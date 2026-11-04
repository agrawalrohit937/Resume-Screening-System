"""
Interview Session Repository — Native PostgreSQL via SQLAlchemy 2.0.
Handles interview session creation, proctoring events, and evaluation storage.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
import structlog
from sqlalchemy import select, update, desc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from config.db import get_pg_session_factory
from models import InterviewSessionModel, gen_uuid_str

logger = structlog.get_logger(__name__)


def _session_to_dict(model: InterviewSessionModel) -> Optional[Dict[str, Any]]:
    if not model:
        return None
    d = {c.name: getattr(model, c.name) for c in InterviewSessionModel.__table__.columns}
    d["_id"] = str(d.get("id"))
    # Format datetime fields if needed
    for dt_col in ("created_at", "updated_at", "started_at", "completed_at", "expires_at"):
        val = d.get(dt_col)
        if isinstance(val, datetime):
            d[dt_col] = val.isoformat()
    return d


class InterviewSessionRepository:
    def __init__(self, db=None, session_factory=None):
        self.session_factory = session_factory or get_pg_session_factory()

    async def create_session(self, data: Dict[str, Any]) -> Dict[str, Any]:
        data = dict(data)
        sid = str(data.get("_id") or data.get("id") or gen_uuid_str())
        data["id"] = sid
        data.pop("_id", None)

        # Parse datetimes
        for dt_col in ("created_at", "updated_at", "started_at", "completed_at", "expires_at"):
            if dt_col in data and isinstance(data[dt_col], str):
                try:
                    data[dt_col] = datetime.fromisoformat(data[dt_col].replace("Z", "+00:00"))
                except Exception:
                    pass

        # Filter valid model columns
        valid_cols = {c.name for c in InterviewSessionModel.__table__.columns}
        filtered = {k: v for k, v in data.items() if k in valid_cols}

        async with self.session_factory() as session:
            async with session.begin():
                obj = InterviewSessionModel(**filtered)
                session.add(obj)
            await session.refresh(obj)
            return _session_to_dict(obj)

    async def get_by_id(self, session_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(InterviewSessionModel).where(InterviewSessionModel.id == str(session_id))
            if user_id:
                stmt = stmt.where(InterviewSessionModel.user_id == str(user_id))
            res = await session.execute(stmt)
            return _session_to_dict(res.scalar_one_or_none())

    async def get_by_magic_token(self, magic_token: str) -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(InterviewSessionModel).where(InterviewSessionModel.magic_token == str(magic_token))
            res = await session.execute(stmt)
            return _session_to_dict(res.scalar_one_or_none())

    async def update_by_id(self, session_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._apply_update(filter_clause=InterviewSessionModel.id == str(session_id), updates=updates)

    async def update_by_token(self, magic_token: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._apply_update(filter_clause=InterviewSessionModel.magic_token == str(magic_token), updates=updates)

    async def _apply_update(self, filter_clause, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        async with self.session_factory() as session:
            async with session.begin():
                stmt = select(InterviewSessionModel).where(filter_clause)
                res = await session.execute(stmt)
                obj = res.scalar_one_or_none()
                if not obj:
                    return None

                # Handle updates
                set_vals = dict(updates.get("$set", updates) if isinstance(updates, dict) else updates)
                push_vals = dict(updates.get("$push", {}) if isinstance(updates, dict) else {})
                inc_vals = dict(updates.get("$inc", {}) if isinstance(updates, dict) else {})

                # If answers or cheating_events is in set_vals and value is a single dict, treat as append
                for list_field in ("answers", "cheating_events"):
                    if list_field in set_vals and isinstance(set_vals[list_field], dict):
                        push_vals[list_field] = set_vals.pop(list_field)

                # Apply set
                for k, v in set_vals.items():
                    if k.startswith("$"):
                        continue
                    if hasattr(obj, k) and k != "id":
                        if k in ("completed_at", "started_at", "expires_at") and isinstance(v, str):
                            try:
                                v = datetime.fromisoformat(v.replace("Z", "+00:00"))
                            except Exception:
                                pass
                        setattr(obj, k, v)

                # Apply inc
                for k, v in inc_vals.items():
                    if hasattr(obj, k) and k != "id":
                        current = getattr(obj, k) or 0
                        setattr(obj, k, current + v)

                # Apply push / append
                for k, v in push_vals.items():
                    if hasattr(obj, k):
                        current = list(getattr(obj, k) or [])
                        if isinstance(v, dict) and "$each" in v:
                            current.extend(v["$each"])
                        else:
                            current.append(v)
                        setattr(obj, k, current)

                obj.updated_at = datetime.now(timezone.utc)
            await session.refresh(obj)
            return _session_to_dict(obj)

    async def list_sessions(self, filter_dict: Dict[str, Any], limit: int = 50) -> List[Dict[str, Any]]:
        async with self.session_factory() as session:
            stmt = select(InterviewSessionModel)
            conditions = []
            for k, v in filter_dict.items():
                if k == "user_id":
                    conditions.append(InterviewSessionModel.user_id == str(v))
                elif k == "employer_id":
                    conditions.append(InterviewSessionModel.employer_id == str(v))
                elif k == "job_id":
                    conditions.append(InterviewSessionModel.job_id == str(v))
                elif k == "application_id":
                    conditions.append(InterviewSessionModel.application_id == str(v))
                elif k == "status":
                    conditions.append(InterviewSessionModel.status == str(v))

            if conditions:
                stmt = stmt.where(and_(*conditions))

            stmt = stmt.order_by(desc(InterviewSessionModel.created_at)).limit(limit)
            res = await session.execute(stmt)
            return [_session_to_dict(m) for m in res.scalars().all()]
