"""
Career Application Repository — Dual Engine (PostgreSQL via SQLAlchemy 2.0 / PostgreSQL Primary)
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
import structlog
from sqlalchemy import select, update, func, or_

from core.config import settings
from config.db import get_pg_session_factory
from models import CareerApplication, gen_uuid_str
from schemas.application_schema import (
    CareerApplicationModel,
)
from repositories.base_repo import BaseRepository

logger = structlog.get_logger(__name__)


def _capp_to_pydantic(row: CareerApplication) -> CareerApplicationModel:
    d = {c.name: getattr(row, c.name) for c in CareerApplication.__table__.columns}
    capp_id = str(d.get("id"))
    d["id"] = capp_id
    d["_id"] = capp_id
    return CareerApplicationModel(**d)


class CareerApplicationRepository(BaseRepository):
    def __init__(self, db: Optional[Any] = None, session_factory: Optional[Any] = None):
        self.session_factory = session_factory or get_pg_session_factory()
    async def create(self, data: dict) -> CareerApplicationModel:
        now = datetime.now(timezone.utc)
        c_data = dict(data)
        c_id = str(c_data.pop("_id", None) or c_data.pop("id", None) or gen_uuid_str())
        inst = CareerApplication(
            id=c_id,
            applicant_name=str(c_data.get("applicant_name", "")),
            email=str(c_data.get("email", "")),
            role_title=str(c_data.get("role_title", "")),
            portfolio_url=c_data.get("portfolio_url"),
            resume_url=c_data.get("resume_url"),
            resume_filename=c_data.get("resume_filename"),
            resume_public_id=c_data.get("resume_public_id"),
            cover_letter=str(c_data.get("cover_letter", "")),
            status=str(c_data.get("status", "applied")),
            admin_notes=c_data.get("admin_notes"),
            email_sent=bool(c_data.get("email_sent", False)),
            created_at=c_data.get("created_at") or now,
            updated_at=c_data.get("updated_at") or now,
        )
        async with self.session_factory() as session:
            session.add(inst)
            await session.commit()
            await session.refresh(inst)
            return _capp_to_pydantic(inst)

    async def get_by_id(self, app_id: str) -> Optional[CareerApplicationModel]:
        if not app_id:
            return None

        async with self.session_factory() as session:
            stmt = select(CareerApplication).where(CareerApplication.id == str(app_id))
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if row:
                return _capp_to_pydantic(row)
            return None

    async def get_all(
        self,
        *,
        status: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[CareerApplicationModel], int]:
        async with self.session_factory() as session:
            filters = []
            if status:
                filters.append(CareerApplication.status == str(status))
            if search:
                s = f"%{search.strip().lower()}%"
                filters.append(
                    or_(
                        func.lower(CareerApplication.applicant_name).like(s),
                        func.lower(CareerApplication.email).like(s),
                        func.lower(CareerApplication.role_title).like(s),
                    )
                )

            count_stmt = select(func.count()).select_from(CareerApplication)
            if filters:
                count_stmt = count_stmt.where(*filters)
            count_res = await session.execute(count_stmt)
            total = count_res.scalar() or 0

            stmt = select(CareerApplication)
            if filters:
                stmt = stmt.where(*filters)
            stmt = stmt.order_by(CareerApplication.created_at.desc()).offset(skip).limit(limit)
            res = await session.execute(stmt)
            apps = [_capp_to_pydantic(r) for r in res.scalars().all()]
            return apps, total

    async def update_status(
        self,
        app_id: str,
        status: str,
        admin_notes: Optional[str] = None,
    ) -> Optional[CareerApplicationModel]:
        now = datetime.now(timezone.utc)
        vals = {"status": status, "updated_at": now}
        if admin_notes is not None:
            vals["admin_notes"] = admin_notes

        async with self.session_factory() as session:
            stmt = (
                update(CareerApplication)
                .where(CareerApplication.id == str(app_id))
                .values(**vals)
                .returning(CareerApplication)
            )
            res = await session.execute(stmt)
            await session.commit()
            row = res.scalar_one_or_none()
            if row:
                return _capp_to_pydantic(row)
            return None

    async def count_by_status(self) -> dict:
        async with self.session_factory() as session:
            stmt = select(CareerApplication.status, func.count()).group_by(CareerApplication.status)
            res = await session.execute(stmt)
            stats = {
                "applied": 0,
                "shortlisted": 0,
                "interviewed": 0,
                "rejected": 0,
                "hired": 0,
            }
            for r in res.fetchall():
                if r[0] in stats:
                    stats[r[0]] = r[1]
            tot_res = await session.execute(select(func.count()).select_from(CareerApplication))
            total = tot_res.scalar() or 0
            return {"by_status": stats, "total": total}
