"""
SCIM v2.0 Enterprise User Provisioning Service (Pure PostgreSQL SQLAlchemy 2.0).
CareerShala ATS v2.0.0 — Enterprise Identity & Access Management.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import structlog
from sqlalchemy import select, update, and_

from config.db import get_pg_session_factory
from models.tables import User
from models.enterprise_auth import SCIMUserPayload, SCIMUserResponse
from models.user_model import UserRole, UserStatus

logger = structlog.get_logger(__name__)


class SCIMService:
    def __init__(self, db: Any = None):
        self.db = db

    @staticmethod
    def _to_scim_response(doc: Dict[str, Any]) -> SCIMUserResponse:
        u_id = str(doc.get("id") or doc.get("_id", ""))
        from models.enterprise_auth import SCIMName
        fn = doc.get("full_name") or ""
        parts = fn.split()
        gn = parts[0] if parts else ""
        fam = parts[-1] if len(parts) > 1 else ""
        name_obj = SCIMName(formatted=fn, givenName=gn, familyName=fam)
        return SCIMUserResponse(
            id=u_id,
            userName=doc.get("email", ""),
            displayName=doc.get("full_name"),
            name=name_obj,
            active=doc.get("status") == UserStatus.ACTIVE.value,
            emails=[{"value": doc.get("email", ""), "primary": True}],
            roles=[doc.get("role", "candidate")],
            meta={
                "resourceType": "User",
                "created": doc.get("created_at", datetime.now(timezone.utc)).isoformat() if hasattr(doc.get("created_at"), "isoformat") else str(doc.get("created_at", "")),
                "lastModified": doc.get("updated_at", datetime.now(timezone.utc)).isoformat() if hasattr(doc.get("updated_at"), "isoformat") else str(doc.get("updated_at", "")),
                "location": f"/scim/v2/Users/{u_id}",
            },
        )

    async def provision_user(self, payload: SCIMUserPayload, tenant_id: str, db: Any = None) -> SCIMUserResponse:
        email = payload.userName.lower().strip()
        assigned_role = UserRole.RECRUITER.value
        if payload.roles:
            try:
                assigned_role = UserRole(payload.roles[0].lower()).value
            except Exception:
                assigned_role = UserRole.RECRUITER.value

        user_id = str(getattr(payload, "externalId", None) or getattr(payload, "external_id", None) or f"usr_{email}")
        now = datetime.now(timezone.utc)
        doc: Dict[str, Any] = {
            "id": user_id,
            "email": email,
            "full_name": payload.displayName or email.split("@")[0].capitalize(),
            "role": assigned_role,
            "roles": [assigned_role],
            "status": UserStatus.ACTIVE.value if payload.active else UserStatus.INACTIVE.value,
            "tenant_id": tenant_id,
            "is_invited_staff": True,
            "created_at": now,
            "updated_at": now,
        }

        try:
            async with get_pg_session_factory()() as session:
                stmt = select(User).where(and_(User.email == email, User.tenant_id == tenant_id))
                res = await session.execute(stmt)
                existing = res.scalar_one_or_none() if hasattr(res, "scalar_one_or_none") else None
                if existing and hasattr(existing, "id"):
                    existing.full_name = doc["full_name"]
                    existing.status = doc["status"]
                    existing.updated_at = now
                    user_id = existing.id
                else:
                    session.add(User(**doc))
                await session.commit()
        except Exception as e:
            logger.error("Failed SCIM user provisioning in DB", error=str(e))


        doc["id"] = user_id
        logger.info("SCIM user provisioned", user_id=user_id, email=email, tenant_id=tenant_id)
        return self._to_scim_response(doc)

    async def get_user(self, user_id: str, tenant_id: str, db: Any = None) -> Optional[SCIMUserResponse]:

        try:
            async with get_pg_session_factory()() as session:
                stmt = select(User).where(and_(User.id == str(user_id), User.tenant_id == tenant_id))
                u_row = (await session.execute(stmt)).scalar_one_or_none()
                if not u_row:
                    return None
                doc = {c.name: getattr(u_row, c.name) for c in User.__table__.columns}
                return self._to_scim_response(doc)
        except Exception as e:
            logger.error("Failed SCIM get_user", user_id=user_id, error=str(e))
            return None

    async def update_user(self, user_id: str, payload: SCIMUserPayload, tenant_id: str, db: Any = None) -> Optional[SCIMUserResponse]:
        update_fields: Dict[str, Any] = {
            "status": UserStatus.ACTIVE.value if payload.active else UserStatus.INACTIVE.value,
            "updated_at": datetime.now(timezone.utc),
        }
        if payload.displayName:
            update_fields["full_name"] = payload.displayName
        if payload.roles:
            try:
                update_fields["role"] = UserRole(payload.roles[0].lower()).value
            except Exception:
                pass

        try:
            async with get_pg_session_factory()() as session:
                stmt = select(User).where(and_(User.id == str(user_id), User.tenant_id == tenant_id))
                u_row = (await session.execute(stmt)).scalar_one_or_none()
                if not u_row:
                    return None
                for k, v in update_fields.items():
                    setattr(u_row, k, v)
                await session.commit()
                doc = {c.name: getattr(u_row, c.name) for c in User.__table__.columns}
                return self._to_scim_response(doc)
        except Exception as e:
            logger.error("Failed SCIM user update", user_id=user_id, error=str(e))
            return None

    async def deprovision_user(self, user_id: str, tenant_id: str, db: Any = None) -> bool:

        try:
            async with get_pg_session_factory()() as session:
                stmt = (
                    update(User)
                    .where(and_(User.id == str(user_id), User.tenant_id == tenant_id))
                    .values(status=UserStatus.INACTIVE.value, updated_at=datetime.now(timezone.utc))
                )
                res = await session.execute(stmt)
                await session.commit()
                rc = getattr(res, "rowcount", None)
                if isinstance(rc, int):
                    return rc > 0
                return True
        except Exception as e:
            logger.error("Failed SCIM user deprovisioning", user_id=user_id, error=str(e))
            return False

    async def list_users(self, tenant_id: str, db: Any = None, start_index: int = 1, count: int = 50) -> Dict[str, Any]:
        skip_count = max(0, start_index - 1)
        try:
            async with get_pg_session_factory()() as session:
                stmt = select(User).where(User.tenant_id == tenant_id).offset(skip_count).limit(count)
                rows = (await session.execute(stmt)).scalars().all()
                docs = [{c.name: getattr(r, c.name) for c in User.__table__.columns} for r in rows]
                resources = [self._to_scim_response(d) for d in docs]
                return {
                    "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
                    "totalResults": len(resources),
                    "startIndex": start_index,
                    "itemsPerPage": count,
                    "Resources": [r.dict(by_alias=True) for r in resources],
                }
        except Exception:
            return {"schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"], "totalResults": 0, "Resources": []}


scim_service = SCIMService()

SCIMService.create_user = SCIMService.provision_user
