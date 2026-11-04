"""
Token Lifecycle & Revocation Service — CareerShala Enterprise Security.

Provides:
1. Revocation denylist verification (Indexed PostgreSQL + in-memory fast path)
2. Refresh Token Family Rotation & Reuse Detection (detects compromised tokens and revokes family)
3. Session termination on logout, password change, and privilege escalation
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional, Tuple
import structlog
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

from config.db import get_pg_session_factory
from core.config import settings
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_token,
    verify_token_type,
)
from models import RefreshToken, RevokedToken, User, gen_uuid_str

logger = structlog.get_logger(__name__)

# In-memory fast cache for revoked JTIs
_REVOKED_JTI_CACHE: set[str] = set()


class TokenService:
    """
    Manages cryptographic JWT lifecycle, token rotation, and denylist verification via PostgreSQL.
    """

    @staticmethod
    async def is_jti_revoked(jti: Optional[str]) -> bool:
        """
        Checks if a JTI has been added to the revocation denylist.
        Time Complexity: O(1) in-memory check, falling back to indexed database read.
        """
        if not jti:
            return False

        if jti in _REVOKED_JTI_CACHE:
            return True

        try:
            session_factory = get_pg_session_factory()
            async with session_factory() as session:
                stmt = select(RevokedToken).where(RevokedToken.jti == str(jti))
                res = await session.execute(stmt)
                if res.scalar_one_or_none() is not None:
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
            session_factory = get_pg_session_factory()
            now = datetime.now(timezone.utc)
            exp = expires_at or (now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))

            async with session_factory() as session:
                async with session.begin():
                    stmt = (
                        insert(RevokedToken)
                        .values(
                            id=gen_uuid_str(),
                            jti=str(jti),
                            expires_at=exp,
                            revoked_at=now,
                            reason=reason,
                        )
                        .on_conflict_do_update(
                            index_elements=[RevokedToken.jti],
                            set_={
                                "expires_at": exp,
                                "revoked_at": now,
                                "reason": reason,
                            },
                        )
                    )
                    await session.execute(stmt)
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
            session_factory = get_pg_session_factory()
            async with session_factory() as session:
                async with session.begin():
                    stmt = (
                        update(RefreshToken)
                        .where(RefreshToken.family_id == str(family_id))
                        .values(revoked=True)
                    )
                    await session.execute(stmt)
            logger.warning("Token family revoked", family_id=family_id, reason=reason)
        except Exception as e:
            logger.error("Failed to revoke token family", family_id=family_id, error=str(e))

    @staticmethod
    async def revoke_all_user_tokens(user_id: str, reason: str = "user_revocation") -> None:
        """
        Revokes all active refresh tokens for a user.
        """
        try:
            session_factory = get_pg_session_factory()
            async with session_factory() as session:
                async with session.begin():
                    stmt = (
                        update(RefreshToken)
                        .where(RefreshToken.user_id == str(user_id))
                        .values(revoked=True)
                    )
                    await session.execute(stmt)
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
            session_factory = get_pg_session_factory()
            hashed = hash_token(raw_token)
            now = datetime.now(timezone.utc)
            exp = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

            async with session_factory() as session:
                async with session.begin():
                    token_obj = RefreshToken(
                        id=gen_uuid_str(),
                        token_hash=hashed,
                        user_id=str(user_id),
                        family_id=str(family_id),
                        jti=str(jti),
                        used=False,
                        revoked=False,
                        created_at=now,
                        expires_at=exp,
                    )
                    session.add(token_obj)
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

        session_factory = get_pg_session_factory()
        token_hash = hash_token(raw_refresh_token)

        async with session_factory() as session:
            stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
            res = await session.execute(stmt)
            stored_record = res.scalar_one_or_none()

            if not stored_record:
                raise ValueError("Refresh token record not recognized")

            if stored_record.revoked is True:
                await TokenService.revoke_token_family(family_id, reason="compromised_token_reuse")
                raise ValueError("Refresh token has been revoked")

            if stored_record.used is True:
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
            stored_record.used = True
            await session.commit()

            # Retrieve user to get fresh roles and claims
            user_stmt = select(User).where(User.id == str(stored_record.user_id))
            user_res = await session.execute(user_stmt)
            user = user_res.scalar_one_or_none()

            role = getattr(user, "role", None) or payload.get("role", "candidate")
            roles = getattr(user, "roles", None) or [role]
            tenant = getattr(user, "tenant_id", None) or tenant_id

            extra_claims = {
                "email": payload.get("email") or getattr(user, "email", ""),
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
