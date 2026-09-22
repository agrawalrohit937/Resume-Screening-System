# """
# ATS Routes — Single match, bulk match, history
# """

import json
import tempfile
from pathlib import Path
import structlog
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile
from typing import Optional
from api.deps import (
    get_current_user, get_resume_repo, get_result_repo,
    get_user_repo, PaginationParams, get_database, get_db
)
from models.result_model import ATSResultModel
from models.resume_model import ResumeStatus
from models.user_model import UserModel
from repositories.resume_repo import ResumeRepository
from repositories.result_repo import ResultRepository
from repositories.user_repo import UserRepository
from services.parser_service import ParserService

from schemas.ats_schema import (
    ATSMatchRequest, ATSMatchResponse, BulkATSMatchRequest,
    BulkATSMatchResponse, BulkATSResultItem
)

from services.scoring_engine import score_resume
from services.skill_ontology import canonicalize_skills
from utils.validators import validate_object_id
import time

logger = structlog.get_logger(__name__)
router = APIRouter()


def _extract_contact_snapshot(extracted_data: dict) -> dict:
    """
    Pull a normalized {email, phone, linkedin, github, portfolio} dict out of
    whatever the LangGraph extraction node produced. Written defensively
    since the exact key name/shape lives in ResumeExtraction, which this
    route doesn't own — tries the common key names and both dict/pydantic
    shapes rather than assuming one.
    """
    raw = extracted_data.get("contact_info") or extracted_data.get("contact") or {}
    if hasattr(raw, "model_dump"):
        raw = raw.model_dump()
    elif hasattr(raw, "__dict__"):
        raw = dict(raw.__dict__)
    elif not isinstance(raw, dict):
        raw = {}

    return {
        "email": raw.get("email") or None,
        "phone": raw.get("phone") or None,
        "linkedin": raw.get("linkedin") or None,
        "github": raw.get("github") or None,
        "portfolio": raw.get("portfolio") or None,
    }


@router.post("/match", response_model=ATSMatchResponse)
async def match_resume(
    request: Request,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    result_repo: ResultRepository = Depends(get_result_repo),
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Score a resume against a job description with BOTH engines.
    Supports both JSON and multipart/form-data file uploads for JD (PDF, DOCX, TXT).
    """

    content_type = request.headers.get("content-type", "").lower()

    resume_id = None
    job_title = "Target Role"
    job_description = ""
    required_skills = []
    save_result = True
    jd_file: Optional[UploadFile] = None

    if "multipart/form-data" in content_type:
        form = await request.form()
        resume_id = form.get("resume_id")
        job_title = form.get("job_title") or "Target Role"
        job_description = form.get("job_description") or ""

        req_skills_raw = form.getlist("required_skills") or form.get("required_skills")
        if isinstance(req_skills_raw, str):
            required_skills = canonicalize_skills([s.strip() for s in req_skills_raw.split(",") if s and s.strip()])
        elif isinstance(req_skills_raw, list):
            required_skills = canonicalize_skills([s.strip() for s in req_skills_raw if isinstance(s, str) and s.strip()])

        save_res_raw = form.get("save_result")
        if save_res_raw is not None:
            save_result = str(save_res_raw).lower() in ("true", "1", "yes")

        form_file = form.get("jd_file")
        if isinstance(form_file, UploadFile):
            jd_file = form_file
    else:
        json_data = await request.json()
        payload = ATSMatchRequest(**json_data)
        resume_id = payload.resume_id
        job_title = payload.job_title
        job_description = payload.job_description
        required_skills = canonicalize_skills(payload.required_skills) if payload.required_skills else []
        save_result = payload.save_result

    # ── Handle uploaded JD file text extraction using ParserService ─────────
    if jd_file and hasattr(jd_file, "filename") and jd_file.filename:
        filename = jd_file.filename
        ext = Path(filename).suffix.lower().lstrip(".")
        if ext not in ("pdf", "docx", "doc", "txt"):
            raise HTTPException(
                status_code=400,
                detail="Unsupported JD file type. Please upload a PDF, DOCX, or TXT file.",
            )

        contents = await jd_file.read()
        if not contents:
            raise HTTPException(
                status_code=400,
                detail="Uploaded JD file is empty.",
            )

        if ext == "txt":
            extracted_text = contents.decode("utf-8", errors="ignore").strip()
        else:
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
                tmp.write(contents)
                tmp_path = tmp.name
            try:
                parser = ParserService()
                extracted_text = await parser._extract_raw_text(tmp_path, ext)
            except Exception as parse_err:
                logger.error("Failed to parse JD file", error=str(parse_err))
                raise HTTPException(
                    status_code=422,
                    detail=f"Failed to extract text from JD file '{filename}': {str(parse_err)}",
                )
            finally:
                Path(tmp_path).unlink(missing_ok=True)

        if extracted_text and len(extracted_text.strip()) > 0:
            job_description = extracted_text.strip()

    if not resume_id:
        raise HTTPException(status_code=422, detail="resume_id is required.")

    if not job_description or len(job_description.strip()) < 10:
        raise HTTPException(
            status_code=422,
            detail="Job description text (or uploaded file) is required and must contain valid text.",
        )

    validate_object_id(resume_id, "resume_id")

    resume = await resume_repo.get_by_id_and_user(
        resume_id,
        str(current_user.id),
    )

    if not resume:
        raise HTTPException(
            status_code=404,
            detail="Resume not found.",
        )

    if resume.status in (ResumeStatus.PENDING, ResumeStatus.PROCESSING) or not resume.parsed_data:
        raise HTTPException(
            status_code=409,
            detail="Resume is currently being parsed and vectorized. Please wait a moment and try again.",
        )

    if resume.status == ResumeStatus.FAILED:
        raise HTTPException(
            status_code=422,
            detail=f"Resume parsing failed: {resume.parse_error or 'Unknown parsing error'}",
        )

    if resume.status != ResumeStatus.PARSED:
        raise HTTPException(
            status_code=404,
            detail="Parsed resume not found.",
        )

    raw_text = (resume.parsed_data.raw_text or "").strip() if resume.parsed_data else ""

    if not raw_text:
        raise HTTPException(
            status_code=422,
            detail="Resume contains no parsed text.",
        )

    # Save Job Description (Fail-safe)
    jd = None
    try:
        jd = await result_repo.create_job_description({
            "user_id": str(current_user.id),
            "title": job_title,
            "description": job_description,
        })
    except Exception as e:
        logger.warning("Failed to save Job Description in database; continuing analysis", error=str(e))

    t_start = time.perf_counter()

    try:
        resume_payload = resume.parsed_data.model_dump() if hasattr(resume.parsed_data, "model_dump") else (resume.parsed_data or {})
        if "raw_text" not in resume_payload:
            resume_payload["raw_text"] = raw_text

        scored = score_resume(
            resume=resume_payload,
            jd=job_description,
            mode="candidate",
            required_skills=required_skills or [],
        )
    except Exception as e:
        logger.exception("Unified scoring engine execution failed", error=str(e))
        err_detail = str(e).strip() or repr(e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze resume: {err_detail}",
        )

    processing_time_ms = int((time.perf_counter() - t_start) * 1000)

    extracted_data = scored.get("extracted_data", {}) or {}
    contact_snapshot = _extract_contact_snapshot(extracted_data)

    score_data = {
        "final_score": scored["final_score"],
        "recommendation": scored["recommendation"],
        "matched_skills": scored["matched_skills"],
        "missing_skills": scored["missing_skills"],
        "experience_score": scored["experience_score"] / 100.0,
        "education_score": scored["education_score"] / 100.0,
        "feedback_suggestions": scored["feedback_suggestions"],
        "processing_time_ms": processing_time_ms,

        # ── Strict engine fields ──
        "is_knockout": scored["is_knockout"],
        "knockout_reasons": scored["knockout_reasons"],
        "knockout_advisories": scored["knockout_advisories"],
        "strict_ats_score": scored["strict_ats_score"],
        "strict_matched_keywords": scored["strict_matched_keywords"],
        "strict_missing_keywords": scored["strict_missing_keywords"],
        "parsing_is_healthy": scored["parsing_is_healthy"],
        "parsing_confidence": scored["parsing_confidence"],
        "parsing_warnings": scored["parsing_warnings"],

        # ── HITL wizard support ──
        "contact_snapshot": contact_snapshot,

        # ── Scoring Engine Version ──
        "scoring_version": scored.get("scoring_version", "1.0.0"),
    }

    result = None

    if save_result:
        try:
            result = await result_repo.create_result({
                "user_id": str(current_user.id),
                "resume_id": resume_id,
                "job_description_id": str(jd.id) if jd and hasattr(jd, "id") else None,
                **score_data,
            })

            await user_repo.increment_counter(
                str(current_user.id),
                "total_ats_checks",
            )

            # Shadow scoring parallel evaluation (Phase 4.6)
            try:
                from services.shadow_scoring import shadow_scoring_service
                db_inst = getattr(result_repo, "db", None) or getattr(getattr(result_repo, "collection", None), "database", None)
                shadow_scoring_service.dispatch_shadow_score(
                    job_id=str(jd.id) if jd and hasattr(jd, "id") else "ats_check",
                    candidate_id=str(current_user.id),
                    primary_score=score_data["final_score"],
                    features_dict=scored.get("features"),
                    db=db_inst,
                )
            except Exception as shadow_err:
                logger.debug("Shadow scoring dispatch skipped in ATS check", error=str(shadow_err))
        except Exception as e:
            logger.warning("Failed to save ATS result in database", error=str(e))

    logger.info(
        "ATS analysis completed",
        resume_id=resume_id,
        score=score_data["final_score"],
        strict_score=score_data["strict_ats_score"],
        is_knockout=score_data["is_knockout"],
        processing_time_ms=processing_time_ms,
    )

    result_id = str(result.id) if result else "unsaved"

    response_payload = _build_ats_response(
        result_id=result_id,
        resume_id=resume_id,
        job_title=job_title,
        data=score_data,
    )

    return response_payload

@router.post("/bulk-match", response_model=BulkATSMatchResponse)
async def bulk_match(
    payload: BulkATSMatchRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    """Batch-score multiple resumes against one job description using LangGraph.

    NOTE: bulk-match intentionally stays AI-engine-only for now. If you want
    strict/knockout data in bulk results too, call run_strict_ats_check()
    per resume here the same way /match does — it's cheap since it's pure
    Python, no extra LLM calls.
    """

    logger.info(
        "Bulk ATS analysis started",
        user_id=str(current_user.id),
        total_resumes=len(payload.resume_ids),
    )

    t_start = time.perf_counter()

    resumes = await resume_repo.get_multiple_by_ids(payload.resume_ids)
    parsed_resumes = [r for r in resumes if r.status == ResumeStatus.PARSED]

    if not parsed_resumes:
        raise HTTPException(
            status_code=422,
            detail="No parsed resumes found.",
        )

    results = []

    for resume in parsed_resumes:
        raw_text = (resume.parsed_data.raw_text or "").strip()

        # Skip empty parsed resumes
        if not raw_text:
            logger.warning(
                "Skipping resume with empty parsed text",
                resume_id=str(resume.id),
            )
            continue

        try:
            resume_payload = resume.parsed_data.model_dump() if hasattr(resume.parsed_data, "model_dump") else (resume.parsed_data or {})
            if "raw_text" not in resume_payload:
                resume_payload["raw_text"] = raw_text

            scored = score_resume(
                resume=resume_payload,
                jd=payload.job_description,
                mode="candidate",
            )
        except Exception:
            logger.exception(
                "ATS scoring failed",
                resume_id=str(resume.id),
            )
            continue

        results.append(
            BulkATSResultItem(
                resume_id=str(resume.id),
                candidate_name=resume.filename,
                final_score=scored["final_score"],
                recommendation=scored["recommendation"],
                matched_keywords=len(scored["matched_skills"]),
                missing_skills_count=len(scored["missing_skills"]),
                rank=0,
            )
        )

    if not results:
        raise HTTPException(
            status_code=500,
            detail="Failed to analyze all resumes.",
        )

    # Highest score first
    results.sort(
        key=lambda r: r.final_score,
        reverse=True,
    )

    for idx, result in enumerate(results, start=1):
        result.rank = idx

    processing_time_ms = int(
        (time.perf_counter() - t_start) * 1000
    )

    logger.info(
        "Bulk ATS analysis completed",
        processed=len(results),
        processing_time_ms=processing_time_ms,
    )

    return BulkATSMatchResponse(
        total_processed=len(results),
        results=results,
        processing_time_ms=processing_time_ms,
    )


# ─── GET /history ─────────────────────────────────────────────────────────
@router.get("/history")
async def get_ats_history(
    pagination: PaginationParams = Depends(),
    min_score: Optional[float] = None,
    current_user: UserModel = Depends(get_current_user),
    result_repo: ResultRepository = Depends(get_result_repo),
):
    """Get ATS check history for the current user."""
    results, total = await result_repo.get_results_by_user(
        str(current_user.id),
        skip=pagination.skip,
        limit=pagination.page_size,
        min_score=min_score,
    )
    return {
        "items": [_result_summary(r) for r in results],
        **pagination.to_response_meta(total),
    }


# ─── POST /match/batch & POST /batch (Async Background Job) ──────────────────
from pydantic import BaseModel, Field
from typing import List
from models.task_job_model import JobType, TaskJobModel
from repositories.task_job_repo import TaskJobRepository
from services.tasks import task_manager
from services.tasks.workers import execute_batch_ats_scoring

class BatchMatchJobPayload(BaseModel):
    job_id: str
    resume_ids: List[str]
    mode: str = Field(default="recruiter", pattern="^(candidate|recruiter)$")

@router.post("/match/batch", status_code=status.HTTP_202_ACCEPTED)
@router.post("/batch", status_code=status.HTTP_202_ACCEPTED)
async def queue_batch_match(
    payload: BatchMatchJobPayload,
    current_user: UserModel = Depends(get_current_user),
):
    """Enqueues async batch ATS matching and returns immediately with a task job ID."""
    if not payload.resume_ids:
        raise HTTPException(status_code=422, detail="resume_ids cannot be empty")

    tenant_id = getattr(current_user, "tenant_id", None) or "default"
    job_record = await task_manager.enqueue_job(
        job_type=JobType.BATCH_ATS_SCORING,
        payload={
            "job_id_target": payload.job_id,
            "resume_ids": payload.resume_ids,
            "mode": payload.mode,
            "tenant_id": tenant_id,
        },
        task_coro_func=execute_batch_ats_scoring,
        tenant_id=tenant_id,
        user_id=str(current_user.id),
    )

    return {
        "status": "queued",
        "job_id": job_record.job_id if hasattr(job_record, "job_id") else getattr(job_record, "get", lambda k: None)("job_id"),
        "total_candidates": len(payload.resume_ids),
        "message": "Batch scoring successfully queued. Poll /api/v1/ats/tasks/{job_id} for live progress.",
    }


# ─── GET /tasks/{task_id} & GET /jobs/{task_id} (Live Polling) ───────────────
@router.get("/tasks/{task_id}")
@router.get("/jobs/{task_id}")
async def get_task_status(
    task_id: str,
    current_user: UserModel = Depends(get_current_user),
    db=Depends(get_database),
):
    """Polls live execution status, progress percentage, and results for a background job."""
    tenant_id = getattr(current_user, "tenant_id", None) or "default"
    repo = TaskJobRepository(db)
    job = await repo.get_by_job_id(task_id, tenant_id=tenant_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task job not found.")
    return job.model_dump()


# ─── GET /result/{result_id} ─────────────────────────────────────────────
@router.get("/result/{result_id}")
async def get_ats_result(
    result_id: str,
    current_user: UserModel = Depends(get_current_user),
    result_repo: ResultRepository = Depends(get_result_repo),
):
    """Get full ATS result by ID."""
    validate_object_id(result_id, "result_id")
    result = await result_repo.get_result_by_id(result_id)
    if not result or result.user_id != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found.")
    return result.model_dump()


# ─── Helpers ──────────────────────────────────────────────────────────────────
def _build_ats_response(result_id: str, resume_id: str, job_title: str, data: dict) -> ATSMatchResponse:
    """Helper to map our new LangGraph + strict-engine dictionary to the Pydantic Response Model"""
    return ATSMatchResponse(
        result_id=result_id,
        resume_id=resume_id,
        job_title=job_title,
        final_score=float(data.get("final_score") or 0.0),
        recommendation=str(data.get("recommendation") or "Low Match"),
        matched_skills=data.get("matched_skills") or [],
        missing_skills=data.get("missing_skills") or [],
        experience_score=float(data.get("experience_score") or 0.0),
        education_score=float(data.get("education_score") or 0.0),
        feedback_suggestions=data.get("feedback_suggestions") or [],
        processing_time_ms=int(data.get("processing_time_ms") or 0),

        # Strict engine fields
        is_knockout=bool(data.get("is_knockout", False)),
        knockout_reasons=data.get("knockout_reasons") or [],
        knockout_advisories=data.get("knockout_advisories") or [],
        strict_ats_score=float(data.get("strict_ats_score") or 0.0),
        strict_matched_keywords=data.get("strict_matched_keywords") or [],
        strict_missing_keywords=data.get("strict_missing_keywords") or [],
        parsing_is_healthy=bool(data.get("parsing_is_healthy", True)),
        parsing_confidence=float(data.get("parsing_confidence") if data.get("parsing_confidence") is not None else 1.0),
        parsing_warnings=data.get("parsing_warnings") or [],

        # HITL wizard support
        contact_snapshot=data.get("contact_snapshot"),
    )


def _result_summary(result: ATSResultModel) -> dict:
    """Helper for the history endpoint"""
    return {
        "result_id": str(result.id),
        "resume_id": result.resume_id,
        "final_score": result.final_score,
        "recommendation": result.recommendation,
        "created_at": result.created_at,
        "strict_ats_score": getattr(result, "strict_ats_score", None),
        "is_knockout": getattr(result, "is_knockout", None),
    }