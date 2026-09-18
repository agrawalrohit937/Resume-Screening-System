"""
Job Application Model — Candidate Job Submissions & ATS Match Tracking.

Phase A: Jobs Foundation:
- Tracks candidate applications to posted jobs.
- Associates resume_id, ATS match_score, and hiring pipeline stage.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class ApplicationStage(str, Enum):
    APPLIED = "Applied"
    UNDER_REVIEW = "Under Review"
    SHORTLISTED = "Shortlisted"
    INTERVIEW = "Interview"
    REJECTED = "Rejected"


class ApplicationModel(BaseModel):
    """MongoDB document model for candidate job applications."""
    id: Optional[str] = Field(default=None, alias="_id")
    job_id: str
    candidate_id: str
    resume_id: str
    match_score: Optional[float] = Field(
        default=None,
        description="Candidate-facing lenient ATS match score (0-100)",
    )
    quality_score: Optional[float] = Field(
        default=None,
        description="Candidate quality score (0-100), NEVER capped, comparable across candidates",
    )
    eligibility: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Structured eligibility check outcome: status ('eligible' | 'ineligible' | 'unverified') and checks list",
    )
    eligibility_rank: Optional[int] = Field(
        default=0,
        description="Rank indicator for Kanban sort: 0 (eligible), 1 (unverified), 2 (ineligible)",
    )
    eligibility_override: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Human discretion override: {by, at, reason_code, note} | null",
    )
    recruiter_score: Optional[float] = Field(
        default=None,
        description="@deprecated: Legacy recruiter-facing score capped at 45.0 on hard knockouts. Use quality_score + eligibility for sorting.",
    )
    knockout_status: Optional[Dict[str, Any]] = Field(
        default=None,
        description="@deprecated: Legacy knockout outcome. Use eligibility instead.",
    )
    resume_snapshot: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Immutable snapshot of resume file_url and parsed_data taken at apply time",
    )
    stage: str = Field(
        default=ApplicationStage.APPLIED.value,
        description="Application lifecycle stage: Applied, Under Review, Shortlisted, Interview, Rejected",
    )
    scoring_version: Optional[str] = Field(
        default="1.0.0",
        description="Version of scoring engine used to compute match_score",
    )
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class ApplicationCreateRequest(BaseModel):
    job_id: str
    resume_id: str
    notes: Optional[str] = None


class ApplicationResponse(BaseModel):
    id: str
    job_id: str
    candidate_id: str
    resume_id: str
    match_score: Optional[float] = None
    quality_score: Optional[float] = None
    eligibility: Optional[Dict[str, Any]] = None
    eligibility_rank: Optional[int] = 0
    eligibility_override: Optional[Dict[str, Any]] = None
    recruiter_score: Optional[float] = None
    knockout_status: Optional[Dict[str, Any]] = None
    resume_snapshot: Optional[Dict[str, Any]] = None
    stage: str
    scoring_version: Optional[str] = None
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        populate_by_name = True

