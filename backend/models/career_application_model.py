"""
MongoDB Document Model — Career Page Applications

Stores submissions from the public /careers page (not the AI Apply Assistant).
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class CareerApplicationStatus(str, Enum):
    APPLIED = "applied"
    SHORTLISTED = "shortlisted"
    INTERVIEWED = "interviewed"
    REJECTED = "rejected"
    HIRED = "hired"


CAREER_APPLICATION_COLLECTION = "career_applications"


class CareerApplicationModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")

    # Applicant info
    applicant_name: str
    email: str
    role_title: str
    portfolio_url: Optional[str] = None

    # Resume
    resume_url: Optional[str] = None          # Cloudinary URL
    resume_filename: Optional[str] = None
    resume_public_id: Optional[str] = None    # Cloudinary public_id for deletion

    # Cover letter
    cover_letter: str

    # Admin management
    status: str = CareerApplicationStatus.APPLIED.value
    admin_notes: Optional[str] = None

    # Email notification tracking
    email_sent: bool = False

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
