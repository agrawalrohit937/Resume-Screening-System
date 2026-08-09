# """
# ATS Routes — Single match, bulk match, history
# """

import tempfile
from pathlib import Path
import structlog
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form
from typing import Optional
from api.deps import (
    get_current_user, get_resume_repo, get_result_repo,
    get_user_repo, PaginationParams
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

from workflows.ats_graph import ats_engine
from services.strict_ats_service import run_strict_ats_check
from utils.validators import validate_object_id
import time
import traceback

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
            required_skills = [s.strip().lower() for s in req_skills_raw.split(",") if s and s.strip()]
        elif isinstance(req_skills_raw, list):
            required_skills = [s.strip().lower() for s in req_skills_raw if isinstance(s, str) and s.strip()]

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
        required_skills = payload.required_skills
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

    if not resume or resume.status != ResumeStatus.PARSED or not resume.parsed_data:
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

    # ── [DEBUG] Verify raw_text content for gap-analysis bug ──────────────
    debug_needles = ["express.js", "node.js", "vector database", "pinecone",
                     "express", "node", "vector", "pinecone"]
    print("\n" + "=" * 80)
    print("[ATS_ROUTE DEBUG] match_resume — raw_text verification:")
    print(f"  raw_text length: {len(raw_text)} chars, {len(raw_text.split())} words")
    print(f"  raw_text preview (first 300 chars):")
    print(f"    '''{raw_text[:300]}'''")
    print(f"  raw_text preview (last 200 chars):")
    print(f"    '''{raw_text[-200:]}'''")
    print(f"  Targeted skill presence in raw_text:")
    for needle in debug_needles:
        found = needle.lower() in raw_text.lower()
        print(f"    {'✅' if found else '❌'} '{needle}': {'FOUND' if found else 'NOT FOUND'}")
    # Check all extracted skills from the parsed data
    extracted_skills = (resume.parsed_data.skills if resume.parsed_data else []) or []
    print(f"  Extracted skills from parser: {extracted_skills}")
    print("=" * 80 + "\n")

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
        graph_result = await ats_engine.ainvoke({
            "resume_text": raw_text,
            "jd_text": job_description,
            "required_skills": required_skills or [],   # Optional skills from UI
        })
    except Exception as e:
        logger.exception("ATS graph execution failed", error=str(e))
        print(f"[ATS ROUTE ERROR] ats_engine.ainvoke failed: {e}")
        traceback.print_exc()
        err_detail = str(e).strip() or repr(e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze resume: {err_detail}",
        )

    processing_time_ms = int((time.perf_counter() - t_start) * 1000)

    required_keys = (
        "final_score",
        "recommendation",
        "matched_skills",
        "missing_skills",
        "experience_score",
        "education_score",
        "feedback_suggestions",
    )

    missing = [key for key in required_keys if key not in graph_result]

    if missing:
        logger.error(
            "ATS graph returned incomplete response",
            missing_keys=missing,
        )
        raise HTTPException(
            status_code=500,
            detail="ATS engine returned an invalid response.",
        )

    extracted_data = graph_result.get("extracted_data", {}) or {}

    # ── Strict / Corporate ATS engine (deterministic, no LLM) ──────────────
    skill_universe = list(required_skills or []) + list(graph_result.get("matched_skills") or []) + list(graph_result.get("missing_skills") or [])

    try:
        strict_result = run_strict_ats_check(
            raw_text=raw_text,
            extracted_data=extracted_data,
            jd_text=job_description,
            skill_universe=skill_universe,
        )
    except Exception:
        logger.exception("Strict ATS check failed; continuing with AI-only result")
        strict_result = {
            "parsing_health": {"is_healthy": True, "confidence": 1.0, "warnings": []},
            "knockout": {"is_knockout": False, "reasons": [], "advisories": []},
            "keyword_match": {"strict_ats_score": 0.0, "matched_exact": [], "missing_exact": []},
        }

    contact_snapshot = _extract_contact_snapshot(extracted_data)

    score_data = {
        "final_score": graph_result["final_score"],
        "recommendation": graph_result["recommendation"],
        "matched_skills": graph_result["matched_skills"],
        "missing_skills": graph_result["missing_skills"],
        "experience_score": graph_result["experience_score"],
        "education_score": graph_result["education_score"],
        "feedback_suggestions": graph_result["feedback_suggestions"],
        "processing_time_ms": processing_time_ms,

        # ── Strict engine fields ──
        "is_knockout": strict_result["knockout"]["is_knockout"],
        "knockout_reasons": strict_result["knockout"]["reasons"],
        "knockout_advisories": strict_result["knockout"]["advisories"],
        "strict_ats_score": strict_result["keyword_match"]["strict_ats_score"],
        "strict_matched_keywords": strict_result["keyword_match"]["matched_exact"],
        "strict_missing_keywords": strict_result["keyword_match"]["missing_exact"],
        "parsing_is_healthy": strict_result["parsing_health"]["is_healthy"],
        "parsing_confidence": strict_result["parsing_health"]["confidence"],
        "parsing_warnings": strict_result["parsing_health"]["warnings"],

        # ── HITL wizard support ──
        "contact_snapshot": contact_snapshot,
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

    return _build_ats_response(
        result_id=result_id,
        resume_id=resume_id,
        job_title=job_title,
        data=score_data,
    )

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
            graph_result = await ats_engine.ainvoke({

                "resume_text": raw_text,
                "jd_text": payload.job_description,
            })
        except Exception:
            logger.exception(
                "ATS graph failed",
                resume_id=str(resume.id),
            )
            continue

        results.append(
            BulkATSResultItem(
                resume_id=str(resume.id),
                candidate_name=resume.filename,
                final_score=graph_result["final_score"],
                recommendation=graph_result["recommendation"],
                matched_keywords=len(graph_result["matched_skills"]),
                missing_skills_count=len(graph_result["missing_skills"]),
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