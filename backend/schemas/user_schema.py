"""
Pydantic v2 Schemas — User Auth & Profile
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from models.user_model import UserRole, UserStatus, AuthProvider


# ─── Request Schemas ──────────────────────────────────────────────────────────
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=100)
    role: UserRole = UserRole.CANDIDATE
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_username: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        if not any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in v):
            raise ValueError("Password must contain at least one special character")
        return v

    @field_validator("full_name")
    @classmethod
    def name_must_have_space(cls, v: str) -> str:
        v = v.strip()
        if len(v.split()) < 2:
            raise ValueError("Please provide your full name (first and last)")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: Optional[UserRole] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_username: Optional[str] = None
    profile_picture: Optional[str] = None
    # NEW profile fields
    college: Optional[str] = None
    degree: Optional[str] = None
    graduation_year: Optional[int] = Field(default=None, ge=1950, le=2100)
    location: Optional[str] = None
    bio: Optional[str] = Field(default=None, max_length=500)
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None


# ─── Response Schemas ─────────────────────────────────────────────────────────
class UserPublicResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    status: UserStatus
    profile_picture: Optional[str]
    phone: Optional[str]
    linkedin_url: Optional[str]
    github_username: Optional[str]
    total_resumes: int
    total_ats_checks: int
    last_login: Optional[datetime]
    created_at: datetime

    provider: AuthProvider = AuthProvider.EMAIL
    email_verified: bool = False
    google_picture: Optional[str] = None          # 🚨 DEPRECATED — kept for frontend compat
    display_picture: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None
    graduation_year: Optional[int] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    profile_completion_percent: int = 0

    # ✅ ADD THESE
    plan: str = "free"
    subscription_active: bool = False
    plan_updated_at: Optional[datetime] = None

    # ── NEW multi-provider auth fields ─────────────────────────────────────
    auth_methods: List[str] = Field(default_factory=list)
    last_login_method: Optional[str] = None
    linked_accounts: Dict[str, Any] = Field(default_factory=dict)

    # ── Primary profile resume fields ────────────────────────────────────
    profile_resume_url: Optional[str] = None
    profile_resume_name: Optional[str] = None
    has_password: bool = False


class SetPrimaryResumeRequest(BaseModel):
    """Payload for setting a resume as the primary profile resume."""
    resume_url: str
    resume_name: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserPublicResponse


class MessageResponse(BaseModel):
    success: bool = True
    message: str


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool
