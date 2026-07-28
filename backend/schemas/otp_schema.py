"""
Pydantic v2 Schemas — OTP / Secure-Login / Forgot-Password flows
"""

from pydantic import BaseModel, EmailStr, Field


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