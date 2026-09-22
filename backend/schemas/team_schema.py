"""
Pydantic Schemas for Multi-Tenant Team Management & Invitations
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

from models.user_model import UserRole


class TeamInviteRequest(BaseModel):
    email: EmailStr
    role: UserRole


class TeamInviteResponse(BaseModel):
    message: str
    invite_id: str
    email: str
    role: str
    tenant_id: str
    invite_link: str
    token: str
    expires_at: datetime


class AcceptInviteRequest(BaseModel):
    token: str
    full_name: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8, max_length=128)

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


class VerifyInviteResponse(BaseModel):
    valid: bool
    email: str
    role: str
    tenant_id: str
    invited_by_name: Optional[str] = None
    invited_by_email: Optional[str] = None
    expires_at: datetime


class TeamMemberItem(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    roles: List[str]
    tenant_id: str
    status: str
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    profile_picture: Optional[str] = None


class PendingInviteItem(BaseModel):
    id: str
    email: str
    role: str
    tenant_id: str
    status: str
    created_at: datetime
    expires_at: datetime
    invited_by_name: Optional[str] = None
    invited_by_email: Optional[str] = None
    invite_link: Optional[str] = None


class TeamListResponse(BaseModel):
    tenant_id: str
    members: List[TeamMemberItem]
    pending_invites: List[PendingInviteItem]
