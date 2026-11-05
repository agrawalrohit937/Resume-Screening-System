"""
Pydantic v2 Schemas — Resume Upload & Response
"""

from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

from models.resume_model import (
    ResumeStatus, ContactInfo, WorkExperience, Education,
    Project, Certification, ParsedResumeData
)

# ── NEW: Human-in-the-Loop (HITL) Wizard Payloads ─────────

class VerifiedLinks(BaseModel):
    """Only the fields the user actually typed something into. A field
    left out (None) means 'user was not asked' or 'user skipped it' —
    NOT 'user confirmed this is blank'. Never use this to erase an
    existing link."""
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None

    @field_validator("linkedin", "github", "portfolio")
    @classmethod
    def _strip_or_none(cls, v):
        if v is None:
            return None
        v = v.strip()
        return v or None

class ImpactMetric(BaseModel):
    """One answered wizard question. `question` is kept alongside the
    answer (rather than sending answers as a bare list) so the LLM
    prompt-builder — and any future analytics — can tell what was
    actually asked, not just guess from position in an array."""
    question: str
    answer: str

    @field_validator("answer")
    @classmethod
    def _non_empty(cls, v):
        v = (v or "").strip()
        if not v:
            raise ValueError("answer must not be empty")
        return v

class UserVerifiedData(BaseModel):
    """The full HITL wizard bundle. Every field is optional at this
    level because a user may have had nothing missing in a given group
    (e.g. all links already present -> `links` omitted entirely)."""
    links: Optional[VerifiedLinks] = None
    verified_skills: List[str] = Field(default_factory=list)
    impact_metrics: List[ImpactMetric] = Field(default_factory=list)

    def is_empty(self) -> bool:
        return (
            (self.links is None or not any([self.links.linkedin, self.links.github, self.links.portfolio]))
            and not self.verified_skills
            and not self.impact_metrics
        )

# ───────────────────────────────────────────────────────

class ResumeUploadResponse(BaseModel):
    resume_id: str
    filename: str
    status: ResumeStatus
    message: str


class ResumeDetailResponse(BaseModel):
    id: str
    user_id: str
    filename: str
    original_filename: str
    file_type: str
    file_url: Optional[str] = None
    file_size_bytes: int
    status: ResumeStatus
    parsed_data: Optional[ParsedResumeData]
    tags: List[str]
    is_primary: bool
    version: int
    created_at: datetime
    updated_at: datetime


class ResumeListResponse(BaseModel):
    resumes: List[ResumeDetailResponse]
    total: int


class ResumeUpdateRequest(BaseModel):
    tags: Optional[List[str]] = None
    is_primary: Optional[bool] = None


class EnhanceResumeRequest(BaseModel):
    resume_id: str
    job_description: Optional[str] = None
    target_role: Optional[str] = None
    required_skills: List[str] = Field(default_factory=list,description="Optional ATS keywords supplied by the recruiter")
    enhancement_areas: List[str] = Field(
        default=["summary", "experience", "skills", "keywords"],
        description="Areas to enhance: summary | experience | skills | keywords | formatting"
    )
    tone: str = Field(default="professional", pattern="^(professional|creative|academic)$")
    save_enhanced: bool = Field(default=False, description="Save the enhanced data back to the resume")
    
    # ── Strict ATS Engine Integration ──
    strict_missing_keywords: Optional[List[str]] = None

    # ── NEW: Human-in-the-Loop Integration ──
    # The HITL wizard bundle. None/absent = user was never shown a wizard (e.g. quick path).
    user_verified: Optional[UserVerifiedData] = None


class EnhanceResumeResponse(BaseModel):
    resume_id: str
    original_summary: Optional[str]
    enhanced_summary: Optional[str]
    original_experience: List[Dict]
    enhanced_experience: List[Dict]
    added_keywords: List[str]
    formatting_suggestions: List[str]
    ats_improvement_estimate: float
    enhancement_notes: List[str]


class InterviewRequest(BaseModel):
    resume_id: str
    job_description: Optional[str] = None
    job_title: Optional[str] = None
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    interview_type: str = Field(
        default="mixed",
        pattern="^(technical|behavioral|situational|mixed)$"
    )
    num_questions: int = Field(default=10, ge=3, le=30)


class InterviewQuestion(BaseModel):
    question_number: int
    type: str
    question: str
    category: str
    difficulty: str
    what_to_look_for: str
    sample_answer_framework: Optional[str] = None
    follow_up_questions: List[str] = []


class InterviewResponse(BaseModel):
    interview_id: str
    resume_id: str
    job_title: Optional[str]
    questions: List[InterviewQuestion]
    preparation_tips: List[str]
    estimated_duration_minutes: int
    created_at: datetime