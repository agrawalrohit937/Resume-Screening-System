"""
Support Ticket Repository — Dual Engine (PostgreSQL via SQLAlchemy 2.0 / PostgreSQL Primary)
CRUD and conversation management for support tickets.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
import re
import structlog
from sqlalchemy import select, update, func, or_

from core.config import settings
from config.db import get_pg_session_factory
from models import SupportTicket, gen_uuid_str
from schemas.support_schema import SupportTicketModel
from repositories.base_repo import BaseRepository

logger = structlog.get_logger(__name__)


def _ticket_row_to_model(row: SupportTicket) -> SupportTicketModel:
    thread = row.thread or []
    messages = [m for m in thread if m.get("type") == "message" or "role" in m]
    history = [h for h in thread if h.get("type") == "status_change" or "changed_by" in h]
    meta = row.metadata_info or {}

    return SupportTicketModel(
        _id=row.id,
        id=row.id,
        ticket_id=row.ticket_id,
        user_id=row.user_id or "",
        email=row.email,
        subject=row.subject,
        description=row.description,
        category=row.category or "general",
        status=row.status or "open",
        priority=row.priority or "low",
        messages=messages or meta.get("messages", []),
        status_history=history or meta.get("status_history", []),
        attachments=meta.get("attachments", []),
        subcategory=meta.get("subcategory"),
        browser=meta.get("browser"),
        os=meta.get("os"),
        route=meta.get("route"),
        current_url=meta.get("current_url"),
        app_version=meta.get("app_version"),
        login_provider=meta.get("login_provider"),
        plan=meta.get("plan"),
        subscription_active=meta.get("subscription_active"),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class SupportTicketRepository(BaseRepository):
    def __init__(self, db: Optional[Any] = None, session_factory: Optional[Any] = None):
        self.session_factory = session_factory or get_pg_session_factory()
    def _normalize_value(self, value: Any) -> Any:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, list):
            return [self._normalize_value(item) for item in value]
        if isinstance(value, dict):
            return {key: self._normalize_value(item) for key, item in value.items()}
        return value

    def _serialize(self, doc: dict) -> dict:
        doc = super()._serialize(doc)
        return self._normalize_value(doc) if doc else doc

    async def create(self, ticket_data: dict) -> SupportTicketModel:
        now = datetime.now(timezone.utc)
        data = dict(ticket_data)
        data["created_at"] = now
        data["updated_at"] = now

        t_id = str(data.get("_id") or data.get("id") or gen_uuid_str())
        ticket_id_val = str(data.get("ticket_id") or t_id)
        messages = data.get("messages") or []
        status_history = data.get("status_history") or []
        thread = []
        for m in messages:
            thread.append(dict(m) if isinstance(m, dict) else m.model_dump())
        for h in status_history:
            thread.append(dict(h) if isinstance(h, dict) else h.model_dump())

        meta = {
            "attachments": data.get("attachments") or [],
            "subcategory": data.get("subcategory"),
            "browser": data.get("browser"),
            "os": data.get("os"),
            "route": data.get("route"),
            "current_url": data.get("current_url"),
            "app_version": data.get("app_version"),
            "login_provider": data.get("login_provider"),
            "plan": data.get("plan"),
            "subscription_active": data.get("subscription_active"),
        }

        async with self.session_factory() as session:
            row = SupportTicket(
                id=t_id,
                ticket_id=ticket_id_val,
                user_id=str(data.get("user_id", "")) if data.get("user_id") else None,
                email=str(data.get("email", "")),
                subject=str(data.get("subject", "")),
                description=str(data.get("description", "")),
                category=str(data.get("category", "general")),
                status=str(data.get("status", "open")),
                priority=str(data.get("priority", "low")),
                thread=thread,
                metadata_info=meta,
                created_at=now,
                updated_at=now,
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return _ticket_row_to_model(row)

    async def get_by_id(self, ticket_id: str) -> Optional[SupportTicketModel]:
        if not ticket_id:
            return None

        async with self.session_factory() as session:
            stmt = select(SupportTicket).where(
                or_(SupportTicket.id == str(ticket_id), SupportTicket.ticket_id == str(ticket_id))
            )
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if row:
                return _ticket_row_to_model(row)
            return None

    async def get_by_ticket_id(self, ticket_id: str) -> Optional[SupportTicketModel]:
        if not ticket_id:
            return None

        async with self.session_factory() as session:
            stmt = select(SupportTicket).where(SupportTicket.ticket_id == str(ticket_id))
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if row:
                return _ticket_row_to_model(row)
            return None

    async def get_user_tickets(
        self,
        user_id: str,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[SupportTicketModel], int]:
        if not user_id:
            return [], 0

        async with self.session_factory() as session:
            filters = [SupportTicket.user_id == str(user_id)]
            if status:
                filters.append(SupportTicket.status == status)

            cnt_stmt = select(func.count()).select_from(SupportTicket).where(*filters)
            cnt_res = await session.execute(cnt_stmt)
            total = cnt_res.scalar() or 0

            stmt = (
                select(SupportTicket)
                .where(*filters)
                .order_by(SupportTicket.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
            res = await session.execute(stmt)
            tickets = [_ticket_row_to_model(r) for r in res.scalars().all()]
            return tickets, total

    async def get_all_tickets(
        self,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[SupportTicketModel], int]:
        async with self.session_factory() as session:
            filters = []
            if status:
                filters.append(SupportTicket.status == status)
            if priority:
                filters.append(SupportTicket.priority == priority)
            if category:
                filters.append(SupportTicket.category == category)
            if search and search.strip():
                term = f"%{search.strip().lower()}%"
                filters.append(
                    or_(
                        func.lower(SupportTicket.subject).like(term),
                        func.lower(SupportTicket.email).like(term),
                        func.lower(SupportTicket.ticket_id).like(term),
                        func.lower(SupportTicket.description).like(term),
                    )
                )

            cnt_stmt = select(func.count()).select_from(SupportTicket).where(*filters)
            cnt_res = await session.execute(cnt_stmt)
            total = cnt_res.scalar() or 0

            stmt = (
                select(SupportTicket)
                .where(*filters)
                .order_by(SupportTicket.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
            res = await session.execute(stmt)
            tickets = [_ticket_row_to_model(r) for r in res.scalars().all()]
            return tickets, total

    async def update_ticket(
        self, ticket_id: str, update_data: dict
    ) -> Optional[SupportTicketModel]:
        now = datetime.now(timezone.utc)
        clean_update = dict(update_data)
        clean_update["updated_at"] = now

        async with self.session_factory() as session:
            stmt = (
                update(SupportTicket)
                .where(or_(SupportTicket.id == str(ticket_id), SupportTicket.ticket_id == str(ticket_id)))
                .values(
                    status=clean_update.get("status", SupportTicket.status),
                    priority=clean_update.get("priority", SupportTicket.priority),
                    category=clean_update.get("category", SupportTicket.category),
                    updated_at=now,
                )
                .returning(SupportTicket)
            )
            res = await session.execute(stmt)
            await session.commit()
            row = res.scalar_one_or_none()
            if row:
                return _ticket_row_to_model(row)
            return None

    async def add_message(
        self, ticket_id: str, message: dict
    ) -> Optional[SupportTicketModel]:
        now = datetime.now(timezone.utc)
        msg_dict = dict(message)
        msg_dict.setdefault("created_at", now.isoformat())

        async with self.session_factory() as session:
            stmt = select(SupportTicket).where(
                or_(SupportTicket.id == str(ticket_id), SupportTicket.ticket_id == str(ticket_id))
            )
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if not row:
                return None

            thread = list(row.thread or [])
            thread.append(msg_dict)
            row.thread = thread
            row.updated_at = now
            await session.commit()
            await session.refresh(row)
            return _ticket_row_to_model(row)

    async def add_attachment(
        self, ticket_id: str, attachment: dict
    ) -> Optional[SupportTicketModel]:
        now = datetime.now(timezone.utc)
        att_dict = dict(attachment)

        async with self.session_factory() as session:
            stmt = select(SupportTicket).where(
                or_(SupportTicket.id == str(ticket_id), SupportTicket.ticket_id == str(ticket_id))
            )
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if not row:
                return None

            meta = dict(row.metadata_info or {})
            atts = list(meta.get("attachments") or [])
            atts.append(att_dict)
            meta["attachments"] = atts
            row.metadata_info = meta
            row.updated_at = now
            await session.commit()
            await session.refresh(row)
            return _ticket_row_to_model(row)

    async def update_status(
        self,
        ticket_id: str,
        status: str,
        changed_by: Optional[str] = None,
        changed_by_role: Optional[str] = None,
        changed_by_name: Optional[str] = None,
    ) -> Optional[SupportTicketModel]:
        now = datetime.now(timezone.utc)
        hist_entry = {
            "status": status,
            "changed_by": changed_by,
            "changed_by_role": changed_by_role,
            "changed_by_name": changed_by_name,
            "created_at": now.isoformat(),
        }

        async with self.session_factory() as session:
            stmt = select(SupportTicket).where(
                or_(SupportTicket.id == str(ticket_id), SupportTicket.ticket_id == str(ticket_id))
            )
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if not row:
                return None

            thread = list(row.thread or [])
            thread.append(hist_entry)
            row.thread = thread
            row.status = status
            row.updated_at = now
            await session.commit()
            await session.refresh(row)
            return _ticket_row_to_model(row)

    async def count_by_user(self, user_id: str) -> int:
        if not user_id:
            return 0
        async with self.session_factory() as session:
            stmt = select(func.count()).select_from(SupportTicket).where(SupportTicket.user_id == str(user_id))
            res = await session.execute(stmt)
            return res.scalar() or 0
    async def count_open_by_user(self, user_id: str) -> int:
        if not user_id:
            return 0
        async with self.session_factory() as session:
            stmt = select(func.count()).select_from(SupportTicket).where(
                SupportTicket.user_id == str(user_id),
                SupportTicket.status.notin_(["resolved", "closed"])
            )
            res = await session.execute(stmt)
            return res.scalar() or 0
    async def get_ticket_stats(self) -> dict:
        async with self.session_factory() as session:
            stmt = select(SupportTicket.status, func.count()).group_by(SupportTicket.status)
            res = await session.execute(stmt)
            stats = {"open": 0, "in_progress": 0, "waiting_for_customer": 0, "resolved": 0, "closed": 0}
            total = 0
            for st, count in res.fetchall():
                if st in stats:
                    stats[st] = count
                total += count
            return {"by_status": stats, "total": total}
