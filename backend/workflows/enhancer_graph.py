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

from google import genai
from langgraph.graph import StateGraph, END
from core.llm_client import gemini_key_pool
from schemas.enhancement_schema import EnhancedResumeSection

# ── State ─────────────────────────────────────────────────────────────────────
class EnhancementState(TypedDict):
    resume_text: str
    jd_text: str
    required_skills: List[str]
    enhanced_data: Optional[dict]
    missing_critical_info: List[str]
    # Exact keywords the Strict ATS engine could NOT find via literal string
    # search (services/strict_ats_service.py).
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


# ── Node 1: Enhance Resume via Gemini LLM ─────────────────────────────────────
async def enhance_resume_content(state: EnhancementState) -> dict:
    """
    Calls Google Gemini LLM (gemini-1.5-flash) with structured JSON output and
    automatic 5-key pool rotation to enhance the resume.
    """
    user_verified = state.get("user_verified") or {}
    verified_skills = user_verified.get("verified_skills") or []
    impact_metrics = user_verified.get("impact_metrics") or []
    verified_links = user_verified.get("links") or None

    req_skills_str = ", ".join(state.get("required_skills", [])) if state.get("required_skills") else "Not provided"
    strict_missing_str = ", ".join(state.get("strict_missing_keywords", [])) if state.get("strict_missing_keywords") else "None provided"
    ver_skills_str = _format_verified_skills(verified_skills)
    imp_metrics_str = _format_impact_metrics(impact_metrics)

    prompt_text = f"""You are an ATS Resume Data Extraction and Optimization API. Your ONLY job is to output a clean JSON representing the candidate's resume while upgrading the professional summary and skills list.

=========================
STRICT PARSER MODE (DO NOT TRUNCATE ARRAYS)
=========================
1. You are acting as a strict JSON structuring engine.
2. You MUST extract and map EVERY single project, EVERY single education entry, and EVERY single work experience from the raw text into the JSON schema. Omitting even one entry is a critical failure.
3. For the `highlights` arrays in Experience and Projects: Copy every single bullet point from the raw text exactly as written.
4. DO NOT drop contact information (email, phone, linkedin, github, portfolio).
5. Certifications must be output as a flat list of strings — copy them verbatim.
6. Output the `skills` field as a JSON object (dictionary) mapping logical categories (e.g. "Programming Languages", "Frameworks & Tools") to arrays of skill strings.
7. For projects: Extract and preserve BOTH the Live Demo URL ('link') and GitHub Repository URL ('github'). Never drop project links.

=========================
CRITICAL: ATS SCORE MUST NEVER DECREASE
=========================
- You MUST preserve EVERY single skill, technology, tool, programming language, framework, and domain keyword from the original resume. NOTHING may be removed.
- Include all Human-Verified Ground Truth skills in the `skills` dictionary.

=========================
YOU MUST IMPROVE (only these fields)
=========================
1. Write a professional headline (`target_role`) matching their specific niche.
2. Rewrite the Professional Summary to be highly ATS-friendly and incorporate missing keywords without erasing identity.
3. Populate `skills` as a categorised dictionary, reordering by JD relevance.

=========================
INPUT DATA
=========================
Resume Raw Text:
{state["resume_text"]}

Job Description:
{state.get("jd_text", "")}

Required Skills:
{req_skills_str}

Strict-ATS Missing Keywords:
{strict_missing_str}

Human-Verified Ground Truth:
Verified Skills: {ver_skills_str}
Impact Metrics:
{imp_metrics_str}

Output ONLY valid JSON matching this schema structure:
{{
  "contact": {{"full_name": "", "email": "", "phone": "", "location": "", "linkedin": "", "github": "", "portfolio": ""}},
  "target_role": "",
  "summary": "",
  "skills": {{"Category Name": ["skill1", "skill2"]}},
  "experience": [{{"company": "", "role": "", "dates": "", "location": "", "highlights": [""]}}],
  "projects": [{{"title": "", "link": "", "github": "", "technologies": ["tech1", "tech2"], "dates": "", "highlights": [""]}}],
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
        print(f"[EnhancerGraph] Gemini LLM Enhancement Error after retries: {e}")
        raise RuntimeError("Unable to enhance the resume using the Gemini AI model.") from e

    # ── Python Bullet Restore ─────────────────────────────────────────────────
    # The LLM may truncate highlights even with strict prompting.
    # We forcefully overwrite `highlights` in every experience and project entry
    # with the exact originals from the parsed resume — the LLM is only trusted
    # for target_role, summary, and the categorised skills dict.
    original = state.get("original_parsed_dict") or {}

    orig_experience = original.get("experience") or []
    llm_experience = enhanced_dict.get("experience") or []
    for i, llm_exp in enumerate(llm_experience):
        # Match by index — if the LLM dropped entries the list may be shorter;
        # only restore where an original entry exists at the same position.
        if i < len(orig_experience):
            orig_highlights = orig_experience[i].get("highlights") if isinstance(orig_experience[i], dict) else getattr(orig_experience[i], "highlights", None)
            if orig_highlights:
                llm_exp["highlights"] = list(orig_highlights)
    enhanced_dict["experience"] = llm_experience

    orig_projects = original.get("projects") or []
    llm_projects = enhanced_dict.get("projects") or []
    for i, llm_proj in enumerate(llm_projects):
        if i < len(orig_projects):
            orig_highlights = orig_projects[i].get("highlights") if isinstance(orig_projects[i], dict) else getattr(orig_projects[i], "highlights", None)
            if orig_highlights:
                llm_proj["highlights"] = list(orig_highlights)
    enhanced_dict["projects"] = llm_projects

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