"""
Copilot Repository — PostgreSQL via SQLAlchemy 2.0
Persistence for Copilot v2.
==============================================================
Provides strictly scoped tenant_id + user_id database operations for:
- copilot_sessions
- copilot_messages
- copilot_memory (with 40-item LRU capacity enforcement)
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import structlog
from sqlalchemy import select, update, delete, desc, asc
from sqlalchemy.orm import selectinload

from config.db import get_pg_session_factory
from models import (
    CopilotSession,
    CopilotMessage,
    CopilotMemory,
    gen_uuid_str,
)
from schemas.copilot_schema import (
    CopilotSessionModel,
    CopilotMessageModel,
    CopilotMemoryModel,
)
from repositories.base_repo import BaseRepository

logger = structlog.get_logger(__name__)

MAX_USER_MEMORY_ITEMS = 40


def _session_to_model(row: CopilotSession) -> CopilotSessionModel:
    return CopilotSessionModel(
        _id=row.id,
        id=row.id,
        tenant_id=row.tenant_id or "default",
        user_id=row.user_id,
        title=row.title or "New Conversation",
        last_message_preview=row.last_message_preview,
        message_count=row.message_count or 0,
        pinned=bool(row.pinned),
        archived=bool(row.archived),
        total_tokens=row.total_tokens or 0,
        total_cost_usd=float(row.total_cost_usd or 0.0),
        deleted_at=row.deleted_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _msg_to_model(row: CopilotMessage) -> CopilotMessageModel:
    return CopilotMessageModel(
        _id=row.id,
        id=row.id,
        session_id=row.session_id,
        tenant_id=row.tenant_id or "default",
        user_id=row.user_id,
        role=row.role,
        content=row.content or "",
        ui_cards=row.ui_cards or [],
        citations=row.citations or [],
        tool_calls=row.tool_calls or [],
        model_used=row.model_used,
        provider_used=row.provider_used,
        latency_ms=row.latency_ms,
        prompt_tokens=row.prompt_tokens or 0,
        completion_tokens=row.completion_tokens or 0,
        feedback=row.feedback,
        feedback_note=row.feedback_note,
        created_at=row.created_at,
    )


def _mem_to_model(row: CopilotMemory) -> CopilotMemoryModel:
    return CopilotMemoryModel(
        _id=row.id,
        id=row.id,
        tenant_id=row.tenant_id or "default",
        user_id=row.user_id,
        key=row.key,
        value=row.value,
        source_message_id=row.source_message_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class _AsyncSessionContext:
    def __init__(self, session):
        self.session = session

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


class CopilotRepository(BaseRepository):
    """
    Repository for all Copilot v2 persistence and memory operations.
    Pure PostgreSQL engine via SQLAlchemy 2.0.
    """

    def __init__(self, db: Optional[Any] = None, session_factory: Optional[Any] = None):
        self.db = db
        if session_factory:
            self.session_factory = session_factory
        elif callable(db):
            self.session_factory = db
        elif hasattr(db, "execute") and hasattr(db, "commit"):
            self.session_factory = lambda: _AsyncSessionContext(db)
        else:
            self.session_factory = get_pg_session_factory()

    async def create_session(
        self,
        tenant_id: str,
        user_id: str,
        title: Optional[str] = None,
    ) -> CopilotSessionModel:
        now = datetime.now(timezone.utc)
        tenant_id = tenant_id or "default"
        s_id = gen_uuid_str()

        async with self.session_factory() as session:
            row = CopilotSession(
                id=s_id,
                tenant_id=tenant_id,
                user_id=str(user_id),
                title=title or "New Conversation",
                last_message_preview=None,
                message_count=0,
                pinned=False,
                archived=False,
                total_tokens=0,
                total_cost_usd=0.0,
                deleted_at=None,
                created_at=now,
                updated_at=now,
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return _session_to_model(row)

    async def get_or_create_session(
        self,
        tenant_id: str,
        user_id: str,
        session_id: Optional[str] = None,
        initial_title: Optional[str] = None,
    ) -> CopilotSessionModel:
        tenant_id = tenant_id or "default"
        if session_id:
            sess = await self.get_session(tenant_id, user_id, session_id)
            if sess:
                return sess
        return await self.create_session(tenant_id, user_id, title=initial_title)

    async def get_session(
        self,
        tenant_id: str,
        user_id: str,
        session_id: str,
        *,
        include_messages: bool = False,
    ) -> Optional[CopilotSessionModel]:
        if not session_id:
            return None
        tenant_id = tenant_id or "default"

        async with self.session_factory() as session:
            stmt = select(CopilotSession).where(
                CopilotSession.id == str(session_id),
                CopilotSession.tenant_id == tenant_id,
                CopilotSession.user_id == str(user_id),
                CopilotSession.deleted_at.is_(None),
            )
            if include_messages:
                stmt = stmt.options(selectinload(CopilotSession.messages))
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if row:
                return _session_to_model(row)
            return None

    async def list_sessions(
        self,
        tenant_id: str,
        user_id: str,
        cursor: Optional[str] = None,
        limit: int = 20,
        include_archived: bool = False,
    ) -> Dict[str, Any]:
        tenant_id = tenant_id or "default"

        async with self.session_factory() as session:
            filters = [
                CopilotSession.tenant_id == tenant_id,
                CopilotSession.user_id == str(user_id),
                CopilotSession.deleted_at.is_(None),
            ]
            if not include_archived:
                filters.append(CopilotSession.archived.is_(False))

            stmt = (
                select(CopilotSession)
                .where(*filters)
                .order_by(desc(CopilotSession.pinned), desc(CopilotSession.updated_at))
                .limit(limit + 1)
            )
            res = await session.execute(stmt)
            rows = res.scalars().all()
            has_more = len(rows) > limit
            sessions = rows[:limit]
            items = [_session_to_model(r) for r in sessions]
            next_cursor = str(items[-1].id) if (has_more and items) else None
            return {
                "sessions": items,
                "has_more": has_more,
                "next_cursor": next_cursor,
            }

    async def update_session(
        self,
        tenant_id: str,
        user_id: str,
        session_id: str,
        title: Optional[str] = None,
        pinned: Optional[bool] = None,
        archived: Optional[bool] = None,
    ) -> Optional[CopilotSessionModel]:
        now = datetime.now(timezone.utc)
        tenant_id = tenant_id or "default"

        vals: Dict[str, Any] = {"updated_at": now}
        if title is not None:
            vals["title"] = title.strip()
        if pinned is not None:
            vals["pinned"] = pinned
        if archived is not None:
            vals["archived"] = archived

        async with self.session_factory() as session:
            stmt = (
                update(CopilotSession)
                .where(
                    CopilotSession.id == str(session_id),
                    CopilotSession.tenant_id == tenant_id,
                    CopilotSession.user_id == str(user_id),
                    CopilotSession.deleted_at.is_(None),
                )
                .values(**vals)
                .returning(CopilotSession)
            )
            res = await session.execute(stmt)
            await session.commit()
            row = res.scalar_one_or_none()
            if row:
                return _session_to_model(row)
            return None

    async def soft_delete_session(
        self,
        tenant_id: str,
        user_id: str,
        session_id: str,
    ) -> bool:
        now = datetime.now(timezone.utc)
        tenant_id = tenant_id or "default"

        async with self.session_factory() as session:
            stmt = (
                update(CopilotSession)
                .where(
                    CopilotSession.id == str(session_id),
                    CopilotSession.tenant_id == tenant_id,
                    CopilotSession.user_id == str(user_id),
                    CopilotSession.deleted_at.is_(None),
                )
                .values(deleted_at=now)
            )
            res = await session.execute(stmt)
            await session.commit()
            return bool(getattr(res, "rowcount", 0) > 0)

    async def append_message(
        self,
        tenant_id: str,
        user_id: str,
        session_id: str,
        role: str,
        content: str,
        ui_cards: Optional[List[Dict[str, Any]]] = None,
        citations: Optional[List[Dict[str, Any]]] = None,
        tool_calls: Optional[List[Dict[str, Any]]] = None,
        model_used: Optional[str] = None,
        provider_used: Optional[str] = None,
        latency_ms: Optional[int] = None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
    ) -> CopilotMessageModel:
        now = datetime.now(timezone.utc)
        tenant_id = tenant_id or "default"
        snippet = (content[:120] + "...") if len(content) > 120 else content
        total_tokens = prompt_tokens + completion_tokens
        cost_usd = round((total_tokens / 1_000_000) * 0.50, 6)

        m_id = gen_uuid_str()

        async with self.session_factory() as session:
            msg_row = CopilotMessage(
                id=m_id,
                session_id=str(session_id),
                tenant_id=tenant_id,
                user_id=str(user_id),
                role=role,
                content=content,
                ui_cards=ui_cards or [],
                citations=citations or [],
                tool_calls=tool_calls or [],
                model_used=model_used,
                provider_used=provider_used,
                latency_ms=latency_ms,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                feedback=None,
                feedback_note=None,
                created_at=now,
            )
            session.add(msg_row)

            # Update session stats
            sess_stmt = (
                update(CopilotSession)
                .where(
                    CopilotSession.id == str(session_id),
                    CopilotSession.tenant_id == tenant_id,
                    CopilotSession.user_id == str(user_id),
                )
                .values(
                    message_count=CopilotSession.message_count + 1,
                    total_tokens=CopilotSession.total_tokens + total_tokens,
                    total_cost_usd=CopilotSession.total_cost_usd + cost_usd,
                    last_message_preview=snippet,
                    updated_at=now,
                )
            )
            await session.execute(sess_stmt)
            await session.commit()
            await session.refresh(msg_row)
            return _msg_to_model(msg_row)

    async def list_messages(
        self,
        tenant_id: str,
        user_id: str,
        session_id: str,
        limit: int = 100,
        before_id: Optional[str] = None,
    ) -> List[CopilotMessageModel]:
        tenant_id = tenant_id or "default"

        async with self.session_factory() as session:
            filters = [
                CopilotMessage.session_id == str(session_id),
                CopilotMessage.tenant_id == tenant_id,
                CopilotMessage.user_id == str(user_id),
            ]
            stmt = select(CopilotMessage).where(*filters).order_by(asc(CopilotMessage.created_at)).limit(limit)
            res = await session.execute(stmt)
            rows = res.scalars().all()
            return [_msg_to_model(r) for r in rows]

    async def get_last_user_message(
        self,
        tenant_id: str,
        user_id: str,
        session_id: str,
    ) -> Optional[CopilotMessageModel]:
        tenant_id = tenant_id or "default"

        async with self.session_factory() as session:
            stmt = (
                select(CopilotMessage)
                .where(
                    CopilotMessage.session_id == str(session_id),
                    CopilotMessage.tenant_id == tenant_id,
                    CopilotMessage.user_id == str(user_id),
                    CopilotMessage.role == "user",
                )
                .order_by(desc(CopilotMessage.created_at))
                .limit(1)
            )
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if row:
                return _msg_to_model(row)
            return None

    async def update_message_feedback(
        self,
        tenant_id: str,
        user_id: str,
        message_id: str,
        feedback: str,
        feedback_note: Optional[str] = None,
        note: Optional[str] = None,
    ) -> Optional[CopilotMessageModel]:
        feedback_note = note or feedback_note
        tenant_id = tenant_id or "default"

        async with self.session_factory() as session:
            stmt = (
                update(CopilotMessage)
                .where(
                    CopilotMessage.id == str(message_id),
                    CopilotMessage.tenant_id == tenant_id,
                    CopilotMessage.user_id == str(user_id),
                )
                .values(feedback=feedback, feedback_note=feedback_note)
                .returning(CopilotMessage)
            )
            res = await session.execute(stmt)
            await session.commit()
            row = res.scalar_one_or_none()
            return True if row else False

    async def get_user_memory(
        self,
        tenant_id: str,
        user_id: str,
    ) -> List[CopilotMemoryModel]:
        tenant_id = tenant_id or "default"

        async with self.session_factory() as session:
            stmt = (
                select(CopilotMemory)
                .where(
                    CopilotMemory.tenant_id == tenant_id,
                    CopilotMemory.user_id == str(user_id),
                )
                .order_by(desc(CopilotMemory.updated_at))
                .limit(MAX_USER_MEMORY_ITEMS)
            )
            res = await session.execute(stmt)
            rows = res.scalars().all()
            return [_mem_to_model(r) for r in rows]

    async def upsert_user_memory(
        self,
        tenant_id: str,
        user_id: str,
        key: str,
        value: str,
        source_message_id: Optional[str] = None,
    ) -> CopilotMemoryModel:
        now = datetime.now(timezone.utc)
        normalized_key = key.strip().lower()
        tenant_id = tenant_id or "default"

        async with self.session_factory() as session:
            stmt = select(CopilotMemory).where(
                CopilotMemory.tenant_id == tenant_id,
                CopilotMemory.user_id == str(user_id),
                CopilotMemory.key == normalized_key,
            )
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()

            if row:
                row.value = value.strip()
                row.source_message_id = source_message_id
                row.updated_at = now
            else:
                row = CopilotMemory(
                    id=gen_uuid_str(),
                    tenant_id=tenant_id,
                    user_id=str(user_id),
                    key=normalized_key,
                    value=value.strip(),
                    source_message_id=source_message_id,
                    created_at=now,
                    updated_at=now,
                )
                session.add(row)

            await session.commit()
            await session.refresh(row)
            return _mem_to_model(row)

    async def delete_user_memory(
        self,
        tenant_id: str,
        user_id: str,
        key: str,
    ) -> bool:
        normalized_key = key.strip().lower()
        tenant_id = tenant_id or "default"

        async with self.session_factory() as session:
            stmt = delete(CopilotMemory).where(
                CopilotMemory.tenant_id == tenant_id,
                CopilotMemory.user_id == str(user_id),
                CopilotMemory.key == normalized_key,
            )
            res = await session.execute(stmt)
            await session.commit()
            return bool(getattr(res, "rowcount", 0) > 0)

    async def migrate_local_history(
        self,
        tenant_id: str,
        user_id: str,
        legacy_messages: List[Dict[str, Any]],
    ) -> str:
        tenant_id = tenant_id or "default"
        session = await self.create_session(
            tenant_id=tenant_id,
            user_id=user_id,
            title="Migrated Local Chat",
        )
        for msg in legacy_messages:
            role = "assistant" if msg.get("role") in ("bot", "assistant") else "user"
            content = msg.get("text") or msg.get("content") or ""
            await self.append_message(
                tenant_id=tenant_id,
                user_id=user_id,
                session_id=str(session.id),
                role=role,
                content=content,
            )
        return str(session.id)
