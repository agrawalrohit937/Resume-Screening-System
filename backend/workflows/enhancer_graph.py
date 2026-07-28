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

from groq import RateLimitError
from langgraph.graph import StateGraph, END
from typing import TypedDict, List, Optional, Dict, Any
import re

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from schemas.enhancement_schema import EnhancedResumeSection
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

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

# ── Retry Logic for LLM Calls ──────────────────────────────────────────────────
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(RateLimitError),
    reraise=True
)
async def _call_llm_with_retry(chain, input_data):
    """Calls the LLM chain with retry capability for rate limits."""
    return await chain.ainvoke(input_data)



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


# ── Node 1: Enhance Resume via LLM ────────────────────────────────────────────
async def enhance_resume_content(state: EnhancementState) -> dict:
    """
    Calls Groq LLM with structured output (full EnhancedResumeSection) to
    enhance the resume.  The aggressive STRICT PARSER MODE prompt instructs
    the model to copy every bullet point verbatim and never truncate arrays.
    Falls back with a RuntimeError if the LLM fails after retries.
    """
    llm = ChatGroq(model_name="llama-3.3-70b-versatile", temperature=0.0)  # 0.0 = max determinism
    structured_llm = llm.with_structured_output(EnhancedResumeSection)

    prompt = ChatPromptTemplate.from_messages([
    (
    "system",
    """
You are an ATS Resume Data Extraction and Optimization API. Your ONLY job is to output a
clean JSON representing the candidate's resume while upgrading the professional summary
and skills list.

=========================
STRICT PARSER MODE (DO NOT TRUNCATE ARRAYS)
=========================
1. You are acting as a strict JSON structuring engine.
2. You MUST extract and map EVERY single project, EVERY single education entry, and
   EVERY single work experience from the raw text into the JSON schema. Omitting even
   one entry is a critical failure.
3. For the `highlights` arrays in Experience and Projects: You are FORBIDDEN from
   summarizing or dropping bullet points. You must copy every single bullet point from
   the raw text exactly as written. If the raw text has 4 bullet points for a project,
   your JSON array MUST contain exactly 4 strings. Count them before you output.
4. DO NOT drop contact information (email, phone, linkedin, github, portfolio).
5. Certifications must be output as a flat list of strings — copy them verbatim.
6. Skills must be a flat list of strings without any category prefixes. Output just the raw skill names.

=========================
CRITICAL: ATS SCORE MUST NEVER DECREASE
=========================
- You MUST preserve EVERY single skill, technology, tool, programming language, framework,
  and domain keyword from the original resume. NOTHING may be removed.
- The ATS match score of the output MUST be >= the original. You may ADD keywords from
  the JD and from the Human-Verified Ground Truth, but you must NEVER drop any existing
  keyword.
- This is the single most important rule. Every keyword that existed in the original
  resume must also exist in the output — even if it seems redundant, minor, or obvious.

=========================
CRITICAL RULE — ZERO DATA DELETION
=========================
- You MUST preserve every Experience, Project, and Education entry EXACTLY.
- DO NOT summarize, shorten, merge, or remove ANY bullet points.
- Every technical term, metric, tool name, and domain-specific jargon MUST survive in your output.

=========================
PRESERVE UNIQUE PROFESSIONAL IDENTITY (UNIVERSAL RULE)
=========================
- Carefully analyze the candidate's raw text to determine their exact profession, seniority level, and specific niche.
- NEVER dilute highly specialized expertise into generic titles. For example:
  * If they are an "Embedded Systems C++ Engineer", do NOT change it to "Software Developer".
  * If they are a "Pediatric ICU Nurse", do NOT change it to "Healthcare Professional".
  * If they are a "B2B SaaS Enterprise Sales Executive", do NOT change it to "Sales Representative".
- You may add keywords from the Job Description to make it ATS-friendly, but you MUST fiercely protect their core specialization and domain-specific terminology.

=========================
SKILLS HANDLING (CATEGORISED DICTIONARY)
=========================
- Output the `skills` field as a JSON object (dictionary), NOT a list.
- Keys are logical category names that make sense for this candidate's specific industry (e.g., "Design Tools", "Frontend", "Medical Procedures", "Accounting Software").
- Values are arrays of raw skill name strings.
- YOU MUST INCLUDE EVERY SKILL FROM THE ORIGINAL RESUME in the output skills dictionary.
  Do not drop any skill, even if you think it is not relevant to the JD.
- Inject JD missing keywords into the most logical category only if the candidate has clear evidence for them.

=========================
HUMAN-VERIFIED DATA (MANDATORY ENFORCEMENT)
=========================
The sections below contain Human-Verified Ground Truth data that the user explicitly
confirmed. You MUST treat this data as factual and include it in the output.

- Verified Skills: The user confirmed they possess these skills. You MUST include EVERY
  single verified skill in the `skills` dictionary under the most appropriate category.
  Do not skip any. Never drop a verified skill.
- Impact Metrics: The user provided these real metrics. Append ONE new bullet point at
  the end of the most relevant Experience or Project highlights list for each metric.
  Do not alter existing bullets — only append.

=========================
YOU MUST IMPROVE (only these fields)
=========================
1. Write a professional headline (`target_role`). It MUST accurately reflect their specific niche and experience level based on their raw resume, rather than defaulting to generic industry titles.
2. Rewrite the Professional Summary to be highly ATS-friendly and incorporate missing keywords, but DO NOT erase their unique achievements and professional identity.
3. Populate `skills` as a categorised dictionary, reordering by JD relevance.

Return ONLY valid JSON matching the EnhancedResumeSection schema.
"""
    ),
    (
    "human",
    """
Resume Raw Text:
{resume_text}

Job Description:
{jd_text}

Required Skills:
{required_skills}

Strict-ATS Missing Keywords:
{strict_missing_keywords}

Human-Verified Ground Truth (YOU MUST INCLUDE ALL OF THESE IN THE OUTPUT):
Verified Skills (user confirmed they possess these — include every one): {verified_skills}
Impact Metrics:
{impact_metrics}
"""
    )
    ])

    chain = prompt | structured_llm

    user_verified = state.get("user_verified") or {}
    verified_skills = user_verified.get("verified_skills") or []
    impact_metrics = user_verified.get("impact_metrics") or []
    verified_links = user_verified.get("links") or None

    try:
        # Retry-enabled function call
        result = await _call_llm_with_retry(
            chain,
            {
                "resume_text": state["resume_text"],
                "jd_text": state.get("jd_text", ""),
                "required_skills": ", ".join(state.get("required_skills", []))
                    if state.get("required_skills")
                    else "Not provided",
                "strict_missing_keywords": ", ".join(state.get("strict_missing_keywords", []))
                    if state.get("strict_missing_keywords")
                    else "None provided",
                "verified_skills": _format_verified_skills(verified_skills),
                "impact_metrics": _format_impact_metrics(impact_metrics),
            },
        )
        enhanced_dict = result.model_dump()

    except Exception as e:
        print(f"[EnhancerGraph] LLM Enhancement Error after retries: {e}")
        raise RuntimeError(
            "Unable to enhance the resume using the AI model."
        ) from e

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