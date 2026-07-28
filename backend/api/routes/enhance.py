"""
Enhance Routes — AI-powered resume enhancement
"""

import asyncio
import os
import uuid
from concurrent.futures import ThreadPoolExecutor

from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import get_current_user, get_resume_repo
from models.user_model import UserModel
from repositories.resume_repo import ResumeRepository
from schemas.resume_schema import EnhanceResumeRequest, EnhanceResumeResponse
from services.pdf_generator_service import PDFGeneratorService
from services.hitl_questionnaire_service import generate_hitl_questions
from workflows.enhancer_graph import enhance_resume_content

router = APIRouter()


def _temp_storage_dir() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "temp_storage"))

# PDF Generator instance
pdf_generator = PDFGeneratorService()

# Thread pool for running sync LLM calls without blocking the event loop
_executor = ThreadPoolExecutor(max_workers=4)


def _serialize_user_verified(payload: EnhanceResumeRequest) -> dict:
    """
    Turn payload.user_verified (a UserVerifiedData pydantic model, or None)
    into the plain dict shape enhancer_graph.py expects. Written defensively
    with getattr()/model_dump() so this route doesn't hard-fail if the
    schema field hasn't been added yet — it just behaves as "no HITL data".
    """
    user_verified = getattr(payload, "user_verified", None)
    if user_verified is None:
        return {}

    data = user_verified.model_dump() if hasattr(user_verified, "model_dump") else dict(user_verified)

    links = data.get("links") or {}
    if hasattr(links, "model_dump"):
        links = links.model_dump()

    return {
        "links": {
            "linkedin": links.get("linkedin"),
            "github": links.get("github"),
            "portfolio": links.get("portfolio"),
        } if links else None,
        "verified_skills": data.get("verified_skills") or [],
        "impact_metrics": [
            {"question": m.get("question", ""), "answer": m.get("answer", "")}
            for m in (data.get("impact_metrics") or [])
        ],
    }


# ── /enhance/resume ────────────────────────────────────────────────────────────
@router.post("/resume", response_model=EnhanceResumeResponse)
async def enhance_resume(
    payload: EnhanceResumeRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    """
    AI-powered resume enhancement — returns enhanced text, keywords, suggestions.
    Does NOT generate a PDF. Use /enhance-and-download for that.
    """
    resume = await resume_repo.get_by_id_and_user(payload.resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")

    parsed_data = resume.parsed_data.model_dump() if hasattr(resume.parsed_data, 'model_dump') else (resume.parsed_data or {})

    resume_text = (parsed_data.get("raw_text") or "").strip()

    if len(resume_text) < 50:
        raise HTTPException(
            status_code=422,
            detail="Resume text is empty or could not be extracted."
        )

    state = {
        "resume_text": resume_text,
        "jd_text": payload.job_description or "",
        "required_skills": payload.required_skills or [],
        "strict_missing_keywords": getattr(payload, "strict_missing_keywords", None) or [],
        # NEW — HITL wizard bundle, see schemas/resume_schema_ADDITIONS_v2_hitl.py
        "user_verified": _serialize_user_verified(payload),
        # Passed through so the graph node can restore LLM-truncated highlights
        "original_parsed_dict": parsed_data,
    }

    # Run async LLM node natively without blocking event loop
    enhanced = await enhance_resume_content(state)
    enhanced_data = enhanced.get("enhanced_data", {})

    if not enhanced_data:
        raise HTTPException(
            status_code=500,
            detail="LLM returned an empty enhanced resume."
        )
    # Map to EnhanceResumeResponse (the ATS results schema)
    return EnhanceResumeResponse(
        resume_id=payload.resume_id,
        original_summary=parsed_data.get("summary", ""),
        enhanced_summary=enhanced_data.get("summary", ""),
        original_experience=[],
        enhanced_experience=enhanced_data.get("experience", []),
        added_keywords=enhanced_data.get("skills", [])[:10],
        formatting_suggestions=enhanced_data.get("missing_critical_info", []),
        ats_improvement_estimate=float(enhanced_data.get("ats_improvement_estimate", 0.05)),
        enhancement_notes=[
            "✅ Professional summary enhanced with stronger language",
            "✅ Experience bullets upgraded with action verbs",
            f"✅ {len(enhanced_data.get('skills', []))} skills identified for ATS",
            "💡 Manually review all AI suggestions before submitting",
        ],
    )


# ── /enhance/wizard-questions ─────────────────────────────────────────────────
class WizardQuestionsRequest(BaseModel):
    resume_id: str
    job_description: Optional[str] = None
    strict_missing_keywords: Optional[List[str]] = None


@router.post("/wizard-questions")
async def get_wizard_questions(
    payload: WizardQuestionsRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    """
    Data Gap Analyzer — generates ≤3 high-value conversational questions
    to show the candidate BEFORE the enhancer graph runs (the HITL wizard).

    Call this endpoint AFTER /ats/match so you have `strict_missing_keywords`
    to pass in.  The returned `questions` list is ordered by priority and may
    be empty if no meaningful gaps are found.

    Flow:
        POST /ats/match           → get strict_missing_keywords
        POST /enhance/wizard-questions  ← HERE
        (user answers in the UI)
        POST /enhance/enhance-and-download with user_verified bundle
    """
    resume = await resume_repo.get_by_id_and_user(payload.resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found.")

    parsed_data = (
        resume.parsed_data.model_dump()
        if hasattr(resume.parsed_data, "model_dump")
        else (resume.parsed_data or {})
    )

    # Run sync LLM call in thread pool — keeps the event loop free
    questions = await asyncio.get_event_loop().run_in_executor(
        _executor,
        generate_hitl_questions,
        parsed_data,
        payload.job_description or "",
        payload.strict_missing_keywords or [],
    )

    return {
        "resume_id": payload.resume_id,
        "questions": questions,         # list of {question_id, question_text, category, context_hint}
        "total": len(questions),
    }


# ── /enhance/enhance-and-download ─────────────────────────────────────────────
@router.post("/enhance-and-download")
async def enhance_and_download(
    payload: EnhanceResumeRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    """
    Enhance resume with AI and generate a downloadable PDF.
    Returns {status: "SUCCESS", pdf_url: "..."} or {status: "MISSING_INFO", missing_fields: [...]}

    `payload.user_verified` (optional) carries the HITL wizard bundle the
    frontend collects before calling this endpoint — see
    schemas/resume_schema_ADDITIONS_v2_hitl.py. It's safe to omit entirely
    (the "skip wizard" quick-enhance path just sends the request without it).
    """
    try:
        # 1. Fetch Resume from DB
        resume = await resume_repo.get_by_id_and_user(payload.resume_id, str(current_user.id))
        if not resume:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")

        # 2. Extract parsed data as plain dict
        parsed_data = (
            resume.parsed_data.model_dump()
            if hasattr(resume.parsed_data, 'model_dump')
            else (resume.parsed_data or {})
        )

        resume_text = (parsed_data.get("raw_text") or "").strip()

        if len(resume_text) < 50:
            raise HTTPException(
                status_code=422,
                detail="Resume text is empty or could not be extracted."
            )

        state = {
            "resume_text": resume_text,
            "jd_text": payload.job_description or "",
            "required_skills": payload.required_skills or [],
            "strict_missing_keywords": getattr(payload, "strict_missing_keywords", None) or [],
            "user_verified": _serialize_user_verified(payload),
            # Passed through so the graph node can restore LLM-truncated highlights
            "original_parsed_dict": parsed_data,
        }

        # 3. Run AI enhancement (async function) — natively awaited
        enhanced = await enhance_resume_content(state)

        enhanced_data = enhanced.get("enhanced_data", {})
        if not enhanced_data:
            raise HTTPException(
                status_code=500,
                detail="LLM returned an empty enhanced resume."
            )

        # 4. Generate PDF
        unique_id = uuid.uuid4().hex[:8]
        output_filename = f"resume_{current_user.id}_{unique_id}.pdf"
        output_path = os.path.join(_temp_storage_dir(), output_filename)

        pdf_url = await pdf_generator.generate_resume_pdf(
            resume_data=enhanced_data,
            output_path=output_path
        )

        return {"status": "SUCCESS", "pdf_url": pdf_url}

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback_str = traceback.format_exc()
        print(f"[Enhance] CRITICAL ERROR: {str(e)}\n{traceback_str}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Enhancement failed: {str(e)}"
        )