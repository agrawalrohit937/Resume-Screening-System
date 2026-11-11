"""
Team Invite Repository — Native PostgreSQL via SQLAlchemy 2.0.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from config.db import get_pg_session_factory
from models import TeamInvite, gen_uuid_str


def _invite_to_dict(row: TeamInvite) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    d = {c.name: getattr(row, c.name) for c in TeamInvite.__table__.columns}
    inv_id = str(d.get("id"))
    d["id"] = inv_id
    d["_id"] = inv_id
    return d


class TeamInviteRepository:
    def __init__(self, session_factory=None):
        self.session_factory = session_factory or get_pg_session_factory()

    async def get_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(TeamInvite).where(TeamInvite.token == token)
            res = await session.execute(stmt)
            return _invite_to_dict(res.scalar_one_or_none())

    async def get_by_email_and_tenant(self, email: str, tenant_id: str) -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(TeamInvite).where(
                TeamInvite.email.ilike(email.strip()),
                TeamInvite.tenant_id == tenant_id,
            )
            res = await session.execute(stmt)
            return _invite_to_dict(res.scalar_one_or_none())

    async def list_by_tenant(self, tenant_id: str) -> List[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(TeamInvite).where(TeamInvite.tenant_id == tenant_id).order_by(TeamInvite.created_at.desc())
            res = await session.execute(stmt)
            return [_invite_to_dict(r) for r in res.scalars().all()]

    async def create_invite(self, data: Dict[str, Any]) -> Dict[str, Any]:
        async with self.session_factory() as session:
            now = datetime.now(timezone.utc)
            clean_data = {k: v for k, v in data.items() if hasattr(TeamInvite, k) and k != "id"}
            invite = TeamInvite(
                id=gen_uuid_str(),
                created_at=now,
                **clean_data
            )
            session.add(invite)
            await session.commit()
            await session.refresh(invite)
            return _invite_to_dict(invite)

    async def upsert_pending_invite(self, data: Dict[str, Any]) -> Dict[str, Any]:
        email = str(data.get("email", "")).strip().lower()
        tenant_id = str(data.get("tenant_id", "default"))
        async with self.session_factory() as session:
            stmt = select(TeamInvite).where(
                TeamInvite.email.ilike(email),
                TeamInvite.tenant_id == tenant_id,
                TeamInvite.status == "pending",
            )
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if existing:
                for k, v in data.items():
                    if hasattr(existing, k) and k not in ("id", "created_at"):
                        setattr(existing, k, v)
                await session.commit()
                await session.refresh(existing)
                return _invite_to_dict(existing)
            else:
                now = datetime.now(timezone.utc)
                clean_data = {k: v for k, v in data.items() if hasattr(TeamInvite, k) and k != "id"}
                invite = TeamInvite(id=gen_uuid_str(), created_at=now, **clean_data)
                session.add(invite)
                await session.commit()
                await session.refresh(invite)
                return _invite_to_dict(invite)

    async def update_status(self, token: str, status: str) -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(TeamInvite).where(TeamInvite.token == token)
            res = await session.execute(stmt)
            invite = res.scalar_one_or_none()
            if invite:
                invite.status = status
                await session.commit()
                await session.refresh(invite)
                return _invite_to_dict(invite)
            return None

    async def revoke_invite(self, invite_id: str, tenant_id: str) -> bool:
        async with self.session_factory() as session:
            stmt = select(TeamInvite).where(TeamInvite.id == invite_id, TeamInvite.tenant_id == tenant_id)
            res = await session.execute(stmt)
            invite = res.scalar_one_or_none()
            if invite:
                invite.status = "revoked"
                await session.commit()
                return True
            return False

