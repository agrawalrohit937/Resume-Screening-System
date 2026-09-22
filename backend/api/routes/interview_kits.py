"""Structured Interview Kits, Scorecards & Calibration API Routes.
CareerPilot ATS v2.0.0 - Enterprise ATS Workflows.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from bson import ObjectId
from api.deps import get_database, get_current_user
from models.user_model import UserModel
from models.interview_kit import (
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
    standard_questions: Optional[List[str]] = None


class SubmitScorecardPayload(BaseModel):
    application_id: str
    candidate_id: str
    stage_name: str
    ratings: Dict[str, int]
    recommendation: RecommendationEnum
    notes: Optional[str] = None


@router.post("", response_model=InterviewKitModel, status_code=status.HTTP_201_CREATED)
async def create_interview_kit_route(
    payload: CreateKitPayload,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """Creates a structured interview kit with standardized competency rubrics."""
    service = InterviewKitService(db)
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.create_interview_kit(
        job_id=payload.job_id,
        stage_name=payload.stage_name,
        competencies=payload.competencies,
        standard_questions=payload.standard_questions,
        tenant_id=tenant_id,
    )


@router.get("", response_model=List[InterviewKitModel])
async def get_interview_kits_route(
    job_id: Optional[str] = Query(None, description="Filter by job ID"),
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """Lists structured interview kits for a job or organization."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    query: Dict[str, Any] = {"tenant_id": tenant_id}
    if job_id:
        query["job_id"] = job_id
    cursor = db.interview_kits.find(query)
    docs = await cursor.to_list(length=50)
    return [InterviewKitModel(**d) for d in docs]


@router.post("/scorecards", response_model=ScorecardModel, status_code=status.HTTP_201_CREATED)
async def submit_scorecard_route(
    payload: SubmitScorecardPayload,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """Submits an interviewer scorecard with 1-5 ratings and recommendations."""
    service = InterviewKitService(db)
    tenant_id = getattr(current_user, "tenant_id", "default")
    interviewer_id_str = str(current_user.id) if current_user.id else "interviewer_user"
    return await service.submit_scorecard(
        application_id=payload.application_id,
        candidate_id=payload.candidate_id,
        interviewer_id=interviewer_id_str,
        stage_name=payload.stage_name,
        ratings=payload.ratings,
        recommendation=payload.recommendation,
        notes=payload.notes,
        tenant_id=tenant_id,
    )


@router.get("/calibration", response_model=CalibrationReport)
async def get_calibration_route(
    application_id: str = Query(..., description="Application ID"),
    stage_name: str = Query(..., description="Interview stage name"),
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """Calculates inter-rater agreement, score variance, and consensus recommendations."""
    service = InterviewKitService(db)
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.calculate_calibration(
        application_id=application_id,
        stage_name=stage_name,
        tenant_id=tenant_id,
    )


@router.get("/assigned", response_model=List[Dict[str, Any]])
async def get_assigned_interviews_route(
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """Retrieves interviews scheduled/assigned for the current user and tenant."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    cursor = db.applications.find({
        "tenant_id": tenant_id,
        "$or": [
            {"stage": {"$in": ["interview", "technical_interview", "onsite", "Interview", "Screening"]}},
            {"interviewer_id": current_user.id or "interviewer_user"},
            {"assigned_interviewer": current_user.id or "interviewer_user"},
        ]
    })
    apps = await cursor.to_list(length=50)
    results: List[Dict[str, Any]] = []

    user_id_str = str(current_user.id) if current_user.id else "interviewer_user"
    for app in apps:
        app_id_str = str(app.get("id") or app.get("_id"))
        job_id = app.get("job_id")
        job = None
        if job_id:
            try:
                job = await db.jobs.find_one({"_id": ObjectId(job_id)})
            except Exception:
                job = None

        kit = await db.interview_kits.find_one({"job_id": job_id, "tenant_id": tenant_id})
        competencies = kit.get("competencies", []) if kit else [
            {"name": "Technical Problem Solving", "description": "Core engineering knowledge and architecture", "rubric": {1: "Sub-par", 3: "Solid", 5: "Mastery"}},
            {"name": "System Architecture", "description": "Scalability, fault-tolerance, data modeling", "rubric": {1: "Basic", 3: "Proficient", 5: "Expert"}},
            {"name": "Communication & Alignment", "description": "Crisp communication and engineering collaboration", "rubric": {1: "Unclear", 3: "Adequate", 5: "Exceptional"}}
        ]

        resume_snapshot = app.get("resume_snapshot") or {}
        resume_url = app.get("resume_url") or resume_snapshot.get("file_url") or "#"

        # Check if a scorecard was already submitted for this application
        scorecard_doc = await db.scorecards.find_one({
            "application_id": app_id_str,
            "$or": [
                {"interviewer_id": user_id_str},
                {"interviewer_id": current_user.id or "interviewer_user"},
                {"interviewer_id": str(current_user.id)}
            ]
        }, sort=[("submitted_at", -1), ("_id", -1)])

        cand_id_str = str(app.get("candidate_id") or app.get("user_id") or "")
        if not scorecard_doc and cand_id_str:
            scorecard_doc = await db.scorecards.find_one({
                "candidate_id": cand_id_str,
                "$or": [
                    {"interviewer_id": user_id_str},
                    {"interviewer_id": current_user.id or "interviewer_user"},
                    {"interviewer_id": str(current_user.id)}
                ]
            }, sort=[("submitted_at", -1), ("_id", -1)])
        if not scorecard_doc and app.get(f"scorecard_{user_id_str}"):
            scorecard_doc = app.get(f"scorecard_{user_id_str}")
        if not scorecard_doc:
            scorecard_doc = await db.scorecards.find_one({
                "application_id": app_id_str
            }, sort=[("submitted_at", -1), ("_id", -1)])
        if not scorecard_doc and cand_id_str:
            scorecard_doc = await db.scorecards.find_one({
                "candidate_id": cand_id_str
            }, sort=[("submitted_at", -1), ("_id", -1)])

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
    db: Any = Depends(get_database),
):
    """Retrieves scorecards submitted for a specific application."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    cursor = db.scorecards.find({"application_id": application_id, "tenant_id": tenant_id})
    scorecards = await cursor.to_list(length=20)
    results = []
    for sc in scorecards:
        d = dict(sc)
        if "_id" in d:
            d["_id"] = str(d["_id"])
        if "submitted_at" in d and hasattr(d["submitted_at"], "isoformat"):
            d["submitted_at"] = d["submitted_at"].isoformat()
        results.append(d)
    return results

