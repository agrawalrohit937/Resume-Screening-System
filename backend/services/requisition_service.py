"""Requisition Management & Headcount Approval Service.
CareerPilot ATS v2.0.0 - Enterprise ATS Workflows.
"""

from datetime import datetime
from typing import List, Optional
import structlog

from models.requisition import RequisitionModel, RequisitionStatus, ApprovalDecision, ApprovalStep
from services.multi_tenancy.tenant_context import get_current_tenant_id

logger = structlog.get_logger(__name__)


class RequisitionService:
    def __init__(self, db):
        self.db = db

    async def create_requisition(
        self,
        title: str,
        department: str,
        hiring_manager_id: str,
        headcount: int = 1,
        budget_min: float = 0.0,
        budget_max: float = 0.0,
        currency: str = "USD",
        approval_chain: Optional[List[ApprovalStep]] = None,
        tenant_id: Optional[str] = None
    ) -> RequisitionModel:
        resolved_tenant = tenant_id or get_current_tenant_id()
        chain = approval_chain or [
            ApprovalStep(step_order=1, approver_id=hiring_manager_id, approver_role="hiring_manager"),
            ApprovalStep(step_order=2, approver_id="finance_admin", approver_role="admin")
        ]
        req = RequisitionModel(
            tenant_id=resolved_tenant,
            title=title,
            department=department,
            headcount=headcount,
            budget_min=budget_min,
            budget_max=budget_max,
            budget_currency=currency,
            hiring_manager_id=hiring_manager_id,
            approval_chain=chain,
            status=RequisitionStatus.DRAFT
        )
        await self.db.requisitions.insert_one(req.dict())
        logger.info("Requisition created", requisition_id=req.id, tenant_id=resolved_tenant)
        return req

    async def submit_for_approval(self, requisition_id: str, tenant_id: Optional[str] = None) -> Optional[RequisitionModel]:
        resolved_tenant = tenant_id or get_current_tenant_id()
        doc = await self.db.requisitions.find_one({"id": requisition_id, "tenant_id": resolved_tenant})
        if not doc:
            return None
        
        req = RequisitionModel(**doc)
        if req.status != RequisitionStatus.DRAFT:
            return req
        
        req.status = RequisitionStatus.PENDING_APPROVAL
        req.updated_at = datetime.utcnow()
        await self.db.requisitions.update_one(
            {"id": requisition_id, "tenant_id": resolved_tenant},
            {"$set": {"status": req.status.value, "updated_at": req.updated_at}}
        )
        logger.info("Requisition submitted for approval", requisition_id=requisition_id)
        return req

    async def record_approval_decision(
        self,
        requisition_id: str,
        approver_id: str,
        decision: ApprovalDecision,
        comments: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Optional[RequisitionModel]:
        resolved_tenant = tenant_id or get_current_tenant_id()
        doc = await self.db.requisitions.find_one({"id": requisition_id, "tenant_id": resolved_tenant})
        if not doc:
            return None
        
        req = RequisitionModel(**doc)
        if req.status != RequisitionStatus.PENDING_APPROVAL:
            return req

        updated_step = False
        for step in req.approval_chain:
            if step.approver_id == approver_id and step.status == ApprovalDecision.PENDING:
                step.status = decision
                step.decided_at = datetime.utcnow()
                step.comments = comments
                updated_step = True
                break

        if not updated_step:
            return req

        # Check chain state
        any_rejected = any(step.status == ApprovalDecision.REJECTED for step in req.approval_chain)
        all_approved = all(step.status == ApprovalDecision.APPROVED for step in req.approval_chain)

        if any_rejected:
            req.status = RequisitionStatus.REJECTED
        elif all_approved:
            req.status = RequisitionStatus.APPROVED

        req.updated_at = datetime.utcnow()
        await self.db.requisitions.update_one(
            {"id": requisition_id, "tenant_id": resolved_tenant},
            {"$set": {
                "approval_chain": [s.dict() for s in req.approval_chain],
                "status": req.status.value,
                "updated_at": req.updated_at
            }}
        )
        logger.info("Requisition approval recorded", requisition_id=requisition_id, status=req.status.value)
        return req

    async def link_to_job(self, requisition_id: str, job_id: str, tenant_id: Optional[str] = None) -> Optional[RequisitionModel]:
        resolved_tenant = tenant_id or get_current_tenant_id()
        doc = await self.db.requisitions.find_one({"id": requisition_id, "tenant_id": resolved_tenant})
        if not doc:
            return None
        
        req = RequisitionModel(**doc)
        if req.status != RequisitionStatus.APPROVED:
            raise ValueError(f"Cannot link job to requisition with status {req.status.value}. Requisition must be approved.")

        req.linked_job_id = job_id
        req.status = RequisitionStatus.OPEN
        req.updated_at = datetime.utcnow()
        await self.db.requisitions.update_one(
            {"id": requisition_id, "tenant_id": resolved_tenant},
            {"$set": {"linked_job_id": job_id, "status": req.status.value, "updated_at": req.updated_at}}
        )
        logger.info("Requisition linked to job and opened", requisition_id=requisition_id, job_id=job_id)
        return req

    async def record_hire(self, requisition_id: str, count: int = 1, tenant_id: Optional[str] = None) -> Optional[RequisitionModel]:
        resolved_tenant = tenant_id or get_current_tenant_id()
        doc = await self.db.requisitions.find_one({"id": requisition_id, "tenant_id": resolved_tenant})
        if not doc:
            return None
        
        req = RequisitionModel(**doc)
        req.filled_count += count
        if req.filled_count >= req.headcount:
            req.status = RequisitionStatus.FILLED
        
        req.updated_at = datetime.utcnow()
        await self.db.requisitions.update_one(
            {"id": requisition_id, "tenant_id": resolved_tenant},
            {"$set": {"filled_count": req.filled_count, "status": req.status.value, "updated_at": req.updated_at}}
        )
        logger.info("Requisition hire recorded", requisition_id=requisition_id, filled=req.filled_count, target=req.headcount)
        return req
