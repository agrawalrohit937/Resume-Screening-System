"""
Audit Service — Centralized Event Dispatcher for Immutable Audit Logs.
======================================================================
Provides helper methods for recording audit events across all platform workflows.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional
import structlog
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.audit_log_model import AuditLogModel, AuditAction, AuditResourceType
from repositories.audit_log_repo import AuditLogRepository

logger = structlog.get_logger(__name__)


class AuditService:
    """
    Central dispatcher for recording tamper-evident audit records.
    """

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None):
        self.db = db
        self.repo = AuditLogRepository(db) if db is not None else None

    def _get_repo(self, db: Optional[AsyncIOMotorDatabase] = None) -> Optional[AuditLogRepository]:
        if db is not None:
            return AuditLogRepository(db)
        return self.repo

    async def record_event(
        self,
        action: AuditAction | str,
        resource_type: AuditResourceType | str,
        resource_id: str,
        tenant_id: str = "default",
        actor_id: str = "system",
        actor_email: Optional[str] = None,
        actor_role: str = "system",
        payload: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        db: Optional[AsyncIOMotorDatabase] = None,
    ) -> Optional[AuditLogModel]:
        """
        Records an audit event to the database. Non-blocking failure tolerance.
        """
        repo = self._get_repo(db)
        if repo is None:
            logger.debug("AuditService has no DB handle, skipping audit write", action=action)
            return None

        action_str = action.value if hasattr(action, "value") else str(action)
        resource_str = resource_type.value if hasattr(resource_type, "value") else str(resource_type)

        model = AuditLogModel(
            tenant_id=tenant_id or "default",
            actor_id=actor_id or "system",
            actor_email=actor_email,
            actor_role=actor_role or "system",
            action=action_str,
            resource_type=resource_str,
            resource_id=str(resource_id),
            payload=payload or {},
            ip_address=ip_address,
            user_agent=user_agent,
            timestamp=datetime.now(timezone.utc),
        )

        try:
            saved = await repo.log_event(model)
            logger.info(
                "Audit event recorded",
                action=action_str,
                resource_type=resource_str,
                resource_id=resource_id,
                tenant_id=tenant_id,
                actor_id=actor_id,
            )
            return saved
        except Exception as e:
            logger.error("Failed recording audit event", action=action_str, error=str(e))
            return None


audit_service = AuditService()
