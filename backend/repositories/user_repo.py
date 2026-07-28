"""
User Repository — Async MongoDB CRUD operations for users
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import structlog
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.user_model import UserModel, UserRole, UserStatus

logger = structlog.get_logger(__name__)


class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.users

    def _serialize(self, doc: dict) -> dict:
        if doc and "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return doc

    async def create(self, user_data: dict) -> UserModel:
        result = await self.collection.insert_one(user_data)
        user_data["_id"] = str(result.inserted_id)
        return UserModel(**user_data)

    async def get_by_id(self, user_id: str) -> Optional[UserModel]:
        try:
            doc = await self.collection.find_one({"_id": ObjectId(user_id)})
        except Exception:
            return None
        if not doc:
            return None
        return UserModel(**self._serialize(doc))

    async def get_by_email(self, email: str) -> Optional[UserModel]:
        doc = await self.collection.find_one({"email": email.lower()})
        if not doc:
            return None
        return UserModel(**self._serialize(doc))

    async def update(self, user_id: str, update_data: dict) -> Optional[UserModel]:
        update_data["updated_at"] = datetime.now(timezone.utc)
        result = await self.collection.find_one_and_update(
            {"_id": ObjectId(user_id)},
            {"$set": update_data},
            return_document=True,
        )
        if not result:
            return None
        return UserModel(**self._serialize(result))

    async def update_last_login(self, user_id: str) -> None:
        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"last_login": datetime.now(timezone.utc)}}
        )

    async def increment_counter(self, user_id: str, field: str, amount: int = 1) -> None:
        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$inc": {field: amount}}
        )

    async def delete(self, user_id: str) -> bool:
        result = await self.collection.delete_one({"_id": ObjectId(user_id)})
        return result.deleted_count > 0

    async def list_users(
        self,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[List[UserModel], int]:
        query = {}
        if role:
            query["role"] = role
        if status:
            query["status"] = status

        total = await self.collection.count_documents(query)
        cursor = self.collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        users = [UserModel(**self._serialize(d)) for d in docs]
        return users, total

    async def email_exists(self, email: str) -> bool:
        count = await self.collection.count_documents({"email": email.lower()})
        return count > 0

    async def get_platform_user_stats(self) -> dict:
        pipeline = [
            {"$group": {
                "_id": "$role",
                "count": {"$sum": 1},
                "active": {"$sum": {"$cond": [{"$eq": ["$status", "active"]}, 1, 0]}},
            }},
        ]
        cursor = self.collection.aggregate(pipeline)
        stats = {}
        async for doc in cursor:
            stats[doc["_id"]] = {"total": doc["count"], "active": doc["active"]}
        total = await self.collection.count_documents({})
        return {"by_role": stats, "total_users": total}

    # ── NEW: Trusted devices (secure login) ────────────────────────────────
    async def add_trusted_device(self, user_id: str, device_doc: dict) -> None:
        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$push": {"trusted_devices": device_doc}},
        )

    async def touch_trusted_device(self, user_id: str, device_hash: str) -> None:
        await self.collection.update_one(
            {"_id": ObjectId(user_id), "trusted_devices.device_hash": device_hash},
            {"$set": {"trusted_devices.$.last_used_at": datetime.now(timezone.utc)}},
        )

    async def is_device_trusted(self, user: UserModel, device_hash: str) -> bool:
        now = datetime.now(timezone.utc)
        for d in user.trusted_devices:
            if d.device_hash == device_hash:
                expires_at = d.expires_at
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at > now:
                    return True
        return False

    async def prune_expired_devices(self, user_id: str) -> None:
        """Remove expired trusted devices (called opportunistically, keeps the array small)."""
        now = datetime.now(timezone.utc)
        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$pull": {"trusted_devices": {"expires_at": {"$lt": now}}}},
        )

    # ── NEW: Multi-provider auth methods ───────────────────────────────────
    async def add_auth_method(self, user_id: str, method: str) -> None:
        """Add a provider method to auth_methods array. Uses $addToSet to prevent duplicates."""
        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$addToSet": {"auth_methods": method}},
        )

    async def update_last_login_method(self, user_id: str, method: str) -> None:
        """Set the last login provider method."""
        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"last_login_method": method}},
        )

    async def upsert_linked_account(
        self, user_id: str, provider: str, provider_data: Dict[str, Any]
    ) -> None:
        """Atomically set provider data in linked_accounts.<provider>.

        Uses $set on the nested field so any existing fields are preserved/overwritten
        at the top level of the provider object.
        """
        set_key = f"linked_accounts.{provider}"
        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {set_key: provider_data}},
        )

    async def link_oauth_provider(
        self, user_id: str, provider: str, provider_data: Dict[str, Any]
    ) -> None:
        """Complete linking operation: add auth method + upsert linked account + update last login method.

        This is the preferred atomic helper for OAuth callbacks.
        """
        now = datetime.now(timezone.utc)
        provider_data.setdefault("linked_at", now)
        provider_data.setdefault("last_login", now)

        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$addToSet": {"auth_methods": provider},
                "$set": {
                    f"linked_accounts.{provider}": provider_data,
                    "last_login_method": provider,
                    "last_login": now,
                    "updated_at": now,
                },
            },
        )

    async def find_by_email_and_update_linked(
        self, email: str, provider: str, provider_data: Dict[str, Any],
        user_data: Optional[Dict[str, Any]] = None
    ) -> Optional[UserModel]:
        """Find user by email and atomically link a new OAuth provider.

        If the user exists, links the provider, updates auth_methods, last_login_method.
        If user_data is provided, also updates those fields (e.g. profile_picture if missing).
        Returns the updated UserModel or None if not found.

        This prevents race conditions where two concurrent requests could create duplicate users.
        """
        now = datetime.now(timezone.utc)
        provider_data.setdefault("linked_at", now)
        provider_data.setdefault("last_login", now)

        set_fields = {
            f"linked_accounts.{provider}": provider_data,
            "last_login_method": provider,
            "last_login": now,
            "updated_at": now,
        }
        if user_data:
            # Only set fields that are not None (don't overwrite with None)
            for k, v in user_data.items():
                if v is not None:
                    set_fields[k] = v

        result = await self.collection.find_one_and_update(
            {"email": email.lower()},
            {
                "$addToSet": {"auth_methods": provider},
                "$set": set_fields,
            },
            return_document=True,
        )
        if not result:
            return None
        return UserModel(**self._serialize(result))

    # ── Gmail OAuth token persistence ──────────────────────────────────────────
    async def save_gmail_tokens(
        self,
        user_id: str,
        access_token: str,
        refresh_token: str,
        expiry: datetime,
    ) -> None:
        """Persist Google OAuth tokens for the gmail.send scope against this user.

        Called once after the first successful Authorization Code exchange.
        Subsequent calls update the access token after a silent refresh.
        """
        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "gmail_access_token": access_token,
                    "gmail_refresh_token": refresh_token,
                    "gmail_token_expiry": expiry,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

    async def update_gmail_access_token(
        self,
        user_id: str,
        access_token: str,
        expiry: datetime,
    ) -> None:
        """Update ONLY the access token + expiry after a silent token refresh.

        The refresh_token is permanent and never overwritten here — only the
        short-lived access_token and its expiry need updating.
        """
        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "gmail_access_token": access_token,
                    "gmail_token_expiry": expiry,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

    async def get_gmail_tokens(self, user_id: str) -> Optional[dict]:
        """Return a dict with gmail_access_token, gmail_refresh_token,
        gmail_token_expiry for the given user, or None if not yet connected."""
        try:
            doc = await self.collection.find_one(
                {"_id": ObjectId(user_id)},
                {"gmail_access_token": 1, "gmail_refresh_token": 1, "gmail_token_expiry": 1},
            )
        except Exception:
            return None
        if not doc or not doc.get("gmail_refresh_token"):
            return None
        return {
            "access_token": doc.get("gmail_access_token"),
            "refresh_token": doc.get("gmail_refresh_token"),
            "expiry": doc.get("gmail_token_expiry"),
        }

