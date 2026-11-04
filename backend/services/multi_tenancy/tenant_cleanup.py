"""
Tenant Data Cascade Cleanup & Lifecycle Engine (Pure PostgreSQL SQLAlchemy 2.0).
Purges or reclaims tenant entities when an organization is deleted.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import structlog
from sqlalchemy import select, update, delete, and_, or_

from config.db import get_pg_session_factory
from models.tables import (
    Company, Job, Resume, CandidateApplication, JobApplication,
    InterviewKit, Scorecard, TalentPoolProfile, WebhookSubscription,
    EeoResponse, User, TeamInvite, Requisition, AuditLog
)

logger = structlog.get_logger(__name__)


async def cascade_delete_tenant(
    db: Any = None,
    tenant_id: str = "default",
    deleted_by_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    if not tenant_id or tenant_id == "default":
        return {"status": "skipped", "reason": "default_tenant_protected"}

    now = datetime.now(timezone.utc)
    purged: Dict[str, int] = {}

    try:
        async with get_pg_session_factory()() as session:
            # 1. Delete tenant-scoped entities
            for Model, name in [
                (Company, "companies"),
                (Job, "jobs"),
                (TeamInvite, "team_invites"),
                (Requisition, "requisitions"),
                (InterviewKit, "interview_kits"),
                (Scorecard, "scorecards"),
                (WebhookSubscription, "webhook_subscriptions"),
                (EeoResponse, "eeo_responses"),
            ]:
                if hasattr(Model, "tenant_id"):
                    res = await session.execute(delete(Model).where(Model.tenant_id == str(tenant_id)))
                    purged[name] = res.rowcount

            # 2. Revert invited team members back to candidates
            u_stmt = (
                update(User)
                .where(User.tenant_id == str(tenant_id))
                .values(
                    tenant_id=None,
                    company_name=None,
                    is_invited_staff=False,
                    role="candidate",
                    roles=["candidate"],
                    updated_at=now,
                )
            )
            u_res = await session.execute(u_stmt)
            purged["users_reverted"] = u_res.rowcount

            # 3. Log audit event
            audit = AuditLog(
                event_id=f"audit_{tenant_id}",
                tenant_id=str(tenant_id),
                actor_id=str(deleted_by_user_id or "system"),
                action="tenant_cascade_deleted",
                target_id=str(tenant_id),
                payload={"purged": purged},
                created_at=now,
            )
            session.add(audit)
            await session.commit()

        logger.info("Tenant successfully cascaded and deleted", tenant_id=tenant_id, purged=purged)
        return {"status": "success", "tenant_id": tenant_id, "purged": purged}

    except Exception as exc:
        logger.exception("Failed to cascade delete tenant", tenant_id=tenant_id, error=str(exc))
        return {"status": "error", "error": str(exc)}


async def purge_orphaned_tenant_if_needed(
    db: Any = None,
    tenant_id: str = "default",
    excluding_user_id: Optional[str] = None,
) -> bool:
    if not tenant_id or tenant_id == "default":
        return False

    try:
        async with get_pg_session_factory()() as session:
            stmt = select(User.id).where(
                and_(User.tenant_id == str(tenant_id), User.status != "deleted")
            )
            if excluding_user_id:
                stmt = stmt.where(User.id != str(excluding_user_id))
            active_users = (await session.execute(stmt)).scalars().all()
            if not active_users:
                await cascade_delete_tenant(None, tenant_id=tenant_id, deleted_by_user_id=excluding_user_id)
                return True
    except Exception as e:
        logger.warning("Failed to check orphaned tenant", tenant_id=tenant_id, error=str(e))
    return False
