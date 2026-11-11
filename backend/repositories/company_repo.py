"""
Company Repository — Native PostgreSQL via SQLAlchemy 2.0.
Handles organization profiles, branding, and employer metadata.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from config.db import get_pg_session_factory
from models import Company, gen_uuid_str


def _company_to_dict(row: Company) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    d = {c.name: getattr(row, c.name) for c in Company.__table__.columns}
    comp_id = str(d.get("id"))
    d["id"] = comp_id
    d["_id"] = comp_id
    return d


class CompanyRepository:
    def __init__(self, session_factory=None):
        self._session_factory = session_factory

    @property
    def session_factory(self):
        return self._session_factory or get_pg_session_factory()

    async def get_by_tenant_id(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(Company).where(Company.tenant_id == tenant_id)
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            return _company_to_dict(row)

    async def get_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(Company).where(Company.company_name.ilike(name))
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            return _company_to_dict(row)

    async def upsert(self, tenant_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        async with self.session_factory() as session:
            stmt = select(Company).where(Company.tenant_id == tenant_id)
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()

            now = datetime.now(timezone.utc)
            clean_data = {k: v for k, v in data.items() if hasattr(Company, k) and k not in ("id", "tenant_id", "created_at")}
            clean_data["updated_at"] = now

            if existing:
                for k, v in clean_data.items():
                    setattr(existing, k, v)
                await session.commit()
                await session.refresh(existing)
                return _company_to_dict(existing)
            else:
                new_company = Company(
                    id=gen_uuid_str(),
                    tenant_id=tenant_id,
                    company_name=data.get("company_name", "CareerShala"),
                    **clean_data
                )
                session.add(new_company)
                await session.commit()
                await session.refresh(new_company)
                return _company_to_dict(new_company)

