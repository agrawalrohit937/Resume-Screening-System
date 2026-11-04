"""Requisition and Headcount Management API Routes (Pure PostgreSQL).
CareerShala ATS v2.0.0 - Enterprise ATS Workflows.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, and_, func

from config.db import get_pg_session_factory
from models.tables import Requisition as RequisitionTable, CandidateApplication, Job, Scorecard
from api.deps import get_current_user
from models.user_model import UserModel
from models.requisition import RequisitionModel, ApprovalDecision, ApprovalStep
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
):
    """Creates a new requisition in DRAFT status."""
    service = RequisitionService()
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.create_requisition(
        title=payload.title,
        department=payload.department,
        hiring_manager_id=current_user.id or "current_user",
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
):
    """Lists all requisitions scoped to the user's active tenant."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    async with get_pg_session_factory()() as session:
        stmt = select(RequisitionTable).where(RequisitionTable.tenant_id == tenant_id).limit(100)
        rows = (await session.execute(stmt)).scalars().all()
        results = []
        for r in rows:
            d = dict(r.data or {})
            d["id"] = r.id
            d["tenant_id"] = r.tenant_id
            d["title"] = r.title
            d["department"] = r.department
            d["hiring_manager_id"] = r.hiring_manager_id
            d["status"] = r.status
            results.append(RequisitionModel(**d))
        return results


@router.get("/pipeline/candidates", response_model=List[Dict[str, Any]])
async def get_pipeline_candidates_route(
    current_user: UserModel = Depends(get_current_user),
):
    """Lists active candidates in the hiring pipeline for the active tenant with high-speed projections."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    results = []

    async with get_pg_session_factory()() as session:
        app_stmt = select(CandidateApplication).where(CandidateApplication.tenant_id == tenant_id).order_by(CandidateApplication.created_at.desc()).limit(100)
        apps_rows = (await session.execute(app_stmt)).scalars().all()
        apps = [{c.name: getattr(r, c.name) for c in CandidateApplication.__table__.columns} for r in apps_rows]

        job_ids = list({a.get("job_id") for a in apps if a.get("job_id")})
        jobs_map = {}
        if job_ids:
            j_stmt = select(Job).where(Job.id.in_(job_ids))
            j_rows = (await session.execute(j_stmt)).scalars().all()
            jobs_map = {j.id: {c.name: getattr(j, c.name) for c in Job.__table__.columns} for j in j_rows}

        app_ids = [str(a.get("id")) for a in apps if a.get("id")]
        scorecard_counts_map = {}
        if app_ids:
            sc_stmt = select(Scorecard.application_id, func.count(Scorecard.id)).where(
                and_(Scorecard.application_id.in_(app_ids), Scorecard.tenant_id == tenant_id)
            ).group_by(Scorecard.application_id)
            sc_res = await session.execute(sc_stmt)
            scorecard_counts_map = {r[0]: r[1] for r in sc_res.all()}

    for app in apps:
        job_id = app.get("job_id")
        job = jobs_map.get(str(job_id)) if job_id else None

        app_id_str = str(app.get("id") or app.get("_id"))
        cand_id_str = str(app.get("candidate_id") or app.get("user_id") or "")
        scorecards_count = scorecard_counts_map.get(app_id_str, 0)

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
):
    """Retrieves a requisition by ID."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    async with get_pg_session_factory()() as session:
        stmt = select(RequisitionTable).where(and_(RequisitionTable.id == requisition_id, RequisitionTable.tenant_id == tenant_id))
        r = (await session.execute(stmt)).scalar_one_or_none()
        if not r:
            raise HTTPException(status_code=404, detail="Requisition not found")
        d = dict(r.data or {})
        d["id"] = r.id
        d["tenant_id"] = r.tenant_id
        d["title"] = r.title
        d["department"] = r.department
        d["hiring_manager_id"] = r.hiring_manager_id
        d["status"] = r.status
        return RequisitionModel(**d)


@router.post("/{requisition_id}/submit", response_model=RequisitionModel)
async def submit_requisition_route(
    requisition_id: str,
    current_user: UserModel = Depends(get_current_user),
):
    """Submits a draft requisition for sequential approval."""
    service = RequisitionService()
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
):
    """Records an approval or rejection step in the requisition approval chain."""
    service = RequisitionService()
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
):
    """Links an approved requisition to a job posting and marks it open."""
    service = RequisitionService()
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
):
    """Increments the filled headcount count for a requisition."""
    service = RequisitionService()
    tenant_id = getattr(current_user, "tenant_id", "default")
    req = await service.record_hire(requisition_id, count=payload.count, tenant_id=tenant_id)
    if not req:
        raise HTTPException(status_code=404, detail="Requisition not found")
    return req
