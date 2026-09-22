"""Consented Talent Pool Models (Privacy-Preserving Search).
CareerPilot ATS v2.0.0 - Enterprise ATS Marketplace.
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
import uuid


class VisibilityTier(str, Enum):
    HIDDEN = "hidden"
    ANONYMIZED = "anonymized"
    FULL = "full"


class TalentPoolProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    candidate_id: str
    tenant_id: str = "default"
    opted_in: bool = False  # Strict default OFF
    visibility_tier: VisibilityTier = VisibilityTier.HIDDEN
    headline: str = ""
    summary: str = ""
    skills: List[str] = Field(default_factory=list)
    years_experience: float = 0.0
    current_company: Optional[str] = None
    candidate_name: str = ""
    candidate_email: str = ""
    excluded_employers: List[str] = Field(default_factory=list)  # Employer domains / names blocked from seeing candidate
    consent_granted_at: Optional[datetime] = None
    consent_revoked_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TalentPoolViewAudit(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    candidate_id: str
    recruiter_id: str
    recruiter_company: str
    recruiter_tenant_id: str
    viewed_at: datetime = Field(default_factory=datetime.utcnow)
    visibility_tier_at_view: VisibilityTier
