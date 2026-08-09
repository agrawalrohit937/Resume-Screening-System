"""
HITL Questionnaire Generator Service
─────────────────────────────────────
Generates a maximum of 3 high-value, conversational questions to show the
user BEFORE the enhancer graph runs.

Priority order (highest → lowest):
  1. Missing JD-critical skills — ask if the candidate has experience with
     tools the JD requires but that don't appear anywhere in their resume.
  2. Missing quantitative metrics — ask for a rough number for any recent
     role that has zero digits in its bullet points.
  3. Missing critical date — only if a major experience/project entry is
     completely undated.

UX contract:
  • MAX 3 questions total.  More questions = worse UX = lower completion.
  • Tone: friendly recruiter, not an interrogation.  One sentence each.
  • Each question must be answerable in 1-2 sentences by the candidate.
  • NEVER ask the user to categorize, group, or rank their own skills.
    Skill grouping is the Enhancer Node's job, not the human's.
"""

import json
from typing import Any, Dict, List

import structlog
from core.llm_client import get_groq_client
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)


# ── Pydantic output schema ────────────────────────────────────────────────────

class WizardQuestion(BaseModel):
    """A single conversational question shown to the candidate in the HITL wizard."""
    question_id: str = Field(
        description="Short snake_case identifier, e.g. 'missing_docker_aws'"
    )
    question_text: str = Field(
        description="The full, friendly question shown to the user in the UI."
    )
    category: str = Field(
        description="One of: 'missing_jd_skills' | 'missing_metrics' | 'missing_date'"
    )
    context_hint: str = Field(
        description=(
            "A very short (≤10 words) placeholder / tooltip shown under the "
            "text box, e.g. 'e.g. Used Docker for local dev, not production'"
        )
    )


class WizardQuestionnaire(BaseModel):
    """The complete HITL wizard payload returned to the frontend."""
    questions: List[WizardQuestion] = Field(
        description="Ordered list of 0–3 questions. Empty list = no questions needed."
    )


# ── System prompt ─────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are a helpful career assistant generating a short, friendly questionnaire
to fill data gaps in a candidate's resume before an AI enhancer runs.

Your output MUST be a JSON object matching this exact schema:
{{
  "questions": [
    {{
      "question_id": "<snake_case_id>",
      "question_text": "<full friendly question>",
      "category": "<missing_jd_skills | missing_metrics | missing_date>",
      "context_hint": "<≤10-word placeholder for the input box>"
    }}
  ]
}}

==============================
HARD RULES — READ CAREFULLY
==============================

1. MAXIMUM 3 QUESTIONS.  If you find more than 3 gaps, pick the 3 highest-value
   ones.  Fewer is always better than more.

2. PRIORITY ORDER (evaluate in this order, stop at 3 total):
   a. [missing_jd_skills]   HIGH — JD lists a tool/technology that appears
      NOWHERE in the resume (not even implied).  Ask conversationally whether
      the candidate has any experience with it.
      Example: "The role mentions Docker and Kubernetes. Have you used either
      in any projects or learning — even briefly?"
   b. [missing_metrics]    HIGH — A work experience entry (especially the most
      recent one) has ZERO numbers/percentages in its bullet points.  Ask for
      a rough estimate only.  Do not ask this for internships shorter than
      3 months or for education entries.
      Example: "For your role at MakaanMitra, do you have a rough sense of
      how many API calls the service handled, or how much latency improved?"
   c. [missing_date]       MEDIUM — A significant job or project entry has NO
      date at all (not even a year).  Only ask this if it is completely absent.
      Example: "Roughly when did you work on the YT-Mind project? Even just
      the year helps!"

3. NEVER ask the user to:
   - Categorize, group, rank, or organize their own skills.
   - Describe themselves in a particular style or tone.
   - Provide information already present in the resume (even partially).

4. TONE: Sound like a friendly recruiter or career coach — encouraging, brief,
   lowercase-casual where appropriate.  Each question must be answerable in
   1-2 sentences.

5. If no meaningful gaps exist, return {{"questions": []}}.

6. Return ONLY valid JSON.  No markdown fences, no explanation, no extra text.
"""

_HUMAN_PROMPT = """\
Resume (parsed JSON):
{resume_json}

Job Description:
{jd_text}

JD Skills the candidate is missing (from strict ATS scan):
{strict_missing_keywords}
"""


# ── Main generator function ───────────────────────────────────────────────────

def generate_hitl_questions(
    parsed_resume: Dict[str, Any],
    jd_text: str,
    strict_missing_keywords: List[str],
) -> List[Dict[str, str]]:
    """
    Synchronous entry point (designed to be run in a thread executor from
    the async FastAPI route, matching the pattern used by enhance_resume_content).

    Returns a list of dicts with keys:
        question_id, question_text, category, context_hint

    Returns an empty list if the LLM fails or no gaps are found.
    """
    # Trim the parsed resume to the fields the LLM actually needs — avoids
    # sending raw_text (large) and keeps token cost low.
    resume_summary = _slim_resume(parsed_resume)

    llm = get_groq_client(model_name="llama-3.3-70b-versatile", temperature=0.0)

    prompt = ChatPromptTemplate.from_messages([
        ("system", _SYSTEM_PROMPT),
        ("human", _HUMAN_PROMPT),
    ])

    chain = prompt | llm

    try:
        response = chain.invoke({
            "resume_json": json.dumps(resume_summary, indent=2, ensure_ascii=False),
            "jd_text": jd_text or "Not provided.",
            "strict_missing_keywords": (
                ", ".join(strict_missing_keywords)
                if strict_missing_keywords
                else "None identified."
            ),
        })

        raw_text = (response.content or "").strip()

        # Strip markdown fences if the model wraps despite instructions
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        parsed = json.loads(raw_text)
        questions = parsed.get("questions", [])

        # Validate and cap at 3
        validated: List[Dict[str, str]] = []
        for q in questions[:3]:
            if q.get("question_text") and q.get("question_id"):
                validated.append({
                    "question_id": str(q.get("question_id", "")).strip(),
                    "question_text": str(q.get("question_text", "")).strip(),
                    "category": str(q.get("category", "missing_jd_skills")).strip(),
                    "context_hint": str(q.get("context_hint", "")).strip(),
                })

        logger.info(
            "HITL questionnaire generated",
            question_count=len(validated),
        )
        return validated

    except Exception as exc:
        logger.warning(
            "HITL question generation failed; returning empty questionnaire",
            error=str(exc),
        )
        return []


# ── Helper ────────────────────────────────────────────────────────────────────

def _slim_resume(parsed: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract only the fields the questionnaire LLM needs.
    Excludes raw_text (too large) and any binary/embedding fields.
    """
    def _exp_slim(e):
        if hasattr(e, "model_dump"):
            e = e.model_dump()
        elif hasattr(e, "__dict__"):
            e = dict(e.__dict__)
        return {
            "role": e.get("role") or e.get("title") or "",
            "company": e.get("company") or "",
            "duration": e.get("duration") or e.get("dates") or "",
            "highlights": (e.get("highlights") or e.get("description") or [])[:6],
            "technologies": (e.get("technologies") or [])[:10],
        }

    def _proj_slim(p):
        if hasattr(p, "model_dump"):
            p = p.model_dump()
        elif hasattr(p, "__dict__"):
            p = dict(p.__dict__)
        return {
            "name": p.get("name") or "",
            "duration": p.get("duration") or p.get("dates") or "",
            "highlights": (p.get("highlights") or [])[:4],
            "technologies": (p.get("technologies") or [])[:8],
        }

    skills = parsed.get("skills") or []
    return {
        "full_name": parsed.get("full_name") or "",
        "target_role": parsed.get("target_role") or "",
        "skills": skills[:30],
        "experience": [_exp_slim(e) for e in (parsed.get("experience") or [])[:5]],
        "projects": [_proj_slim(p) for p in (parsed.get("projects") or [])[:5]],
        "education": [
            {
                "institution": (e.get("institution") or "") if isinstance(e, dict) else "",
                "degree": (e.get("degree") or "") if isinstance(e, dict) else "",
                "year": (e.get("year") or "") if isinstance(e, dict) else "",
            }
            for e in (parsed.get("education") or [])[:3]
        ],
    }
