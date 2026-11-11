"""
Certificate Repository
======================
Standardized repository handling all persistence and queries for the Certificate entity
via native PostgreSQL and SQLAlchemy 2.0.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import select, update, desc, and_, or_, func
from models.tables import Certificate
from repositories.base_repo import BaseRepository


class CertificateRepository(BaseRepository):
    def __init__(self, session_factory=None):
        super().__init__(model_cls=Certificate, session_factory=session_factory)

    async def get_by_id(self, cert_id: str) -> Optional[Dict[str, Any]]:
        async with self._get_session() as session:
            stmt = select(Certificate).where(Certificate.id == str(cert_id))
            row = (await session.execute(stmt)).scalar_one_or_none()
            return self._serialize(row) if row else None

    async def get_active_by_user_and_topic(self, user_id: str, topic_slug: str) -> Optional[Dict[str, Any]]:
        async with self._get_session() as session:
            stmt = (
                select(Certificate)
                .where(
                    and_(
                        Certificate.user_id == str(user_id),
                        Certificate.status == "active",
                        or_(
                            Certificate.topic == topic_slug,
                            func.lower(Certificate.topic) == topic_slug.lower(),
                        )
                    )
                )
                .order_by(desc(Certificate.issued_at))
                .limit(1)
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            return self._serialize(row) if row else None

    async def list_by_user(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        async with self._get_session() as session:
            stmt = (
                select(Certificate)
                .where(Certificate.user_id == str(user_id))
                .order_by(desc(Certificate.issued_at))
                .limit(limit)
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [self._serialize(r) for r in rows if r]

    async def create(self, cert_data: Dict[str, Any]) -> Dict[str, Any]:
        async with self._get_session() as session:
            row = Certificate(**cert_data)
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return self._serialize(row)

    async def supersede(self, old_cert_id: str, new_cert_id: str) -> bool:
        async with self._get_session() as session:
            stmt = (
                update(Certificate)
                .where(Certificate.id == str(old_cert_id))
                .values(
                    status="superseded",
                    superseded_by=str(new_cert_id),
                    superseded_at=datetime.now(timezone.utc),
                )
            )
            res = await session.execute(stmt)
            await session.commit()
            return (res.rowcount or 0) > 0

    async def update_recipient(self, cert_id: str, recipient_name: str, snapshot: Dict[str, Any]) -> bool:
        async with self._get_session() as session:
            stmt = (
                update(Certificate)
                .where(Certificate.id == str(cert_id))
                .values(recipient_name=recipient_name, snapshot=snapshot)
            )
            res = await session.execute(stmt)
            await session.commit()
            return (res.rowcount or 0) > 0

