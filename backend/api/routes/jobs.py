"""
Candidate Explore Jobs, Recommendations, ATS Match & Application Routes (/api/v1/jobs).
Recruiter, applicant pipeline & employer branding routes live in `jobs_recruiter.py`.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse as _JSONResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import (
    get_company_repo,
    get_current_user,
    get_db,
    get_job_repo,
    get_optional_current_user,
    get_resume_repo,
)
from api.routes.jobs_recruiter import (  # noqa: F401
    create_job,
    get_my_posted_jobs,
    router as recruiter_router,
)
from config.db import get_pg_session_factory
from core.config import settings
from models.tables import Company, Job
from repositories.company_repo import CompanyRepository
from repositories.job_repo import JobRepository
from schemas.application_schema import ApplicationResponse, ApplicationStage
from schemas.job_schema import JobResponse
from schemas.user_schema import UserModel, UserRole
from services.cloudinary_service import extract_public_id_from_url
from services.job_matcher import find_jobs_for_candidate
from services.scoring_engine import score_resume, score_resume_dual
from utils.validators import DocumentId

logger = structlog.get_logger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter()

job_repo = JobRepository()
company_repo = CompanyRepository()


class JobApplyPayload(BaseModel):
    resume_id: Optional[str] = None
    notes: Optional[str] = None


def _parse_skills(raw_skills: Any) -> List[str]:
    if isinstance(raw_skills, list):
        return [str(s).strip() for s in raw_skills if s is not None and str(s).strip()]
    if isinstance(raw_skills, str) and raw_skills.strip():
        return [s.strip() for s in raw_skills.split(",") if s.strip()]
    return []


def _resolve_publisher_source(is_external: bool, apply_url: Optional[str], existing: Optional[str] = None) -> str:
    if not is_external:
        return "Direct Employer"
    if existing:
        return existing
    url_lower = str(apply_url or "").lower()
    if "linkedin.com" in url_lower:
        return "LinkedIn"
    if "naukri.com" in url_lower:
        return "Naukri"
    return "External"


def _serialize_job_item(
    d: Dict[str, Any],
    *,
    applied_ids: Optional[set] = None,
    company_profile: Optional[Dict[str, Any]] = None,
    fallback_company: str = "Unknown Company",
) -> Dict[str, Any]:
    """Serialize a job dict/ORM payload into a clean, consistent feed/detail response."""
    job_id_str = str(d.get("id") or d.get("_id") or "")
    is_ext = bool(d.get("is_external") in [True, "true", "True", 1])
    apply_url = d.get("external_apply_url") or d.get("apply_url") or None
    comp_logo = (
        d.get("company_logo")
        or d.get("company_logo_url")
        or d.get("logo_url")
        or d.get("logo")
        or (company_profile.get("logo_url") if company_profile else None)
    )
    comp_site = (
        d.get("company_website")
        or d.get("website")
        or (company_profile.get("website") if company_profile else None)
    )
    created_at = d.get("created_at") or datetime.now(timezone.utc)
    created_iso = created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at)

    return {
        "id": job_id_str,
        "company_name": d.get("company_name") or d.get("company") or fallback_company,
        "title": d.get("title") or "Untitled Role",
        "jd_text_raw": (d.get("jd_text_raw") or d.get("jd_text") or d.get("description") or "").strip(),
        "required_skills": _parse_skills(d.get("required_skills") or d.get("skills")),
        "min_years": float(d["min_years"]) if d.get("min_years") is not None else None,
        "location": d.get("location") or "Remote",
        "work_mode": d.get("work_mode") or "Remote",
        "salary_range": d.get("salary_range") or None,
        "status": d.get("status") or "open",
        "department": d.get("department") or None,
        "company_logo": comp_logo or None,
        "company_logo_url": comp_logo or None,
        "logo_url": comp_logo or None,
        "company_website": comp_site or None,
        "company_about": d.get("company_about") or (company_profile.get("about") if company_profile else None),
        "company_size": d.get("company_size") or (company_profile.get("team_size") if company_profile else None),
        "is_external": is_ext,
        "publisher_source": _resolve_publisher_source(is_ext, apply_url, d.get("publisher_source")),
        "external_apply_url": apply_url,
        "external_job_id": d.get("external_job_id") or None,
        "company_industry": d.get("company_industry") or (company_profile.get("industry") if company_profile else None),
        "applicant_count": int(d.get("applicant_count") or 0),
        "created_at": created_iso,
        "has_applied": bool(applied_ids and job_id_str in applied_ids),
        "tenant_id": d.get("tenant_id") or "default",
    }


def _extract_resume_payload(raw_parsed: Any) -> Dict[str, Any]:
    if hasattr(raw_parsed, "model_dump"):
        payload = raw_parsed.model_dump()
    elif isinstance(raw_parsed, dict):
        payload = dict(raw_parsed)
    else:
        payload = {}
    if not payload.get("raw_text"):
        if hasattr(raw_parsed, "raw_text"):
            payload["raw_text"] = raw_parsed.raw_text or ""
        elif isinstance(raw_parsed, dict):
            payload["raw_text"] = raw_parsed.get("raw_text", "")
    return payload


async def _resolve_candidate_resume(resume_repo: Any, user_id: str, resume_id: Optional[str] = None) -> Any:
    if isinstance(resume_id, str) and resume_id.strip():
        return await resume_repo.get_by_id_and_user(resume_id.strip(), user_id)
    target = None
    try:
        target = await resume_repo.get_primary_by_user(user_id)
    except Exception:
        target = None
    if not target:
        resumes, _ = await resume_repo.get_by_user(user_id, limit=1)
        target = resumes[0] if resumes else None
    return target


@router.get("")
@router.get("/")
async def list_jobs(
    search: Optional[str] = Query(default=None, description="Search title, company, or keyword"),
    work_mode: Optional[str] = Query(default=None, description="Remote, Hybrid, or Onsite"),
    location: Optional[str] = Query(default=None, description="Location substring filter"),
    min_years: Optional[float] = Query(default=None, description="Maximum required experience years"),
    skill: Optional[str] = Query(default=None, description="Required skill filter"),
    limit: int = Query(default=30, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    job_repo: JobRepository = Depends(get_job_repo),
):
    if not hasattr(job_repo, "list_jobs"):
        job_repo = get_job_repo()
    docs, total = await job_repo.list_jobs(
        search=search, work_mode=work_mode, location=location, min_years=min_years, skill=skill, skip=skip, limit=limit
    )
    applied_job_ids = await job_repo.get_user_applied_job_ids(str(current_user.id)) if current_user else set()
    jobs = [_serialize_job_item(d, applied_ids=applied_job_ids, fallback_company="Leading Employer") for d in docs]
    return {"jobs": jobs, "total": total, "limit": limit, "skip": skip}


@router.get("/applications/my")
async def get_my_applications(current_user: UserModel = Depends(get_current_user)):
    """Fetch all jobs applied for by the current candidate with current pipeline stage."""
    app_docs = await job_repo.list_applications_by_candidate(str(current_user.id))
    job_ids_set = {str(app.get("job_id")) for app in app_docs if app.get("job_id")}
    jobs_map: Dict[str, Dict[str, Any]] = {}
    company_map: Dict[str, Dict[str, Any]] = {}

    if job_ids_set:
        async with get_pg_session_factory()() as session:
            for j in (await session.execute(select(Job).where(Job.id.in_(list(job_ids_set))))).scalars().all():
                d = {c.name: getattr(j, c.name) for c in Job.__table__.columns}
                d["_id"] = d.get("id")
                jobs_map[str(j.id)] = d
            company_names = {j.get("company_name", "").strip() for j in jobs_map.values() if j.get("company_name")}
            if company_names:
                for c in (await session.execute(select(Company).where(Company.company_name.in_(list(company_names))))).scalars().all():
                    company_map[c.company_name.strip().lower()] = {"logo_url": c.logo_url, "website": c.website}

    results = []
    for app in app_docs:
        job_id = app.get("job_id")
        job_info = None
        if job_id and job_id in jobs_map:
            job_doc = jobs_map[job_id]
            comp_name = job_doc.get("company_name", "Unknown Company")
            comp_doc = company_map.get(comp_name.strip().lower()) if comp_name else None
            job_info = {
                "id": str(job_doc["_id"]),
                "title": job_doc.get("title", "Unknown Role"),
                "company_name": comp_name,
                "location": job_doc.get("location", "Remote"),
                "work_mode": job_doc.get("work_mode", "Remote"),
                "salary_range": job_doc.get("salary_range"),
                "status": job_doc.get("status", "open"),
                "company_logo": job_doc.get("company_logo") or (comp_doc.get("logo_url") if comp_doc else None),
                "company_website": job_doc.get("company_website") or (comp_doc.get("website") if comp_doc else None),
                "department": job_doc.get("department"),
            }
        results.append({
            "id": str(app["_id"]),
            "job_id": job_id,
            "resume_id": app.get("resume_id", ""),
            "match_score": app.get("match_score"),
            "stage": app.get("stage", ApplicationStage.APPLIED.value),
            "notes": app.get("notes"),
            "created_at": app.get("created_at", datetime.now(timezone.utc)).isoformat()
            if hasattr(app.get("created_at"), "isoformat")
            else str(app.get("created_at", "")),
            "job": job_info or {
                "id": job_id,
                "title": "Role Listing",
                "company_name": "Company",
                "location": "Remote",
                "work_mode": "Remote",
                "salary_range": None,
                "status": "closed",
            },
        })
    return {"applications": results, "total": len(results)}


@router.get("/recommended")
async def get_recommended_jobs(
    limit: int = Query(default=5, ge=1, le=20),
    current_user: UserModel = Depends(get_current_user),
    resume_repo=Depends(get_resume_repo),
    job_repo: JobRepository = Depends(get_job_repo),
):
    """On-demand job recommendation engine cached privately per user for 5 minutes."""
    user_role = getattr(getattr(current_user, "role", None), "value", getattr(current_user, "role", None))
    result = await find_jobs_for_candidate(
        candidate_id=str(current_user.id),
        limit=limit,
        db=None,
        resume_repo=resume_repo,
        include_external=str(user_role or "").lower() == UserRole.CANDIDATE.value,
    )
    response = _JSONResponse(content=result)
    response.headers["Cache-Control"] = "private, max-age=300"
    return response


@router.post("/admin/trigger-alerts")
async def trigger_job_alerts_webhook(
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
):
    """Azure Logic App webhook: scrapes fresh jobs, deletes 5-day-old external jobs, and emails alerts."""
    valid_cron_auth = bool(
        x_cron_secret
        and (
            (settings.CRON_SECRET and x_cron_secret == settings.CRON_SECRET)
            or (settings.SECRET_KEY and x_cron_secret == settings.SECRET_KEY)
        )
    )
    if not valid_cron_auth:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Valid X-Cron-Secret header required.")

    from scheduler.job_alerts import run_nightly_job_alerts
    result = await run_nightly_job_alerts(triggered_by="webhook_cron")
    return {"success": True, "result": result}


@router.get("/company/{company_name}")
async def get_jobs_by_company(
    company_name: str,
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    company_repo: CompanyRepository = Depends(get_company_repo),
    session: Optional[AsyncSession] = Depends(get_db),
):
    """Public employer profile & open jobs for a given company."""
    cleaned_name = company_name.strip()
    if not cleaned_name:
        raise HTTPException(status_code=400, detail="Company name cannot be empty.")

    company_doc = await company_repo.get_by_name(cleaned_name)

    async def _fetch_company_jobs(sess: AsyncSession):
        stmt = (
            select(Job)
            .where(func.lower(Job.company_name) == cleaned_name.lower(), Job.status.in_(["open", "published", "active"]))
            .order_by(Job.created_at.desc())
        )
        res = []
        for j in (await sess.execute(stmt)).scalars().all():
            d = {c.name: getattr(j, c.name) for c in Job.__table__.columns}
            d["_id"] = d.get("id")
            res.append(d)
        return res

    active_sess = session if hasattr(session, "execute") else None
    if active_sess:
        docs = await _fetch_company_jobs(active_sess)
    else:
        async with get_pg_session_factory()() as sess:
            docs = await _fetch_company_jobs(sess)

    canonical_name = (
        company_doc.get("company_name")
        if company_doc
        else (docs[0].get("company_name", cleaned_name) if docs else cleaned_name)
    )
    jobs = [_serialize_job_item(d, company_profile=company_doc, fallback_company=canonical_name) for d in docs]
    first_job_about = docs[0].get("company_about") if docs and docs[0].get("company_about") else None

    profile_data = {
        "company_name": canonical_name,
        "tagline": (company_doc.get("tagline") if company_doc else None) or f"Building innovative platforms and solutions at {canonical_name}.",
        "about": (company_doc.get("about") if company_doc else None) or first_job_about or f"{canonical_name} is a technology organization dedicated to building world-class products.",
        "logo_url": (company_doc.get("logo_url") if company_doc else None) or (docs[0].get("company_logo") if docs else None),
        "cover_url": company_doc.get("cover_url") if company_doc else None,
        "website": (company_doc.get("website") if company_doc else None) or (docs[0].get("company_website") if docs else None),
        "location": (company_doc.get("location") if company_doc else None) or (docs[0].get("location") if docs else "Remote"),
        "industry": (company_doc.get("industry") if company_doc else None) or (docs[0].get("company_industry") if docs else "Software & Technology"),
        "team_size": (company_doc.get("team_size") if company_doc else None) or (docs[0].get("company_size") if docs else "50-200 employees"),
        "perks": company_doc.get("perks") if company_doc and company_doc.get("perks") else [
            "Remote-First Culture",
            "Competitive Equity & Compensation",
            "Comprehensive Health & Dental",
            "Annual $2,500 Learning Stipend",
            "Flexible Working Hours",
        ],
        "linkedin": company_doc.get("linkedin") if company_doc else None,
        "github": company_doc.get("github") if company_doc else None,
    }
    return {"company_name": canonical_name, "company_profile": profile_data, "jobs": jobs, "total": len(jobs)}


# Mount recruiter, applicant pipeline, and branding routes BEFORE parameterized /{job_id}
router.add_api_route("", create_job, methods=["POST"], response_model=JobResponse, status_code=status.HTTP_201_CREATED)
router.include_router(recruiter_router)


@router.get("/{job_id}")
async def get_job_detail(
    job_id: str,
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    job_repo: JobRepository = Depends(get_job_repo),
    company_repo: CompanyRepository = Depends(get_company_repo),
    session: Optional[AsyncSession] = Depends(get_db),
    db: Optional[Any] = None,
):
    """Return full job details enriched with company profile and has_applied state."""
    if not hasattr(job_repo, "get_by_id"):
        job_repo = globals()["job_repo"]
    if not hasattr(company_repo, "get_by_name"):
        company_repo = globals()["company_repo"]
    if not DocumentId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    doc = await job_repo.get_by_id(job_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Job posting not found.")

    company_profile = await company_repo.get_by_name(doc.get("company_name", "")) if doc.get("company_name") else None
    applied_ids = set(await job_repo.get_user_applied_job_ids(str(current_user.id))) if current_user else set()
    return _serialize_job_item(doc, applied_ids=applied_ids, company_profile=company_profile)


@router.post("/{job_id}/match")
@limiter.limit("10/minute")
async def match_job_ats(
    request: Request,
    job_id: str,
    resume_id: Optional[str] = Query(default=None),
    current_user: UserModel = Depends(get_current_user),
    resume_repo=Depends(get_resume_repo),
    job_repo: JobRepository = Depends(get_job_repo),
    session: Optional[AsyncSession] = Depends(get_db),
    db: Optional[Any] = None,
):
    """Calculate instant ATS Profile Fit score between candidate resume and job."""
    if not hasattr(job_repo, "get_by_id"):
        job_repo = get_job_repo()
    if not hasattr(resume_repo, "get_primary_by_user"):
        resume_repo = get_resume_repo()

    job_doc = await job_repo.get_by_id(str(job_id))
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job posting not found.")
    if str(job_doc.get("status", "open")).lower() not in ("open", "published", "active"):
        raise HTTPException(status_code=400, detail="This job posting is no longer accepting applications.")

    target_resume = await _resolve_candidate_resume(resume_repo, str(current_user.id), resume_id)
    raw_parsed = getattr(target_resume, "parsed_data", None) or (
        target_resume.get("parsed_data") if isinstance(target_resume, dict) else None
    )
    if not target_resume or not raw_parsed:
        raise HTTPException(
            status_code=400,
            detail="No parsed resume found on your profile. Please upload a resume first to calculate match %.",
        )

    resume_payload = _extract_resume_payload(raw_parsed)
    jd_content = (job_doc.get("jd_text_raw") or job_doc.get("jd_text") or job_doc.get("description") or "").strip()
    scored = score_resume(
        resume=resume_payload,
        jd=jd_content,
        mode="candidate",
        required_skills=job_doc.get("required_skills", []),
        min_years=job_doc.get("min_years"),
    )
    target_resume_id = getattr(target_resume, "id", None) or (
        target_resume.get("_id") if isinstance(target_resume, dict) else str(target_resume)
    )

    return {
        "job_id": job_id,
        "resume_id": str(target_resume_id),
        "job_title": job_doc["title"],
        "company_name": job_doc["company_name"],
        "final_score": scored["final_score"],
        "scoring_version": scored.get("scoring_version", "1.0.0"),
        "recommendation": scored["recommendation"],
        "matched_skills": scored["matched_skills"],
        "missing_skills": scored["missing_skills"],
        "experience_score": scored["experience_score"],
        "education_score": scored["education_score"],
        "is_knockout": scored.get("is_knockout", False),
        "knockout_reasons": scored.get("knockout_reasons", []),
        "knockout_advisories": scored.get("knockout_advisories", []),
        "feedback_suggestions": (scored.get("feedback_suggestions") or [])[:3],
    }


@router.post("/{job_id}/apply", response_model=ApplicationResponse)
async def apply_to_job(
    job_id: str,
    payload: Optional[JobApplyPayload] = None,
    resume_id: Optional[str] = Query(default=None),
    current_user: UserModel = Depends(get_current_user),
    resume_repo=Depends(get_resume_repo),
    job_repo: JobRepository = Depends(get_job_repo),
    session: Optional[AsyncSession] = Depends(get_db),
    db: Optional[Any] = None,
):
    """Submit an internal candidate application with resume snapshot & dual ATS scoring."""
    if not DocumentId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    job_doc = await job_repo.get_by_id(job_id)
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job posting not found.")
    if bool(job_doc.get("is_external", False)):
        raise HTTPException(status_code=400, detail="External jobs do not support internal applications.")
    if str(job_id) in await job_repo.get_user_applied_job_ids(str(current_user.id)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You have already applied to this job.")

    chosen_resume_id = (payload.resume_id if payload and payload.resume_id else None) or resume_id
    target_resume = await _resolve_candidate_resume(resume_repo, str(current_user.id), chosen_resume_id)
    raw_parsed = getattr(target_resume, "parsed_data", None) or (
        target_resume.get("parsed_data") if isinstance(target_resume, dict) else None
    )
    if not target_resume or not raw_parsed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please upload a parsed resume before applying to jobs.")

    target_resume_id = getattr(target_resume, "id", None) or (
        target_resume.get("_id") if isinstance(target_resume, dict) else str(target_resume)
    )
    resume_payload = _extract_resume_payload(raw_parsed)

    try:
        dual = await asyncio.to_thread(
            score_resume_dual,
            resume=resume_payload,
            jd=job_doc.get("jd_text_raw") or job_doc.get("description", ""),
            required_skills=job_doc.get("required_skills", []),
            min_years=job_doc.get("min_years"),
        )
        match_score = round(float(dual.get("candidate_score", 0.0)), 1)
        recruiter_score = round(float(dual.get("recruiter_score", 0.0)), 1)
        quality_score = round(float(dual.get("quality_score", dual.get("final_score", 0.0))), 1)
        eligibility = dual.get("eligibility") or {"status": "unverified", "checks": []}
        eligibility_rank = int(dual.get("eligibility_rank", 1))
        knockout_status = dual.get("knockout") or {"passed": True, "reasons": []}
        scoring_version = dual.get("scoring_version", "2.0.0")
        features_data = dual.get("features") or dual.get("recruiter_result", {}).get("features")
    except Exception as e:
        logger.warning("Auto match calculation failed during apply, using skill fallback", error=str(e))
        cand_skills = {str(s).lower().strip() for s in (resume_payload.get("skills") or resume_payload.get("technical_skills") or [])}
        req_skills = {str(s).lower().strip() for s in job_doc.get("required_skills", [])}
        calc = round(max(35.0, min(95.0, (len(cand_skills & req_skills) / max(len(req_skills), 1)) * 100.0)), 1) if req_skills else 65.0
        match_score = recruiter_score = quality_score = calc
        eligibility = {"status": "eligible", "checks": []}
        eligibility_rank = 0
        knockout_status = {"passed": True, "reasons": []}
        scoring_version = "2.0.0-fallback"
        features_data = None

    target_file_url = getattr(target_resume, "file_url", None) or (target_resume.get("file_url") if isinstance(target_resume, dict) else None)
    target_filename = (
        getattr(target_resume, "original_filename", None)
        or getattr(target_resume, "filename", None)
        or (target_resume.get("original_filename") or target_resume.get("filename") if isinstance(target_resume, dict) else None)
        or "resume.pdf"
    )
    target_cloudinary_pid = getattr(target_resume, "cloudinary_public_id", None) or (
        target_resume.get("cloudinary_public_id") if isinstance(target_resume, dict) else None
    )
    if not target_cloudinary_pid and target_file_url:
        target_cloudinary_pid = extract_public_id_from_url(target_file_url)

    resume_snapshot = {
        "file_url": target_file_url,
        "cloudinary_public_id": target_cloudinary_pid,
        "parsed_data": _extract_resume_payload(raw_parsed),
        "filename": target_filename,
    }
    now = datetime.now(timezone.utc)
    app_doc = {
        "job_id": job_id,
        "candidate_id": str(current_user.id),
        "resume_id": str(target_resume_id),
        "tenant_id": job_doc.get("tenant_id", "default") or "default",
        "match_score": match_score,
        "quality_score": quality_score,
        "eligibility": eligibility,
        "eligibility_rank": eligibility_rank,
        "eligibility_override": None,
        "recruiter_score": recruiter_score,
        "knockout_status": knockout_status,
        "resume_snapshot": resume_snapshot,
        "features": features_data,
        "stage": ApplicationStage.APPLIED.value,
        "scoring_version": scoring_version,
        "candidate_name": current_user.full_name,
        "candidate_email": current_user.email,
        "notes": payload.notes if payload else None,
        "created_at": now,
        "updated_at": now,
    }
    created_app = await job_repo.create_candidate_application(app_doc)
    await job_repo.increment_applicant_count(job_id, 1)
    app_id_res = str(created_app.get("id") or created_app.get("_id") or "")

    return ApplicationResponse(
        id=app_id_res,
        job_id=job_id,
        candidate_id=str(current_user.id),
        resume_id=str(target_resume_id),
        match_score=match_score,
        quality_score=quality_score,
        eligibility=eligibility,
        eligibility_rank=eligibility_rank,
        eligibility_override=None,
        recruiter_score=recruiter_score,
        knockout_status=knockout_status,
        resume_snapshot=resume_snapshot,
        features=features_data,
        stage=ApplicationStage.APPLIED.value,
        scoring_version=scoring_version,
        candidate_name=current_user.full_name,
        candidate_email=current_user.email,
        notes=payload.notes if payload else None,
        created_at=now,
    )
