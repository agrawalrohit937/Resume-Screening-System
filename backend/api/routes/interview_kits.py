"""
Structured Interview Kits, Scorecards & Calibration API Routes (Pure PostgreSQL).
CareerShala ATS v2.0.0 - Enterprise ATS Workflows.
Fully decoupled into repository architecture.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel

from api.deps import get_current_user, get_interview_kit_repo, get_job_repo
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
    service: InterviewKitService = Depends(),
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
    service: InterviewKitService = Depends(),
):
    """Retrieves all interview kits configured for a job."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.list_kits_by_job(job_id=job_id, tenant_id=tenant_id)


@router.get("/job/{job_id}/stage/{stage_name}", response_model=Optional[InterviewKitModel])
async def get_kit_by_job_and_stage_route(
    job_id: str,
    stage_name: str,
    current_user: UserModel = Depends(get_current_user),
    service: InterviewKitService = Depends(),
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
    service: InterviewKitService = Depends(),
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
    service: InterviewKitService = Depends(),
):
    """Computes a calibration report and inter-rater consensus across all interviewers for an application."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.compute_calibration(
        application_id=application_id, tenant_id=tenant_id
    )


@router.get("/assigned", response_model=List[Dict[str, Any]])
async def get_assigned_interviews_route(
    current_user: UserModel = Depends(get_current_user),
    kit_repo: InterviewKitRepository = Depends(get_interview_kit_repo),
    job_repo: JobRepository = Depends(get_job_repo),
):
    """Retrieves interviews scheduled/assigned for the current user and tenant."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    apps = await job_repo.list_candidate_applications_by_tenant(tenant_id=tenant_id, limit=50)
    results: List[Dict[str, Any]] = []

    for app in apps:
        app_id_str = str(app.get("id") or app.get("_id"))
        job_id = app.get("job_id")
        job = None
        if job_id:
            job = await job_repo.get_by_id(job_id)

        kit = await kit_repo.get_kit_by_job(job_id, tenant_id) if job_id else None
        competencies = kit.get("competencies", []) if kit else [
            {"name": "Technical Problem Solving", "description": "Core engineering knowledge and architecture", "rubric": {1: "Sub-par", 3: "Solid", 5: "Mastery"}},
            {"name": "System Architecture", "description": "Scalability, fault-tolerance, data modeling", "rubric": {1: "Basic", 3: "Proficient", 5: "Expert"}},
            {"name": "Communication & Alignment", "description": "Crisp communication and engineering collaboration", "rubric": {1: "Unclear", 3: "Adequate", 5: "Exceptional"}}
        ]

        resume_snapshot = app.get("resume_snapshot") or {}
        resume_url = app.get("resume_url") or resume_snapshot.get("file_url") or "#"

        scorecards_list = await kit_repo.get_scorecards_by_application(app_id_str)
        scorecard_doc = scorecards_list[0] if scorecards_list else None

        scorecard_data = None
        is_submitted = False
        if scorecard_doc:
            is_submitted = True
            rec_val = scorecard_doc.get("recommendation")
            if hasattr(rec_val, "value"):
                rec_val = rec_val.value
            scorecard_data = {
                "id": str(scorecard_doc.get("id") or scorecard_doc.get("_id", "")),
                "ratings": scorecard_doc.get("ratings", {}),
                "recommendation": rec_val or "yes",
                "notes": scorecard_doc.get("notes", "") or "",
                "submitted_at": str(scorecard_doc.get("submitted_at", "")),
            }

        results.append({
            "id": app_id_str,
            "application_id": app_id_str,
            "candidate_id": str(app.get("candidate_id") or app.get("user_id") or "unknown_cand"),
            "candidate_name": app.get("candidate_name") or app.get("full_name") or "Candidate",
            "role_title": app.get("job_title") or (job.get("title") if job else None) or "Candidate Interview",
            "department": app.get("department") or (job.get("department") if job else None) or "General",
            "stage": app.get("stage") or "Technical Interview",
            "scheduled_time": app.get("scheduled_time") or "Scheduled Interview",
            "resume_url": resume_url,
            "competencies": competencies,
            "is_submitted": is_submitted,
            "scorecard": scorecard_data
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
