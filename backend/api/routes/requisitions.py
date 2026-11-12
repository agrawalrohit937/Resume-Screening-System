"""Requisition Management & Headcount Approval API Routes (Pure PostgreSQL).
CareerShala ATS v2.0.0 - Enterprise ATS Workflows.
Fully decoupled into service architecture.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from api.deps import get_current_user, get_requisition_service
from schemas.user_schema import UserModel
from schemas.requisition_schema import (
    RequisitionModel,
    ApprovalDecision,
    ApprovalStep,
)
from services.requisition_service import RequisitionService

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
    service: RequisitionService = Depends(get_requisition_service),
):
    """Creates a new headcount requisition in DRAFT status."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.create_requisition(
        title=payload.title,
        department=payload.department,
        hiring_manager_id=current_user.id or "hiring_manager_user",
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
    service: RequisitionService = Depends(get_requisition_service),
):
    """Lists all requisitions scoped to the user's active tenant."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.list_requisitions(tenant_id=tenant_id, limit=100)


@router.get("/pipeline/candidates", response_model=List[Dict[str, Any]])
async def get_pipeline_candidates_route(
    current_user: UserModel = Depends(get_current_user),
    service: RequisitionService = Depends(get_requisition_service),
):
    """Lists active candidates in the hiring pipeline for the active tenant with high-speed projections."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.get_pipeline_candidates(tenant_id=tenant_id, limit=100)


@router.get("/{requisition_id}", response_model=RequisitionModel)
async def get_requisition_route(
    requisition_id: str,
    current_user: UserModel = Depends(get_current_user),
    service: RequisitionService = Depends(get_requisition_service),
):
    """Retrieves a requisition by ID."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    req = await service.get_requisition(requisition_id, tenant_id=tenant_id)
    if not req:
        raise HTTPException(status_code=404, detail="Requisition not found")
    return req


@router.post("/{requisition_id}/submit", response_model=RequisitionModel)
async def submit_requisition_route(
    requisition_id: str,
    current_user: UserModel = Depends(get_current_user),
    service: RequisitionService = Depends(get_requisition_service),
):
    """Submits a draft requisition for sequential approval."""
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
    service: RequisitionService = Depends(get_requisition_service),
):
    """Records an approval or rejection step in the requisition approval chain."""
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
    service: RequisitionService = Depends(get_requisition_service),
):
    """Links an approved requisition to a job posting and marks it open."""
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
    service: RequisitionService = Depends(get_requisition_service),
):
    """Increments the filled headcount count for a requisition."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    req = await service.record_hire(requisition_id, count=payload.count, tenant_id=tenant_id)
    if not req:
        raise HTTPException(status_code=404, detail="Requisition not found")
    return req
