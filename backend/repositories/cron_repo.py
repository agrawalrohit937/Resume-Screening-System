"""
Cron & Job Alert Delivery Repository — Native PostgreSQL via SQLAlchemy 2.0.
Handles batch tracking in `cron_job_runs` and atomic per-user claims in `job_alert_deliveries`.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import structlog
from sqlalchemy import select, update, func, and_, or_
from sqlalchemy.dialects.postgresql import insert

from config.db import get_pg_session_factory
from models import CronJobRun, JobAlertDelivery, User, Resume, Job, Company, gen_uuid_str
from schemas.cron_schema import CronRunStatus, DeliveryStatus

logger = structlog.get_logger(__name__)


def _cron_run_to_dict(model: CronJobRun) -> Optional[Dict[str, Any]]:
    if not model:
        return None
    d = {c.name: getattr(model, c.name) for c in CronJobRun.__table__.columns}
    cron_id = str(d.get("id"))
    d["id"] = cron_id
    d["_id"] = cron_id
    return d


def _delivery_to_dict(model: JobAlertDelivery) -> Optional[Dict[str, Any]]:
    if not model:
        return None
    d = {c.name: getattr(model, c.name) for c in JobAlertDelivery.__table__.columns}
    deliv_id = str(d.get("id"))
    d["id"] = deliv_id
    d["_id"] = deliv_id
    return d


class CronRepository:
    def __init__(self, db=None, session_factory=None):
        self.db = db
        self._session_factory = session_factory

    @property
    def session_factory(self):
        return self._session_factory or get_pg_session_factory()

    async def get_cron_run(self, slot_id: str, job_name: str = "job_alerts") -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(CronJobRun).where(
                CronJobRun.slot_id == str(slot_id),
                CronJobRun.job_name == str(job_name),
            )
            res = await session.execute(stmt)
            return _cron_run_to_dict(res.scalar_one_or_none())

    async def upsert_cron_run(
        self,
        slot_id: str,
        job_name: str = "job_alerts",
        slot_type: str = "morning",
        status: str = "running",
        triggered_by: str = "scheduler",
        **extra_fields,
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        async with self.session_factory() as session:
            async with session.begin():
                stmt = select(CronJobRun).where(
                    CronJobRun.slot_id == str(slot_id),
                    CronJobRun.job_name == str(job_name),
                )
                res = await session.execute(stmt)
                obj = res.scalar_one_or_none()

                if not obj:
                    obj = CronJobRun(
                        id=gen_uuid_str(),
                        slot_id=str(slot_id),
                        job_name=str(job_name),
                        slot_type=slot_type,
                        status=status,
                        started_at=now,
                        triggered_by=triggered_by,
                    )
                    session.add(obj)
                    await session.flush()

                obj.status = status
                for k, v in extra_fields.items():
                    if hasattr(obj, k):
                        setattr(obj, k, v)

            await session.refresh(obj)
            return _cron_run_to_dict(obj)

    async def get_candidate_delivery(self, candidate_id: str, slot_id: str) -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(JobAlertDelivery).where(
                JobAlertDelivery.candidate_id == str(candidate_id),
                JobAlertDelivery.slot_id == str(slot_id),
            )
            res = await session.execute(stmt)
            return _delivery_to_dict(res.scalar_one_or_none())

    async def claim_candidate(self, candidate_id: str, slot_id: str, email: str) -> bool:
        """Atomically claim a candidate delivery for a specific slot."""
        now = datetime.now(timezone.utc)
        async with self.session_factory() as session:
            try:
                async with session.begin():
                    obj = JobAlertDelivery(
                        id=gen_uuid_str(),
                        candidate_id=str(candidate_id),
                        slot_id=str(slot_id),
                        email=email,
                        status=DeliveryStatus.CLAIMED.value,
                        attempt_count=1,
                        claimed_at=now,
                    )
                    session.add(obj)
                return True
            except Exception:
                return False

    async def reclaim_candidate(self, candidate_id: str, slot_id: str, old_claimed_at: datetime) -> bool:
        now = datetime.now(timezone.utc)
        async with self.session_factory() as session:
            async with session.begin():
                stmt = (
                    update(JobAlertDelivery)
                    .where(
                        JobAlertDelivery.candidate_id == str(candidate_id),
                        JobAlertDelivery.slot_id == str(slot_id),
                        JobAlertDelivery.status == DeliveryStatus.CLAIMED.value,
                        JobAlertDelivery.claimed_at == old_claimed_at,
                    )
                    .values(
                        claimed_at=now,
                        attempt_count=JobAlertDelivery.attempt_count + 1,
                    )
                )
                res = await session.execute(stmt)
                return bool(res.rowcount and res.rowcount > 0)

    async def update_delivery(self, candidate_id: str, slot_id: str, **fields) -> bool:
        async with self.session_factory() as session:
            async with session.begin():
                valid_cols = {c.name for c in JobAlertDelivery.__table__.columns}
                vals = {k: v for k, v in fields.items() if k in valid_cols and k != "id"}
                stmt = (
                    update(JobAlertDelivery)
                    .where(
                        JobAlertDelivery.candidate_id == str(candidate_id),
                        JobAlertDelivery.slot_id == str(slot_id),
                    )
                    .values(**vals)
                )
                res = await session.execute(stmt)
                return bool(res.rowcount and res.rowcount > 0)

    async def get_active_candidates(self, target_email: Optional[str] = None) -> List[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(User).where(User.status != "deleted")
            if target_email:
                stmt = stmt.where(User.email == target_email.strip().lower())
            else:
                stmt = stmt.where(
                    or_(
                        User.role == "candidate",
                        User.role.is_(None),
                    ),
                    User.job_alerts_enabled.isnot(False),
                )
            res = await session.execute(stmt)
            users = res.scalars().all()
            return [
                {
                    "_id": str(u.id),
                    "id": str(u.id),
                    "email": u.email,
                    "full_name": getattr(u, "full_name", None) or getattr(u, "name", None) or u.email,
                    "role": u.role or "candidate",
                    "last_alert_slot": getattr(u, "last_alert_slot", None),
                }
                for u in users
            ]

    async def get_candidate_parsed_resume(self, user_id: str) -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = (
                select(Resume)
                .where(
                    Resume.user_id == str(user_id),
                    Resume.status == "parsed",
                    Resume.parsed_data.isnot(None),
                )
                .order_by(Resume.is_primary.desc(), Resume.created_at.desc())
                .limit(1)
            )
            res = await session.execute(stmt)
            r = res.scalar_one_or_none()
            if not r:
                return None
            return {
                "_id": str(r.id),
                "id": str(r.id),
                "user_id": str(r.user_id),
                "parsed_data": r.parsed_data,
            }

    async def get_open_jobs_count(self) -> int:
        async with self.session_factory() as session:
            stmt = select(func.count()).select_from(Job).where(Job.status.in_(["open", "published"]))
            res = await session.execute(stmt)
            return res.scalar() or 0

    async def update_user_alert_slot(self, user_id: str, slot_id: str, job_ids: List[str]) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                stmt = update(User).where(User.id == str(user_id)).values(last_alert_slot=str(slot_id))
                await session.execute(stmt)
