"""
Enhancer Graph — LangGraph-based AI resume enhancement pipeline

v3 changes (HITL wizard):
  - EnhancementState gains `user_verified`: a dict of human-confirmed data
    (links, verified_skills, impact_metrics) collected by the frontend
    wizard BEFORE this graph ever runs.
  - The system prompt now treats that data as ground truth the LLM is
    explicitly allowed (and told) to weave in, since a human — not the
    model — vouched for it.
  - Contact links are still merged deterministically in Python, never left
    to the LLM to retype. URLs are exactly the kind of string an LLM can
    subtly mangle (trailing slash, protocol, typo), and there's no reason
    to risk that when we already have the verbatim, human-provided value.
"""

import json
import re
from typing import TypedDict, List, Optional, Dict, Any

import structlog
from google import genai
from langgraph.graph import StateGraph, END
from core.llm_client import gemini_key_pool
from schemas.enhancement_schema import EnhancedResumeSection

logger = structlog.get_logger(__name__)

# ── State ─────────────────────────────────────────────────────────────────────
class EnhancementState(TypedDict):
    resume_text: str
    jd_text: str
    required_skills: List[str]
    enhanced_data: Optional[dict]
    missing_critical_info: List[str]
    # Exact keywords the ATS engine could NOT find via literal string
    # search (services/scoring_engine.py).
    strict_missing_keywords: List[str]
    # NEW — HITL wizard bundle. Shape (all keys optional):
    #   {
    #     "links": {"linkedin": str|None, "github": str|None, "portfolio": str|None},
    #     "verified_skills": [str, ...],
    #     "impact_metrics": [{"question": str, "answer": str}, ...],
    #   }
    user_verified: Optional[Dict[str, Any]]
    # Raw parsed dict — used ONLY to restore highlights after the LLM call so
    # bullet points are never truncated. Passed in by the route handler.
    original_parsed_dict: Optional[Dict[str, Any]]


# ── Ground-truth formatting helpers ────────────────────────────────────────────
def _format_verified_skills(skills: List[str]) -> str:
    if not skills:
        return "None provided."
    return ", ".join(s.strip() for s in skills if s and s.strip())


def _format_impact_metrics(metrics: List[Dict[str, str]]) -> str:
    if not metrics:
        return "None provided."
    lines = []
    for m in metrics:
        q = (m.get("question") or "").strip()
        a = (m.get("answer") or "").strip()
        if a:
            lines.append(f"- Q: {q}\n  Candidate's answer (true, human-confirmed): {a}")
    return "\n".join(lines) if lines else "None provided."


def _merge_verified_links(enhanced_data: dict, links: Optional[Dict[str, Optional[str]]]) -> dict:
    """
    Deterministically overlay human-confirmed links onto the LLM's output.
    Never trust the LLM to retype a URL verbatim — do it in code instead.
    Only overwrites a field if the user actually provided a non-empty value;
    an omitted/None field leaves whatever the original parsed resume had.
    """
    if not links:
        return enhanced_data

    contact = enhanced_data.get("contact") or {}
    if hasattr(contact, "model_dump"):
        contact = contact.model_dump()
    elif hasattr(contact, "__dict__"):
        contact = dict(contact.__dict__)
    else:
        contact = dict(contact)

    for field in ("linkedin", "github", "portfolio"):
        value = (links.get(field) or "").strip() if links.get(field) else ""
        if value:
            contact[field] = value

    enhanced_data["contact"] = contact
    return enhanced_data


# ── PII Masking Helpers ────────────────────────────────────────────────────────
EMAIL_REGEX = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
PHONE_REGEX = re.compile(r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b')

def mask_pii(text: str) -> tuple[str, Dict[str, str]]:
    """
    Masks emails and phone numbers in raw text before sending to LLM.
    Returns the sanitized text and a map of placeholder -> original value.
    """
    pii_map: Dict[str, str] = {}
    if not text:
        return text, pii_map

    email_idx = 1
    def _mask_email(m):
        nonlocal email_idx
        token = f"[EMAIL_REDACTED_{email_idx}]"
        email_idx += 1
        pii_map[token] = m.group(0)
        return token

    text = EMAIL_REGEX.sub(_mask_email, text)

    phone_idx = 1
    def _mask_phone(m):
        nonlocal phone_idx
        token = f"[PHONE_REDACTED_{phone_idx}]"
        phone_idx += 1
        pii_map[token] = m.group(0)
        return token

    text = PHONE_REGEX.sub(_mask_phone, text)
    return text, pii_map


def unmask_pii(obj: Any, pii_map: Dict[str, str]) -> Any:
    """
    Recursively replaces redaction tokens with original values across dicts, lists, and strings.
    """
    if not pii_map:
        return obj

    if isinstance(obj, str):
        res = obj
        for token, original in pii_map.items():
            if token in res:
                res = res.replace(token, original)
        return res
    elif isinstance(obj, dict):
        return {k: unmask_pii(v, pii_map) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [unmask_pii(item, pii_map) for item in obj]
    return obj


# ── Node 1: Enhance Resume via Gemini LLM ─────────────────────────────────────
async def enhance_resume_content(state: EnhancementState) -> dict:
    """
    Calls Google Gemini LLM (gemini-2.5-flash) with structured JSON output and
    automatic 5-key pool rotation to enhance the resume.
    Applies PII masking before sending data to Gemini, restoring verified contact
    information deterministically post-generation.
    """
    user_verified = state.get("user_verified") or {}
    verified_skills = user_verified.get("verified_skills") or []
    impact_metrics = user_verified.get("impact_metrics") or []
    verified_links = user_verified.get("links") or None

    req_skills_str = ", ".join(state.get("required_skills", [])) if state.get("required_skills") else "Not provided"
    strict_missing_str = ", ".join(state.get("strict_missing_keywords", [])) if state.get("strict_missing_keywords") else "None provided"
    ver_skills_str = _format_verified_skills(verified_skills)
    imp_metrics_str = _format_impact_metrics(impact_metrics)

    # Mask candidate PII before prompt synthesis
    sanitized_resume_text, pii_map = mask_pii(state.get("resume_text", ""))

    prompt_text = f"""You are an Expert ATS Resume Optimizer. Your ONLY job is to output a clean JSON representing the candidate's resume, optimized to achieve a 95%+ ATS score against the provided Job Description (JD).

=========================
STRICT ETHICAL GUARDRAILS (ZERO HALLUCINATION)
=========================
1. DO NOT invent, fabricate, or add any skills, tools, degrees, metrics, or years of experience that the candidate does not actually possess. 
2. Ensure the output remains 100% truthful to the candidate's original background.

=========================
OPTIMIZATION STRATEGY (HOW TO MAXIMIZE SCORE)
=========================
1. **Keyword Unpacking:** If the candidate lists a broad skill (e.g., "MERN"), explicitly unpack it into the JD's required keywords (e.g., "MongoDB, Express.js, React.js, Node.js") naturally within their experience or summary.
2. **Semantic Synonyms:** Replace the candidate's casual terminology with the exact professional keywords used in the JD (e.g., change "made an app" to "architected an application").
3. **STAR Method Rewriting:** You MUST rewrite the `highlights` (bullet points) in the `experience` and `projects` arrays. Convert weak, short sentences into strong, context-rich bullet points using Action Verbs. Focus on the *how* and *what* by weaving in the `strict_missing_keywords`.
4. **Formatting Internships:** Format internships formally under the `experience` array so ATS parsers recognize them as valid professional experience.
5. **Skill Categorization:** Group skills into 4 to 6 specialized domains (e.g., "Generative AI", "Backend Development") with exactly 6 to 10 curated skills per category. Include all Human-Verified Ground Truth skills.

=========================
INPUT DATA
=========================
Resume Raw Text: {sanitized_resume_text}
Job Description: {state.get("jd_text", "")}
Required Skills: {req_skills_str}
Strict-ATS Missing Keywords: {strict_missing_str}

Human-Verified Ground Truth:
Verified Skills: {ver_skills_str}
Impact Metrics:
{imp_metrics_str}

Output ONLY valid JSON matching this exact schema:
{{
  "contact": {{"full_name": "", "email": "", "phone": "", "location": "", "linkedin": "", "github": "", "portfolio": ""}},
  "target_role": "",
  "summary": "",
  "skills": {{"Category Name": ["skill1", "skill2"]}},
  "experience": [{{"company": "", "role": "", "dates": "", "location": "", "highlights": [""]}}],
  "projects": [{{"title": "", "link": "", "github": "", "technologies": ["tech1"], "dates": "", "highlights": [""]}}],
  "education": [{{"institution": "", "degree": "", "dates": "", "location": "", "details": ""}}],
  "certifications": [""]
}}
"""

    async def _enhance_with_gemini(client: genai.Client):
        if not client:
            raise ValueError("No Gemini API key available")
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt_text,
            config={"response_mime_type": "application/json"}
        )
        if not response or not response.text:
            raise ValueError("Empty response from Gemini")

        raw_text = response.text.strip()
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)

        return json.loads(raw_text)

    try:
        enhanced_dict = await gemini_key_pool.execute_async_with_fallback(_enhance_with_gemini)
    except Exception as e:
        logger.error("Gemini LLM enhancement failed after retries", error=str(e))
        raise RuntimeError("Unable to enhance the resume using the Gemini AI model.") from e

    # Restore any masked PII throughout the generated JSON structure
    enhanced_dict = unmask_pii(enhanced_dict, pii_map)

    # Ensure highlights in experience and projects are clean lists
    for exp in enhanced_dict.get("experience", []):
        if isinstance(exp, dict) and isinstance(exp.get("highlights"), str):
            exp["highlights"] = [exp["highlights"]]
        elif isinstance(exp, dict) and not exp.get("highlights"):
            exp["highlights"] = []

    for proj in enhanced_dict.get("projects", []):
        if isinstance(proj, dict) and isinstance(proj.get("highlights"), str):
            proj["highlights"] = [proj["highlights"]]
        elif isinstance(proj, dict) and not proj.get("highlights"):
            proj["highlights"] = []

    # Deterministically ensure contact details (email, phone) are accurately preserved
    orig_contact = (state.get("original_parsed_dict") or {}).get("contact") or {}
    contact = enhanced_dict.get("contact") or {}
    if not isinstance(contact, dict):
        contact = dict(contact) if hasattr(contact, "__dict__") else {}

    if orig_contact.get("email") and (not contact.get("email") or "REDACTED" in str(contact.get("email"))):
        contact["email"] = orig_contact["email"]
    if orig_contact.get("phone") and (not contact.get("phone") or "REDACTED" in str(contact.get("phone"))):
        contact["phone"] = orig_contact["phone"]

    enhanced_dict["contact"] = contact

    # Deterministic, LLM-free merge of confirmed links
    enhanced_dict = _merge_verified_links(enhanced_dict, verified_links)

    return {"enhanced_data": enhanced_dict}

# ── Node 2: Validate Resume Quality ───────────────────────────────────────────
def validate_resume_quality(state: EnhancementState) -> dict:
    enhanced = state.get("enhanced_data") or {}
    missing = []
    for exp in enhanced.get("experience", []):
        highlights_text = " ".join(exp.get("highlights", []))
        if not any(char.isdigit() for char in highlights_text):
            company = exp.get("company", "unknown company")
            missing.append(f"Add metrics/impact for your role at {company}")
    return {"missing_critical_info": missing}

# ── Graph Assembly ─────────────────────────────────────────────────────────────
workflow = StateGraph(EnhancementState)
workflow.add_node("enhancer", enhance_resume_content)
workflow.add_node("validator", validate_resume_quality)
workflow.set_entry_point("enhancer")
workflow.add_edge("enhancer", "validator")
workflow.add_edge("validator", END)

enhancement_graph = workflow.compile()