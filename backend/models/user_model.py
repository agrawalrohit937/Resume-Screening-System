"""
MongoDB Document Models — User
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId


class UserRole(str, Enum):
    CANDIDATE = "candidate"
    RECRUITER = "recruiter"
    ADMIN = "admin"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING_VERIFICATION = "pending_verification"  # NEW — used while email OTP is unverified


class AuthProvider(str, Enum):
    EMAIL = "email"
    GOOGLE = "google"
    LINKEDIN = "linkedin"
    GITHUB = "github"


class TrustedDevice(BaseModel):
    """A previously-verified browser/device, so we don't ask for login OTP every time."""
    device_hash: str            # hash of the opaque device_id cookie value
    label: Optional[str] = None  # e.g. "Chrome on Windows"
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_used_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime


class LinkedAccountProvider(BaseModel):
    """Metadata stored per linked OAuth provider in linked_accounts.<provider>."""
    provider_id: Optional[str] = None          # provider-specific user ID (sub, id, etc.)
    email: Optional[str] = None                # email from the provider (may differ from primary)
    picture: Optional[str] = None              # avatar URL from the provider
    username: Optional[str] = None             # GitHub / LinkedIn username if available
    linked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    email: EmailStr
    hashed_password: Optional[str] = None
    full_name: str
    role: UserRole = UserRole.CANDIDATE
    status: UserStatus = UserStatus.ACTIVE
    # Premium / subscription fields (saved to user document)
    plan: str = "free"  # "free" | "pro" | "premium"
    subscription_active: bool = False
    plan_updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    profile_picture: Optional[str] = None
    profile_picture_public_id: Optional[str] = None  # Cloudinary public_id for deletion
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_username: Optional[str] = None
    total_resumes: int = 0
    total_ats_checks: int = 0
    last_login: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    refresh_token: Optional[str] = None

    # ── Gmail OAuth tokens (server-side offline access) ────────────────────────
    # These are Google-issued OAuth2 tokens for the gmail.send scope.
    # Stored server-side so the user only consents once, ever.
    # NOTE: This is NOT the same as the app-level JWT refresh_token above.
    gmail_access_token: Optional[str] = None
    gmail_refresh_token: Optional[str] = None
    gmail_token_expiry: Optional[datetime] = None  # UTC datetime when access token expires

    # ── NEW: Auth provider / verification ──────────────────────────────────
    # 🚨 DEPRECATED — kept for backward compatibility with existing documents.
    # Use auth_methods, last_login_method, and linked_accounts instead.
    auth_method: Optional[str] = None
    provider: AuthProvider = AuthProvider.EMAIL
    email_verified: bool = False
    google_picture: Optional[str] = None       # 🚨 DEPRECATED — use linked_accounts.google.picture

    # ── NEW: Multi-provider auth model ─────────────────────────────────────
    auth_methods: List[str] = Field(default_factory=list)           # unique list, e.g. ["google", "password"]
    last_login_method: Optional[str] = None                         # e.g. "google"
    linked_accounts: Dict[str, Any] = Field(default_factory=dict)   # provider → LinkedAccountProvider dict

    # ── NEW: Extended profile fields ───────────────────────────────────────
    college: Optional[str] = None
    degree: Optional[str] = None
    graduation_year: Optional[int] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    profile_resume_url: Optional[str] = None
    profile_resume_name: Optional[str] = None

    # ── NEW: Trusted devices for secure login ──────────────────────────────
    trusted_devices: List[TrustedDevice] = Field(default_factory=list)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

    # ── Helpers (not persisted) ─────────────────────────────────────────────
    @property
    def display_picture(self) -> Optional[str]:
        """Priority: custom uploaded image (has public_id) > provider picture > linked_accounts > None.
        
        - If profile_picture_public_id exists → it's a custom Cloudinary upload → use profile_picture.
        - Otherwise, return profile_picture (could be from provider auto-set or None).
        - Fallback to linked_accounts picture or old google_picture if profile_picture is None.
        """
        # Custom upload takes priority
        if self.profile_picture and self.profile_picture_public_id:
            return self.profile_picture
        # If profile_picture is set (provider auto-set), use it
        if self.profile_picture:
            return self.profile_picture
        # Try linked_accounts for any provider picture
        if self.linked_accounts:
            for provider_name in ["google", "linkedin", "github"]:
                provider_data = self.linked_accounts.get(provider_name)
                if isinstance(provider_data, dict) and provider_data.get("picture"):
                    return provider_data["picture"]
        # Fallback to deprecated google_picture
        if self.google_picture:
            return self.google_picture
        return None

    @property
    def provider_names(self) -> List[str]:
        """Get list of linked provider names (backed by auth_methods or fallback to auth_method)."""
        if self.auth_methods:
            return self.auth_methods
        if self.auth_method:
            return [self.auth_method]
        return []

    @property
    def profile_completion_percent(self) -> int:
        fields = [
            self.full_name, self.phone, self.college, self.degree,
            self.graduation_year, self.location, self.bio,
            self.linkedin_url, self.github_url, self.portfolio_url,
            self.display_picture,
        ]
        filled = sum(1 for f in fields if f not in (None, "", 0))
        return round((filled / len(fields)) * 100)
