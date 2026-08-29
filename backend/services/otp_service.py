"""
OTP Service — generate, send, verify, and rate-limit OTPs.
Centralizes the rules from FEATURE 1/2/3/12 so signup, login, and
forgot-password all share identical, tested behaviour.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
import structlog

from core.config import settings
from core.security import generate_otp, hash_otp, verify_otp_hash
from models.otp_model import OTPModel, OTPPurpose
from repositories.otp_repo import OTPRepository
from services.email_service import EmailService

logger = structlog.get_logger(__name__)


class OTPService:
    def __init__(self, otp_repo: OTPRepository, email_service: EmailService):
        self.otp_repo = otp_repo
        self.email_service = email_service

    async def issue(self, email: str, full_name: str, purpose: OTPPurpose,
                     is_resend: bool = False) -> None:
        """Create a new OTP, enforcing cooldown + hourly cap, and email it."""
        email = email.lower()

        if is_resend:
            latest = await self.otp_repo.get_latest_active(email, purpose)
            if latest:
                elapsed = (datetime.now(timezone.utc) - _as_utc(latest.created_at)).total_seconds()
                if elapsed < settings.OTP_RESEND_COOLDOWN_SECONDS:
                    wait = int(settings.OTP_RESEND_COOLDOWN_SECONDS - elapsed)
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Please wait {wait}s before requesting another code.",
                    )

        recent_count = await self.otp_repo.count_recent(email, purpose, window_minutes=60)
        if recent_count >= settings.OTP_MAX_PER_HOUR:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many codes requested. Please try again later.",
            )

        # Invalidate any previous unconsumed OTP for this email+purpose
        await self.otp_repo.invalidate_active(email, purpose)

        otp_plain = generate_otp(settings.OTP_LENGTH)
        await self.otp_repo.create(
            email=email,
            purpose=purpose,
            otp_hash=hash_otp(otp_plain),
            expire_minutes=settings.OTP_EXPIRE_MINUTES,
            max_attempts=settings.OTP_MAX_ATTEMPTS,
        )

        # Purpose branching now lives in EmailService's dispatch table, not here.
        if not getattr(settings, "BREVO_API_KEY", None):
            logger.warning(
                "🔑 [DEV MODE] Brevo API Key not configured. OTP generated for %s (purpose=%s): %s",
                email,
                purpose.value,
                otp_plain,
            )
            print(f"\n======================================================\n🔑 [OTP CODE] For: {email} | Purpose: {purpose.value}\n👉 CODE: {otp_plain}\n======================================================\n")

        await self.email_service.send_otp(email, full_name, otp_plain, purpose)

    async def verify(self, email: str, purpose: OTPPurpose, otp_input: str) -> None:
        """Raises HTTPException on any failure. Marks the OTP consumed on success."""
        email = email.lower()
        record: Optional[OTPModel] = await self.otp_repo.get_latest_active(email, purpose)

        if not record:
            raise HTTPException(status_code=400, detail="No active code found. Please request a new one.")

        if _as_utc(record.expires_at) < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Code expired. Please request a new one.")

        if record.attempts >= record.max_attempts:
            raise HTTPException(status_code=429, detail="Too many incorrect attempts. Please request a new code.")

        if not verify_otp_hash(otp_input, record.otp_hash):
            await self.otp_repo.increment_attempts(record.id)
            remaining = record.max_attempts - (record.attempts + 1)
            if remaining <= 0:
                raise HTTPException(status_code=429, detail="Too many incorrect attempts. Please request a new code.")
            raise HTTPException(status_code=400, detail=f"Incorrect code. {remaining} attempt(s) left.")

        consumed = await self.otp_repo.mark_consumed(record.id)
        if not consumed:
            raise HTTPException(status_code=400, detail="Code already used or invalid. Please request a new one.")


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt