"""
Audit Log Repository — Dual Engine (PostgreSQL via SQLAlchemy 2.0 / PostgreSQL Primary)
Append-Only Storage for Audit Logs.
========================================================================
Strictly enforces immutable append-only constraints (mutations and deletions
raise explicit errors) and ensures tenant-scoped query capabilities.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
import structlog
from sqlalchemy import select, func, and_

from core.config import settings
from config.db import get_pg_session_factory
from models import AuditLog, gen_uuid_str
from schemas.audit_schema import AuditLogModel
from repositories.base_repo import BaseRepository

logger = structlog.get_logger(__name__)


class AuditLogRepository(BaseRepository):
    """
    Append-only repository for compliance audit logs.
    Pure PostgreSQL Engine: writes to PostgreSQL via SQLAlchemy 2.0.
    """

    def __init__(self, db: Optional[Any] = None, session_factory: Optional[Any] = None):
        self.db = db
        self.session_factory = session_factory or (db if callable(db) else get_pg_session_factory())
    async def log_event(self, event: AuditLogModel | Dict[str, Any]) -> AuditLogModel:
        """
        Appends an immutable audit event.
        """
        if isinstance(event, AuditLogModel):
            doc = event.model_dump(by_alias=False, exclude_none=False)
        else:
            doc = dict(event)

        if "timestamp" not in doc or doc["timestamp"] is None:
            doc["timestamp"] = datetime.now(timezone.utc)
        elif isinstance(doc["timestamp"], str):
            try:
                doc["timestamp"] = datetime.fromisoformat(doc["timestamp"])
            except Exception:
                doc["timestamp"] = datetime.now(timezone.utc)

        if "tenant_id" not in doc or not doc["tenant_id"]:
            doc["tenant_id"] = "default"

        if "_id" in doc and doc["_id"] is None:
            doc.pop("_id")
        if "id" in doc and doc["id"] is None:
            doc.pop("id")

        log_id = str(doc.get("id") or doc.get("_id") or gen_uuid_str())
        event_id = str(doc.get("event_id") or f"evt_{log_id[:16]}")
        actor_id = str(doc.get("actor_id") or "system")
        act = doc.get("action")
        action = act.value if hasattr(act, "value") else str(act or "unknown")
        target_id = str(doc.get("resource_id") or doc.get("target_id") or "")
        tenant_id = str(doc.get("tenant_id") or "default")
        ip_address = str(doc.get("ip_address") or "") if doc.get("ip_address") else None
        ts = doc["timestamp"]
        if not ts.tzinfo:
            ts = ts.replace(tzinfo=timezone.utc)

        payload_data = dict(doc.get("payload") or {})
        payload_data["actor_email"] = doc.get("actor_email")
        payload_data["actor_role"] = doc.get("actor_role")
        payload_data["resource_type"] = doc.get("resource_type")
        payload_data["resource_id"] = doc.get("resource_id")
        payload_data["user_agent"] = doc.get("user_agent")


        async with self.session_factory() as session:
            log_row = AuditLog(
                id=log_id,
                event_id=event_id,
                tenant_id=tenant_id,
                actor_id=actor_id,
                action=action,
                target_id=target_id,
                payload=payload_data,
                ip_address=ip_address,
                created_at=ts,
            )
            session.add(log_row)
            await session.commit()

        doc["_id"] = log_id
        doc["id"] = log_id
        doc["event_id"] = event_id
        return AuditLogModel(**doc)

    async def query_logs(
        self,
        tenant_id: str,
        actor_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        action: Optional[str] = None,
        resource_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[AuditLogModel], int]:
        """
        Queries audit logs with multi-tenant filtering, optional criteria, and pagination.
        """
        async with self.session_factory() as session:
            filters = []
            if tenant_id != "*":
                filters.append(AuditLog.tenant_id == tenant_id)
            if actor_id:
                filters.append(AuditLog.actor_id == actor_id)
            if action:
                filters.append(AuditLog.action == action)
            if resource_id:
                filters.append(AuditLog.target_id == resource_id)
            if start_time:
                filters.append(AuditLog.created_at >= start_time)
            if end_time:
                filters.append(AuditLog.created_at <= end_time)

            count_stmt = select(func.count()).select_from(AuditLog).where(*filters)
            count_res = await session.execute(count_stmt)
            total_count = count_res.scalar() or 0

            stmt = (
                select(AuditLog)
                .where(*filters)
                .order_by(AuditLog.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
            res = await session.execute(stmt)
            rows = res.scalars().all()

            results = []
            for row in rows:
                payload = row.payload or {}
                res_type = payload.get("resource_type") or "system"
                if resource_type and res_type != resource_type:
                    continue
                m = AuditLogModel(
                    id=row.id,
                    event_id=row.event_id or f"evt_{row.id[:16]}",
                    tenant_id=row.tenant_id or "default",
                    actor_id=row.actor_id or "system",
                    actor_email=payload.get("actor_email"),
                    actor_role=payload.get("actor_role") or "system",
                    action=row.action,
                    resource_type=res_type,
                    resource_id=row.target_id or payload.get("resource_id") or "",
                    payload=payload,
                    ip_address=row.ip_address,
                    user_agent=payload.get("user_agent"),
                    timestamp=row.created_at or datetime.now(timezone.utc),
                )
                results.append(m)

            return results, total_count

    async def update(self, *args, **kwargs):
        """Forbidden: Audit logs are immutable."""
        raise RuntimeError("Audit log entries are immutable and cannot be modified.")

    async def update_one(self, *args, **kwargs):
        """Forbidden: Audit logs are immutable."""
        raise RuntimeError("Audit log entries are immutable and cannot be modified.")

    async def delete(self, *args, **kwargs):
        """Forbidden: Audit logs are immutable."""
        raise RuntimeError("Audit log entries are immutable and cannot be deleted.")

    async def delete_one(self, *args, **kwargs):
        """Forbidden: Audit logs are immutable."""
        raise RuntimeError("Audit log entries are immutable and cannot be deleted.")

    async def delete_many(self, *args, **kwargs):
        """Forbidden: Audit logs are immutable."""
        raise RuntimeError("Audit log entries are immutable and cannot be deleted.")
