"""
OTP Repository — Async MongoDB CRUD for the "otps" collection
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.otp_model import OTPModel, OTPPurpose


class OTPRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.otps

    def _serialize(self, doc: dict) -> dict:
        if doc and "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return doc

    async def create(self, email: str, purpose: OTPPurpose, otp_hash: str,
                      expire_minutes: int, max_attempts: int) -> OTPModel:
        data = {
            "email": email.lower(),
            "purpose": purpose.value,
            "otp_hash": otp_hash,
            "attempts": 0,
            "max_attempts": max_attempts,
            "consumed": False,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=expire_minutes),
        }
        result = await self.collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return OTPModel(**data)

    async def invalidate_active(self, email: str, purpose: OTPPurpose) -> None:
        """Invalidate any previously-issued, unconsumed OTPs for this email+purpose (used on resend)."""
        await self.collection.update_many(
            {"email": email.lower(), "purpose": purpose.value, "consumed": False},
            {"$set": {"consumed": True}},
        )

    async def get_latest_active(self, email: str, purpose: OTPPurpose) -> Optional[OTPModel]:
        doc = await self.collection.find_one(
            {"email": email.lower(), "purpose": purpose.value, "consumed": False},
            sort=[("created_at", -1)],
        )
        if not doc:
            return None
        return OTPModel(**self._serialize(doc))

    async def count_recent(self, email: str, purpose: OTPPurpose, window_minutes: int = 60) -> int:
        since = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
        return await self.collection.count_documents({
            "email": email.lower(),
            "purpose": purpose.value,
            "created_at": {"$gte": since},
        })

    async def increment_attempts(self, otp_id: str) -> None:
        await self.collection.update_one(
            {"_id": ObjectId(otp_id)},
            {"$inc": {"attempts": 1}},
        )

    async def mark_consumed(self, otp_id: str) -> bool:
        result = await self.collection.update_one(
            {"_id": ObjectId(otp_id), "consumed": False},
            {"$set": {"consumed": True}},
        )
        return result.modified_count > 0


    async def delete_all_for(self, email: str, purpose: OTPPurpose) -> None:
        await self.collection.delete_many({"email": email.lower(), "purpose": purpose.value})

    # ── [BUG-003] Atomic verify-and-consume ────────────────────────────────────
    async def atomic_consume_if_valid(
        self,
        email: str,
        purpose: OTPPurpose,
        now: datetime,
    ) -> Optional[OTPModel]:
        """[BUG-003] Atomically marks the latest unconsumed, unexpired OTP as
        consumed in a single MongoDB findOneAndUpdate round-trip.

        Returns the OTP document (pre-update state) if found and unexpired,
        or None if no valid unconsumed OTP exists.

        By collapsing the 'verify → set consumed' into one operation, there is
        zero window between verification success and the consumed flag being set,
        making OTP replay attacks impossible even under concurrent requests.
        """
        doc = await self.collection.find_one_and_update(
            {
                "email": email.lower(),
                "purpose": purpose.value,
                "consumed": False,
                "expires_at": {"$gt": now},
            },
            {"$set": {"consumed": True}},
            sort=[("created_at", -1)],
            # return_document=False → returns the pre-update document (default)
        )
        if not doc:
            return None
        return OTPModel(**self._serialize(doc))