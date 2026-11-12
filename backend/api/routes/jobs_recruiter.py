"""Recruiter, Applicant Pipeline & Employer Branding Routes (mounted under /api/v1/jobs)."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import (
    get_company_repo,
    get_current_user,
    get_db,
    get_job_repo,
    get_app_repo,
    get_recruiter_or_admin,
    get_resume_repo,
)
from config.db import get_pg_session_factory
from models.tables import AuditLog, CandidateApplication, Job
from repositories.application_repo import ApplicationRepository
from repositories.company_repo import CompanyRepository
from repositories.job_repo import JobRepository
from repositories.resume_repo import ResumeRepository
from repositories.user_repo import UserRepository
from schemas.application_schema import ApplicationResponse, ApplicationStage
from schemas.job_schema import (
    CompanyProfilePayload,
    JobCreateRequest,
    JobResponse,
    JobStatus,
    JobUpdateRequest,
)
from schemas.user_schema import UserModel, UserRole
from services.cloudinary_service import extract_public_id_from_url, generate_signed_resume_url
from services.jd_parser_service import map_job_title_to_occupation, parse_jd_with_groq
from services.scoring_engine import score_resume_dual
from services.skill_ontology import canonicalize_skills
from utils.validators import DocumentId

logger = structlog.get_logger(__name__)
router = APIRouter()

job_repo = JobRepository()
app_repo = ApplicationRepository()
resume_repo = ResumeRepository()
company_repo = CompanyRepository()


class ApplicationStageUpdatePayload(BaseModel):
    stage: str = Field(description="Applied, Under Review, Shortlisted, Interview, Rejected")


class EligibilityOverridePayload(BaseModel):
    new_status: str = Field(description="eligible, ineligible, or unverified")
    reason_code: str = Field(description="Audit reason code")
    note: Optional[str] = Field(default=None, description="Optional note or explanation")


@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobCreateRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Recruiters / Admins post a new job."""
    user_roles = getattr(current_user, "roles", [current_user.role])
    allowed_roles = {UserRole.RECRUITER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.EXECUTIVE}
    if not any(r in allowed_roles for r in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters and administrators can post jobs.",
        )

    raw_text = payload.jd_text_raw.strip()
    company_clean = payload.company_name.strip()
    company_profile = (await company_repo.get_by_name(company_clean)) or {}
    now = datetime.now(timezone.utc)

    occ_code = payload.occupation_code or map_job_title_to_occupation(payload.title)
    reqs_structured = payload.requirements_structured
    if not reqs_structured:
        try:
            groq_specs = await parse_jd_with_groq(raw_text)
            if groq_specs and groq_specs.get("required_skills"):
                reqs_structured = [
                    {
                        "text": f"Proficiency in {s}",
                        "criticality": "must_have",
                        "years": groq_specs.get("candidate_min_experience_years"),
                        "is_must_have": True,
                    }
                    for s in groq_specs["required_skills"]
                ]
                if not payload.required_skills:
                    payload.required_skills = groq_specs["required_skills"]
        except Exception as ge:
            logger.warning("Groq structured requirements extraction skipped", error=str(ge))
            reqs_structured = []

    initial_skills = canonicalize_skills(payload.required_skills) if payload.required_skills else []
    job_doc = {
        "company_name": company_clean,
        "title": payload.title.strip(),
        "jd_text_raw": raw_text,
        "required_skills": initial_skills,
        "min_years": payload.min_years,
        "location": payload.location.strip() or "Remote",
        "work_mode": payload.work_mode,
        "salary_range": payload.salary_range.strip() if payload.salary_range else None,
        "department": payload.department.strip() if payload.department else None,
        "company_logo": (payload.company_logo or "").strip() or company_profile.get("logo_url") or None,
        "company_website": (payload.company_website or "").strip() or company_profile.get("website") or None,
        "company_about": (payload.company_about or "").strip() or company_profile.get("about") or None,
        "company_size": (payload.company_size or "").strip() or company_profile.get("team_size") or None,
        "is_external": False,
        "external_apply_url": None,
        "external_job_id": None,
        "company_industry": (payload.company_industry or "").strip() or company_profile.get("industry") or None,
        "education_requirement_mode": payload.education_requirement_mode,
        "required_credentials": payload.required_credentials,
        "occupation_code": occ_code,
        "requirements_structured": reqs_structured,
        "status": JobStatus.OPEN.value,
        "jd_embedding": [],
        "created_by": str(current_user.id),
        "tenant_id": getattr(current_user, "tenant_id", "default") or "default",
        "applicant_count": 0,
        "created_at": now,
        "updated_at": now,
    }

    created = await job_repo.create(job_doc)
    job_id = str(created.get("id") or created.get("_id"))
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
        has_embedding=True,
    )


@router.get("/me")
@router.get("/my-jobs")
async def get_my_posted_jobs(
    current_user: UserModel = Depends(get_current_user),
    session: Optional[AsyncSession] = Depends(get_db),
):
    """Fetch all jobs created under the authenticated recruiter's tenant."""
    user_roles = getattr(current_user, "roles", [current_user.role])
    allowed_roles = {
        UserRole.RECRUITER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN,
        UserRole.EXECUTIVE, UserRole.HIRING_MANAGER, UserRole.INTERVIEWER,
    }
    if not any(r in allowed_roles for r in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recruiter, Interviewer, or Administrator access required.",
        )

    current_tenant = getattr(current_user, "tenant_id", "default") or "default"
    is_platform_admin_user = any(r in {UserRole.ADMIN, UserRole.PLATFORM_ADMIN} for r in user_roles)

    async def _fetch_jobs(sess: AsyncSession):
        stmt = select(Job).where(Job.is_external == False).order_by(Job.created_at.desc())  # noqa: E712
        if not (is_platform_admin_user or current_tenant == "default"):
            stmt = stmt.where(or_(Job.tenant_id == current_tenant, Job.tenant_id == "default", Job.tenant_id == None))
        res = await sess.execute(stmt)
        docs = []
        for j in res.scalars().all():
            d = {c.name: getattr(j, c.name) for c in Job.__table__.columns}
            d["_id"] = d.get("id")
            docs.append(d)

        job_ids = [str(d["_id"]) for d in docs]
        app_counts: Dict[str, int] = {}
        if job_ids:
            counts_res = await sess.execute(
                select(CandidateApplication.job_id, func.count(CandidateApplication.id))
                .where(CandidateApplication.job_id.in_(job_ids))
                .group_by(CandidateApplication.job_id)
            )
            for row in counts_res.all():
                app_counts[str(row[0])] = int(row[1])
        return docs, app_counts

    active_sess = session if hasattr(session, "execute") else None
    if active_sess:
        docs, app_counts = await _fetch_jobs(active_sess)
    else:
        async with get_pg_session_factory()() as sess:
            docs, app_counts = await _fetch_jobs(sess)

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
            "tenant_id": d.get("tenant_id"),
            "applicant_count": app_counts.get(str(d["_id"]), int(d.get("applicant_count", 0))),
            "created_at": d.get("created_at", datetime.now(timezone.utc)).isoformat()
            if hasattr(d.get("created_at"), "isoformat")
            else str(d.get("created_at", "")),
        }
        for d in docs
    ]
    return {"jobs": jobs, "total": len(jobs)}


@router.get("/recruiter/stats")
async def get_recruiter_pipeline_stats(
    current_user: UserModel = Depends(get_current_user),
    session: Optional[AsyncSession] = Depends(get_db),
    db: Optional[Any] = None,
):
    """Return live pipeline funnel counts for the authenticated recruiter."""
    user_roles = getattr(current_user, "roles", [current_user.role])
    allowed_roles = {UserRole.RECRUITER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.EXECUTIVE, UserRole.HIRING_MANAGER}
    if not any(r in allowed_roles for r in user_roles):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Recruiter or Administrator access required.")

    current_tenant = getattr(current_user, "tenant_id", "default") or "default"
    is_platform_admin_user = any(r in {UserRole.ADMIN, UserRole.PLATFORM_ADMIN} for r in user_roles)

    async with get_pg_session_factory()() as sess:
        stmt = select(Job.id, Job.status).where(Job.is_external == False)  # noqa: E712
        if not (is_platform_admin_user or current_tenant == "default"):
            stmt = stmt.where(
                or_(Job.tenant_id == current_tenant, Job.tenant_id == "default", Job.tenant_id == None, Job.created_by == str(current_user.id))
            )
        jobs_rows = (await sess.execute(stmt)).all()
        job_ids = [str(r[0]) for r in jobs_rows]
        active_openings = sum(1 for r in jobs_rows if str(r[1] or "").lower() in ("open", "active"))

        if not job_ids:
            return {
                "active_openings": 0,
                "total_candidates": 0,
                "action_required": 0,
                "time_to_screen": None,
                "funnel": {"applied": 0, "under_review": 0, "shortlisted": 0, "interview": 0, "rejected": 0},
            }

        apps_rows = (await sess.execute(select(CandidateApplication).where(CandidateApplication.job_id.in_(job_ids)))).scalars().all()
        apps_list = []
        for app_row in apps_rows:
            ad = {c.name: getattr(app_row, c.name) for c in CandidateApplication.__table__.columns}
            if app_row.details:
                ad.update(app_row.details)
            apps_list.append(ad)

    funnel = {"applied": 0, "under_review": 0, "shortlisted": 0, "interview": 0, "rejected": 0}
    action_required = 0
    for app in apps_list:
        raw_stage = (app.get("stage") or "Applied").lower().replace(" ", "_")
        if raw_stage in funnel:
            funnel[raw_stage] += 1
        if raw_stage in ("applied", "under_review"):
            action_required += 1

    return {
        "active_openings": active_openings,
        "total_candidates": len(apps_list),
        "action_required": action_required,
        "time_to_screen": "1.2d",
        "funnel": funnel,
    }


@router.get("/resume/{resume_id}/download")
async def download_applicant_resume(
    resume_id: str,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    session: Optional[AsyncSession] = Depends(get_db),
    db: Optional[Any] = None,
):
    """Secure applicant resume download via signed Cloudinary URL or local file."""
    user_id_str = str(current_user.id)
    is_admin = current_user.has_role(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
    doc = await resume_repo.get_by_id(str(resume_id))

    is_candidate_owner = bool(doc and str(doc.get("user_id")) == user_id_str)
    is_job_owner = is_admin or current_user.has_role(UserRole.RECRUITER, UserRole.HIRING_MANAGER, UserRole.INTERVIEWER, UserRole.EXECUTIVE)

    if not is_candidate_owner and not is_job_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access or download this resume.",
        )

    cloudinary_pid = doc.get("cloudinary_public_id") if doc else None
    raw_file_url = doc.get("file_url") if doc else None
    if not cloudinary_pid and raw_file_url:
        cloudinary_pid = extract_public_id_from_url(raw_file_url)
    if cloudinary_pid:
        signed_url = generate_signed_resume_url(cloudinary_pid, expires_in=300)
        if signed_url:
            return RedirectResponse(url=signed_url)
    if raw_file_url:
        return RedirectResponse(url=raw_file_url)

    original_path = doc.get("storage_path") if doc else None
    if original_path:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        file_path = os.path.join(base_dir, original_path)
        if os.path.exists(file_path):
            return FileResponse(path=file_path, filename=doc.get("original_filename", "resume.pdf"), media_type="application/octet-stream")

    raise HTTPException(status_code=404, detail="No resume available")


@router.patch("/applications/{app_id}/stage")
async def update_application_stage(
    app_id: str,
    payload: ApplicationStageUpdatePayload,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
    app_repo: ApplicationRepository = Depends(get_app_repo),
    job_repo: JobRepository = Depends(get_job_repo),
    session: Optional[AsyncSession] = Depends(get_db),
    db: Optional[Any] = None,
):
    """Update hiring pipeline stage for an applicant (Recruiter/Admin)."""
    if not current_user.has_role(UserRole.RECRUITER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.EXECUTIVE, UserRole.HIRING_MANAGER):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Recruiter or Administrator access required.")

    app_doc = await app_repo.get_by_id_only(app_id)
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application record not found.")

    valid_stages_map = {e.value.lower(): e.value for e in ApplicationStage}
    raw_stage = payload.stage.strip()
    if raw_stage.lower() not in valid_stages_map:
        valid_options = ", ".join(e.value for e in ApplicationStage)
        raise HTTPException(status_code=400, detail=f"Invalid stage '{raw_stage}'. Must be one of: {valid_options}")
    target_stage = valid_stages_map[raw_stage.lower()]
    now = datetime.now(timezone.utc)

    if not current_user.has_role(UserRole.ADMIN, UserRole.PLATFORM_ADMIN):
        try:
            job_doc = await job_repo.get_by_id(str(app_doc.get("job_id", "")))
            if job_doc:
                job_tenant = job_doc.get("tenant_id", "default") or "default"
                user_tenant = getattr(current_user, "tenant_id", "default") or "default"
                created_by = job_doc.get("created_by")
                if str(created_by) != str(current_user.id) and job_tenant != user_tenant and user_tenant != "default" and job_tenant != "default":
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only manage applications for your organization's job postings.")
        except HTTPException:
            raise
        except Exception:
            pass

    await app_repo.update_stage(app_id, target_stage)
    logger.info("Application stage updated", application_id=app_id, new_stage=target_stage, updated_by=str(current_user.id))

    try:
        audit_event = {
            "event_type": "application_stage_changed",
            "sub_type": target_stage.lower(),
            "application_id": app_id,
            "job_id": str(app_doc.get("job_id", "")),
            "candidate_id": str(app_doc.get("candidate_id", "")),
            "tenant_id": str(getattr(current_user, "tenant_id", "default") or "default"),
            "actor_id": str(current_user.id),
            "previous_stage": str(app_doc.get("stage", "")),
            "new_stage": target_stage,
            "timestamp": now.isoformat(),
        }
        async with get_pg_session_factory()() as sess:
            sess.add(AuditLog(action=audit_event["event_type"], actor_id=audit_event["actor_id"], target_id=app_id, payload=audit_event))
            await sess.commit()
    except Exception as _audit_err:
        logger.warning("Audit write failed (non-critical)", error=str(_audit_err))

    if target_stage == "Hired":
        async def _send_hire_email(app_doc_snap: dict) -> None:
            try:
                from services.email_service import EmailService
                candidate_id = app_doc_snap.get("candidate_id")
                if not candidate_id:
                    return
                user_repository = UserRepository()
                cand_doc = await user_repository.get_by_id(str(candidate_id))
                if not cand_doc or not cand_doc.get("email"):
                    return
                to_email = cand_doc["email"]
                cand_name = cand_doc.get("full_name") or to_email.split("@")[0]

                job_title, company_name, recruiter_email = "the position", "the hiring team", None
                try:
                    j_doc = await job_repo.get_by_id(str(app_doc_snap.get("job_id", "")))
                    if j_doc:
                        job_title = j_doc.get("title", job_title)
                        company_name = j_doc.get("company_name") or j_doc.get("company") or company_name
                        recruiter_email = j_doc.get("contact_email")
                        if not recruiter_email and j_doc.get("created_by"):
                            rec_doc = await user_repository.get_by_id(str(j_doc["created_by"]))
                            if rec_doc:
                                recruiter_email = rec_doc.get("email")
                except Exception:
                    pass

                subject = f"Official Job Offer: {job_title} at {company_name}"
                html_body = (
                    f"<p>Dear {cand_name},</p>"
                    f"<p>We are thrilled to inform you that <strong>{company_name}</strong> would like to extend an "
                    f"official offer for the position of <strong>{job_title}</strong>. Your recruiter will follow up shortly with offer details.</p>"
                    f"<p>Questions? Contact <a href='mailto:{recruiter_email or 'careers@careershala.tech'}'>{recruiter_email or 'careers@careershala.tech'}</a>.</p>"
                )
                await EmailService().send_email(
                    to_email=to_email,
                    to_name=cand_name,
                    subject=subject,
                    html_content=html_body,
                    reply_to_email=recruiter_email,
                    reply_to_name=company_name if recruiter_email else None,
                )
            except Exception as exc:
                logger.error("Hire email background task failed", application_id=app_id, error=str(exc))

        background_tasks.add_task(_send_hire_email, app_doc)

    return {"success": True, "application_id": app_id, "stage": target_stage, "updated_at": now.isoformat()}


@router.post("/company/profile")
@router.put("/company/profile")
async def save_company_profile(
    payload: CompanyProfilePayload,
    current_user: UserModel = Depends(get_current_user),
    company_repo: CompanyRepository = Depends(get_company_repo),
    session: Optional[AsyncSession] = Depends(get_db),
):
    """Recruiters / Admins save employer branding profile and sync open jobs."""
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
        new_logo = await upload_base64_company_logo(new_logo, company_id=tenant_id) or new_logo

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
    await company_repo.upsert(clean_name, profile_dict)

    update_fields = {
        k: v
        for k, v in {
            "company_logo": profile_dict.get("logo_url"),
            "company_website": profile_dict.get("website"),
            "company_about": profile_dict.get("about"),
        }.items()
        if v
    }
    if update_fields:
        async def _upd_jobs(sess: AsyncSession):
            await sess.execute(update(Job).where(func.lower(Job.company_name) == clean_name.lower()).values(**update_fields))
            await sess.commit()

        active_sess = session if hasattr(session, "execute") else None
        if active_sess:
            await _upd_jobs(active_sess)
        else:
            async with get_pg_session_factory()() as sess:
                await _upd_jobs(sess)

    logger.info("Company profile updated", company=clean_name, user_id=str(current_user.id))
    return {"success": True, "message": "Company profile saved successfully.", "profile": profile_dict}


@router.get("/{job_id}/applications")
@router.get("/{job_id}/applicants")
async def get_job_applications(
    job_id: str,
    stage: Optional[str] = Query(default=None, description="Filter by stage"),
    current_user: UserModel = Depends(get_current_user),
    job_repo: JobRepository = Depends(get_job_repo),
    session: Optional[AsyncSession] = Depends(get_db),
    db: Optional[Any] = None,
):
    """Return all applicants for a specific job enriched with parsed resume snapshots."""
    user_roles = getattr(current_user, "roles", [current_user.role])
    allowed_roles = {UserRole.RECRUITER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.EXECUTIVE, UserRole.HIRING_MANAGER, UserRole.INTERVIEWER}
    if not any(r in allowed_roles for r in user_roles):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Recruiter, Interviewer, or Administrator access required.")
    if not DocumentId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    job_doc = await job_repo.get_by_id(job_id)
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job posting not found.")

    if not any(r in {UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.EXECUTIVE} for r in user_roles):
        job_tenant = job_doc.get("tenant_id") or "default"
        user_tenant = getattr(current_user, "tenant_id", "default") or "default"
        if str(job_doc.get("created_by")) != str(current_user.id) and job_tenant != user_tenant and user_tenant != "default" and job_tenant != "default":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view applicants for your organization's job postings.")

    app_docs = await job_repo.list_candidate_applications(job_id, stage=stage if stage and stage.lower() != "all" else None)
    missing_resume_ids = [str(app["resume_id"]) for app in app_docs if app.get("resume_id")]
    fallback_resumes_map = await resume_repo.get_multiple_by_ids(list(set(missing_resume_ids))) if missing_resume_ids else {}

    enriched_applications = []
    for app in app_docs:
        resume_id = app.get("resume_id")
        resume_snapshot = app.get("resume_snapshot") or {}
        src = resume_snapshot if (isinstance(resume_snapshot, dict) and (resume_snapshot.get("parsed_data") or resume_snapshot.get("file_url"))) else (fallback_resumes_map.get(str(resume_id)) if resume_id else None) or {}
        file_url = src.get("file_url")
        raw_parsed = src.get("parsed_data", {})
        parsed_data = raw_parsed.model_dump() if hasattr(raw_parsed, "model_dump") else (raw_parsed if isinstance(raw_parsed, dict) else {})

        contact = parsed_data.get("contact_info") or {}
        skills = parsed_data.get("skills") or parsed_data.get("technical_skills") or []
        summary = parsed_data.get("summary") or ""
        cand_name = app.get("candidate_name") or parsed_data.get("full_name") or contact.get("name") or "Applicant"
        cand_email = app.get("candidate_email") or contact.get("email") or ""

        raw_match_score = app.get("match_score")
        raw_recruiter_score = app.get("recruiter_score")
        if (raw_recruiter_score is None or raw_recruiter_score <= 0.0) and (skills or summary):
            job_reqs = {str(s).lower().strip() for s in (job_doc.get("required_skills") or [])}
            cand_s = {str(s).lower().strip() for s in skills}
            calc_val = round(max(35.0, min(95.0, (len(cand_s & job_reqs) / len(job_reqs)) * 100.0)), 1) if job_reqs else 65.0
            raw_match_score = raw_match_score if (raw_match_score and raw_match_score > 0) else calc_val
            raw_recruiter_score = raw_recruiter_score if (raw_recruiter_score and raw_recruiter_score > 0) else calc_val

        app_id_str = str(app["_id"])
        enriched_applications.append({
            "id": app_id_str,
            "_id": app_id_str,
            "job_id": job_id,
            "candidate_id": str(app.get("candidate_id", "")),
            "resume_id": str(resume_id) if resume_id else None,
            "resume_snapshot": resume_snapshot,
            "match_score": raw_match_score,
            "recruiter_score": raw_recruiter_score if raw_recruiter_score is not None else raw_match_score,
            "knockout_status": app.get("knockout_status") or {"passed": not bool(app.get("is_knockout", False)), "reasons": app.get("knockout_reasons") or []},
            "stage": app.get("stage", ApplicationStage.APPLIED.value),
            "candidate_name": cand_name,
            "candidate_email": cand_email,
            "notes": app.get("notes"),
            "created_at": app.get("created_at").isoformat() if hasattr(app.get("created_at"), "isoformat") else str(app.get("created_at", "")),
            "candidate": {
                "name": cand_name,
                "email": cand_email,
                "phone": contact.get("phone"),
                "location": contact.get("location") or "Remote",
                "linkedin": contact.get("linkedin"),
                "github": contact.get("github"),
                "portfolio": contact.get("portfolio"),
                "skills": skills,
                "experience_years": float(parsed_data.get("total_experience_years") or 0.0),
                "summary": summary,
                "work_experience": (parsed_data.get("work_experience") or [])[:4],
                "education": (parsed_data.get("education") or [])[:3],
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
        "created_at": job_doc.get("created_at").isoformat() if hasattr(job_doc.get("created_at"), "isoformat") else str(job_doc.get("created_at", "")),
    }
    return {"job": job_info, "applications": enriched_applications, "applicants": enriched_applications, "total": len(enriched_applications)}


@router.patch("/{job_id}/status")
async def toggle_job_status(
    job_id: str,
    payload: Dict[str, Any],
    current_user: UserModel = Depends(get_current_user),
    job_repo: JobRepository = Depends(get_job_repo),
    session: Optional[AsyncSession] = Depends(get_db),
    db: Optional[Any] = None,
):
    """Toggle job status between open, closed, and draft."""
    if not current_user.has_role(UserRole.RECRUITER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.EXECUTIVE, UserRole.HIRING_MANAGER):
        raise HTTPException(status_code=403, detail="Recruiter access required.")
    if not DocumentId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid job ID format.")
    if not await job_repo.get_by_id(job_id):
        raise HTTPException(status_code=404, detail="Job not found or unauthorized.")

    new_status = payload.get("status")
    if new_status not in ("open", "closed", "draft"):
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'open', 'closed', or 'draft'.")

    await job_repo.update(job_id, {"status": new_status, "updated_at": datetime.now(timezone.utc)})
    return {"success": True, "job_id": job_id, "status": new_status}


@router.put("/{job_id}")
@router.patch("/{job_id}")
async def update_job(
    job_id: str,
    payload: JobUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    job_repo: JobRepository = Depends(get_job_repo),
    session: Optional[AsyncSession] = Depends(get_db),
    db: Optional[Any] = None,
):
    """Update a job posting and optionally rescore active applicants."""
    if not current_user.has_role(UserRole.RECRUITER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.EXECUTIVE, UserRole.HIRING_MANAGER):
        raise HTTPException(status_code=403, detail="Recruiter access required.")
    if not hasattr(job_repo, "get_by_id"):
        job_repo = get_job_repo()
    if not DocumentId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    job_doc = await job_repo.get_by_id(job_id)
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job not found or unauthorized.")

    applicant_count = await job_repo.count_candidate_applications(job_id) or int(job_doc.get("applicant_count") or 0)
    update_dict = payload.model_dump(exclude_unset=True)
    rescore_requested = update_dict.pop("rescore_applicants", False)

    changed_core_fields, old_vals, new_vals = [], {}, {}
    for field in ("required_skills", "min_years", "jd_text_raw"):
        if field not in update_dict:
            continue
        cur, nxt = job_doc.get(field), update_dict[field]
        is_changed = (
            {s.strip().lower() for s in (cur or []) if s and s.strip()} != {s.strip().lower() for s in (nxt or []) if s and s.strip()}
            if field == "required_skills"
            else (float(nxt or 0) != float(cur or 0) if field == "min_years" else (nxt or "").strip() != (cur or "").strip())
        )
        if is_changed:
            changed_core_fields.append(field)
            old_vals[field], new_vals[field] = cur, nxt

    now = datetime.now(timezone.utc)
    if applicant_count > 0 and changed_core_fields:
        if not rescore_requested:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This job has active applicants. To update core scoring requirements, you must pass rescore_applicants=true, or close this role and post a new one.",
            )
        async with get_pg_session_factory()() as sess:
            sess.add(AuditLog(action="job_edit_rescore", actor_id=str(current_user.id), target_id=str(job_id), payload={"changed_fields": changed_core_fields, "old_values": old_vals, "new_values": new_vals}))
            await sess.commit()

    if "jd_text_raw" in update_dict and isinstance(update_dict["jd_text_raw"], str):
        update_dict["jd_text_raw"] = update_dict["jd_text_raw"].strip()
    if "required_skills" in update_dict and isinstance(update_dict["required_skills"], list):
        update_dict["required_skills"] = canonicalize_skills(update_dict["required_skills"])
    update_dict["updated_at"] = now

    updated_doc = await job_repo.update(job_id, update_dict) or job_doc
    rescored_count = 0
    if applicant_count > 0 and changed_core_fields and rescore_requested:
        for app in await job_repo.list_candidate_applications(job_id):
            resume_payload = (app.get("resume_snapshot") or {}).get("parsed_data") or {}
            if not resume_payload or not resume_payload.get("raw_text"):
                rid = str(app.get("resume_id") or "")
                res_doc = await resume_repo.get_by_id(rid) if rid else None
                if res_doc and res_doc.get("parsed_data"):
                    resume_payload = res_doc["parsed_data"]
            try:
                dual = score_resume_dual(
                    resume=resume_payload,
                    jd=updated_doc.get("jd_text_raw", ""),
                    required_skills=updated_doc.get("required_skills", []),
                    min_years=updated_doc.get("min_years"),
                )
                await job_repo.update_candidate_application(job_id, str(app["_id"]), {
                    "match_score": round(float(dual.get("candidate_score", 0.0)), 1),
                    "quality_score": round(float(dual.get("quality_score", dual.get("recruiter_score", 0.0))), 1),
                    "eligibility": dual.get("eligibility") or {"status": "eligible", "checks": []},
                    "eligibility_rank": int(dual.get("eligibility_rank", 0)),
                    "recruiter_score": round(float(dual.get("recruiter_score", 0.0)), 1),
                    "knockout_status": dual.get("knockout") or {"passed": True, "reasons": []},
                    "scoring_version": dual.get("scoring_version", "1.0.0"),
                    "features": dual.get("features") or dual.get("recruiter_result", {}).get("features"),
                })
                rescored_count += 1
            except Exception as re_err:
                logger.warning("Failed to re-score application during job update", app_id=str(app.get("_id")), error=str(re_err))

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


@router.post("/{job_id}/applications/{app_id}/override-eligibility", response_model=ApplicationResponse)
async def override_application_eligibility(
    job_id: str,
    app_id: str,
    payload: EligibilityOverridePayload,
    current_user: UserModel = Depends(get_recruiter_or_admin),
    job_repo: JobRepository = Depends(get_job_repo),
    session: Optional[AsyncSession] = Depends(get_db),
    db: Optional[Any] = None,
):
    """Recruiter/Admin discretion override for automated eligibility status."""
    if payload.new_status not in ("eligible", "ineligible", "unverified"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status. Must be 'eligible', 'ineligible', or 'unverified'.")

    app = await job_repo.get_candidate_application(job_id, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found for this job.")

    now = datetime.now(timezone.utc)
    override_entry = {
        "by": str(current_user.id),
        "by_email": getattr(current_user, "email", None),
        "at": now,
        "previous_status": (app.get("details") or {}).get("eligibility", {}).get("status", "unverified") if isinstance(app.get("details"), dict) else "unverified",
        "new_status": payload.new_status,
        "reason_code": payload.reason_code,
        "note": payload.note,
    }
    await job_repo.update_candidate_application(job_id, app_id, {
        "eligibility": {"status": payload.new_status},
        "eligibility_rank": {"eligible": 0, "unverified": 1, "ineligible": 2}[payload.new_status],
        "eligibility_override": override_entry,
        "updated_at": now,
    })

    try:
        from repositories.audit_log_repo import AuditLogRepository
        await AuditLogRepository().log_event(
            action="eligibility_override",
            actor_id=str(current_user.id),
            target_id=str(app_id),
            payload=override_entry,
        )
    except Exception:
        pass

    updated_app = await job_repo.get_candidate_application(job_id, app_id) or app
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
