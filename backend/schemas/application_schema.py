"""
Pydantic request/response schemas for the AI Apply Assistant API.

ASSUMPTION FLAG: mirrors the conventions described for ats_schema.py /
resume_schema.py as best I can infer - diff against your real schema
files and adjust base-model config if yours differs (e.g. if you use
a shared BaseSchema with populate_by_name / alias_generator already).
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator
from bson import ObjectId

from models.application_model import ApplicationStatus


def _validate_object_id(v: str) -> str:
    if not ObjectId.is_valid(v):
        raise ValueError(f"Invalid ObjectId: {v}")
    return v


# ---------- Requests ----------

class ApplyDraftRequest(BaseModel):
    resume_id: str = Field(..., description="ID of an already-parsed resume owned by the current user")
    company_name: str = Field(..., min_length=1, max_length=200)
    job_title: str = Field(..., min_length=1, max_length=200)
    hr_email: EmailStr
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
    job_title: str = Field(..., min_length=1, max_length=200)
    job_description: str = Field(..., min_length=20, description="Raw JD text")

    _validate_resume_id = field_validator("resume_id")(_validate_object_id)


class ATSScoreResponse(BaseModel):
    score: int = Field(..., description="ATS keyword match score (0-100)")
    matched_keywords: List[str] = Field(default_factory=list)
    missing_keywords: List[str] = Field(default_factory=list)
    is_low_score: bool = Field(default=False, description="True if score is below 80")
