"""
Structured Interview Kits, Scorecards & Calibration API Routes (Pure PostgreSQL).
CareerShala ATS v2.0.0 - Enterprise ATS Workflows.
Fully decoupled into repository architecture.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import (
    get_current_user,
    get_interview_kit_repo,
    get_job_repo,
    get_interview_kit_service,
    get_db,
)
from models.tables import User, InterviewSessionModel
from repositories.interview_kit_repo import InterviewKitRepository
from repositories.job_repo import JobRepository
from schemas.user_schema import UserModel
from schemas.interview_schema import (
    InterviewKitModel,
    ScorecardModel,
    CalibrationReport,
    RecommendationEnum,
    Competency,
)
from services.interview_kit_service import InterviewKitService

router = APIRouter()


class CreateKitPayload(BaseModel):
    job_id: str
    stage_name: str
    competencies: List[Competency]
    structured_questions: Optional[List[str]] = []


@router.post("/", response_model=InterviewKitModel, status_code=status.HTTP_201_CREATED)
async def create_or_update_kit_route(
    payload: CreateKitPayload,
    current_user: UserModel = Depends(get_current_user),
    service: InterviewKitService = Depends(get_interview_kit_service),
):
    """Creates or updates a structured interview kit for a job stage."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.create_or_update_kit(
        job_id=payload.job_id,
        stage_name=payload.stage_name,
        competencies=payload.competencies,
        structured_questions=payload.structured_questions or [],
        tenant_id=tenant_id,
        creator_id=str(current_user.id),
    )


@router.get("/job/{job_id}", response_model=List[InterviewKitModel])
async def list_kits_by_job_route(
    job_id: str,
    current_user: UserModel = Depends(get_current_user),
    service: InterviewKitService = Depends(get_interview_kit_service),
):
    """Retrieves all interview kits configured for a job."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.list_kits_by_job(job_id=job_id, tenant_id=tenant_id)


@router.get("/job/{job_id}/stage/{stage_name}", response_model=Optional[InterviewKitModel])
async def get_kit_by_job_and_stage_route(
    job_id: str,
    stage_name: str,
    current_user: UserModel = Depends(get_current_user),
    service: InterviewKitService = Depends(get_interview_kit_service),
):
    """Retrieves a specific interview kit for a job and stage."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.get_kit_for_stage(
        job_id=job_id, stage_name=stage_name, tenant_id=tenant_id
    )


@router.post("/scorecard", response_model=ScorecardModel, status_code=status.HTTP_201_CREATED)
async def submit_scorecard_route(
    payload: ScorecardModel,
    current_user: UserModel = Depends(get_current_user),
    service: InterviewKitService = Depends(get_interview_kit_service),
):
    """Submits or updates an interviewer scorecard with competency ratings and recommendation."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    # Ensure interviewer_id is populated from current user if missing
    if not payload.interviewer_id:
        payload.interviewer_id = str(current_user.id)
    payload.tenant_id = tenant_id

    return await service.submit_scorecard(payload)


@router.get("/calibration/{application_id}", response_model=CalibrationReport)
async def compute_calibration_route(
    application_id: str,
    current_user: UserModel = Depends(get_current_user),
    service: InterviewKitService = Depends(get_interview_kit_service),
):
    """Computes a calibration report and inter-rater consensus across all interviewers for an application."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.compute_calibration(
        application_id=application_id, tenant_id=tenant_id
    )


@router.get("/assigned", response_model=List[Dict[str, Any]])
async def get_assigned_interviews_route(
    job_id: Optional[str] = Query(default=None),
    current_user: UserModel = Depends(get_current_user),
    kit_repo: InterviewKitRepository = Depends(get_interview_kit_repo),
    job_repo: JobRepository = Depends(get_job_repo),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves candidates in the 'Interview' pipeline stage scheduled/assigned for evaluation, enriched with AI session state."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    apps = await job_repo.list_candidate_applications_by_tenant(
        tenant_id=tenant_id, stage="Interview", job_id=job_id, limit=100
    )
    if not apps:
        return []

    app_ids = [str(a.get("id") or a.get("_id")) for a in apps]
    cand_ids = [str(a.get("candidate_id") or a.get("user_id")) for a in apps if (a.get("candidate_id") or a.get("user_id"))]

    # Batch fetch Users for profile picture
    user_pic_map = {}
    if cand_ids:
        user_stmt = select(User.id, User.profile_picture).where(User.id.in_(cand_ids))
        user_rows = (await db.execute(user_stmt)).all()
        for uid, pic in user_rows:
            if pic:
                user_pic_map[str(uid)] = pic

    # Batch fetch InterviewSessionModel for application_ids
    session_map = {}
    if app_ids:
        sess_stmt = (
            select(InterviewSessionModel)
            .where(InterviewSessionModel.application_id.in_(app_ids))
            .order_by(InterviewSessionModel.created_at.desc())
        )
        sess_rows = (await db.execute(sess_stmt)).scalars().all()
        for s in sess_rows:
            aid = str(s.application_id)
            if aid not in session_map:  # Keep latest session per application
                session_map[aid] = {
                    "session_id": str(s.id),
                    "status": s.status,
                    "magic_token": s.magic_token,
                    "magic_link_url": s.magic_link_url,
                    "overall_score": s.overall_score,
                    "warning_count": s.warning_count,
                    "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                    "expires_at": s.expires_at.isoformat() if s.expires_at else None,
                    "questions_count": len(s.questions or []),
                    "answers_count": len(s.answers or []),
                    "improvement_summary": s.improvement_summary,
                    "strength_areas": s.strength_areas or [],
                    "weakness_areas": s.weakness_areas or [],
                }

    # Cache jobs by job_id to prevent redundant queries
    job_cache = {}
    for app in apps:
        jid = app.get("job_id")
        if jid and jid not in job_cache:
            job_cache[jid] = await job_repo.get_by_id(jid)

    results: List[Dict[str, Any]] = []

    for app in apps:
        app_id_str = str(app.get("id") or app.get("_id"))
        cand_id_str = str(app.get("candidate_id") or app.get("user_id") or "unknown_cand")
        app_job_id = app.get("job_id")
        job = job_cache.get(app_job_id)

        resume_snapshot = app.get("resume_snapshot") or {}
        resume_url = app.get("resume_url") or resume_snapshot.get("file_url") or "#"

        ai_sess = session_map.get(app_id_str)
        is_ai_completed = bool(ai_sess and ai_sess.get("status") == "completed")
        is_ai_scheduled = bool(ai_sess is not None)

        results.append({
            "id": app_id_str,
            "application_id": app_id_str,
            "candidate_id": cand_id_str,
            "candidate_name": app.get("candidate_name") or app.get("full_name") or "Candidate",
            "candidate_email": app.get("candidate_email") or app.get("email") or "",
            "profile_picture": user_pic_map.get(cand_id_str) or app.get("profile_picture") or None,
            "job_id": app_job_id,
            "role_title": app.get("job_title") or (job.get("title") if job else None) or "Candidate Interview",
            "department": app.get("department") or (job.get("department") if job else None) or "General",
            "required_skills": job.get("required_skills", []) if job else [],
            "stage": app.get("stage") or "Technical Interview",
            "match_score": app.get("match_score"),
            "resume_url": resume_url,
            "competencies": [],
            "is_submitted": False,
            "scorecard": None,
            "is_ai_scheduled": is_ai_scheduled,
            "is_ai_completed": is_ai_completed,
            "ai_session": ai_sess,
        })

    return results


@router.get("/scorecards/{application_id}", response_model=List[Dict[str, Any]])
async def get_scorecards_by_application_route(
    application_id: str,
    current_user: UserModel = Depends(get_current_user),
    kit_repo: InterviewKitRepository = Depends(get_interview_kit_repo),
):
    """Retrieves scorecards submitted for a specific application."""
    scorecards = await kit_repo.get_scorecards_by_application(application_id)
    results = []
    for sc in scorecards:
        d = dict(sc)
        if "_id" in d:
            d["_id"] = str(d["_id"])
        if "submitted_at" in d and hasattr(d["submitted_at"], "isoformat"):
            d["submitted_at"] = d["submitted_at"].isoformat()
        results.append(d)
    return results
