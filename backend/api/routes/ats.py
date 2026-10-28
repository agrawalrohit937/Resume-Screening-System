# """
# ATS Routes — Single match, bulk match, history
# """

import tempfile
from pathlib import Path
import structlog
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from typing import Optional
from api.deps import (
    get_current_user, get_resume_repo, get_result_repo,
    get_user_repo, PaginationParams, get_database
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
from services.jd_parser_service import parse_jd_with_groq
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


@router.post("/extract-jd")
async def extract_jd_text(
    file: UploadFile = File(...),
    current_user: UserModel = Depends(get_current_user),
):
    """Extract clean plain text from an uploaded JD file (PDF, DOCX, TXT) using DocumentParserService."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in ("pdf", "docx", "txt"):
        raise HTTPException(
            status_code=400,
            detail="Unsupported JD file type. Please upload a PDF, DOCX, or TXT file.",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded JD file is empty.")

    if ext == "txt":
        text = contents.decode("utf-8", errors="ignore").strip()
    else:
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        try:
            parser = ParserService()
            text = await parser._extract_raw_text(tmp_path, ext)
        except Exception as e:
            logger.error("Failed to parse JD file", error=str(e), filename=file.filename)
            raise HTTPException(
                status_code=422,
                detail=f"Failed to extract text from JD file '{file.filename}': {str(e)}",
            )
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    if not text or len(text.strip()) < 10:
        raise HTTPException(
            status_code=422,
            detail="Could not extract sufficient text from the uploaded document. Please check the file content.",
        )

    return {
        "text": text.strip(),
        "filename": file.filename,
        "length": len(text.strip()),
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
        if ext not in ("pdf", "docx", "txt"):
            raise HTTPException(
                status_code=400,
                detail="Unsupported JD file type. Please upload a PDF, DOCX, or TXT file (legacy .doc files must be converted to .docx or .pdf).",
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

    valid_parsed_statuses = (ResumeStatus.PARSED, "ready", "parsed")
    if resume.status not in valid_parsed_statuses and not resume.parsed_data:
        raise HTTPException(
            status_code=404,
            detail="Parsed resume not found.",
        )

    raw_text = ""
    if resume.parsed_data:
        raw_text = (getattr(resume.parsed_data, "raw_text", None) or "").strip()
        if not raw_text and isinstance(resume.parsed_data, dict):
            raw_text = (resume.parsed_data.get("raw_text") or "").strip()

    # Synthesize raw_text from structured parsed_data if raw_text is missing (e.g. demo/seeded resumes)
    if not raw_text and resume.parsed_data:
        pd = resume.parsed_data if isinstance(resume.parsed_data, dict) else (resume.parsed_data.model_dump() if hasattr(resume.parsed_data, "model_dump") else {})
        name = pd.get("name") or pd.get("full_name") or "Candidate"
        summary = pd.get("summary") or ""
        skills_list = pd.get("skills") or pd.get("technical_skills") or []
        exp_list = pd.get("work_experience") or pd.get("experience") or []
        edu_list = pd.get("education") or []
        
        lines = [name]
        if summary:
            lines.append(summary)
        if skills_list:
            lines.append("Skills: " + ", ".join(str(s) for s in skills_list))
        for exp in exp_list:
            if isinstance(exp, dict):
                lines.append(f"{exp.get('title', '')} at {exp.get('company', '')} - {exp.get('description', '')}")
        for ed in edu_list:
            if isinstance(ed, dict):
                lines.append(f"{ed.get('degree', '')} from {ed.get('institution', '')}")
        raw_text = "\n".join(lines).strip()
        if hasattr(resume.parsed_data, "raw_text"):
            resume.parsed_data.raw_text = raw_text
        elif isinstance(resume.parsed_data, dict):
            resume.parsed_data["raw_text"] = raw_text

    if not raw_text:
        raise HTTPException(
            status_code=422,
            detail="Resume contains no parsed text. Please re-upload your resume.",
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

    # Direct Groq JD parser: extracts clean candidate specs (avoids company age confusion)
    db_conn = getattr(result_repo, "db", None) or getattr(resume_repo, "collection", {}).database
    jd_specs = await parse_jd_with_groq(job_description, db=db_conn)
    if not jd_specs:
        raise HTTPException(
            status_code=502,
            detail="Failed to parse Job Description with Groq LLM. Please verify your Groq connection and try again.",
        )
    llm_min_years = float(jd_specs.get("candidate_min_experience_years") or 0.0)
    llm_min_education = jd_specs.get("minimum_education")
    if not required_skills and jd_specs.get("required_skills"):
        required_skills = canonicalize_skills(jd_specs["required_skills"])
    if (not job_title or job_title == "Target Role") and jd_specs.get("job_title"):
        job_title = str(jd_specs["job_title"]).strip()

    try:
        resume_payload = resume.parsed_data.model_dump() if hasattr(resume.parsed_data, "model_dump") else (resume.parsed_data or {})
        if "raw_text" not in resume_payload:
            resume_payload["raw_text"] = raw_text

        scored = score_resume(
            resume=resume_payload,
            jd=job_description,
            mode="candidate",
            required_skills=required_skills or [],
            min_years=llm_min_years,
            min_education=llm_min_education,
            must_have_skills=jd_specs.get("must_have_skills"),
            nice_to_have_skills=jd_specs.get("nice_to_have_skills"),
            or_groups=jd_specs.get("or_groups"),
            years_is_required=jd_specs.get("years_is_required"),
            education_is_required=jd_specs.get("education_is_required"),
            job_location=jd_specs.get("location"),
            remote_policy=jd_specs.get("remote_policy"),
            jd_confidence=jd_specs.get("jd_confidence", "high"),
        )
    except Exception as e:
        logger.exception("Unified scoring engine execution failed", error=str(e))
        err_detail = str(e).strip() or repr(e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze resume: {err_detail}",
        )

    # Generate dynamic, personalized suggestions via Groq LLM
    try:
        from services.ats_feedback_service import generate_ats_feedback_with_groq
        scored["feedback_suggestions"] = await generate_ats_feedback_with_groq(
            scored_result=scored,
            job_title=job_title,
            job_description=job_description,
            resume_data=resume_payload,
        )
    except Exception as e:
        logger.warning("Failed to generate dynamic Groq feedback; keeping baseline", error=str(e))

    processing_time_ms = int((time.perf_counter() - t_start) * 1000)

    extracted_data = scored.get("extracted_data", {}) or {}
    contact_snapshot = _extract_contact_snapshot(extracted_data)

    score_data = {
        "final_score": scored["final_score"],
        "recommendation": scored["recommendation"],
        "matched_skills": scored["matched_skills"],
        "missing_skills": scored["missing_skills"],
        "soft_skills": jd_specs.get("soft_skills") or jd_specs.get("soft_competencies") or [],
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

        # ── v2.3 Engine Fields ──
        "match_band": scored.get("match_band"),
        "confidence": scored.get("confidence"),
        "needs_input": scored.get("needs_input", []),
        "dropped_components": scored.get("dropped_components", []),
        "skills_score": scored.get("skills_score"),
        "projects_score": scored.get("projects_score"),
        "active_weights": scored.get("active_weights") or {},

        # ── Scoring Engine Version ──
        "scoring_version": scored.get("scoring_version", "2.3.0"),
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

    # Parse JD once with Groq for the entire batch (avoids company tenure confusion)
    bulk_required_skills = payload.required_skills or []
    db_conn = getattr(resume_repo, "collection", {}).database
    jd_specs = await parse_jd_with_groq(payload.job_description, db=db_conn)
    if not jd_specs:
        raise HTTPException(
            status_code=502,
            detail="Failed to parse Job Description with Groq LLM. Please verify your Groq connection and try again.",
        )
    llm_min_years = float(jd_specs.get("candidate_min_experience_years") or 0.0)
    llm_min_education = jd_specs.get("minimum_education")
    if not bulk_required_skills and jd_specs.get("required_skills"):
        bulk_required_skills = canonicalize_skills(jd_specs["required_skills"])

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
                required_skills=bulk_required_skills,
                min_years=llm_min_years,
                min_education=llm_min_education,
                must_have_skills=jd_specs.get("must_have_skills"),
                nice_to_have_skills=jd_specs.get("nice_to_have_skills"),
                or_groups=jd_specs.get("or_groups"),
                years_is_required=jd_specs.get("years_is_required"),
                education_is_required=jd_specs.get("education_is_required"),
                job_location=jd_specs.get("location"),
                remote_policy=jd_specs.get("remote_policy"),
                jd_confidence=jd_specs.get("jd_confidence", "high"),
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


# ─── GET /latest (Auto-restore latest scan state) ──────────────────────────
@router.get("/latest")
async def get_latest_ats_result(
    current_user: UserModel = Depends(get_current_user),
    result_repo: ResultRepository = Depends(get_result_repo),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    """Get the user's most recent ATS check result and linked JD for auto-restoring after refresh."""
    results, total = await result_repo.get_results_by_user(
        str(current_user.id),
        skip=0,
        limit=1,
    )
    if not results:
        return {"has_result": False}

    latest = results[0]
    jd_doc = await result_repo.get_jd_by_id(latest.job_description_id) if latest.job_description_id else None
    resume = await resume_repo.get_by_id(latest.resume_id) if latest.resume_id else None

    latest_dict = latest.model_dump() if hasattr(latest, "model_dump") else dict(latest)
    
    jd_text = ""
    if jd_doc:
        jd_text = getattr(jd_doc, "raw_text", "") or getattr(jd_doc, "description", "") or ""

    return {
        "has_result": True,
        "result": latest_dict,
        "job_title": getattr(latest, "job_title", "") or (jd_doc.title if jd_doc else "Target Role"),
        "job_description": jd_text,
        "required_skills": getattr(jd_doc, "required_skills", []) if jd_doc else [],
        "resume": {
            "id": str(resume.id) if resume else latest.resume_id,
            "file_name": getattr(resume, "file_name", "Profile Resume.pdf"),
            "file_url": getattr(resume, "file_url", None),
        } if (resume or latest.resume_id) else None,
    }


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
from models.task_job_model import JobType
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
        soft_skills=data.get("soft_skills") or [],
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

        # ATS Scoring Engine v2.3 Fields
        match_band=data.get("match_band"),
        confidence=data.get("confidence"),
        needs_input=data.get("needs_input") or [],
        dropped_components=data.get("dropped_components") or [],
        skills_score=float(data.get("skills_score")) if data.get("skills_score") is not None else None,
        projects_score=float(data.get("projects_score")) if data.get("projects_score") is not None else None,
        active_weights=data.get("active_weights") or {},
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