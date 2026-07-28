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

# ─── Password Context ─────────────────────────────────────────────────────────
# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto"
)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# ─── OTP (reuses the same hashing context — no new dependency) ───────────────
def generate_otp(length: int = 6) -> str:
    """Cryptographically-secure numeric OTP, e.g. '483921'. Never logged or stored raw."""
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def hash_otp(otp: str) -> str:
    return pwd_context.hash(otp)


def verify_otp_hash(plain_otp: str, hashed_otp: str) -> bool:
    try:
        return pwd_context.verify(plain_otp, hashed_otp)
    except Exception:
        return False


def generate_device_id() -> str:
    """Random opaque token stored in an httponly cookie to identify a trusted browser."""
    return secrets.token_urlsafe(32)


def hash_device_id(device_id: str) -> str:
    """We store only a hash of the device id server-side, same as we would a token."""
    return pwd_context.hash(device_id)


def verify_device_id(plain_device_id: str, hashed_device_id: str) -> bool:
    try:
        return pwd_context.verify(plain_device_id, hashed_device_id)
    except Exception:
        return False


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


# ─── JWT ──────────────────────────────────────────────────────────────────────
def create_access_token(
    subject: Union[str, dict],
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[dict] = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: Union[str, dict]) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning("JWT decode failed", error=str(e))
        return None


def verify_token_type(payload: dict, expected_type: str) -> bool:
    return payload.get("type") == expected_type