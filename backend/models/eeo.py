"""
Equal Employment Opportunity (EEO) Self-Identification Models.

Phase 5, Task 5.2:
Voluntary demographic data collection stored strictly outside the scoring pipeline.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class EEOGender(str, Enum):
    MALE = "Male"
    FEMALE = "Female"
    NON_BINARY = "Non-Binary"
    DECLINE = "Decline to State"


class EEORaceEthnicity(str, Enum):
    HISPANIC_LATINO = "Hispanic or Latino"
    WHITE = "White (Not Hispanic or Latino)"
    BLACK = "Black or African American"
    ASIAN = "Asian"
    NATIVE_AMERICAN = "American Indian or Alaska Native"
    PACIFIC_ISLANDER = "Native Hawaiian or Other Pacific Islander"
    TWO_OR_MORE = "Two or More Races"
    DECLINE = "Decline to State"


class EEOVeteranStatus(str, Enum):
    PROTECTED_VETERAN = "I identify as one or more of the classifications of protected veteran"
    NOT_VETERAN = "I am not a protected veteran"
    DECLINE = "I decline to state my veteran status"


class EEODisabilityStatus(str, Enum):
    YES = "Yes, I have a disability, or have a history/record of having a disability"
    NO = "No, I don't have a disability, or a history/record of having a disability"
    DECLINE = "I do not wish to answer"


class EEOSelfIdentificationPayload(BaseModel):
    gender: Optional[EEOGender] = EEOGender.DECLINE
    race_ethnicity: Optional[EEORaceEthnicity] = EEORaceEthnicity.DECLINE
    veteran_status: Optional[EEOVeteranStatus] = EEOVeteranStatus.DECLINE
    disability_status: Optional[EEODisabilityStatus] = EEODisabilityStatus.DECLINE
    application_id: Optional[str] = None
    job_id: Optional[str] = None


class EEOSelfIdentificationRecord(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    candidate_id: str
    tenant_id: str = "default"
    gender: str
    race_ethnicity: str
    veteran_status: str
    disability_status: str
    application_id: Optional[str] = None
    job_id: Optional[str] = None
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
