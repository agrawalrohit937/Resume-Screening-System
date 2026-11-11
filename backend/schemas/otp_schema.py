"""
Pydantic v2 Schemas — OTP / Secure-Login / Forgot-Password flows
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


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

    model_config = ConfigDict(populate_by_name=True)


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=4, max_length=8)


class ResendOtpRequest(BaseModel):
    email: EmailStr
    purpose: str = "signup_verification"  # "signup_verification" | "login_verification" | "password_reset"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyResetOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=4, max_length=8)


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_token: str
    new_password: str = Field(min_length=8, max_length=128)


class VerifyLoginOtpRequest(BaseModel):
    challenge_token: str
    otp: str = Field(min_length=4, max_length=8)


class LoginChallengeResponse(BaseModel):
    requires_otp: bool = True
    challenge_token: str
    message: str = "A verification code has been sent to your email."


class OtpMessageResponse(BaseModel):
    success: bool = True
    message: str
    email: EmailStr | None = None