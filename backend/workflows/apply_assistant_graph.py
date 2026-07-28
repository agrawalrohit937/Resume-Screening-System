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
from core.llm_client import get_groq_client  # Your existing Groq factory

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
    llm = get_groq_client()
    prompt = _load_prompt("jd_analysis.txt").format(job_description=state["job_description"])

    response = await llm.ainvoke(prompt)
    try:
        jd_analysis = json.loads(response.content)
    except (json.JSONDecodeError, AttributeError):
        jd_analysis = _DEFAULT_ANALYSIS

    return {"jd_analysis": jd_analysis}


# ─── NODE 2: EMAIL GENERATOR (GEMINI) ────────────────────────────────────────

# ─── NODE 2: EMAIL GENERATOR (DIRECT GEMINI CLIENT) ────────────────────────
async def email_generator_node(state: ApplyAssistantState) -> dict:
    """Drafts the application email subject + body using Gemini Direct SDK."""
    client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))
    
    raw_prompt_text = _load_prompt("email_generation.txt")
    if not raw_prompt_text.strip():
        job_title = state.get("job_title", "Position")
        company_name = state.get("company_name", "Company")
        return {
            "email_subject": f"Application for {job_title} at {company_name}",
            "email_body": "Error: The prompt template file is empty."
        }

    formatted_prompt = f"""You are an expert AI career assistant. Output ONLY the requested professional text. Do not include any meta-commentary.

{raw_prompt_text.format(
    resume_text=state.get("resume_text", "No resume provided."),
    company_name=state.get("company_name", "Unknown Company"),
    job_title=state.get("job_title", "Unknown Role"),
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
        subject = f"Application for {state.get('job_title', 'Role')} at {state.get('company_name', 'Company')}"
        body = content

    # 👇 CONVERT NEWLINES TO HTML BREAKS FOR PROPER GMAIL FORMATTING
    formatted_body = body.replace("\n\n", "<br><br>").replace("\n", "<br>")

    return {"email_subject": subject, "email_body": formatted_body}


# ─── NODE 3: COVER LETTER GENERATOR (DIRECT GEMINI CLIENT) ─────────────────
async def cover_letter_generator_node(state: ApplyAssistantState) -> dict:
    """Drafts the cover letter BODY TEXT using Gemini Direct SDK."""
    client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))
    
    raw_prompt_text = _load_prompt("cover_letter.txt")
    if not raw_prompt_text.strip():
        return {"cover_letter_text": "Error: The prompt template file is empty."}

    formatted_prompt = f"""You are an expert AI career assistant. Output ONLY the requested professional text. Do not include any meta-commentary.

{raw_prompt_text.format(
    resume_text=state.get("resume_text", "No resume provided."),
    company_name=state.get("company_name", "Unknown Company"),
    job_title=state.get("job_title", "Unknown Role"),
    job_description=state.get("job_description", "No JD provided."),
    jd_analysis=state.get("jd_analysis", {}),
)}"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=formatted_prompt,
    )

    return {"cover_letter_text": response.text.strip()}


# ─── NODE 4: QUALITY VALIDATOR (GROQ) ────────────────────────────────────────

PLACEHOLDER_PATTERNS = [
    r"\[.*?\]",           # [Your Name], [Company], etc.
    r"\{\{.*?\}\}",       # unfilled template variables
    r"\bLorem ipsum\b",
    r"\bTODO\b",
]

MIN_EMAIL_BODY_LENGTH = 150
MIN_COVER_LETTER_LENGTH = 400
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
    llm = get_groq_client()
    prompt = _load_prompt("quality_validation.txt").format(
        job_description=state["job_description"],
        email_body=state.get("email_body", ""),
        cover_letter_text=state.get("cover_letter_text", ""),
    )
    response = await llm.ainvoke(prompt)
    try:
        issues = json.loads(response.content)
        return issues if isinstance(issues, list) else []
    except (json.JSONDecodeError, AttributeError):
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