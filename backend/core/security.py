"""
Security — JWT token creation/verification, password hashing, OTP hashing
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Union

import structlog
from jose import JWTError, jwt
from passlib.context import CryptContext

from core.config import settings

logger = structlog.get_logger(__name__)

import asyncio
import hashlib
import hmac
import uuid

# ─── Password Context ─────────────────────────────────────────────────────────
# pwd_context uses argon2 for secure password hashing
pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    deprecated="auto"
)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


async def hash_password_async(password: str) -> str:
    """Non-blocking password hashing offloaded to thread pool."""
    return await asyncio.to_thread(pwd_context.hash, password)


async def verify_password_async(plain_password: str, hashed_password: str) -> bool:
    """Non-blocking password verification offloaded to thread pool to prevent event-loop stalls."""
    try:
        return await asyncio.to_thread(pwd_context.verify, plain_password, hashed_password)
    except Exception:
        return False


# ─── OTP (High-performance HMAC-SHA256 with fallback) ─────────────────────────
def generate_otp(length: int = 6) -> str:
    """Cryptographically-secure numeric OTP, e.g. '483921'. Never logged or stored raw."""
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def hash_otp(otp: str) -> str:
    """Fast, secure HMAC-SHA256 digest for short-lived 6-digit numeric OTPs."""
    secret = (settings.SECRET_KEY or "careershala_secret").encode("utf-8")
    return hmac.new(secret, str(otp).strip().encode("utf-8"), hashlib.sha256).hexdigest()


def verify_otp_hash(plain_otp: str, hashed_otp: str) -> bool:
    """Verifies OTP in constant time with backward-compatible fallback for legacy passlib hashes."""
    if not hashed_otp or not plain_otp:
        return False
    if hashed_otp.startswith(("$argon2", "$2b$", "$2a$", "$bcrypt")):
        try:
            return pwd_context.verify(plain_otp, hashed_otp)
        except Exception:
            return False
    expected = hash_otp(plain_otp)
    return secrets.compare_digest(expected, hashed_otp)


def generate_device_id() -> str:
    """Random opaque token stored in an httponly cookie to identify a trusted browser."""
    return secrets.token_urlsafe(32)


def hash_device_id(device_id: str) -> str:
    """Fast, secure HMAC-SHA256 digest for 256-bit random high-entropy device tokens."""
    secret = (settings.SECRET_KEY or "careershala_secret").encode("utf-8")
    return hmac.new(secret, device_id.strip().encode("utf-8"), hashlib.sha256).hexdigest()


def verify_device_id(plain_device_id: str, hashed_device_id: str) -> bool:
    """Verifies device ID in constant time with backward-compatible fallback for legacy passlib hashes."""
    if not hashed_device_id or not plain_device_id:
        return False
    if hashed_device_id.startswith(("$argon2", "$2b$", "$2a$", "$bcrypt")):
        try:
            return pwd_context.verify(plain_device_id, hashed_device_id)
        except Exception:
            return False
    expected = hash_device_id(plain_device_id)
    return secrets.compare_digest(expected, hashed_device_id)


def generate_challenge_token(subject: str, purpose: str, expires_minutes: int = 10) -> str:
    """Short-lived token identifying a pending OTP challenge (login-otp / reset-password),
    so the frontend never has to pass raw email/id around and we don't issue real JWTs early."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload = {
        "sub": subject,
        "purpose": purpose,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "challenge",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# ─── JWT & Token Lifecycle ───────────────────────────────────────────────────
import hashlib
import uuid

def hash_token(token: str) -> str:
    """Computes a deterministic SHA-256 hash of a token for secure database indexing."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(
    subject: Union[str, dict],
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[dict] = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    jti = str(uuid.uuid4())
    payload = {
        "sub": str(subject),
        "jti": jti,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    headers = {"kid": "v1"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM, headers=headers)


def create_refresh_token(
    subject: Union[str, dict],
    family_id: Optional[str] = None,
    extra_claims: Optional[dict] = None,
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    jti = str(uuid.uuid4())
    payload = {
        "sub": str(subject),
        "jti": jti,
        "family_id": family_id or str(uuid.uuid4()),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
    }
    if extra_claims:
        payload.update(extra_claims)
    headers = {"kid": "v1"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM, headers=headers)


def decode_token(token: str) -> Optional[dict]:
    """
    Decodes a JWT token using primary SECRET_KEY, falling back to JWT_PREVIOUS_SECRET_KEY
    if key rotation grace window is active.
    """
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as primary_err:
        if settings.JWT_SECRET_ROTATION_ENABLED and settings.JWT_PREVIOUS_SECRET_KEY:
            try:
                payload = jwt.decode(token, settings.JWT_PREVIOUS_SECRET_KEY, algorithms=[settings.ALGORITHM])
                logger.debug("Decoded JWT using rotated previous secret key")
                return payload
            except JWTError:
                pass
        logger.warning("JWT decode failed", error=str(primary_err))
        return None


def verify_token_type(payload: dict, expected_type: str) -> bool:
    return payload.get("type") == expected_type


def create_invite_token(
    email: str,
    tenant_id: str,
    role: str,
    invited_by: str,
    extra_claims: Optional[dict] = None,
    expires_days: int = 7,
) -> str:
    """Generate a cryptographically signed JWT invite token embedding tenant_id, role, and inviter."""
    expire = datetime.now(timezone.utc) + timedelta(days=expires_days)
    jti = str(uuid.uuid4())
    payload = {
        "sub": email.lower(),
        "jti": jti,
        "tenant_id": tenant_id,
        "role": role,
        "invited_by": str(invited_by),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "team_invite",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)