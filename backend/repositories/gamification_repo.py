"""
Gamification Repository — Native PostgreSQL via SQLAlchemy 2.0.
Handles points, streaks, levels, and user gamification tracking.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from config.db import get_pg_session_factory
from models import UserGamification, gen_uuid_str


def _gamification_to_dict(row: UserGamification) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    d = {c.name: getattr(row, c.name) for c in UserGamification.__table__.columns}
    gam_id = str(d.get("id"))
    d["id"] = gam_id
    d["_id"] = gam_id
    return d


class GamificationRepository:
    def __init__(self, session_factory=None):
        self.session_factory = session_factory or get_pg_session_factory()

    async def get_by_user_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(UserGamification).where(UserGamification.user_id == str(user_id))
            res = await session.execute(stmt)
            return _gamification_to_dict(res.scalar_one_or_none())

    async def create_profile(self, user_id: str) -> Dict[str, Any]:
        async with self.session_factory() as session:
            now = datetime.now(timezone.utc)
            profile = UserGamification(
                id=gen_uuid_str(),
                user_id=str(user_id),
                total_points=0,
                current_streak=0,
                longest_streak=0,
                interviews_completed=0,
                questions_answered=0,
                average_score=0.0,
                best_score=0.0,
                badges=[],
                active_dates=[],
                created_at=now,
                updated_at=now,
            )
            session.add(profile)
            await session.commit()
            await session.refresh(profile)
            return _gamification_to_dict(profile)

    async def update_profile(self, user_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(UserGamification).where(UserGamification.user_id == str(user_id))
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()
            if not existing:
                existing = UserGamification(
                    id=gen_uuid_str(),
                    user_id=str(user_id),
                    created_at=datetime.now(timezone.utc),
                )
                session.add(existing)

            for k, v in updates.items():
                if hasattr(UserGamification, k) and k not in ("id", "user_id"):
                    setattr(existing, k, v)

            existing.updated_at = datetime.now(timezone.utc)
            await session.commit()
            await session.refresh(existing)
            return _gamification_to_dict(existing)


    async def get_user_rank(self, total_pts: int) -> int:
        async with self.session_factory() as session:
            stmt = select(func.count()).select_from(UserGamification).where(UserGamification.total_points > total_pts)
            res = await session.execute(stmt)
            return (res.scalar() or 0) + 1

    async def get_leaderboard(self, limit: int = 10) -> List[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(UserGamification).order_by(UserGamification.total_points.desc()).limit(limit)
            res = await session.execute(stmt)
            return [_gamification_to_dict(r) for r in res.scalars().all()]
