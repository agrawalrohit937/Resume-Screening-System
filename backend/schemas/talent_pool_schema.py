"""
Consented Talent Pool Schemas (Privacy-Preserving Search).
CareerShala ATS v2.0.0 - Enterprise ATS Marketplace.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class VisibilityTier(str, Enum):
    HIDDEN = "hidden"
    ANONYMIZED = "anonymized"
    FULL = "full"


class TalentPoolProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    candidate_id: str
    tenant_id: str = "default"
    opted_in: bool = False
    visibility_tier: VisibilityTier = VisibilityTier.HIDDEN
    headline: str = ""
    summary: str = ""
    skills: List[str] = Field(default_factory=list)
    years_experience: float = 0.0
    current_company: Optional[str] = None
    candidate_name: str = ""
    candidate_email: str = ""
    excluded_employers: List[str] = Field(default_factory=list)
    consent_granted_at: Optional[datetime] = None
    consent_revoked_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)


class TalentPoolViewAudit(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    candidate_id: str
    recruiter_id: str
    recruiter_company: str
    recruiter_tenant_id: str
    viewed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    visibility_tier_at_view: VisibilityTier

