"""
Portfolio Repository — Native PostgreSQL via SQLAlchemy 2.0.
Handles User Profiles and Portfolio Analytics.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from config.db import get_pg_session_factory
from models import UserProfile, PortfolioAnalytics, gen_uuid_str


def _profile_to_dict(row: UserProfile) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    d = {c.name: getattr(row, c.name) for c in UserProfile.__table__.columns}
    prof_id = str(d.get("id"))
    d["id"] = prof_id
    d["_id"] = prof_id
    return d


def _analytics_to_dict(row: PortfolioAnalytics) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    d = {c.name: getattr(row, c.name) for c in PortfolioAnalytics.__table__.columns}
    analytics_id = str(d.get("id"))
    d["id"] = analytics_id
    d["_id"] = analytics_id
    return d


class PortfolioRepository:
    def __init__(self, session_factory=None):
        self.session_factory = session_factory or get_pg_session_factory()

    async def get_by_user_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(UserProfile).where(UserProfile.user_id == str(user_id))
            res = await session.execute(stmt)
            return _profile_to_dict(res.scalar_one_or_none())

    async def get_by_username(self, username: str, published_only: bool = False) -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(UserProfile).where(UserProfile.username.ilike(username.strip()))
            if published_only:
                stmt = stmt.where(UserProfile.is_published == True)
            res = await session.execute(stmt)
            return _profile_to_dict(res.scalar_one_or_none())

    async def upsert_profile(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        async with self.session_factory() as session:
            stmt = select(UserProfile).where(UserProfile.user_id == str(user_id))
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()

            now = datetime.now(timezone.utc)
            clean_data = {k: v for k, v in data.items() if hasattr(UserProfile, k) and k not in ("id", "user_id", "created_at")}
            clean_data["updated_at"] = now

            if existing:
                for k, v in clean_data.items():
                    setattr(existing, k, v)
                await session.commit()
                await session.refresh(existing)
                return _profile_to_dict(existing)
            else:
                if not clean_data.get("username"):
                    clean_data["username"] = f"user_{user_id[:8]}"
                if not clean_data.get("full_name"):
                    clean_data["full_name"] = "Candidate"
                if clean_data.get("email") is None:
                    clean_data["email"] = ""
                new_profile = UserProfile(
                    id=gen_uuid_str(),
                    user_id=str(user_id),
                    **clean_data,
                )
                session.add(new_profile)
                await session.commit()
                await session.refresh(new_profile)
                return _profile_to_dict(new_profile)

    async def get_analytics(self, username: str) -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(PortfolioAnalytics).where(PortfolioAnalytics.username.ilike(username.strip()))
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if not row:
                return {
                    "username": username,
                    "total_views": 0,
                    "resume_downloads": 0,
                    "contact_clicks": 0,
                    "views_by_date": {},
                    "last_viewed_at": None,
                }
            return _analytics_to_dict(row)

    async def record_view(self, username: str) -> None:
        async with self.session_factory() as session:
            clean_name = username.strip().lower()
            stmt = select(PortfolioAnalytics).where(PortfolioAnalytics.username.ilike(clean_name))
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()

            now = datetime.now(timezone.utc)
            today_str = now.strftime("%Y-%m-%d")

            if existing:
                existing.total_views = (existing.total_views or 0) + 1
                existing.last_viewed_at = now
                existing.updated_at = now
                v_by_date = dict(existing.views_by_date or {})
                v_by_date[today_str] = v_by_date.get(today_str, 0) + 1
                existing.views_by_date = v_by_date
                await session.commit()
            else:
                analytics = PortfolioAnalytics(
                    id=gen_uuid_str(),
                    username=clean_name,
                    total_views=1,
                    views_by_date={today_str: 1},
                    last_viewed_at=now,
                    created_at=now,
                    updated_at=now,
                )
                session.add(analytics)
                await session.commit()

    async def increment_counter(self, username: str, field: str) -> None:
        if field not in ("resume_downloads", "contact_clicks"):
            return
        async with self.session_factory() as session:
            clean_name = username.strip().lower()
            stmt = select(PortfolioAnalytics).where(PortfolioAnalytics.username.ilike(clean_name))
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()
            now = datetime.now(timezone.utc)

            if existing:
                current_val = getattr(existing, field, 0) or 0
                setattr(existing, field, current_val + 1)
                existing.updated_at = now
                await session.commit()
            else:
                analytics = PortfolioAnalytics(
                    id=gen_uuid_str(),
                    username=clean_name,
                    total_views=0,
                    last_viewed_at=now,
                    created_at=now,
                    updated_at=now,
                )
                setattr(analytics, field, 1)
                session.add(analytics)
                await session.commit()

