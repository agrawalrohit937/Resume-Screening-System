"""Pydantic request and response schemas for the AI Apply Assistant API."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from utils.validators import DocumentId


# ─── Application Stages & Statuses ─────────────────────────────────────────────

class ApplicationStage(str, Enum):
    APPLIED = "Applied"
    UNDER_REVIEW = "Under Review"
    SHORTLISTED = "Shortlisted"
    INTERVIEW = "Interview"
    HIRED = "Hired"
    REJECTED = "Rejected"


class ApplicationStatus(str, Enum):
    DRAFT = "draft"
    READY_FOR_REVIEW = "ready_for_review"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"


_VALID_TRANSITIONS = {
    ApplicationStatus.DRAFT: {ApplicationStatus.READY_FOR_REVIEW, ApplicationStatus.FAILED},
    ApplicationStatus.READY_FOR_REVIEW: {ApplicationStatus.DRAFT, ApplicationStatus.SENDING, ApplicationStatus.FAILED},
    ApplicationStatus.SENDING: {ApplicationStatus.SENT, ApplicationStatus.FAILED},
    ApplicationStatus.SENT: set(),
    ApplicationStatus.FAILED: {ApplicationStatus.DRAFT, ApplicationStatus.SENDING},
}


def is_valid_transition(current: Any, next_status: Any) -> bool:
    try:
        curr = ApplicationStatus(current) if isinstance(current, str) else current
        nxt = ApplicationStatus(next_status) if isinstance(next_status, str) else next_status
        return nxt in _VALID_TRANSITIONS.get(curr, set())
    except (ValueError, KeyError):
        return False



class CareerApplicationStatus(str, Enum):
    APPLIED = "applied"
    SHORTLISTED = "shortlisted"
    INTERVIEWED = "interviewed"
    REJECTED = "rejected"
    HIRED = "hired"


class CareerApplicationModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    applicant_name: str
    email: str
    role_title: str
    portfolio_url: Optional[str] = None
    resume_url: Optional[str] = None
    resume_filename: Optional[str] = None
    resume_public_id: Optional[str] = None
    cover_letter: str
    status: str = CareerApplicationStatus.APPLIED.value
    admin_notes: Optional[str] = None
    email_sent: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )



def new_application_document(
    *,
    user_id: str,
    resume_id: str,
    company_name: str,
    job_title: str,
    hr_email: str,
    job_description: str,
) -> dict:
    return {
        "user_id": str(user_id),
        "resume_id": str(resume_id),
        "company_name": company_name,
        "job_title": job_title,
        "hr_email": hr_email,
        "job_description": job_description,
        "jd_analysis": None,
        "ats_result_ref": None,
        "generated_draft": None,
        "edited_draft": None,
        "cover_letter_pdf_path": None,
        "status": ApplicationStatus.DRAFT.value,
        "needs_manual_review": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }


class ApplicationModel(BaseModel):
    """Domain DTO for candidate job applications."""
    id: Optional[str] = Field(default=None, alias="_id")
    job_id: str
    candidate_id: str
    resume_id: str
    tenant_id: str = Field(default="default", description="Multi-tenant organization partition identifier")
    match_score: Optional[float] = Field(default=None, description="Candidate-facing match score (0-100)")
    quality_score: Optional[float] = Field(default=None, description="Quality score (0-100)")
    eligibility: Optional[Dict[str, Any]] = None
    eligibility_rank: Optional[int] = 0
    eligibility_override: Optional[Dict[str, Any]] = None
    recruiter_score: Optional[float] = None
    knockout_status: Optional[Dict[str, Any]] = None
    resume_snapshot: Optional[Dict[str, Any]] = None
    stage: str = Field(default=ApplicationStage.APPLIED.value)
    scoring_version: Optional[str] = "2.0.0"
    features: Optional[Dict[str, Any]] = None
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    hire_outcome: Optional[str] = None
    hire_outcome_recorded_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


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
    features: Optional[Dict[str, Any]] = None
    stage: str
    scoring_version: Optional[str] = None
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    hire_outcome: Optional[str] = None
    hire_outcome_recorded_at: Optional[datetime] = None
    notes: Optional[str] = None
    tenant_id: Optional[str] = "default"
    created_at: datetime

    model_config = ConfigDict(populate_by_name=True)


def _validate_document_id(v: str) -> str:
    if not DocumentId.is_valid(v):
        raise ValueError(f"Invalid ID: {v}")
    return v


_validate_object_id = _validate_document_id


# ---------- Requests ----------

class ApplyDraftRequest(BaseModel):
    resume_id: str = Field(..., description="ID of an already-parsed resume owned by the current user")
    company_name: str = Field(..., min_length=1, max_length=200)
    job_title: str = Field(..., min_length=1, max_length=200)
    hr_email: Optional[EmailStr] = None
    job_description: str = Field(..., min_length=20, description="Raw JD text")

    _validate_resume_id = field_validator("resume_id")(_validate_object_id)


class ApplyDraftUpdateRequest(BaseModel):
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    cover_letter_text: Optional[str] = None


class ApplySendRequest(BaseModel):
    confirm: bool = Field(default=True, description="Explicit client-side confirmation flag - server re-checks status regardless")


# ---------- Responses ----------

class ATSResultSummary(BaseModel):
    result_id: str
    score: int
    missing_keywords: List[str] = []


class ApplyDraftResponse(BaseModel):
    application_id: str
    status: ApplicationStatus
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    cover_letter_text: Optional[str] = None
    ats_result: Optional[ATSResultSummary] = None
    needs_manual_review: bool = False
    created_at: datetime
    updated_at: datetime


class ApplyPreviewResponse(BaseModel):
    preview_url: str
    expires_in: int = 300


class ApplySendResponse(BaseModel):
    application_id: str
    status: ApplicationStatus
    sent_at: Optional[datetime] = None


class ApplicationHistoryItem(BaseModel):
    application_id: str
    company_name: str
    job_title: str
    status: ApplicationStatus
    created_at: datetime


class ApplicationHistoryResponse(BaseModel):
    items: List[ApplicationHistoryItem]
    total: int
    page: int


# ---------- ATS Score Pre-check (Apply Assistant) ----------

class ATSScoreRequest(BaseModel):
    resume_id: str = Field(..., description="ID of an already-parsed resume owned by the current user")
    job_description: str = Field(..., min_length=20, description="Raw JD text")

    _validate_resume_id = field_validator("resume_id")(_validate_object_id)


class ATSScoreResponse(BaseModel):
    score: int = Field(..., description="ATS keyword match score (0-100)")
    matched_keywords: List[str] = Field(default_factory=list)
    missing_keywords: List[str] = Field(default_factory=list)
    is_low_score: bool = Field(default=False, description="True if score is below 80")


class JobDetailsExtractionResponse(BaseModel):
    company_name: str = Field(default="", description="Extracted company name")
    job_title: str = Field(default="", description="Extracted job title")
    hr_email: str = Field(default="", description="Extracted HR/recruiter email address")
    job_description: str = Field(default="", description="Extracted job description text")
