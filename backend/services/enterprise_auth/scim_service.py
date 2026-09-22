"""
SCIM 2.0 Provisioning Service (RFC 7643 & RFC 7644).

Phase 5, Task 5.2:
Handles automated CRUD provisioning of enterprise members from IdP identity management
systems (Okta, Azure AD, OneLogin, PingFederate).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
import structlog

from models.enterprise_auth import SCIMEmail, SCIMName, SCIMUserPayload, SCIMUserResponse
from models.user_model import UserRole, UserStatus
from services.multi_tenancy import tenant_context

logger = structlog.get_logger(__name__)


class SCIMService:
    """
    Implements RFC 7644 compliant SCIM operations partitioned by tenant_id.
    """

    def _to_scim_response(self, doc: Dict[str, Any]) -> SCIMUserResponse:
        email = doc.get("email", "")
        uid = str(doc.get("_id") or doc.get("id"))
        return SCIMUserResponse(
            id=uid,
            userName=doc.get("email", ""),
            name=SCIMName(
                formatted=doc.get("full_name"),
                familyName=doc.get("full_name", "").split(" ")[-1] if " " in doc.get("full_name", "") else "",
                givenName=doc.get("full_name", "").split(" ")[0] if doc.get("full_name") else "",
            ),
            emails=[SCIMEmail(value=email, type="work", primary=True)],
            active=bool(doc.get("status") == UserStatus.ACTIVE.value),
            roles=[doc.get("role", "recruiter")],
            meta={
                "resourceType": "User",
                "created": doc.get("created_at", datetime.now(timezone.utc)).isoformat() if hasattr(doc.get("created_at"), "isoformat") else str(doc.get("created_at")),
                "location": f"/api/v1/scim/v2/Users/{uid}",
            }
        )

    async def create_user(self, payload: SCIMUserPayload, tenant_id: str, db: Any) -> SCIMUserResponse:
        email = payload.userName
        if payload.emails and payload.emails[0].value:
            email = payload.emails[0].value

        name = payload.displayName or (payload.name.formatted if payload.name else None) or email.split("@")[0]
        role_str = payload.roles[0] if payload.roles else "recruiter"
        try:
            role_enum = UserRole(role_str.lower())
        except Exception:
            role_enum = UserRole.RECRUITER

        doc = {
            "_id": ObjectId(),
            "email": email,
            "full_name": name,
            "role": role_enum.value,
            "status": UserStatus.ACTIVE.value if payload.active else UserStatus.INACTIVE.value,
            "tenant_id": tenant_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        if db is not None:
            await db.users.insert_one(doc)

        logger.info("SCIM user provisioned", user_id=str(doc["_id"]), email=email, tenant_id=tenant_id)
        return self._to_scim_response(doc)

    async def get_user(self, user_id: str, tenant_id: str, db: Any) -> Optional[SCIMUserResponse]:
        if db is None:
            return None
        try:
            doc = await db.users.find_one({"_id": ObjectId(user_id), "tenant_id": tenant_id})
        except Exception:
            return None
        if not doc:
            return None
        return self._to_scim_response(doc)

    async def update_user(self, user_id: str, payload: SCIMUserPayload, tenant_id: str, db: Any) -> Optional[SCIMUserResponse]:
        if db is None:
            return None

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
            await db.users.update_one(
                {"_id": ObjectId(user_id), "tenant_id": tenant_id},
                {"$set": update_fields}
            )
            doc = await db.users.find_one({"_id": ObjectId(user_id), "tenant_id": tenant_id})
            return self._to_scim_response(doc) if doc else None
        except Exception as e:
            logger.error("Failed SCIM user update", user_id=user_id, error=str(e))
            return None

    async def deprovision_user(self, user_id: str, tenant_id: str, db: Any) -> bool:
        if db is None:
            return True
        try:
            res = await db.users.update_one(
                {"_id": ObjectId(user_id), "tenant_id": tenant_id},
                {"$set": {"status": UserStatus.INACTIVE.value, "updated_at": datetime.now(timezone.utc)}}
            )
            return bool(getattr(res, "modified_count", 0) > 0 or getattr(res, "matched_count", 0) > 0)
        except Exception as e:
            logger.error("Failed SCIM user deprovisioning", user_id=user_id, error=str(e))
            return False

    async def list_users(self, tenant_id: str, db: Any, start_index: int = 1, count: int = 50) -> Dict[str, Any]:
        if db is None:
            return {"schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"], "totalResults": 0, "Resources": []}

        skip_count = max(0, start_index - 1)
        cursor = db.users.find({"tenant_id": tenant_id}).skip(skip_count).limit(count)
        from utils.pagination import stream_cursor
        docs = await stream_cursor(cursor)

        resources = [self._to_scim_response(d).model_dump() for d in docs]
        return {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": len(resources),
            "startIndex": start_index,
            "itemsPerPage": count,
            "Resources": resources,
        }


scim_service = SCIMService()
