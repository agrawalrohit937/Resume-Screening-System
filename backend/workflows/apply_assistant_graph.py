"""
LangGraph wiring for the AI Apply Assistant.

Consolidated Version: Contains the State definition, all Nodes 
(JDAnalyzer, EmailGenerator, CoverLetterGenerator, QualityValidator), 
and the Graph wiring in a single file.

- Uses Groq for structured data extraction and validation.
- Uses Gemini 1.5 Pro for writing high-quality emails and cover letters.
"""

import json
import re
from pathlib import Path
from typing import TypedDict, List
from langgraph.graph import StateGraph, END

# LLM Imports
from langchain_core.prompts import ChatPromptTemplate
from core.llm_client import get_groq_client, gemini_key_pool

from google import genai
import os
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
    retry_count: int
    needs_manual_review: bool


# ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

def _load_prompt(filename: str) -> str:
    """Helper to load prompt templates from the backend/prompts directory."""
    # .parents[1] ya .parents[2] depend karta hai ki file kahan saved hai. 
    # Agar apply_assistant_graph.py 'backend/workflows/' ke andar hai, toh yeh path sahi rahega:
    prompt_path = Path(__file__).resolve().parent.parent / "prompts" / "apply_assistant" / filename
    return prompt_path.read_text(encoding="utf-8")


# ─── NODE 1: JD ANALYZER (GROQ) ──────────────────────────────────────────────

_DEFAULT_ANALYSIS = {"required_skills": [], "seniority": "unspecified", "tone": "formal"}

async def jd_analyzer_node(state: ApplyAssistantState) -> dict:
    """Parses raw job description text into structured requirements."""
    try:
        llm = get_groq_client()
        prompt = _load_prompt("jd_analysis.txt").format(job_description=state.get("job_description", ""))
        response = await llm.ainvoke(prompt)
        jd_analysis = json.loads(response.content)
    except Exception:
        jd_analysis = _DEFAULT_ANALYSIS

    return {"jd_analysis": jd_analysis}


# ─── NODE 2: EMAIL GENERATOR (DIRECT GEMINI CLIENT WITH KEY POOL FALLBACK) ───
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
            model="gemini-2.5-flash",
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

        formatted_body = body.replace("\n\n", "<br><br>").replace("\n", "<br>")
        return {"email_subject": subject, "email_body": formatted_body}

    try:
        return await gemini_key_pool.execute_async_with_fallback(_generate)
    except Exception:
        pass

    # Fallback professional email template
    subject = f"Application for {job_title} at {company_name}"
    body = (
        f"Dear Hiring Manager at {company_name},<br><br>"
        f"I am writing to express my strong interest in the {job_title} position. "
        f"With a solid foundation in software engineering, technical innovation, and collaborative problem solving, "
        f"I am eager to contribute effectively to your team's ongoing success.<br><br>"
        f"Please find my resume attached for your review. I look forward to discussing how my experience aligns with your requirements.<br><br>"
        f"Sincerely,<br>Candidate"
    )
    return {"email_subject": subject, "email_body": body}


# ─── NODE 3: COVER LETTER GENERATOR (DIRECT GEMINI CLIENT WITH KEY POOL FALLBACK) ────
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
            model="gemini-2.5-flash",
            contents=formatted_prompt,
        )

        if response and response.text:
            return {"cover_letter_text": response.text.strip()}
        raise ValueError("Empty response from Gemini")

    try:
        return await gemini_key_pool.execute_async_with_fallback(_generate)
    except Exception:
        pass

    # Fallback professional cover letter template
    cover_letter_text = (
        f"Dear Hiring Manager,\n\n"
        f"I am writing to express my enthusiastic interest in the {job_title} position at {company_name}. "
        f"Having thoroughly reviewed the job description, I am confident that my technical background, problem-solving mindset, "
        f"and passion for building impactful software make me a strong fit for your organization.\n\n"
        f"Throughout my professional journey, I have consistently delivered high-performance solutions and collaborated with cross-functional teams "
        f"to build robust applications. My experience closely matches the key qualifications sought for this position.\n\n"
        f"Thank you for reviewing my application. I welcome the opportunity to discuss my qualifications further in an interview.\n\n"
        f"Sincerely,\nCandidate"
    )
    return {"cover_letter_text": cover_letter_text}


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

def _deterministic_checks(state: ApplyAssistantState) -> list:
    issues = []
    email_body = state.get("email_body", "")
    cover_letter = state.get("cover_letter_text", "")

    if any(re.search(p, email_body, re.IGNORECASE) for p in PLACEHOLDER_PATTERNS):
        issues.append("Email body contains unfilled placeholder text")

    if any(re.search(p, cover_letter, re.IGNORECASE) for p in PLACEHOLDER_PATTERNS):
        issues.append("Cover letter contains unfilled placeholder text")

    if len(email_body) < MIN_EMAIL_BODY_LENGTH:
        issues.append("Email body is too short")
    if len(cover_letter) < MIN_COVER_LETTER_LENGTH:
        issues.append("Cover letter is too short")
    if not state.get("email_subject", "").strip():
        issues.append("Email subject is empty")

    return issues

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
        issues = json.loads(response.content)
        return issues if isinstance(issues, list) else []
    except Exception:
        return []

async def quality_validator_node(state: ApplyAssistantState) -> dict:
    """Validates the generated draft before it reaches the user."""
    issues = _deterministic_checks(state)
    if not issues:
        issues = await _llm_tone_check(state)

    retry_count = state.get("retry_count", 0)
    if issues:
        retry_count += 1

    return {
        "validation_issues": issues,
        "retry_count": retry_count,
        "needs_manual_review": bool(issues) and retry_count >= MAX_RETRIES,
    }

# ─── GRAPH WIRING ────────────────────────────────────────────────────────────

def _route_after_validation(state: ApplyAssistantState) -> str:
    if not state.get("validation_issues"):
        return "end"
    if state.get("needs_manual_review"):
        return "give_up"
    return "retry"

def build_apply_assistant_graph():
    graph = StateGraph(ApplyAssistantState)

    graph.add_node("jd_analyzer", jd_analyzer_node)
    graph.add_node("email_generator", email_generator_node)
    graph.add_node("cover_letter_generator", cover_letter_generator_node)
    graph.add_node("quality_validator", quality_validator_node)

    graph.set_entry_point("jd_analyzer")
    graph.add_edge("jd_analyzer", "email_generator")
    graph.add_edge("email_generator", "cover_letter_generator")
    graph.add_edge("cover_letter_generator", "quality_validator")

    graph.add_conditional_edges(
        "quality_validator",
        _route_after_validation,
        {
            "end": END,
            "retry": "email_generator",   
            "give_up": END,               
        },
    )

    return graph.compile()


apply_assistant_graph = build_apply_assistant_graph()