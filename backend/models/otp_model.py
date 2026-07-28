"""
MongoDB Document Model — OTP (collection: "otps")
Never stores the raw OTP — only its hash.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class OTPPurpose(str, Enum):
    SIGNUP_VERIFICATION = "signup_verification"
    LOGIN_VERIFICATION = "login_verification"
    PASSWORD_RESET = "password_reset"


class OTPModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    email: str
    purpose: OTPPurpose
    otp_hash: str
    attempts: int = 0
    max_attempts: int = 3
    consumed: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime

    class Config:
        populate_by_name = True