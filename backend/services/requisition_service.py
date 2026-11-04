"""Requisition Management & Headcount Approval Service (Pure PostgreSQL SQLAlchemy 2.0).
CareerShala ATS v2.0.0 - Enterprise ATS Workflows.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Optional
import structlog
from sqlalchemy import select, and_

from config.db import get_pg_session_factory
from models.tables import Requisition as RequisitionTable
from models.requisition import RequisitionModel, RequisitionStatus, ApprovalDecision, ApprovalStep
from services.multi_tenancy.tenant_context import get_current_tenant_id

logger = structlog.get_logger(__name__)


class RequisitionService:
    def __init__(self, db: Any = None, session_factory: Any = None):
        self.db = db
        self.session_factory = session_factory or get_pg_session_factory()

    def _get_session(self):
        return self.session_factory()

    async def get_requisition(self, requisition_id: str, tenant_id: Optional[str] = None) -> Optional[RequisitionModel]:
        resolved_tenant = tenant_id or get_current_tenant_id()
        async with self._get_session() as session:
            stmt = select(RequisitionTable).where(
                and_(RequisitionTable.id == str(requisition_id), RequisitionTable.tenant_id == str(resolved_tenant))
            )
            r_row = (await session.execute(stmt)).scalar_one_or_none()
            if not r_row:
                return None
            doc = dict(r_row.data or {})
            doc.update({
                "id": r_row.id,
                "tenant_id": r_row.tenant_id,
                "title": r_row.title,
                "department": r_row.department or doc.get("department", ""),
                "hiring_manager_id": r_row.hiring_manager_id or doc.get("hiring_manager_id", ""),
                "status": r_row.status,
            })
            return RequisitionModel(**doc)

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

        async with self._get_session() as session:
            session.add(RequisitionTable(
                id=req.id,
                tenant_id=req.tenant_id,
                title=req.title,
                department=req.department,
                hiring_manager_id=req.hiring_manager_id,
                status=req.status.value if hasattr(req.status, "value") else str(req.status),
                data=req.dict(),
            ))
            await session.commit()

        logger.info("Requisition created", requisition_id=req.id, tenant_id=resolved_tenant)
        return req

    async def submit_for_approval(self, requisition_id: str, tenant_id: Optional[str] = None) -> Optional[RequisitionModel]:
        resolved_tenant = tenant_id or get_current_tenant_id()
        async with self._get_session() as session:
            stmt = select(RequisitionTable).where(
                and_(RequisitionTable.id == str(requisition_id), RequisitionTable.tenant_id == str(resolved_tenant))
            )
            r_row = (await session.execute(stmt)).scalar_one_or_none()
            if not r_row:
                return None

            doc = dict(r_row.data or {})
            doc.update({
                "id": r_row.id,
                "tenant_id": r_row.tenant_id,
                "title": r_row.title,
                "department": r_row.department or doc.get("department", ""),
                "hiring_manager_id": r_row.hiring_manager_id or doc.get("hiring_manager_id", ""),
                "status": r_row.status,
            })
            req = RequisitionModel(**doc)
            if req.status != RequisitionStatus.DRAFT:
                return req

            req.status = RequisitionStatus.PENDING_APPROVAL
            req.updated_at = datetime.now(timezone.utc)

            r_row.status = req.status.value if hasattr(req.status, "value") else str(req.status)
            r_row.data = req.dict()
            await session.commit()

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
        async with self._get_session() as session:
            stmt = select(RequisitionTable).where(
                and_(RequisitionTable.id == str(requisition_id), RequisitionTable.tenant_id == str(resolved_tenant))
            )
            r_row = (await session.execute(stmt)).scalar_one_or_none()
            if not r_row:
                return None

            doc = dict(r_row.data or {})
            doc.update({
                "id": r_row.id,
                "tenant_id": r_row.tenant_id,
                "title": r_row.title,
                "department": r_row.department or doc.get("department", ""),
                "hiring_manager_id": r_row.hiring_manager_id or doc.get("hiring_manager_id", ""),
                "status": r_row.status,
            })
            req = RequisitionModel(**doc)
            if req.status != RequisitionStatus.PENDING_APPROVAL:
                return req

            updated_step = False
            for step in req.approval_chain:
                if step.approver_id == approver_id and step.status == ApprovalDecision.PENDING:
                    step.status = decision
                    step.decided_at = datetime.now(timezone.utc)
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

            req.updated_at = datetime.now(timezone.utc)

            r_row.status = req.status.value if hasattr(req.status, "value") else str(req.status)
            r_row.data = req.dict()
            await session.commit()

        logger.info("Requisition approval recorded", requisition_id=requisition_id, status=req.status.value)
        return req

    async def link_to_job(self, requisition_id: str, job_id: str, tenant_id: Optional[str] = None) -> Optional[RequisitionModel]:
        resolved_tenant = tenant_id or get_current_tenant_id()
        async with self._get_session() as session:
            stmt = select(RequisitionTable).where(
                and_(RequisitionTable.id == str(requisition_id), RequisitionTable.tenant_id == str(resolved_tenant))
            )
            r_row = (await session.execute(stmt)).scalar_one_or_none()
            if not r_row:
                return None

            doc = dict(r_row.data or {})
            doc.update({
                "id": r_row.id,
                "tenant_id": r_row.tenant_id,
                "title": r_row.title,
                "department": r_row.department or doc.get("department", ""),
                "hiring_manager_id": r_row.hiring_manager_id or doc.get("hiring_manager_id", ""),
                "status": r_row.status,
            })
            req = RequisitionModel(**doc)
            if req.status != RequisitionStatus.APPROVED:
                raise ValueError(f"Cannot link job to requisition with status {req.status.value}. Requisition must be approved.")

            req.linked_job_id = str(job_id)
            req.status = RequisitionStatus.OPEN
            req.updated_at = datetime.now(timezone.utc)

            r_row.status = req.status.value if hasattr(req.status, "value") else str(req.status)
            r_row.data = req.dict()
            await session.commit()

        logger.info("Requisition linked to job and opened", requisition_id=requisition_id, job_id=job_id)
        return req

    async def record_hire(self, requisition_id: str, count: int = 1, tenant_id: Optional[str] = None) -> Optional[RequisitionModel]:
        resolved_tenant = tenant_id or get_current_tenant_id()
        async with self._get_session() as session:
            stmt = select(RequisitionTable).where(
                and_(RequisitionTable.id == str(requisition_id), RequisitionTable.tenant_id == str(resolved_tenant))
            )
            r_row = (await session.execute(stmt)).scalar_one_or_none()
            if not r_row:
                return None

            doc = dict(r_row.data or {})
            doc.update({
                "id": r_row.id,
                "tenant_id": r_row.tenant_id,
                "title": r_row.title,
                "department": r_row.department or doc.get("department", ""),
                "hiring_manager_id": r_row.hiring_manager_id or doc.get("hiring_manager_id", ""),
                "status": r_row.status,
            })
            req = RequisitionModel(**doc)
            req.filled_count += count
            if req.filled_count >= req.headcount:
                req.status = RequisitionStatus.FILLED

            req.updated_at = datetime.now(timezone.utc)

            r_row.status = req.status.value if hasattr(req.status, "value") else str(req.status)
            r_row.data = req.dict()
            await session.commit()

        logger.info("Requisition hire recorded", requisition_id=requisition_id, filled=req.filled_count, target=req.headcount)
        return req
