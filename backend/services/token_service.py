"""
Token Lifecycle & Revocation Service — CareerShala Enterprise Security.

Provides:
1. Revocation denylist verification (TTL indexed MongoDB + in-memory fast path)
2. Refresh Token Family Rotation & Reuse Detection (detects compromised tokens and revokes family)
3. Session termination on logout, password change, and privilege escalation
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional, Tuple
import structlog
from config.db import get_database
from core.config import settings
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_token,
    verify_token_type,
)

logger = structlog.get_logger(__name__)

# In-memory fast cache for revoked JTIs
_REVOKED_JTI_CACHE: set[str] = set()


class TokenService:
    """
    Manages cryptographic JWT lifecycle, token rotation, and denylist verification.
    """

    @staticmethod
    async def is_jti_revoked(jti: Optional[str]) -> bool:
        """
        Checks if a JTI has been added to the revocation denylist.
        Time Complexity: O(1) in-memory check, falling back to indexed MongoDB read.
        """
        if not jti:
            return False

        if jti in _REVOKED_JTI_CACHE:
            return True

        try:
            db = get_database()
            revoked_doc = await db["revoked_tokens"].find_one({"jti": jti})
            if revoked_doc:
                _REVOKED_JTI_CACHE.add(jti)
                return True
        except Exception as e:
            logger.error("Failed to check JTI revocation status", jti=jti, error=str(e))

        return False

    @staticmethod
    async def revoke_jti(jti: str, expires_at: Optional[datetime] = None, reason: str = "logout") -> None:
        """
        Revokes a single JTI until its natural expiration.
        """
        if not jti:
            return

        _REVOKED_JTI_CACHE.add(jti)
        try:
            db = get_database()
            exp = expires_at or (datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
            await db["revoked_tokens"].update_one(
                {"jti": jti},
                {
                    "$set": {
                        "jti": jti,
                        "expires_at": exp,
                        "revoked_at": datetime.now(timezone.utc),
                        "reason": reason,
                    }
                },
                upsert=True,
            )
            logger.info("JTI revoked successfully", jti=jti, reason=reason)
        except Exception as e:
            logger.error("Failed to persist JTI revocation", jti=jti, error=str(e))

    @staticmethod
    async def revoke_token_family(family_id: str, reason: str = "family_reuse_detected") -> None:
        """
        Revokes all refresh tokens belonging to a specific family ID.
        """
        if not family_id:
            return

        try:
            db = get_database()
            await db["refresh_tokens"].update_many(
                {"family_id": family_id},
                {"$set": {"revoked": True, "revoked_at": datetime.now(timezone.utc), "revocation_reason": reason}},
            )
            logger.warning("Token family revoked", family_id=family_id, reason=reason)
        except Exception as e:
            logger.error("Failed to revoke token family", family_id=family_id, error=str(e))

    @staticmethod
    async def revoke_all_user_tokens(user_id: str, reason: str = "user_revocation") -> None:
        """
        Revokes all active refresh tokens for a user.
        """
        try:
            db = get_database()
            await db["refresh_tokens"].update_many(
                {"user_id": str(user_id)},
                {"$set": {"revoked": True, "revoked_at": datetime.now(timezone.utc), "revocation_reason": reason}},
            )
            logger.info("All user tokens revoked", user_id=user_id, reason=reason)
        except Exception as e:
            logger.error("Failed to revoke user tokens", user_id=user_id, error=str(e))

    @staticmethod
    async def store_refresh_token(
        raw_token: str,
        user_id: str,
        tenant_id: str,
        family_id: str,
        jti: str,
    ) -> None:
        """
        Persists a newly issued refresh token in hashed form.
        """
        try:
            db = get_database()
            hashed = hash_token(raw_token)
            exp = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
            await db["refresh_tokens"].insert_one({
                "token_hash": hashed,
                "user_id": str(user_id),
                "tenant_id": tenant_id,
                "family_id": family_id,
                "jti": jti,
                "used": False,
                "revoked": False,
                "created_at": datetime.now(timezone.utc),
                "expires_at": exp,
            })
        except Exception as e:
            logger.error("Failed to store refresh token", user_id=user_id, error=str(e))

    @staticmethod
    async def rotate_refresh_token(raw_refresh_token: str) -> Tuple[str, str, Dict[str, Any]]:
        """
        Rotates a refresh token:
        - Validates the token payload and signature.
        - Checks if already used or revoked.
        - If reuse detected: revokes the entire token family!
        - If valid: marks old token as used, generates a new access token and a new refresh token within the same family.
        Returns: (new_access_token, new_refresh_token, user_payload)
        """
        payload = decode_token(raw_refresh_token)
        if not payload or not verify_token_type(payload, "refresh"):
            raise ValueError("Invalid refresh token payload")

        user_id = str(payload.get("sub"))
        jti = payload.get("jti")
        family_id = payload.get("family_id") or str(jti)
        tenant_id = payload.get("tenant_id") or "default"

        if await TokenService.is_jti_revoked(jti):
            await TokenService.revoke_token_family(family_id, reason="revoked_jti_reuse")
            raise ValueError("Token has been revoked")

        db = get_database()
        token_hash = hash_token(raw_refresh_token)
        stored_record = await db["refresh_tokens"].find_one({"token_hash": token_hash})

        if not stored_record:
            # Token not found in db or already purged
            raise ValueError("Refresh token record not recognized")

        if stored_record.get("revoked") is True:
            # Token is explicitly revoked
            await TokenService.revoke_token_family(family_id, reason="compromised_token_reuse")
            raise ValueError("Refresh token has been revoked")

        if stored_record.get("used") is True:
            # REUSE DETECTED: Someone is presenting an old refresh token that was already swapped.
            logger.error(
                "security_alert_refresh_token_reuse_detected",
                user_id=user_id,
                family_id=family_id,
                jti=jti,
            )
            await TokenService.revoke_token_family(family_id, reason="token_reuse_attack_detected")
            await TokenService.revoke_jti(jti, reason="reuse_attack")
            raise ValueError("Token reuse detected. All sessions in this family have been terminated.")

        # Mark current token as used
        await db["refresh_tokens"].update_one(
            {"_id": stored_record["_id"]},
            {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}},
        )

        # Retrieve user to get fresh roles and claims
        user = await db["users"].find_one({"_id": stored_record["user_id"]})
        if not user:
            from bson import ObjectId
            try:
                user = await db["users"].find_one({"_id": ObjectId(stored_record["user_id"])})
            except Exception:
                pass

        role = user.get("role", "candidate") if user else payload.get("role", "candidate")
        roles = user.get("roles", [role]) if user else payload.get("roles", [role])
        tenant = user.get("tenant_id", tenant_id) if user else tenant_id

        extra_claims = {
            "email": payload.get("email") or (user.get("email") if user else ""),
            "role": role,
            "roles": roles,
            "tenant_id": tenant,
        }

        # Issue new token pair
        new_access_token = create_access_token(subject=user_id, extra_claims=extra_claims)
        new_refresh_token = create_refresh_token(subject=user_id, family_id=family_id, extra_claims=extra_claims)

        new_refresh_payload = decode_token(new_refresh_token) or {}
        new_jti = new_refresh_payload.get("jti", "")

        # Persist new refresh token
        await TokenService.store_refresh_token(
            raw_token=new_refresh_token,
            user_id=user_id,
            tenant_id=tenant,
            family_id=family_id,
            jti=new_jti,
        )

        return new_access_token, new_refresh_token, extra_claims
