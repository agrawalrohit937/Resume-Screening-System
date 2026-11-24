"""LangGraph workflow for generating and validating an application draft."""

import asyncio
import re
from pathlib import Path
from typing import TypedDict, List
from langgraph.graph import StateGraph, END

try:
    from google import genai
except Exception:
    genai = None

from core.llm_client import gemini_key_pool, get_groq_client
from utils.json_utils import parse_llm_json
import structlog

logger = structlog.get_logger(__name__)
# ─── STATE DEFINITION ────────────────────────────────────────────────────────

class ApplyAssistantState(TypedDict, total=False):
    # ---- inputs, supplied by apply_assistant_service.py before invoke() ----
    resume_text: str
    ats_result: dict              # {score, matched_keywords, missing_keywords, result_id}
    company_name: str
    job_title: str
    hr_email: str
    job_description: str

    # ---- populated by nodes as the graph runs ----
    jd_analysis: dict
    email_subject: str
    email_body: str
    cover_letter_text: str

    validation_issues: List[str]
    email_issues: List[str]
    cl_issues: List[str]
    retry_count: int
    needs_manual_review: bool


# ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

def _load_prompt(filename: str) -> str:
    """Helper to load prompt templates from the backend/prompts directory."""
    # .parents[1] ya .parents[2] depend karta hai ki file kahan saved hai. 
    # Agar apply_assistant_graph.py 'backend/workflows/' ke andar hai, toh yeh path sahi rahega:
    prompt_path = Path(__file__).resolve().parent.parent / "prompts" / "apply_assistant" / filename
    return prompt_path.read_text(encoding="utf-8")


# ─── NODE 1: JD ANALYZER ─────────────────────────────────────────────────────

_DEFAULT_ANALYSIS = {"required_skills": [], "seniority": "unspecified", "tone": "formal"}

async def jd_analyzer_node(state: ApplyAssistantState) -> dict:
    """Parses raw job description text into structured requirements."""
    llm = get_groq_client()
    prompt = _load_prompt("jd_analysis.txt").format(job_description=state.get("job_description", ""))
    response = await llm.ainvoke(prompt)
    jd_analysis = parse_llm_json(response.content, default=None)
    if not isinstance(jd_analysis, dict):
        raise ValueError("JD analysis returned invalid JSON")
    return {"jd_analysis": jd_analysis}


# ─── NODE 2: EMAIL GENERATOR ────────────────────────────────────────────────
async def email_generator_node(state: ApplyAssistantState) -> dict:
    """Drafts the application email subject + body using Gemini Direct SDK with automatic key pool rotation."""
    job_title = state.get("job_title", "Position")
    company_name = state.get("company_name", "Company")

    async def _generate(client: genai.Client):
        if not client:
            raise ValueError("No Gemini API key available")
        raw_prompt_text = _load_prompt("email_generation.txt")
        if not raw_prompt_text.strip():
            raise ValueError("Empty email prompt template")

        formatted_prompt = f"""You are an expert AI career assistant. Output ONLY the requested professional text. Do not include any meta-commentary.

{raw_prompt_text.format(
    resume_text=state.get("resume_text", "No resume provided."),
    company_name=company_name,
    job_title=job_title,
    job_description=state.get("job_description", "No JD provided."),
    jd_analysis=state.get("jd_analysis", {}),
    ats_result=state.get("ats_result", {}),
    previous_issues=state.get("validation_issues", []) or "none",
)}"""
        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=formatted_prompt,
        )

        content = response.text.strip()

        if content.lower().startswith("subject:"):
            first_line, _, rest = content.partition("\n")
            subject = first_line.split(":", 1)[1].strip()
            body = rest.strip()
        else:
            subject = f"Application for {job_title} at {company_name}"
            body = content

        # Clean any raw <br> tags into clean plain-text newlines
        clean_body = re.sub(r"<br\s*/?>", "\n", body, flags=re.IGNORECASE).strip()
        return {"email_subject": subject, "email_body": clean_body}

    try:
        return await asyncio.wait_for(
            gemini_key_pool.execute_async_with_fallback(_generate),
            timeout=12.0
        )
    except Exception as gemini_err:
        logger.warning("Gemini cover letter generation failed or timed out, using Groq fallback...", error=str(gemini_err))
        # Fallback to Groq if Gemini has 503 or quota outages
        try:
            llm = get_groq_client()
            raw_prompt_text = _load_prompt("email_generation.txt")
            formatted_prompt = f"""You are an expert AI career assistant. Output ONLY the requested professional text. Do not include any meta-commentary.

{raw_prompt_text.format(
    resume_text=state.get("resume_text", "No resume provided."),
    company_name=company_name,
    job_title=job_title,
    job_description=state.get("job_description", "No JD provided."),
    jd_analysis=state.get("jd_analysis", {}),
    ats_result=state.get("ats_result", {}),
    previous_issues=state.get("validation_issues", []) or "none",
)}"""
            res = await llm.ainvoke(formatted_prompt)
            content = str(res.content).strip()
            if content.lower().startswith("subject:"):
                first_line, _, rest = content.partition("\n")
                subject = first_line.split(":", 1)[1].strip()
                body = rest.strip()
            else:
                subject = f"Application for {job_title} at {company_name}"
                body = content
            clean_body = re.sub(r"<br\s*/?>", "\n", body, flags=re.IGNORECASE).strip()
            return {"email_subject": subject, "email_body": clean_body}
        except Exception:
            raise gemini_err



# ─── NODE 3: COVER LETTER GENERATOR ─────────────────────────────────────────
async def cover_letter_generator_node(state: ApplyAssistantState) -> dict:
    """Drafts the cover letter BODY TEXT using Gemini Direct SDK with automatic key pool rotation."""
    job_title = state.get("job_title", "Position")
    company_name = state.get("company_name", "Company")

    async def _generate(client: genai.Client):
        if not client:
            raise ValueError("No Gemini API key available")
        raw_prompt_text = _load_prompt("cover_letter.txt")
        if not raw_prompt_text.strip():
            raise ValueError("Empty cover letter prompt template")

        formatted_prompt = f"""You are an expert AI career assistant. Output ONLY the requested professional text. Do not include any meta-commentary.

{raw_prompt_text.format(
    resume_text=state.get("resume_text", "No resume provided."),
    company_name=company_name,
    job_title=job_title,
    job_description=state.get("job_description", "No JD provided."),
    jd_analysis=state.get("jd_analysis", {}),
)}"""

        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=formatted_prompt,
        )

        if response and response.text:
            return {"cover_letter_text": response.text.strip()}
        raise ValueError("Empty response from Gemini")

    try:
        return await asyncio.wait_for(
            gemini_key_pool.execute_async_with_fallback(_generate),
            timeout=12.0
        )
    except Exception as gemini_err:
        logger.warning("Gemini cover letter generation failed or timed out, using Groq fallback...", error=str(gemini_err))
        # Fallback to Groq if Gemini has 503 or quota outages
        try:
            llm = get_groq_client()
            raw_prompt_text = _load_prompt("cover_letter.txt")
            formatted_prompt = f"""You are an expert AI career assistant. Output ONLY the requested professional text. Do not include any meta-commentary.

{raw_prompt_text.format(
    resume_text=state.get("resume_text", "No resume provided."),
    company_name=company_name,
    job_title=job_title,
    job_description=state.get("job_description", "No JD provided."),
    jd_analysis=state.get("jd_analysis", {}),
)}"""
            res = await llm.ainvoke(formatted_prompt)
            content = str(res.content).strip()
            if content:
                return {"cover_letter_text": content}
            raise ValueError("Empty response from Groq")
        except Exception:
            raise gemini_err


# ─── NODE 4: QUALITY VALIDATOR (GROQ) ────────────────────────────────────────

PLACEHOLDER_PATTERNS = [
    r"\[.*?\]",           # [Your Name], [Company], etc.
    r"\{\{.*?\}\}",       # unfilled template variables
    r"\bLorem ipsum\b",
    r"\bTODO\b",
]

MIN_EMAIL_BODY_LENGTH = 100
MIN_COVER_LETTER_LENGTH = 250
MAX_RETRIES = 2

def _deterministic_checks(state: ApplyAssistantState) -> tuple[list, list]:
    email_issues = []
    cl_issues = []
    email_body = state.get("email_body", "")
    cover_letter = state.get("cover_letter_text", "")

    if any(re.search(p, email_body, re.IGNORECASE) for p in PLACEHOLDER_PATTERNS):
        email_issues.append("Email body contains unfilled placeholder text")

    if any(re.search(p, cover_letter, re.IGNORECASE) for p in PLACEHOLDER_PATTERNS):
        cl_issues.append("Cover letter contains unfilled placeholder text")

    if len(email_body) < MIN_EMAIL_BODY_LENGTH:
        email_issues.append("Email body is too short")
    if len(cover_letter) < MIN_COVER_LETTER_LENGTH:
        cl_issues.append("Cover letter is too short")
    if not state.get("email_subject", "").strip():
        email_issues.append("Email subject is empty")

    return email_issues, cl_issues

async def _llm_tone_check(state: ApplyAssistantState) -> list:
    """Only reached when deterministic checks pass. Uses Groq for fast JSON validation."""
    try:
        llm = get_groq_client()
        prompt = _load_prompt("quality_validation.txt").format(
            job_description=state.get("job_description", ""),
            email_body=state.get("email_body", ""),
            cover_letter_text=state.get("cover_letter_text", ""),
        )
        response = await llm.ainvoke(prompt)
        issues = parse_llm_json(response.content, default=[])
        return issues if isinstance(issues, list) else []
    except Exception as exc:
        return [f"Quality validation unavailable: {exc}"]

async def quality_validator_node(state: ApplyAssistantState) -> dict:
    """Validates the generated draft before it reaches the user."""
    email_issues, cl_issues = _deterministic_checks(state)
    all_issues = list(email_issues) + list(cl_issues)
    if not all_issues:
        llm_issues = await _llm_tone_check(state)
        for iss in llm_issues:
            all_issues.append(iss)
            if "cover letter" in iss.lower():
                cl_issues.append(iss)
            else:
                email_issues.append(iss)

    retry_count = state.get("retry_count", 0)
    if all_issues:
        retry_count += 1

    return {
        "validation_issues": all_issues,
        "email_issues": email_issues,
        "cl_issues": cl_issues,
        "retry_count": retry_count,
        "needs_manual_review": bool(all_issues) and retry_count >= MAX_RETRIES,
    }

# ─── GRAPH WIRING ────────────────────────────────────────────────────────────

def _route_after_validation(state: ApplyAssistantState):
    if not state.get("validation_issues"):
        return "end"
    if state.get("needs_manual_review"):
        return "give_up"

    has_email_err = bool(state.get("email_issues"))
    has_cl_err = bool(state.get("cl_issues"))

    # Selective targeted retry: only re-run the node that had errors!
    if has_email_err and has_cl_err:
        return ["email_generator", "cover_letter_generator"]
    elif has_email_err:
        return "email_generator"
    elif has_cl_err:
        return "cover_letter_generator"
    return ["email_generator", "cover_letter_generator"]


def build_apply_assistant_graph():
    graph = StateGraph(ApplyAssistantState)

    # 1. Register Nodes
    graph.add_node("jd_analyzer", jd_analyzer_node)
    graph.add_node("email_generator", email_generator_node)
    graph.add_node("cover_letter_generator", cover_letter_generator_node)
    graph.add_node("quality_validator", quality_validator_node)

    # 2. Entry & Native Parallel Fan-Out
    graph.set_entry_point("jd_analyzer")
    graph.add_edge("jd_analyzer", "email_generator")
    graph.add_edge("jd_analyzer", "cover_letter_generator")

    # 3. Native Parallel Fan-In to Validator
    graph.add_edge("email_generator", "quality_validator")
    graph.add_edge("cover_letter_generator", "quality_validator")

    # 4. Selective Self-Correction Loop
    graph.add_conditional_edges(
        "quality_validator",
        _route_after_validation,
        {
            "email_generator": "email_generator",
            "cover_letter_generator": "cover_letter_generator",
            "end": END,
            "give_up": END,
        },
    )

    return graph.compile()


apply_assistant_graph = build_apply_assistant_graph()