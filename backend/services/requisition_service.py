"""Requisition Management & Headcount Approval Service (Pure PostgreSQL SQLAlchemy 2.0).
CareerShala ATS v2.0.0 - Enterprise ATS Workflows.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import structlog
from sqlalchemy import select, and_, func

from config.db import get_pg_session_factory
from models.tables import Requisition as RequisitionTable, CandidateApplication, Job, Scorecard
from schemas.requisition_schema import RequisitionModel, RequisitionStatus, ApprovalDecision, ApprovalStep
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

    async def list_requisitions(self, tenant_id: Optional[str] = None, limit: int = 100) -> List[RequisitionModel]:
        resolved_tenant = tenant_id or get_current_tenant_id()
        async with self._get_session() as session:
            stmt = select(RequisitionTable).where(RequisitionTable.tenant_id == str(resolved_tenant)).limit(limit)
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

    async def get_pipeline_candidates(self, tenant_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        resolved_tenant = tenant_id or get_current_tenant_id()
        async with self._get_session() as session:
            app_stmt = (
                select(CandidateApplication)
                .where(CandidateApplication.tenant_id == str(resolved_tenant))
                .order_by(CandidateApplication.created_at.desc())
                .limit(limit)
            )
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
                sc_stmt = (
                    select(Scorecard.application_id, func.count(Scorecard.id))
                    .where(and_(Scorecard.application_id.in_(app_ids), Scorecard.tenant_id == str(resolved_tenant)))
                    .group_by(Scorecard.application_id)
                )
                sc_res = await session.execute(sc_stmt)
                scorecard_counts_map = {r[0]: r[1] for r in sc_res.all()}

        results = []
        for app in apps:
            app_id_str = str(app.get("id") or app.get("_id"))
            job_info = jobs_map.get(app.get("job_id"), {})
            resume_snap = app.get("resume_snapshot") or {}
            resume_url = app.get("resume_url") or resume_snap.get("file_url") or "#"
            scorecards_count = scorecard_counts_map.get(app_id_str, 0)
            years_exp = resume_snap.get("total_experience_years") or app.get("years_experience", 0)

            results.append({
                "id": app_id_str,
                "application_id": app_id_str,
                "candidate_id": str(app.get("candidate_id") or app.get("user_id") or ""),
                "candidate_name": app.get("candidate_name") or app.get("full_name") or "Candidate",
                "email": app.get("email") or resume_snap.get("email", ""),
                "role_title": app.get("job_title") or job_info.get("title") or "Candidate Application",
                "department": app.get("department") or job_info.get("department") or "Engineering",
                "stage": app.get("stage") or "Screening",
                "match_score": app.get("match_score") or 0,
                "created_at": app.get("created_at"),
                "skills": resume_snap.get("skills", []) or app.get("skills", []),
                "years_experience": years_exp,
                "status": app.get("status") or "active",
                "scorecards_count": scorecards_count,
                "resume_url": resume_url,
            })
        return results

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
