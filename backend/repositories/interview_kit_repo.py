"""
Interview Kit & Scorecard Repository — Native PostgreSQL via SQLAlchemy 2.0.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from config.db import get_pg_session_factory
from models import InterviewKit, Scorecard, gen_uuid_str


def _kit_to_dict(row: InterviewKit) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    d = {c.name: getattr(row, c.name) for c in InterviewKit.__table__.columns}
    d["_id"] = d.get("id")
    return d


def _scorecard_to_dict(row: Scorecard) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    d = {c.name: getattr(row, c.name) for c in Scorecard.__table__.columns}
    d["_id"] = d.get("id")
    return d


class InterviewKitRepository:
    def __init__(self, session_factory=None):
        self.session_factory = session_factory or get_pg_session_factory()

    async def get_kit_by_job_and_stage(self, job_id: str, stage_name: str, tenant_id: str = "default") -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(InterviewKit).where(
                InterviewKit.job_id == str(job_id),
                InterviewKit.stage_name == stage_name,
                InterviewKit.tenant_id == tenant_id,
            )
            res = await session.execute(stmt)
            return _kit_to_dict(res.scalar_one_or_none())

    async def create_kit(self, data: Dict[str, Any]) -> Dict[str, Any]:
        async with self.session_factory() as session:
            now = datetime.now(timezone.utc)
            clean_data = {k: v for k, v in data.items() if hasattr(InterviewKit, k) and k not in ("id", "created_at", "updated_at")}
            kit = InterviewKit(
                id=gen_uuid_str(),
                created_at=now,
                updated_at=now,
                **clean_data
            )
            session.add(kit)
            await session.commit()
            await session.refresh(kit)
            return _kit_to_dict(kit)

    async def get_scorecards_by_application(self, application_id: str) -> List[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(Scorecard).where(Scorecard.application_id == str(application_id))
            res = await session.execute(stmt)
            return [_scorecard_to_dict(r) for r in res.scalars().all()]

    async def get_scorecards_by_candidate(self, candidate_id: str) -> List[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(Scorecard).where(Scorecard.candidate_id == str(candidate_id))
            res = await session.execute(stmt)
            return [_scorecard_to_dict(r) for r in res.scalars().all()]

    async def submit_scorecard(self, data: Dict[str, Any]) -> Dict[str, Any]:
        async with self.session_factory() as session:
            now = datetime.now(timezone.utc)
            app_id = str(data.get("application_id") or "")
            int_id = str(data.get("interviewer_id") or "")
            stg = str(data.get("stage_name") or "")
            t_id = str(data.get("tenant_id") or "default")

            stmt = select(Scorecard).where(
                Scorecard.application_id == app_id,
                Scorecard.interviewer_id == int_id,
                Scorecard.stage_name == stg,
                Scorecard.tenant_id == t_id,
            )
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()
            if existing:
                for k, v in data.items():
                    if hasattr(Scorecard, k) and k not in ("id", "created_at"):
                        setattr(existing, k, v)
                existing.updated_at = now
                await session.commit()
                await session.refresh(existing)
                return _scorecard_to_dict(existing)

            clean_data = {k: v for k, v in data.items() if hasattr(Scorecard, k) and k not in ("id", "created_at", "updated_at")}
            scorecard = Scorecard(
                id=gen_uuid_str(),
                created_at=now,
                updated_at=now,
                **clean_data
            )
            session.add(scorecard)
            await session.commit()
            await session.refresh(scorecard)
            return _scorecard_to_dict(scorecard)


    async def list_kits_by_job(self, job_id: str, tenant_id: str = "default") -> List[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(InterviewKit).where(InterviewKit.job_id == str(job_id))
            if tenant_id and tenant_id != "default":
                stmt = stmt.where(InterviewKit.tenant_id == tenant_id)
            res = await session.execute(stmt)
            return [_kit_to_dict(r) for r in res.scalars().all()]
