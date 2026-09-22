"""Requisition and Headcount Management API Routes.
CareerPilot ATS v2.0.0 - Enterprise ATS Workflows.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from bson import ObjectId
from api.deps import get_database, get_current_user
from models.user_model import UserModel
from models.requisition import RequisitionModel, RequisitionStatus, ApprovalDecision, ApprovalStep
from services.requisition_service import RequisitionService
from services.multi_tenancy.tenant_context import get_current_tenant_id

router = APIRouter()


class CreateRequisitionPayload(BaseModel):
    title: str
    department: str
    headcount: int = 1
    budget_min: float = 0.0
    budget_max: float = 0.0
    budget_currency: str = "USD"
    approval_chain: Optional[List[ApprovalStep]] = None


class DecisionPayload(BaseModel):
    decision: ApprovalDecision
    comments: Optional[str] = None


class LinkJobPayload(BaseModel):
    job_id: str


class HirePayload(BaseModel):
    count: int = 1


@router.post("", response_model=RequisitionModel, status_code=status.HTTP_201_CREATED)
async def create_requisition_route(
    payload: CreateRequisitionPayload,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """Creates a new requisition in DRAFT status."""
    service = RequisitionService(db)
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.create_requisition(
        title=payload.title,
        department=payload.department,
        hiring_manager_id=current_user.id or "manager_user",
        headcount=payload.headcount,
        budget_min=payload.budget_min,
        budget_max=payload.budget_max,
        currency=payload.budget_currency,
        approval_chain=payload.approval_chain,
        tenant_id=tenant_id,
    )


@router.get("", response_model=List[RequisitionModel])
async def list_requisitions_route(
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """Lists all requisitions scoped to the user's active tenant."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    cursor = db.requisitions.find({"tenant_id": tenant_id})
    docs = await cursor.to_list(length=100)
    return [RequisitionModel(**d) for d in docs]


@router.get("/pipeline/candidates", response_model=List[Dict[str, Any]])
async def get_pipeline_candidates_route(
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """Lists active candidates in the hiring pipeline for the active tenant."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    cursor = db.applications.find({"tenant_id": tenant_id})
    apps = await cursor.to_list(length=100)
    results: List[Dict[str, Any]] = []

    for app in apps:
        job_id = app.get("job_id")
        job = None
        if job_id:
            try:
                job = await db.jobs.find_one({"_id": ObjectId(job_id)})
            except Exception:
                job = None

        app_id_str = str(app.get("id") or app.get("_id"))
        cand_id_str = str(app.get("candidate_id") or app.get("user_id") or "")
        scorecards_count = await db.scorecards.count_documents({"application_id": app_id_str, "tenant_id": tenant_id})

        score = float(app.get("quality_score") or app.get("match_score") or app.get("ats_score") or 0.0)
        if scorecards_count > 0:
            consensus = f"{scorecards_count} Scorecard{'s' if scorecards_count > 1 else ''} Submitted"
            consensus_color = "bg-purple-50 text-purple-700 border-purple-200"
        else:
            consensus = "Strong Yes" if score >= 85 else "Yes" if score >= 70 else "Review Needed" if score > 0 else "Pending"
            consensus_color = (
                "bg-emerald-50 text-emerald-700 border-emerald-200" if score >= 85
                else "bg-blue-50 text-blue-700 border-blue-200" if score >= 70
                else "bg-amber-50 text-amber-700 border-amber-200"
            )
        role = app.get("job_title") or (job.get("title") if job else None) or "Candidate Role"
        years_exp = float(app.get("years_experience") or (job.get("min_years") if job else 0.0) or 0.0)
        resume_snapshot = app.get("resume_snapshot") or {}
        resume_url = app.get("resume_url") or resume_snapshot.get("file_url") or None

        results.append({
            "id": app_id_str,
            "application_id": app_id_str,
            "candidate_id": cand_id_str,
            "job_id": str(job_id) if job_id else None,
            "name": app.get("candidate_name") or app.get("full_name") or "Candidate",
            "role": role,
            "stage": app.get("stage") or "Applied",
            "ats_score": round(score, 1),
            "calibration_consensus": consensus,
            "consensus_color": consensus_color,
            "years_experience": years_exp,
            "status": app.get("status") or "active",
            "scorecards_count": scorecards_count,
            "resume_url": resume_url
        })

    return results


@router.get("/{requisition_id}", response_model=RequisitionModel)
async def get_requisition_route(
    requisition_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """Retrieves a requisition by ID."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    doc = await db.requisitions.find_one({"id": requisition_id, "tenant_id": tenant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Requisition not found")
    return RequisitionModel(**doc)


@router.post("/{requisition_id}/submit", response_model=RequisitionModel)
async def submit_requisition_route(
    requisition_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """Submits a draft requisition for sequential approval."""
    service = RequisitionService(db)
    tenant_id = getattr(current_user, "tenant_id", "default")
    req = await service.submit_for_approval(requisition_id, tenant_id=tenant_id)
    if not req:
        raise HTTPException(status_code=404, detail="Requisition not found or not in draft status")
    return req


@router.post("/{requisition_id}/decision", response_model=RequisitionModel)
async def record_decision_route(
    requisition_id: str,
    payload: DecisionPayload,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """Records an approval or rejection step in the requisition approval chain."""
    service = RequisitionService(db)
    tenant_id = getattr(current_user, "tenant_id", "default")
    req = await service.record_approval_decision(
        requisition_id=requisition_id,
        approver_id=current_user.id or "approver_user",
        decision=payload.decision,
        comments=payload.comments,
        tenant_id=tenant_id,
    )
    if not req:
        raise HTTPException(status_code=404, detail="Requisition not found or not pending approval")
    return req


@router.post("/{requisition_id}/link-job", response_model=RequisitionModel)
async def link_job_route(
    requisition_id: str,
    payload: LinkJobPayload,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """Links an approved requisition to a job posting and marks it open."""
    service = RequisitionService(db)
    tenant_id = getattr(current_user, "tenant_id", "default")
    try:
        req = await service.link_to_job(requisition_id, job_id=payload.job_id, tenant_id=tenant_id)
        if not req:
            raise HTTPException(status_code=404, detail="Requisition not found")
        return req
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{requisition_id}/hire", response_model=RequisitionModel)
async def record_hire_route(
    requisition_id: str,
    payload: HirePayload,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """Increments the filled headcount count for a requisition."""
    service = RequisitionService(db)
    tenant_id = getattr(current_user, "tenant_id", "default")
    req = await service.record_hire(requisition_id, count=payload.count, tenant_id=tenant_id)
    if not req:
        raise HTTPException(status_code=404, detail="Requisition not found")
    return req
