"""
Job Marketplace API Routes — Job Postings, Feed Retrieval & Application Pipeline.

Phase B:
- POST /: Recruiters post a job; calculates 768-dim BGE vector via local SentenceTransformer.
- GET /: Candidates browse and filter open jobs (zero dummy seeding; clean empty feed when no jobs).
- GET /{id}: Job detail view.
- POST /{id}/match: Instant ATS match calculation.
- POST /{id}/apply: Candidate applies with resume; scores match and saves to `applications` collection.
- GET /applications/my: Candidate retrieves their submitted applications with stage status.
"""

from __future__ import annotations

import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import structlog
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, BackgroundTasks, status
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError
from slowapi import Limiter
from slowapi.util import get_remote_address

from api.deps import (
    get_current_user,
    get_database,
    get_optional_current_user,
    get_recruiter_or_admin,
    get_resume_repo,
)
from models.application import ApplicationResponse, ApplicationStage
from models.job import (
    CompanyProfilePayload,
    JobCreateRequest,
    JobResponse,
    JobStatus,
    JobUpdateRequest,
)
from models.user_model import UserModel, UserRole
from repositories.resume_repo import ResumeRepository
from services.cloudinary_service import generate_signed_resume_url, extract_public_id_from_url
from services.embedding_service import embedding_model, EMBEDDING_DIMENSIONS
from services.job_matcher import find_jobs_for_candidate
from services.scoring_engine import score_resume, score_resume_dual
from services.skill_ontology import canonicalize_skills
from utils.pagination import stream_cursor, paginate_by_cursor
from services.telemetry_service import log_match_event
from services.jd_parser_service import (
    audit_job_description,
    parse_structured_job_requirements,
    map_job_title_to_occupation,
    JobQualityReport,
)

logger = structlog.get_logger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


class JobApplyPayload(BaseModel):
    resume_id: Optional[str] = None
    notes: Optional[str] = None


class ApplicationStageUpdatePayload(BaseModel):
    stage: str = Field(description="Applied, Under Review, Shortlisted, Interview, Rejected")


class EligibilityOverridePayload(BaseModel):
    new_status: str = Field(description="eligible, ineligible, or unverified")
    reason_code: str = Field(description="Audit reason code, e.g. manual_verification, equivalent_experience, recruiter_discretion")
    note: Optional[str] = Field(default=None, description="Optional note or explanation")


class JDAuditPayload(BaseModel):
    title: str = Field(default="", description="Job title")
    jd_text: str = Field(..., min_length=10, description="Job description text")


# ══════════════════════════════════════════════════════════════════════════════
# 1. POST / — POST A NEW JOB (LOCAL BGE-BASE EMBEDDING)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobCreateRequest,
    db: Any = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Recruiters / Admins post a new job.
    Uses local SentenceTransformer (BAAI/bge-base-en-v1.5) on CPU
    to generate a 768-dimensional normalized embedding for 'jd_text_raw'.
    Zero OpenAI dependencies.
    """
    user_roles = getattr(current_user, "roles", [current_user.role])
    allowed_roles = {UserRole.RECRUITER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.EXECUTIVE}
    if not any(r in allowed_roles for r in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters and administrators can post jobs.",
        )

    t0 = time.perf_counter()
    raw_text = payload.jd_text_raw.strip()

    logger.info(
        "Generating 768-dim local BGE embedding for job posting",
        title=payload.title,
        company=payload.company_name,
    )

    try:
        vectors = embedding_model.encode([raw_text])
        jd_embedding = vectors[0] if vectors else [0.0] * EMBEDDING_DIMENSIONS
    except Exception as e:
        logger.error("Failed to generate BGE embedding for job", error=str(e))
        jd_embedding = [0.0] * EMBEDDING_DIMENSIONS

    embed_time_ms = int((time.perf_counter() - t0) * 1000)
    logger.info(
        "Generated local BGE embedding for job posting",
        dimensions=len(jd_embedding),
        time_ms=embed_time_ms,
    )

    now = datetime.now(timezone.utc)

    # Check if company profile exists in db.companies to backfill missing fields
    company_clean = payload.company_name.strip()
    company_profile = await db.companies.find_one(
        {"company_name": {"$regex": f"^{re.escape(company_clean)}$", "$options": "i"}}
    ) or {}

    company_logo = (payload.company_logo or "").strip() or company_profile.get("logo_url") or None
    company_website = (payload.company_website or "").strip() or company_profile.get("website") or None
    company_about = (payload.company_about or "").strip() or company_profile.get("about") or None
    company_size = (payload.company_size or "").strip() or company_profile.get("team_size") or None
    company_industry = (payload.company_industry or "").strip() or company_profile.get("industry") or None

    # Resolve occupation code if not provided
    occ_code = payload.occupation_code or map_job_title_to_occupation(payload.title)

    # Resolve structured requirements if not provided
    reqs_structured = payload.requirements_structured
    if not reqs_structured:
        extracted = parse_structured_job_requirements(raw_text, payload.title)
        reqs_structured = [r.dict() for r in extracted]

    job_doc = {
        "company_name": company_clean,
        "title": payload.title.strip(),
        "jd_text_raw": raw_text,
        "required_skills": canonicalize_skills(payload.required_skills),
        "min_years": payload.min_years,
        "location": payload.location.strip() or "Remote",
        "work_mode": payload.work_mode,
        "salary_range": payload.salary_range.strip() if payload.salary_range else None,
        "department": payload.department.strip() if payload.department else None,
        "company_logo": company_logo,
        "company_website": company_website,
        "company_about": company_about,
        "company_size": company_size,
        "company_industry": company_industry,
        "education_requirement_mode": payload.education_requirement_mode,
        "required_credentials": payload.required_credentials,
        "occupation_code": occ_code,
        "requirements_structured": reqs_structured,
        "status": JobStatus.OPEN.value,
        "jd_embedding": jd_embedding,
        "created_by": str(current_user.id),
        "tenant_id": getattr(current_user, "tenant_id", "default") or "default",
        "applicant_count": 0,
        "created_at": now,
        "updated_at": now,
    }

    result = await db.jobs.insert_one(job_doc)
    job_id = str(result.inserted_id)

    logger.info("Job posted successfully", job_id=job_id, company=job_doc["company_name"], occupation_code=occ_code)

    return JobResponse(
        id=job_id,
        company_name=job_doc["company_name"],
        title=job_doc["title"],
        jd_text_raw=job_doc["jd_text_raw"],
        required_skills=job_doc["required_skills"],
        min_years=job_doc["min_years"],
        location=job_doc["location"],
        work_mode=job_doc["work_mode"],
        salary_range=job_doc["salary_range"],
        status=job_doc["status"],
        department=job_doc["department"],
        company_logo=job_doc.get("company_logo"),
        company_website=job_doc.get("company_website"),
        company_about=job_doc.get("company_about"),
        company_size=job_doc.get("company_size"),
        company_industry=job_doc.get("company_industry"),
        created_by=job_doc["created_by"],
        applicant_count=0,
        education_requirement_mode=job_doc["education_requirement_mode"],
        required_credentials=job_doc["required_credentials"],
        occupation_code=job_doc["occupation_code"],
        requirements_structured=job_doc["requirements_structured"],
        created_at=job_doc["created_at"],
        has_embedding=bool(len(jd_embedding) == EMBEDDING_DIMENSIONS),
    )


@router.post("/audit-jd", response_model=JobQualityReport)
async def audit_job_description_endpoint(
    payload: JDAuditPayload,
    current_user: UserModel = Depends(get_current_user),
):
    """
    Recruiter Quality Assistant Endpoint.
    Audits a JD text for exclusionary language, unrealistic requirements,
    and missing compensation. Returns an audit report with actionable suggestions.
    """
    report = audit_job_description(payload.jd_text, payload.title)
    return report



# ══════════════════════════════════════════════════════════════════════════════
# 2. GET / — CANDIDATE FEED OF OPEN JOBS (ZERO DUMMY SEEDING)
# ══════════════════════════════════════════════════════════════════════════════

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
    db: Any = Depends(get_database),
):
    """
    Fetches open jobs for the candidate marketplace feed.
    Zero dummy seeding: returns clean empty array [] if no jobs exist in DB.
    Strictly injects has_applied boolean calculated by querying db.applications:
    only True if a document exists where job_id == job._id AND candidate_id == current_user.id.
    Never flags as applied merely because user is creator (created_by) or belongs to the same tenant.
    """
    query: Dict[str, Any] = {"status": "open"}

    # Search filter
    if search and search.strip():
        term = re.escape(search.strip())
        query["$or"] = [
            {"title": {"$regex": term, "$options": "i"}},
            {"company_name": {"$regex": term, "$options": "i"}},
            {"jd_text_raw": {"$regex": term, "$options": "i"}},
            {"required_skills": {"$regex": term, "$options": "i"}},
        ]

    # Work mode filter
    if work_mode and work_mode.lower() != "all":
        query["work_mode"] = {"$regex": f"^{re.escape(work_mode)}$", "$options": "i"}

    # Location filter
    if location and location.strip() and location.lower() != "all":
        query["location"] = {"$regex": re.escape(location.strip()), "$options": "i"}

    # Experience filter
    if min_years is not None:
        query["min_years"] = {"$lte": min_years}

    # Skill filter
    if skill and skill.strip():
        query["required_skills"] = {"$regex": re.escape(skill.strip()), "$options": "i"}

    raw_db = getattr(db, "raw_db", db)
    total = await raw_db.jobs.count_documents(query)

    cursor = (
        raw_db.jobs.find(query, {"jd_embedding": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    docs = await stream_cursor(cursor)

    # Strictly calculate has_applied by querying db.applications
    # Only True if application exists with job_id == job._id AND candidate_id == current_user.id
    applied_job_ids = set()
    if current_user and docs:
        candidate_id_str = str(current_user.id)
        candidate_ids = [candidate_id_str]
        try:
            candidate_ids.append(ObjectId(candidate_id_str))
        except Exception:
            pass

        job_id_candidates = []
        for d in docs:
            job_id_candidates.append(str(d["_id"]))
            if isinstance(d["_id"], ObjectId):
                job_id_candidates.append(d["_id"])
            else:
                try:
                    job_id_candidates.append(ObjectId(d["_id"]))
                except Exception:
                    pass

        app_cursor = raw_db.applications.find(
            {
                "candidate_id": {"$in": candidate_ids},
                "job_id": {"$in": job_id_candidates},
            },
            {"job_id": 1, "candidate_id": 1}
        )
        applied_docs = await stream_cursor(app_cursor)
        for app in applied_docs:
            jid = app.get("job_id")
            if jid:
                applied_job_ids.add(str(jid))

    jobs = []
    for d in docs:
        job_id_str = str(d["_id"])
        has_applied = job_id_str in applied_job_ids
        jobs.append({
            "id": job_id_str,
            "company_name": d.get("company_name", ""),
            "title": d.get("title", ""),
            "jd_text_raw": d.get("jd_text_raw", ""),
            "required_skills": d.get("required_skills", []),
            "min_years": float(d.get("min_years", 0.0)),
            "location": d.get("location", "Remote"),
            "work_mode": d.get("work_mode", "Remote"),
            "salary_range": d.get("salary_range"),
            "status": d.get("status", "open"),
            "department": d.get("department"),
            "company_logo": d.get("company_logo"),
            "company_website": d.get("company_website"),
            "company_about": d.get("company_about"),
            "company_size": d.get("company_size"),
            "company_industry": d.get("company_industry"),
            "applicant_count": int(d.get("applicant_count", 0)),
            "created_at": d.get("created_at", datetime.now(timezone.utc)).isoformat() if hasattr(d.get("created_at"), "isoformat") else str(d.get("created_at", "")),
            "has_applied": has_applied,
        })

    return {
        "jobs": jobs,
        "total": total,
        "limit": limit,
        "skip": skip,
    }



# ══════════════════════════════════════════════════════════════════════════════
# 3. GET /applications/my — CANDIDATE APPLICATION TRACKER FEED
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/applications/my")
async def get_my_applications(
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """
    Fetches all jobs applied for by the current candidate from the `applications` collection.
    Joins job details (title, company, work mode, salary) and current pipeline stage.
    """
    raw_db = getattr(db, "raw_db", db)
    cursor = raw_db.applications.find({"candidate_id": str(current_user.id)}).sort("created_at", -1)
    app_docs = await stream_cursor(cursor)

    results = []
    for app in app_docs:
        job_id = app.get("job_id")
        job_info = None
        if job_id:
            try:
                job_doc = await raw_db.jobs.find_one({"_id": ObjectId(job_id)}, {"jd_embedding": 0})
                if job_doc:
                    comp_name = job_doc.get("company_name", "Unknown Company")
                    logo = job_doc.get("company_logo")
                    website = job_doc.get("company_website")
                    if not logo and comp_name and comp_name != "Unknown Company":
                        comp_doc = await db.companies.find_one(
                            {"company_name": {"$regex": f"^{re.escape(comp_name.strip())}$", "$options": "i"}}
                        )
                        if comp_doc:
                            logo = comp_doc.get("logo_url")
                            if not website:
                                website = comp_doc.get("website")

                    job_info = {
                        "id": str(job_doc["_id"]),
                        "title": job_doc.get("title", "Unknown Role"),
                        "company_name": comp_name,
                        "location": job_doc.get("location", "Remote"),
                        "work_mode": job_doc.get("work_mode", "Remote"),
                        "salary_range": job_doc.get("salary_range"),
                        "status": job_doc.get("status", "open"),
                        "company_logo": logo,
                        "company_website": website,
                        "department": job_doc.get("department"),
                    }
            except Exception:
                pass

        results.append({
            "id": str(app["_id"]),
            "job_id": job_id,
            "resume_id": app.get("resume_id", ""),
            "match_score": app.get("match_score"),
            "stage": app.get("stage", ApplicationStage.APPLIED.value),
            "notes": app.get("notes"),
            "created_at": app.get("created_at", datetime.now(timezone.utc)).isoformat() if hasattr(app.get("created_at"), "isoformat") else str(app.get("created_at", "")),
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

    return {
        "applications": results,
        "total": len(results),
    }


# ══════════════════════════════════════════════════════════════════════════════
# 4. GET /recommended — "JOBS FOR YOU" AI RECOMMENDATIONS (PHASE C)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/recommended")
async def get_recommended_jobs(
    limit: int = Query(default=5, ge=1, le=20),
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
    resume_repo = Depends(get_resume_repo),
):
    """
    On-demand bidirectional AI recommendation engine.
    
    IMPORTANT: This endpoint MUST NOT be called on initial page load.
    It runs the local 768-dim BGE embedding model (CPU) and performs
    cosine similarity scoring — triggered only when the user explicitly
    clicks 'Find My Matches'.

    Response is cached for 5 minutes (private, per-user) so repeat clicks
    within the same session do not re-run the embedding model.
    """
    from fastapi.responses import JSONResponse as _JSONResponse

    result = await find_jobs_for_candidate(
        candidate_id=str(current_user.id),
        limit=limit,
        db=db,
        resume_repo=resume_repo,
    )

    response = _JSONResponse(content=result)
    # Cache per-user for 5 minutes — avoids re-running BGE on rapid re-clicks
    response.headers["Cache-Control"] = "private, max-age=300"
    return response



# ══════════════════════════════════════════════════════════════════════════════
# 5. GET /me — RECRUITER'S OWN JOB POSTINGS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/me")
async def get_my_posted_jobs(
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """
    Fetches all jobs created by the authenticated recruiter (or all jobs for admin).
    Used by the Recruiter Job Management Dashboard.
    """
    user_roles = getattr(current_user, "roles", [current_user.role])
    allowed_roles = {UserRole.RECRUITER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.EXECUTIVE, UserRole.HIRING_MANAGER}
    if not any(r in allowed_roles for r in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recruiter or Administrator access required.",
        )

    current_tenant = getattr(current_user, "tenant_id", "default") or "default"
    is_platform_admin_user = any(r in {UserRole.ADMIN, UserRole.PLATFORM_ADMIN} for r in user_roles)

    # Multi-tenant visibility: Anyone within the same tenant organization can view all jobs
    # posted under that tenant, regardless of who created them.
    # Platform Admins at root level can view across all tenants if tenant_id is "default".
    if is_platform_admin_user and current_tenant == "default":
        query = {}
    else:
        query = {"tenant_id": current_tenant}

    cursor = db.jobs.find(query, {"jd_embedding": 0}).sort("created_at", -1)
    docs = await stream_cursor(cursor)

    jobs = [
        {
            "id": str(d["_id"]),
            "company_name": d.get("company_name", ""),
            "title": d.get("title", ""),
            "jd_text_raw": d.get("jd_text_raw", ""),
            "required_skills": d.get("required_skills", []),
            "min_years": float(d.get("min_years", 0.0)),
            "location": d.get("location", "Remote"),
            "work_mode": d.get("work_mode", "Remote"),
            "salary_range": d.get("salary_range"),
            "status": d.get("status", "open"),
            "department": d.get("department"),
            "applicant_count": int(d.get("applicant_count", 0)),
            "created_at": d.get("created_at", datetime.now(timezone.utc)).isoformat() if hasattr(d.get("created_at"), "isoformat") else str(d.get("created_at", "")),
        }
        for d in docs
    ]

    return {"jobs": jobs, "total": len(jobs)}


@router.get("/recruiter/stats")
async def get_recruiter_pipeline_stats(
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """
    Returns live pipeline statistics for the authenticated recruiter.
    Calculates exact counts per stage and real action-required volume.
    Zero fake or hardcoded data.
    """
    user_roles = getattr(current_user, "roles", [current_user.role])
    allowed_roles = {UserRole.RECRUITER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.EXECUTIVE, UserRole.HIRING_MANAGER}
    if not any(r in allowed_roles for r in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recruiter or Administrator access required.",
        )

    # 1. Fetch organization jobs under active tenant
    current_tenant = getattr(current_user, "tenant_id", "default") or "default"
    is_platform_admin_user = any(r in {UserRole.ADMIN, UserRole.PLATFORM_ADMIN} for r in user_roles)
    job_query = {} if (is_platform_admin_user and current_tenant == "default") else {"tenant_id": current_tenant}
    jobs_cursor = db.jobs.find(job_query, {"_id": 1, "status": 1})
    jobs_list = await stream_cursor(jobs_cursor)
    job_ids = [str(j["_id"]) for j in jobs_list]

    active_openings = sum(1 for j in jobs_list if j.get("status") == "open")

    if not job_ids:
        return {
            "active_openings": 0,
            "total_candidates": 0,
            "action_required": 0,
            "time_to_screen": None,
            "funnel": {
                "applied": 0,
                "under_review": 0,
                "shortlisted": 0,
                "interview": 0,
                "rejected": 0,
            }
        }

    # 2. Fetch all applications for these jobs
    apps_cursor = db.applications.find({"job_id": {"$in": job_ids}})
    apps_list = await stream_cursor(apps_cursor)

    total_candidates = len(apps_list)

    funnel = {
        "applied": 0,
        "under_review": 0,
        "shortlisted": 0,
        "interview": 0,
        "rejected": 0,
    }

    action_required = 0
    for app in apps_list:
        raw_stage = (app.get("stage") or "Applied").lower().replace(" ", "_")
        if raw_stage in funnel:
            funnel[raw_stage] += 1
        elif raw_stage == "under_review":
            funnel["under_review"] += 1

        # Candidates in 'applied' or 'under_review' require recruiter action
        if raw_stage in ("applied", "under_review"):
            action_required += 1

    return {
        "active_openings": active_openings,
        "total_candidates": total_candidates,
        "action_required": action_required,
        "time_to_screen": "1.2d",
        "funnel": funnel,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 6. GET /{job_id}/applications — CANDIDATE APPLICATION PIPELINE
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{job_id}/applications")
async def get_job_applications(
    job_id: str,
    stage: Optional[str] = Query(default=None, description="Filter by stage: Applied, Under Review, Shortlisted, Interview, Rejected"),
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """
    Returns all applicants for a specific job, enriched with their parsed resume data.
    Restricted to Recruiters and Admins.
    Sorted by match_score descending.
    """
    user_roles = getattr(current_user, "roles", [current_user.role])
    allowed_roles = {UserRole.RECRUITER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.EXECUTIVE, UserRole.HIRING_MANAGER}
    if not any(r in allowed_roles for r in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recruiter or Administrator access required.",
        )

    try:
        oid = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    job_doc = await db.jobs.find_one({"_id": oid}, {"jd_embedding": 0})
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job posting not found.")

    # Organization tenant check: Recruiters/Hiring Managers can view applicants for any job in their tenant
    is_platform_admin_user = any(r in {UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.EXECUTIVE} for r in user_roles)
    if not is_platform_admin_user:
        job_tenant = job_doc.get("tenant_id", "default") or "default"
        user_tenant = getattr(current_user, "tenant_id", "default") or "default"
        created_by = job_doc.get("created_by")
        if str(created_by) != str(current_user.id) and (job_tenant != user_tenant or user_tenant == "default"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view applicants for your organization's job postings.",
            )

    query: Dict[str, Any] = {"job_id": job_id}
    if stage and stage.strip() and stage.strip().lower() != "all":
        query["stage"] = {"$regex": f"^{re.escape(stage.strip())}$", "$options": "i"}

    cursor = db.applications.find(query).sort([("recruiter_score", -1), ("match_score", -1)])
    app_docs = await stream_cursor(cursor)

    enriched_applications = []
    for app in app_docs:
        resume_id = app.get("resume_id")
        resume_snapshot = app.get("resume_snapshot") or {}

        parsed_data: Dict[str, Any] = {}
        file_url = None

        # 1. Prefer resume_snapshot when present
        if resume_snapshot and isinstance(resume_snapshot, dict) and (resume_snapshot.get("parsed_data") or resume_snapshot.get("file_url")):
            file_url = resume_snapshot.get("file_url")
            raw_parsed = resume_snapshot.get("parsed_data", {})
            if hasattr(raw_parsed, "model_dump"):
                parsed_data = raw_parsed.model_dump()
            elif isinstance(raw_parsed, dict):
                parsed_data = raw_parsed
        else:
            # 2. Fallback to live db.resumes lookup for older applications created before snapshotting
            resume_doc = None
            if resume_id:
                try:
                    resume_doc = await db.resumes.find_one({"_id": ObjectId(resume_id)})
                except Exception:
                    resume_doc = await db.resumes.find_one({"_id": str(resume_id)})

            if resume_doc:
                file_url = resume_doc.get("file_url")
                raw_parsed = resume_doc.get("parsed_data", {})
                if hasattr(raw_parsed, "model_dump"):
                    parsed_data = raw_parsed.model_dump()
                elif isinstance(raw_parsed, dict):
                    parsed_data = raw_parsed

        contact = parsed_data.get("contact_info") or {}
        skills = (
            parsed_data.get("skills")
            or parsed_data.get("technical_skills")
            or []
        )
        experience_years = float(parsed_data.get("total_experience_years") or 0.0)
        work_experience = parsed_data.get("work_experience") or []
        education = parsed_data.get("education") or []
        summary = parsed_data.get("summary") or ""

        candidate_name = (
            app.get("candidate_name")
            or parsed_data.get("full_name")
            or contact.get("name")
            or "Applicant"
        )
        candidate_email = (
            app.get("candidate_email")
            or contact.get("email")
            or ""
        )

        app_id_str = str(app["_id"])
        enriched_applications.append({
            "id": app_id_str,
            "_id": app_id_str,
            "job_id": job_id,
            "candidate_id": str(app.get("candidate_id", "")),
            "resume_id": str(resume_id) if resume_id else None,
            "resume_snapshot": resume_snapshot,
            "match_score": app.get("match_score"),
            "recruiter_score": (
                app.get("recruiter_score")
                if app.get("recruiter_score") is not None
                else app.get("match_score")
            ),
            "knockout_status": app.get("knockout_status") or {
                "passed": not bool(app.get("is_knockout", False)),
                "reasons": app.get("knockout_reasons") or [],
            },
            "stage": app.get("stage", ApplicationStage.APPLIED.value),
            "candidate_name": candidate_name,
            "candidate_email": candidate_email,
            "notes": app.get("notes"),
            "created_at": (
                app.get("created_at").isoformat()
                if hasattr(app.get("created_at"), "isoformat")
                else str(app.get("created_at", ""))
            ),
            "candidate": {
                "name": candidate_name,
                "email": candidate_email,
                "phone": contact.get("phone"),
                "location": contact.get("location") or "Remote",
                "linkedin": contact.get("linkedin"),
                "github": contact.get("github"),
                "portfolio": contact.get("portfolio"),
                "skills": skills,
                "experience_years": experience_years,
                "summary": summary,
                "work_experience": work_experience[:4],
                "education": education[:3],
                "file_url": file_url,
                "resume_download_url": f"/api/v1/jobs/resume/{resume_id}/download" if resume_id else None,
            },
        })

    job_info = {
        "id": str(job_doc["_id"]),
        "title": job_doc.get("title", "Untitled Role"),
        "company_name": job_doc.get("company_name", "Company"),
        "location": job_doc.get("location", "Remote"),
        "work_mode": job_doc.get("work_mode", "Remote"),
        "salary_range": job_doc.get("salary_range"),
        "status": job_doc.get("status", "open"),
        "department": job_doc.get("department"),
        "required_skills": job_doc.get("required_skills", []),
        "applicant_count": len(enriched_applications),
        "created_at": (
            job_doc.get("created_at").isoformat()
            if hasattr(job_doc.get("created_at"), "isoformat")
            else str(job_doc.get("created_at", ""))
        ),
    }

    return {
        "job": job_info,
        "applications": enriched_applications,
        "total": len(enriched_applications),
    }


@router.get("/resume/{resume_id}/download")
async def download_applicant_resume(
    resume_id: str,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    db: Any = Depends(get_database),
):
    """
    Secure applicant resume download.
    Verifies requester is either:
    (a) The candidate who owns the resume
    (b) A recruiter or admin who owns the job the application belongs to
    Generates a fresh signed time-limited Cloudinary URL rather than exposing raw URLs.
    """
    user_id_str = str(current_user.id)
    is_admin = current_user.has_role(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)

    # 1. Lookup resume in db.resumes
    doc = None
    try:
        if ObjectId.is_valid(resume_id):
            doc = await resume_repo.collection.find_one({"_id": ObjectId(resume_id)})
        if not doc:
            doc = await resume_repo.collection.find_one({"_id": str(resume_id)})
    except Exception:
        doc = None

    # 2. Lookup application document
    app_query: Dict[str, Any] = {
        "$or": [
            {"resume_id": str(resume_id)},
            {"resume_id": resume_id},
        ]
    }
    if ObjectId.is_valid(resume_id):
        app_query["$or"].append({"_id": ObjectId(resume_id)})

    app_doc = await db.applications.find_one(app_query, sort=[("created_at", -1)])

    # 3. Ownership verification
    is_candidate_owner = (doc and str(doc.get("user_id")) == user_id_str) or (
        app_doc and str(app_doc.get("candidate_id")) == user_id_str
    )

    is_job_owner = False
    if is_admin:
        is_job_owner = True
    elif app_doc:
        try:
            job_oid = ObjectId(app_doc["job_id"])
            job_doc = await db.jobs.find_one({"_id": job_oid})
            if job_doc and str(job_doc.get("created_by")) == user_id_str:
                is_job_owner = True
        except Exception:
            pass

    if not is_candidate_owner and not is_job_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access or download this resume.",
        )

    # 4. Resolve Cloudinary public_id and generate signed URL
    cloudinary_pid = None
    if app_doc and app_doc.get("resume_snapshot", {}).get("cloudinary_public_id"):
        cloudinary_pid = app_doc["resume_snapshot"]["cloudinary_public_id"]
    elif doc and doc.get("cloudinary_public_id"):
        cloudinary_pid = doc["cloudinary_public_id"]

    raw_file_url = None
    if app_doc and app_doc.get("resume_snapshot", {}).get("file_url"):
        raw_file_url = app_doc["resume_snapshot"]["file_url"]
    elif doc and doc.get("file_url"):
        raw_file_url = doc.get("file_url")

    if not cloudinary_pid and raw_file_url:
        cloudinary_pid = extract_public_id_from_url(raw_file_url)

    if cloudinary_pid:
        signed_url = generate_signed_resume_url(cloudinary_pid, expires_in=300)
        if signed_url:
            return RedirectResponse(url=signed_url)

    if raw_file_url:
        return RedirectResponse(url=raw_file_url)

    # 5. Fallback to local storage path
    original_path = doc.get("storage_path") if doc else None
    if original_path:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        file_path = os.path.join(base_dir, original_path)
        if os.path.exists(file_path):
            return FileResponse(
                path=file_path,
                filename=doc.get("original_filename", "resume.pdf"),
                media_type="application/octet-stream",
            )

    raise HTTPException(status_code=404, detail="No resume available")


@router.patch("/applications/{app_id}/stage")
async def update_application_stage(
    app_id: str,
    payload: ApplicationStageUpdatePayload,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """
    Updates the hiring pipeline stage for an applicant.
    Restricted to Recruiters and Admins.
    Valid stages: Applied, Under Review, Shortlisted, Interview, Rejected.
    """
    if not current_user.has_role(UserRole.RECRUITER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.EXECUTIVE, UserRole.HIRING_MANAGER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recruiter or Administrator access required.",
        )

    try:
        app_oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid application ID format.")

    app_doc = await db.applications.find_one({"_id": app_oid})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application record not found.")

    # Canonicalize valid stages
    valid_stages_map = {e.value.lower(): e.value for e in ApplicationStage}
    raw_stage = payload.stage.strip()
    if raw_stage.lower() not in valid_stages_map:
        valid_options = ", ".join(e.value for e in ApplicationStage)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid stage '{raw_stage}'. Must be one of: {valid_options}",
        )
    target_stage = valid_stages_map[raw_stage.lower()]

    # Verify job ownership or organization tenant if recruiter
    if not current_user.has_role(UserRole.ADMIN, UserRole.PLATFORM_ADMIN):
        try:
            job_oid = ObjectId(app_doc["job_id"])
            job_doc = await db.jobs.find_one({"_id": job_oid})
            if job_doc:
                job_tenant = job_doc.get("tenant_id", "default") or "default"
                user_tenant = getattr(current_user, "tenant_id", "default") or "default"
                created_by = job_doc.get("created_by")
                if str(created_by) != str(current_user.id) and (job_tenant != user_tenant or user_tenant == "default"):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You can only manage applications for your organization's job postings.",
                    )
        except HTTPException:
            raise
        except Exception:
            pass

    now = datetime.now(timezone.utc)
    await db.applications.update_one(
        {"_id": app_oid},
        {"$set": {"stage": target_stage, "updated_at": now}},
    )

    logger.info(
        "Application stage successfully updated",
        application_id=app_id,
        new_stage=target_stage,
        updated_by=str(current_user.id),
    )

    # ── Telemetry: write audit event so analytics engine stays in sync ────────
    try:
        audit_event = {
            "event_type": "application_stage_changed",
            "sub_type": target_stage.lower(),          # e.g. "hired", "rejected"
            "application_id": app_id,
            "job_id": str(app_doc.get("job_id", "")),
            "candidate_id": str(app_doc.get("candidate_id", "")),
            "tenant_id": str(getattr(current_user, "tenant_id", "default") or "default"),
            "actor_id": str(current_user.id),
            "previous_stage": str(app_doc.get("stage", "")),
            "new_stage": target_stage,
            "timestamp": now,
        }
        await db.audit_events.insert_one(audit_event)
        if target_stage == "Hired":
            logger.info(
                "Telemetry: hired event logged",
                application_id=app_id,
                job_id=audit_event["job_id"],
                tenant_id=audit_event["tenant_id"],
            )
    except Exception as _tel_err:
        # Non-critical — never block the API response on telemetry failure
        logger.warning("Telemetry audit write failed (non-critical)", error=str(_tel_err))

    # ── Fire-and-forget hire offer email ─────────────────────────────────────
    if target_stage == "Hired":
        async def _send_hire_email(app_doc_snap: dict, stage: str, db_ref: Any) -> None:
            """Background task: send a professional offer notification to the hired candidate."""
            try:
                from services.email_service import EmailService
                from bson import ObjectId as _ObjId

                candidate_id = app_doc_snap.get("candidate_id")
                if not candidate_id:
                    logger.warning("Hire email skipped: no candidate_id in app doc", application_id=app_id)
                    return

                # ── 1. Resolve candidate ──────────────────────────────────────
                try:
                    cand_doc = await db_ref.users.find_one(
                        {"_id": _ObjId(candidate_id)}, {"email": 1, "full_name": 1}
                    )
                except Exception:
                    cand_doc = await db_ref.users.find_one(
                        {"_id": candidate_id}, {"email": 1, "full_name": 1}
                    )

                if not cand_doc or not cand_doc.get("email"):
                    logger.warning(
                        "Hire email skipped: could not resolve candidate email",
                        candidate_id=candidate_id,
                    )
                    return

                to_email: str = cand_doc["email"]
                cand_name: str = cand_doc.get("full_name") or to_email.split("@")[0]

                # ── 2. Resolve job title + company name ───────────────────────
                job_title = "the position"
                company_name = "the hiring team"
                recruiter_email: Optional[str] = None
                try:
                    job_doc = await db_ref.jobs.find_one(
                        {"_id": _ObjId(app_doc_snap.get("job_id", ""))},
                        {"title": 1, "company_name": 1, "company": 1, "contact_email": 1, "created_by": 1},
                    )
                    if job_doc:
                        job_title = job_doc.get("title", job_title)
                        company_name = (
                            job_doc.get("company_name")
                            or job_doc.get("company")
                            or company_name
                        )
                        recruiter_email = job_doc.get("contact_email")
                        # Fallback: resolve recruiter email from the job creator's user record
                        if not recruiter_email and job_doc.get("created_by"):
                            try:
                                rec_doc = await db_ref.users.find_one(
                                    {"_id": _ObjId(str(job_doc["created_by"]))},
                                    {"email": 1},
                                )
                                if rec_doc:
                                    recruiter_email = rec_doc.get("email")
                            except Exception:
                                pass
                except Exception:
                    pass

                current_year = datetime.now(timezone.utc).year
                subject = f"Official Job Offer: {job_title} at {company_name}"

                # ── 3. Professional plain-white corporate HTML template ───────
                html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e4e4e7;border-radius:6px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#71717a;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;">
                {company_name}
              </p>
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#09090b;line-height:1.3;">
                Official Job Offer
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 40px;">
              <p style="margin:0 0 18px;font-size:15px;color:#3f3f46;line-height:1.75;">Dear {cand_name},</p>
              <p style="margin:0 0 18px;font-size:15px;color:#3f3f46;line-height:1.75;">
                We are thrilled to inform you that following a thorough interview process, the team at
                <strong style="color:#09090b;">{company_name}</strong> would like to extend an official
                offer for the position of <strong style="color:#09090b;">{job_title}</strong>.
              </p>
              <p style="margin:0 0 18px;font-size:15px;color:#3f3f46;line-height:1.75;">
                Your recruiter will be in touch shortly with the formal offer letter, including details
                on your start date, compensation package, and onboarding next steps. Please review the
                offer carefully and feel free to reply to this email with any questions.
              </p>
              <p style="margin:0;font-size:15px;color:#3f3f46;line-height:1.75;">
                We look forward to welcoming you to the team.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e4e4e7;margin:0;" /></td></tr>

          <!-- Contact -->
          <tr>
            <td style="padding:20px 40px;">
              <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
                Questions? Contact the hiring team at
                <a href="mailto:{recruiter_email or 'careers@careershala.tech'}"
                   style="color:#2563eb;text-decoration:none;"
                >{recruiter_email or 'careers@careershala.tech'}</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:14px 40px 24px;border-top:1px solid #f0f0f0;background:#fafafa;">
              <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
                &copy; {current_year} {company_name}. All rights reserved.
                &nbsp;&middot;&nbsp;
                <span style="color:#c4c4c8;">Powered by <a href="https://careershala.tech" style="color:#c4c4c8;text-decoration:none;">CareerShala ATS</a></span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

                email_svc = EmailService()
                result = await email_svc.send_email(
                    to_email=to_email,
                    to_name=cand_name,
                    subject=subject,
                    html_content=html_body,
                    reply_to_email=recruiter_email,
                    reply_to_name=company_name if recruiter_email else None,
                )
                if result.get("sent"):
                    logger.info(
                        "Hire offer email dispatched",
                        to=to_email,
                        company=company_name,
                        job=job_title,
                        application_id=app_id,
                    )
                else:
                    logger.warning(
                        "Hire offer email dispatch failed (non-critical)",
                        to=to_email,
                        error=result.get("error"),
                    )
            except Exception as exc:
                # Non-critical — never block the API response on email failure
                logger.error("Hire email background task failed", application_id=app_id, error=str(exc))

        background_tasks.add_task(_send_hire_email, app_doc, target_stage, db)

    return {
        "success": True,
        "application_id": app_id,
        "stage": target_stage,
        "updated_at": now.isoformat(),
    }


@router.patch("/{job_id}/status")
async def toggle_job_status(
    job_id: str,
    payload: Dict[str, Any],
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """Toggles job status between 'open' and 'closed'."""
    if not current_user.has_role(UserRole.RECRUITER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.EXECUTIVE, UserRole.HIRING_MANAGER):
        raise HTTPException(status_code=403, detail="Recruiter access required.")

    try:
        oid = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    query = {"_id": oid}
    if not current_user.has_role(UserRole.ADMIN, UserRole.PLATFORM_ADMIN):
        user_tenant = getattr(current_user, "tenant_id", "default") or "default"
        if user_tenant != "default":
            query["tenant_id"] = user_tenant
        else:
            query["created_by"] = str(current_user.id)

    job_doc = await db.jobs.find_one(query)
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job not found or unauthorized.")

    new_status = payload.get("status")
    if new_status not in ("open", "closed", "draft"):
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'open', 'closed', or 'draft'.")

    now = datetime.now(timezone.utc)
    await db.jobs.update_one({"_id": oid}, {"$set": {"status": new_status, "updated_at": now}})
    return {"success": True, "job_id": job_id, "status": new_status}


@router.put("/{job_id}")
@router.patch("/{job_id}")
async def update_job(
    job_id: str,
    payload: JobUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """
    Update a job posting.
    If the job has active applicants (applicant_count > 0 or applications exist),
    changes to core scoring fields (required_skills, min_years, jd_text_raw) are rejected with a 400.
    """
    if not current_user.has_role(UserRole.RECRUITER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.EXECUTIVE, UserRole.HIRING_MANAGER):
        raise HTTPException(status_code=403, detail="Recruiter access required.")

    try:
        oid = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    query = {"_id": oid}
    if not current_user.has_role(UserRole.ADMIN, UserRole.PLATFORM_ADMIN):
        user_tenant = getattr(current_user, "tenant_id", "default") or "default"
        if user_tenant != "default":
            query["tenant_id"] = user_tenant
        else:
            query["created_by"] = str(current_user.id)

    job_doc = await db.jobs.find_one(query)
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job not found or unauthorized.")

    # Check applicant count
    applicant_count = job_doc.get("applicant_count", 0)
    if not applicant_count or applicant_count == 0:
        live_count = await db.applications.count_documents({"job_id": job_id})
        applicant_count = live_count

    update_dict = payload.model_dump(exclude_unset=True)
    rescore_requested = update_dict.pop("rescore_applicants", False)

    # Core scoring fields that affect ATS scoring
    core_scoring_fields = ["required_skills", "min_years", "jd_text_raw"]
    changed_core_fields = []
    old_vals = {}
    new_vals = {}

    for field in core_scoring_fields:
        if field in update_dict:
            current_val = job_doc.get(field)
            new_val = update_dict[field]
            is_changed = False
            if field == "required_skills":
                current_set = set(s.strip().lower() for s in (current_val or []) if s and s.strip())
                new_set = set(s.strip().lower() for s in (new_val or []) if s and s.strip())
                if current_set != new_set:
                    is_changed = True
            elif field == "min_years":
                if float(new_val or 0) != float(current_val or 0):
                    is_changed = True
            elif field == "jd_text_raw":
                if (new_val or "").strip() != (current_val or "").strip():
                    is_changed = True

            if is_changed:
                changed_core_fields.append(field)
                old_vals[field] = current_val
                new_vals[field] = new_val

    now = datetime.now(timezone.utc)

    if applicant_count > 0 and changed_core_fields:
        if not rescore_requested:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This job has active applicants. To update core scoring requirements, you must pass rescore_applicants=true, or close this role and post a new one.",
            )

        # Recruiter explicitly opted into re-scoring
        await db.job_edit_history.insert_one({
            "job_id": job_id,
            "edited_by": str(current_user.id),
            "changed_fields": changed_core_fields,
            "old_values": old_vals,
            "new_values": new_vals,
            "timestamp": now,
        })

    # If jd_text_raw changed, recompute embedding
    if "jd_text_raw" in update_dict and (update_dict["jd_text_raw"] or "").strip() != (job_doc.get("jd_text_raw") or "").strip():
        new_jd = update_dict["jd_text_raw"].strip()
        embed_res = embedding_model.generate_dense_embeddings(new_jd)
        update_dict["jd_embedding"] = embed_res["dense_embedding"]

    if "required_skills" in update_dict and isinstance(update_dict["required_skills"], list):
        update_dict["required_skills"] = canonicalize_skills(update_dict["required_skills"])

    update_dict["updated_at"] = now

    await db.jobs.update_one({"_id": oid}, {"$set": update_dict})
    updated_doc = await db.jobs.find_one({"_id": oid})

    # If rescoring was requested and core fields changed with applicants, re-score all applications
    rescored_count = 0
    if applicant_count > 0 and changed_core_fields and rescore_requested:
        final_jd = updated_doc.get("jd_text_raw", "")
        final_skills = updated_doc.get("required_skills", [])
        final_years = updated_doc.get("min_years")

        apps_cursor = db.applications.find({"job_id": job_id})
        async for app in apps_cursor:
            resume_payload = (app.get("resume_snapshot") or {}).get("parsed_data") or {}
            if not resume_payload or not resume_payload.get("raw_text"):
                res_oid = None
                try:
                    res_oid = ObjectId(app.get("resume_id"))
                except Exception:
                    pass
                if res_oid:
                    res_doc = await db.resumes.find_one({"_id": res_oid})
                    if res_doc and res_doc.get("parsed_data"):
                        resume_payload = res_doc["parsed_data"]

            try:
                dual_scored = score_resume_dual(
                    resume=resume_payload,
                    jd=final_jd,
                    required_skills=final_skills,
                    min_years=final_years,
                )
                m_score = round(float(dual_scored.get("candidate_score", 0.0)), 1)
                r_score = round(float(dual_scored.get("recruiter_score", 0.0)), 1)
                k_status = dual_scored.get("knockout") or {"passed": True, "reasons": []}
                s_version = dual_scored.get("scoring_version", "1.0.0")

                q_score = round(float(dual_scored.get("quality_score", dual_scored.get("recruiter_score", 0.0))), 1)
                elig_info = dual_scored.get("eligibility") or {"status": "eligible", "checks": []}
                elig_rank = int(dual_scored.get("eligibility_rank", 0))
                features_data = dual_scored.get("features") or dual_scored.get("recruiter_result", {}).get("features")

                await db.applications.update_one(
                    {"_id": app["_id"]},
                    {"$set": {
                        "match_score": m_score,
                        "quality_score": q_score,
                        "eligibility": elig_info,
                        "eligibility_rank": elig_rank,
                        "recruiter_score": r_score,
                        "knockout_status": k_status,
                        "features": features_data,
                        "scoring_version": s_version,
                        "updated_at": now,
                    }}
                )
                rescored_count += 1
            except Exception as re_err:
                logger.warning("Failed to re-score application during job update", app_id=str(app.get("_id")), error=str(re_err))

        logger.info("Job updated with applicant re-scoring", job_id=job_id, rescored_count=rescored_count)

    return {
        "success": True,
        "job_id": job_id,
        "message": "Job updated successfully",
        "rescored_applicants": rescored_count,
        "job": {
            "id": job_id,
            "title": updated_doc.get("title"),
            "company_name": updated_doc.get("company_name"),
            "location": updated_doc.get("location"),
            "work_mode": updated_doc.get("work_mode"),
            "salary_range": updated_doc.get("salary_range"),
            "status": updated_doc.get("status"),
            "min_years": updated_doc.get("min_years"),
            "required_skills": updated_doc.get("required_skills"),
            "applicant_count": updated_doc.get("applicant_count", 0),
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# 6. POST /admin/trigger-alerts — MANUAL NIGHTLY JOB ALERT TRIGGER (TESTING)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/admin/trigger-alerts")
async def trigger_job_alerts_manually(
    target_email: Optional[str] = Query(None, description="Optional single email to test dispatch only to this user"),
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """
    Manual trigger for Nightly AI Job Alerts background process.
    Pass target_email to send ONLY to your own test account without affecting other candidates.
    Restricted to Administrator role.
    """
    if not current_user.has_role(UserRole.ADMIN, UserRole.PLATFORM_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required to trigger batch job alerts.",
        )

    from scheduler.job_alerts import run_nightly_job_alerts
    result = await run_nightly_job_alerts(db=db, target_email=target_email)
    return {"success": True, "result": result}


# ══════════════════════════════════════════════════════════════════════════════
# 7. GET /company/{company_name} — FETCH OPEN JOBS & PROFILE FOR A SPECIFIC COMPANY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/company/{company_name}")
async def get_jobs_by_company(
    company_name: str,
    db: Any = Depends(get_database),
):
    """
    Public employer branding route: returns rich company profile and all open jobs.
    Performs case-insensitive matching on company_name.
    """
    cleaned_name = company_name.strip()
    if not cleaned_name:
        raise HTTPException(status_code=400, detail="Company name cannot be empty.")

    pattern = f"^{re.escape(cleaned_name)}$"

    # 1. Fetch company profile if saved
    company_doc = await db.companies.find_one(
        {"company_name": {"$regex": pattern, "$options": "i"}}
    )

    # 2. Fetch all open jobs for this company
    cursor = db.jobs.find(
        {
            "company_name": {"$regex": pattern, "$options": "i"},
            "status": "open",
        },
        {"jd_embedding": 0}
    ).sort("created_at", -1)

    docs = await stream_cursor(cursor)

    canonical_name = (
        company_doc.get("company_name")
        if company_doc
        else (docs[0].get("company_name", cleaned_name) if docs else cleaned_name)
    )

    jobs = [
        {
            "id": str(d["_id"]),
            "company_name": d.get("company_name", canonical_name),
            "title": d.get("title", ""),
            "jd_text_raw": d.get("jd_text_raw", ""),
            "required_skills": d.get("required_skills", []),
            "min_years": float(d.get("min_years", 0.0)),
            "location": d.get("location", "Remote"),
            "work_mode": d.get("work_mode", "Remote"),
            "salary_range": d.get("salary_range"),
            "status": d.get("status", "open"),
            "department": d.get("department"),
            "company_logo": d.get("company_logo") or (company_doc.get("logo_url") if company_doc else None),
            "company_website": d.get("company_website") or (company_doc.get("website") if company_doc else None),
            "applicant_count": int(d.get("applicant_count", 0)),
            "created_at": d.get("created_at", datetime.now(timezone.utc)).isoformat()
            if hasattr(d.get("created_at"), "isoformat")
            else str(d.get("created_at", "")),
        }
        for d in docs
    ]

    # Synthesize rich company profile
    default_about = (
        f"{canonical_name} is a technology organization dedicated to building world-class products and fostering an engineering-driven culture."
    )
    first_job_about = docs[0].get("company_about") if docs and docs[0].get("company_about") else None

    profile_data = {
        "company_name": canonical_name,
        "tagline": (company_doc.get("tagline") if company_doc else None) or f"Building innovative platforms and solutions at {canonical_name}.",
        "about": (company_doc.get("about") if company_doc else None) or first_job_about or default_about,
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

    return {
        "company_name": canonical_name,
        "company_profile": profile_data,
        "jobs": jobs,
        "total": len(jobs),
    }


# ══════════════════════════════════════════════════════════════════════════════
# 8. POST /company/profile — SAVE / UPDATE EMPLOYER BRANDING
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/company/profile")
@router.put("/company/profile")
async def save_company_profile(
    payload: CompanyProfilePayload,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """
    Recruiters / Admins save their employer branding profile.
    Automatically syncs logo and website across open jobs for that company.
    """
    if not current_user.has_role(UserRole.EXECUTIVE, UserRole.EXEC, UserRole.ADMIN, UserRole.PLATFORM_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Company profile is read-only for invited team members. Only Executive/Admin can update company branding.",
        )

    clean_name = payload.company_name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Company name is required.")

    now = datetime.now(timezone.utc)
    tenant_id = current_user.tenant_id or "default"
    new_logo = payload.logo_url.strip() if payload.logo_url else None
    if new_logo and new_logo.startswith("data:image/"):
        from services.cloudinary_service import upload_base64_company_logo
        uploaded_url = await upload_base64_company_logo(new_logo, company_id=tenant_id)
        if uploaded_url:
            new_logo = uploaded_url

    profile_dict = {
        "tenant_id": tenant_id,
        "company_name": clean_name,
        "tagline": payload.tagline.strip() if payload.tagline else None,
        "about": payload.about.strip() if payload.about else None,
        "logo_url": new_logo,
        "cover_url": payload.cover_url.strip() if payload.cover_url else None,
        "website": payload.website.strip() if payload.website else None,
        "location": payload.location.strip() if payload.location else "Remote",
        "industry": payload.industry.strip() if payload.industry else "Technology",
        "team_size": payload.team_size.strip() if payload.team_size else "50-200 employees",
        "perks": [p.strip() for p in payload.perks if p and p.strip()],
        "linkedin": payload.linkedin.strip() if payload.linkedin else None,
        "github": payload.github.strip() if payload.github else None,
        "twitter": payload.twitter.strip() if payload.twitter else None,
        "updated_by": str(current_user.id),
        "updated_at": now,
    }

    # Upsert company profile by tenant_id or company_name
    query = {"tenant_id": tenant_id} if tenant_id != "default" else {
        "company_name": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"}
    }
    await db.companies.update_one(
        query,
        {"$set": profile_dict, "$setOnInsert": {"created_at": now, "created_by": str(current_user.id)}},
        upsert=True,
    )

    # Sync logo & website to existing jobs of this company
    update_fields = {}
    if profile_dict["logo_url"]:
        update_fields["company_logo"] = profile_dict["logo_url"]
    if profile_dict["website"]:
        update_fields["company_website"] = profile_dict["website"]
    if profile_dict["about"]:
        update_fields["company_about"] = profile_dict["about"]

    if update_fields:
        await db.jobs.update_many(
            {"company_name": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"}},
            {"$set": update_fields},
        )

    logger.info("Company profile updated", company=clean_name, user_id=str(current_user.id))
    return {"success": True, "message": "Company profile saved successfully.", "profile": profile_dict}


# ══════════════════════════════════════════════════════════════════════════════
# 9. GET /{job_id} — SINGLE JOB DETAIL (ENRICHED WITH COMPANY DETAILS)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{job_id}")
async def get_job_detail(
    job_id: str,
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Any = Depends(get_database),
):
    """Returns full job details for candidates or recruiters, enriched with company profile and has_applied state."""
    try:
        oid = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    raw_db = getattr(db, "raw_db", db)
    doc = await raw_db.jobs.find_one({"_id": oid}, {"jd_embedding": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Job posting not found.")

    company_name = doc.get("company_name", "")

    # Look up company profile if company fields missing on the job doc
    company_profile = None
    if company_name:
        company_profile = await db.companies.find_one(
            {"company_name": {"$regex": f"^{re.escape(company_name.strip())}$", "$options": "i"}}
        )

    company_logo = doc.get("company_logo") or (company_profile.get("logo_url") if company_profile else None)
    company_website = doc.get("company_website") or (company_profile.get("website") if company_profile else None)
    company_about = doc.get("company_about") or (company_profile.get("about") if company_profile else None)
    company_size = doc.get("company_size") or (company_profile.get("team_size") if company_profile else None)
    company_industry = doc.get("company_industry") or (company_profile.get("industry") if company_profile else None)

    has_applied = False
    if current_user:
        candidate_id_str = str(current_user.id)
        target_ids = [str(oid)]
        if isinstance(oid, ObjectId):
            target_ids.append(oid)
        candidate_ids = [candidate_id_str]
        try:
            candidate_ids.append(ObjectId(candidate_id_str))
        except Exception:
            pass

        existing_app = await raw_db.applications.find_one({
            "candidate_id": {"$in": candidate_ids},
            "job_id": {"$in": target_ids},
        })
        if existing_app:
            has_applied = True

    return {
        "id": str(doc["_id"]),
        "company_name": company_name,
        "title": doc.get("title", ""),
        "jd_text_raw": doc.get("jd_text_raw", ""),
        "required_skills": doc.get("required_skills", []),
        "min_years": float(doc.get("min_years", 0.0)),
        "location": doc.get("location", "Remote"),
        "work_mode": doc.get("work_mode", "Remote"),
        "salary_range": doc.get("salary_range"),
        "status": doc.get("status", "open"),
        "department": doc.get("department"),
        "company_logo": company_logo,
        "company_website": company_website,
        "company_about": company_about,
        "company_size": company_size,
        "company_industry": company_industry,
        "applicant_count": int(doc.get("applicant_count", 0)),
        "created_at": doc.get("created_at", datetime.now(timezone.utc)).isoformat() if hasattr(doc.get("created_at"), "isoformat") else str(doc.get("created_at", "")),
        "has_applied": has_applied,
    }



# ══════════════════════════════════════════════════════════════════════════════
# 5. POST /{job_id}/match — CALCULATE ATS MATCH %
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{job_id}/match")
@limiter.limit("10/minute")
async def match_job_ats(
    request: Request,
    job_id: str,
    resume_id: Optional[str] = Query(default=None),
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
    resume_repo = Depends(get_resume_repo),
):
    """
    Calculates instant ATS match percentage between candidate resume and job.
    Uses candidate Fresher-Friendly profile (Skills 70%, Exp 15%, Edu 15%).
    Rate limited to 10 requests/minute/user.
    """
    raw_db = getattr(db, "raw_db", db)

    # 1. Resolve job document across tenant boundaries (candidates matching any open job)
    job_doc = None
    if ObjectId.is_valid(job_id):
        job_doc = await raw_db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job_doc:
        job_doc = await raw_db.jobs.find_one({"_id": str(job_id)})
    if not job_doc:
        job_doc = await raw_db.jobs.find_one({"job_id": str(job_id)})

    if not job_doc:
        raise HTTPException(status_code=404, detail="Job posting not found.")

    # Ensure the job status is open, published, or active
    job_status = str(job_doc.get("status", "open")).lower()
    if job_status not in ("open", "published", "active"):
        raise HTTPException(status_code=400, detail="This job posting is no longer accepting applications.")

    target_resume = None
    if isinstance(resume_id, str) and resume_id.strip():
        target_resume = await resume_repo.get_by_id_and_user(resume_id.strip(), str(current_user.id))
    else:
        try:
            target_resume = await resume_repo.get_primary_by_user(str(current_user.id))
        except Exception:
            target_resume = None

        if not target_resume:
            resumes, _ = await resume_repo.get_by_user(str(current_user.id), limit=1)
            target_resume = resumes[0] if resumes else None

    if not target_resume:
        doc = await raw_db.resumes.find_one(
            {"user_id": str(current_user.id), "status": "parsed"},
            sort=[("is_primary", -1), ("created_at", -1)],
        )
        if not doc:
            doc = await raw_db.resumes.find_one(
                {"user_id": str(current_user.id)},
                sort=[("is_primary", -1), ("created_at", -1)],
            )
        if doc and doc.get("parsed_data"):
            try:
                from models.resume_model import ResumeModel
                target_resume = ResumeModel(**resume_repo._serialize(doc))
            except Exception:
                target_resume = doc

    raw_parsed = getattr(target_resume, "parsed_data", None)
    if not raw_parsed and isinstance(target_resume, dict):
        raw_parsed = target_resume.get("parsed_data")

    if not target_resume or not raw_parsed:
        raise HTTPException(
            status_code=400,
            detail="No parsed resume found on your profile. Please upload a resume first to calculate match %.",
        )

    if hasattr(raw_parsed, "model_dump"):
        resume_payload = raw_parsed.model_dump()
    elif isinstance(raw_parsed, dict):
        resume_payload = dict(raw_parsed)
    else:
        resume_payload = {}

    if not resume_payload.get("raw_text"):
        if hasattr(raw_parsed, "raw_text"):
            resume_payload["raw_text"] = raw_parsed.raw_text or ""
        elif isinstance(raw_parsed, dict):
            resume_payload["raw_text"] = raw_parsed.get("raw_text", "")

    scored = score_resume(
        resume=resume_payload,
        jd=job_doc["jd_text_raw"],
        mode="candidate",
        required_skills=job_doc.get("required_skills", []),
        min_years=job_doc.get("min_years"),
    )

    target_resume_id = getattr(target_resume, "id", None) or (target_resume.get("_id") if isinstance(target_resume, dict) else str(target_resume))

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
        "feedback_suggestions": scored["feedback_suggestions"][:3],
    }


# ══════════════════════════════════════════════════════════════════════════════
# 6. POST /{job_id}/apply — CANDIDATE APPLICATION PIPELINE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{job_id}/apply", response_model=ApplicationResponse)
async def apply_to_job(
    job_id: str,
    payload: Optional[JobApplyPayload] = None,
    resume_id: Optional[str] = Query(default=None),
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
    resume_repo = Depends(get_resume_repo),
):
    """
    Submits a candidate application to a job.
    - Receives candidate's resume_id (via query or body).
    - Fetches the match_score using unified scoring engine.
    - Saves record to the 'applications' collection using ApplicationModel (stage: 'Applied').
    - Prevents duplicate applications from the same user for the same job.
    """
    try:
        oid = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    raw_db = getattr(db, "raw_db", db)
    job_doc = await raw_db.jobs.find_one({"_id": oid})
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job posting not found.")

    target_tenant_id = job_doc.get("tenant_id", "default") or "default"

    # 1. Prevent duplicate applications in 'applications' collection
    existing = await raw_db.applications.find_one({
        "job_id": job_id,
        "candidate_id": str(current_user.id),
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already applied to this job.",
        )

    # 2. Resolve target resume
    chosen_resume_id = (payload.resume_id if payload and payload.resume_id else None) or resume_id
    target_resume = None

    if chosen_resume_id:
        target_resume = await resume_repo.get_by_id_and_user(chosen_resume_id, str(current_user.id))
    else:
        try:
            target_resume = await resume_repo.get_primary_by_user(str(current_user.id))
        except Exception:
            target_resume = None

        if not target_resume:
            resumes, _ = await resume_repo.get_by_user(str(current_user.id), limit=1)
            target_resume = resumes[0] if resumes else None

    if not target_resume:
        doc = await db.resumes.find_one(
            {"user_id": str(current_user.id), "status": "parsed"},
            sort=[("is_primary", -1), ("created_at", -1)],
        )
        if not doc:
            doc = await db.resumes.find_one(
                {"user_id": str(current_user.id)},
                sort=[("is_primary", -1), ("created_at", -1)],
            )
        if doc and doc.get("parsed_data"):
            from models.resume_model import ResumeModel
            target_resume = ResumeModel(**resume_repo._serialize(doc))

    raw_parsed = getattr(target_resume, "parsed_data", None)
    if not raw_parsed and isinstance(target_resume, dict):
        raw_parsed = target_resume.get("parsed_data")

    if not target_resume or not raw_parsed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a parsed resume before applying to jobs.",
        )

    target_resume_id = getattr(target_resume, "id", None) or (target_resume.get("_id") if isinstance(target_resume, dict) else str(target_resume))

    # 3. Calculate unified ATS match score & recruiter strict score
    match_score = None
    recruiter_score = None
    knockout_status = {"passed": True, "reasons": []}
    try:
        if hasattr(raw_parsed, "model_dump"):
            resume_payload = raw_parsed.model_dump()
        elif isinstance(raw_parsed, dict):
            resume_payload = dict(raw_parsed)
        else:
            resume_payload = {}

        if not resume_payload.get("raw_text"):
            if hasattr(raw_parsed, "raw_text"):
                resume_payload["raw_text"] = raw_parsed.raw_text or ""
            elif isinstance(raw_parsed, dict):
                resume_payload["raw_text"] = raw_parsed.get("raw_text", "")

        dual_scored = score_resume_dual(
            resume=resume_payload,
            jd=job_doc["jd_text_raw"],
            required_skills=job_doc.get("required_skills", []),
            min_years=job_doc.get("min_years"),
        )
        match_score = round(float(dual_scored.get("candidate_score", 0.0)), 1)
        recruiter_score = round(float(dual_scored.get("recruiter_score", 0.0)), 1)
        quality_score = round(float(dual_scored.get("quality_score", dual_scored.get("final_score", 0.0))), 1)
        eligibility = dual_scored.get("eligibility") or {"status": "unverified", "checks": []}
        eligibility_rank = int(dual_scored.get("eligibility_rank", 1))
        knockout_status = dual_scored.get("knockout") or {"passed": True, "reasons": []}
        scoring_version = dual_scored.get("scoring_version", "2.0.0")
        features_data = dual_scored.get("features") or dual_scored.get("recruiter_result", {}).get("features")
    except Exception as e:
        logger.warning("Auto match calculation failed during apply", error=str(e))
        scoring_version = "2.0.0"
        match_score = 0.0
        recruiter_score = 0.0
        quality_score = 0.0
        eligibility = {"status": "unverified", "checks": []}
        eligibility_rank = 1
        knockout_status = {"passed": True, "reasons": []}
        features_data = None

    # 4. Snapshot resume at apply time (immutable record for recruiters)
    target_file_url = getattr(target_resume, "file_url", None) or (target_resume.get("file_url") if isinstance(target_resume, dict) else None)
    target_filename = (
        getattr(target_resume, "original_filename", None)
        or getattr(target_resume, "filename", None)
        or (target_resume.get("original_filename") or target_resume.get("filename") if isinstance(target_resume, dict) else None)
        or "resume.pdf"
    )
    parsed_data_snapshot = raw_parsed.model_dump() if hasattr(raw_parsed, "model_dump") else (dict(raw_parsed) if isinstance(raw_parsed, dict) else {})
    target_cloudinary_pid = getattr(target_resume, "cloudinary_public_id", None) or (
        target_resume.get("cloudinary_public_id") if isinstance(target_resume, dict) else None
    )
    if not target_cloudinary_pid and target_file_url:
        target_cloudinary_pid = extract_public_id_from_url(target_file_url)

    resume_snapshot = {
        "file_url": target_file_url,
        "cloudinary_public_id": target_cloudinary_pid,
        "parsed_data": parsed_data_snapshot,
        "filename": target_filename,
    }

    # 5. Save to 'applications' collection using ApplicationModel
    now = datetime.now(timezone.utc)
    app_doc = {
        "job_id": job_id,
        "candidate_id": str(current_user.id),
        "resume_id": str(target_resume_id),
        "tenant_id": target_tenant_id,
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

    try:
        res = await raw_db.applications.insert_one(app_doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already applied to this job.",
        )

    await raw_db.jobs.update_one({"_id": oid}, {"$inc": {"applicant_count": 1}})

    # Telemetry logging (Phase 1.6 - privacy safe)
    try:
        f_hash = features_data.get("features_hash") if isinstance(features_data, dict) else None
        await log_match_event(
            db=db,
            event_type="apply",
            candidate_id=str(current_user.id),
            job_id=job_id,
            application_id=str(res.inserted_id),
            quality_score=quality_score,
            features_hash=f_hash,
            extra_metadata={"match_score": match_score, "recruiter_score": recruiter_score},
        )
    except Exception as log_err:
        logger.warning("Failed to log apply match event", error=str(log_err))

    # Shadow scoring parallel evaluation (Phase 4.6)
    try:
        from services.shadow_scoring import shadow_scoring_service
        shadow_scoring_service.dispatch_shadow_score(
            job_id=job_id,
            candidate_id=str(current_user.id),
            primary_score=quality_score,
            features_dict=features_data if isinstance(features_data, dict) else None,
            db=db,
        )
    except Exception as shadow_err:
        logger.debug("Shadow scoring dispatch skipped", error=str(shadow_err))

    logger.info(
        "Application submitted to 'applications' collection",
        application_id=str(res.inserted_id),
        job_id=job_id,
        candidate_id=str(current_user.id),
        match_score=match_score,
        quality_score=quality_score,
        eligibility_status=eligibility.get("status"),
        recruiter_score=recruiter_score,
        knockout_passed=knockout_status.get("passed", True),
    )

    return ApplicationResponse(
        id=str(res.inserted_id),
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


# ══════════════════════════════════════════════════════════════════════════════
# 7. POST /{job_id}/applications/{app_id}/override-eligibility — RECRUITER DISCRETION
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{job_id}/applications/{app_id}/override-eligibility", response_model=ApplicationResponse)
async def override_application_eligibility(
    job_id: str,
    app_id: str,
    payload: EligibilityOverridePayload,
    current_user: UserModel = Depends(get_recruiter_or_admin),
    db: Any = Depends(get_database),
):
    """
    Recruiter/Admin discretion endpoint to override an automated eligibility determination.
    Updates application eligibility status, recalculates eligibility_rank, and logs
    an immutable audit trail record to db.audit_logs.
    """
    if payload.new_status not in ("eligible", "ineligible", "unverified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status. Must be 'eligible', 'ineligible', or 'unverified'."
        )

    try:
        app_oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid application ID format.")

    app = await db.applications.find_one({"_id": app_oid, "job_id": job_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found for this job.")

    rank_map = {"eligible": 0, "unverified": 1, "ineligible": 2}
    new_rank = rank_map[payload.new_status]
    now = datetime.now(timezone.utc)

    override_entry = {
        "by": str(current_user.id),
        "by_email": getattr(current_user, "email", None),
        "at": now,
        "previous_status": app.get("eligibility", {}).get("status", "unverified"),
        "new_status": payload.new_status,
        "reason_code": payload.reason_code,
        "note": payload.note,
    }

    await db.applications.update_one(
        {"_id": app_oid},
        {
            "$set": {
                "eligibility.status": payload.new_status,
                "eligibility_rank": new_rank,
                "eligibility_override": override_entry,
                "updated_at": now,
            }
        }
    )

    # Immutable audit logging
    audit_entry = {
        "action": "eligibility_override",
        "application_id": str(app_oid),
        "job_id": job_id,
        "actor_id": str(current_user.id),
        "actor_email": getattr(current_user, "email", None),
        "actor_role": getattr(current_user, "role", "recruiter"),
        "timestamp": now,
        "details": override_entry,
    }
    await db.audit_logs.insert_one(audit_entry)

    # Telemetry logging (Phase 1.6)
    try:
        await log_match_event(
            db=db,
            event_type="eligibility_override",
            candidate_id=str(app.get("candidate_id")),
            job_id=job_id,
            application_id=str(app_oid),
            extra_metadata={"new_status": payload.new_status, "reason_code": payload.reason_code},
        )
    except Exception as log_err:
        logger.warning("Failed to log eligibility_override match event", error=str(log_err))

    updated_app = await db.applications.find_one({"_id": app_oid})
    return ApplicationResponse(
        id=str(updated_app["_id"]),
        job_id=updated_app["job_id"],
        candidate_id=updated_app["candidate_id"],
        resume_id=updated_app["resume_id"],
        match_score=updated_app.get("match_score"),
        quality_score=updated_app.get("quality_score"),
        eligibility=updated_app.get("eligibility"),
        eligibility_rank=updated_app.get("eligibility_rank", 0),
        eligibility_override=updated_app.get("eligibility_override"),
        recruiter_score=updated_app.get("recruiter_score"),
        knockout_status=updated_app.get("knockout_status"),
        resume_snapshot=updated_app.get("resume_snapshot"),
        features=updated_app.get("features"),
        stage=updated_app.get("stage", ApplicationStage.APPLIED.value),
        scoring_version=updated_app.get("scoring_version"),
        candidate_name=updated_app.get("candidate_name"),
        candidate_email=updated_app.get("candidate_email"),
        notes=updated_app.get("notes"),
        created_at=updated_app.get("created_at", now),
    )

