"""
Job Marketplace Model & Schemas — MongoDB Entity & API Layer.

Phase A: Jobs Foundation:
- Pydantic models for job listings with 768-dim BGE local embedding vectors.
- Supports recruiter job creation, candidate feed retrieval, and ATS vector indexing.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class WorkMode(str, Enum):
    REMOTE = "Remote"
    HYBRID = "Hybrid"
    ONSITE = "Onsite"


class JobStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    DRAFT = "draft"


class JobModel(BaseModel):
    """MongoDB Document Model for the 'jobs' collection."""
    id: Optional[str] = Field(default=None, alias="_id")
    company_name: str
    title: str
    jd_text_raw: str
    required_skills: List[str] = Field(default_factory=list)
    min_years: float = Field(default=0.0, ge=0.0)
    location: str = "Remote"
    work_mode: str = WorkMode.REMOTE.value
    salary_range: Optional[str] = None
    status: str = JobStatus.OPEN.value
    jd_embedding: List[float] = Field(
        default_factory=list,
        description="768-dimensional normalized BGE embedding vector from local SentenceTransformer",
    )
    department: Optional[str] = None
    company_logo: Optional[str] = None
    company_website: Optional[str] = None
    company_about: Optional[str] = None
    company_size: Optional[str] = None
    is_external: bool = False
    external_apply_url: Optional[str] = None
    external_job_id: Optional[str] = None
    created_by: Optional[str] = None  # Recruiter / Admin user_id
    tenant_id: str = Field(default="default", description="Multi-tenant organization partition identifier")
    applicant_count: int = 0
    education_requirement_mode: str = Field(
        default="preferred",
        description="Skills-first education mode: 'required' | 'preferred' | 'ignored'"
    )
    required_credentials: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Mandatory or preferred credentials e.g. [{'type': 'RN', 'is_mandatory': True}]"
    )
    occupation_code: Optional[str] = Field(
        default=None,
        description="ESCO / NCO / SOC code for domain scoring adapter dispatch"
    )
    requirements_structured: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Structured requirements parsed from JD text"
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class JobCreateRequest(BaseModel):
    """Payload for creating a new job posting."""
    company_name: str = Field(..., min_length=2, max_length=120)
    title: str = Field(..., min_length=2, max_length=150)
    jd_text_raw: str = Field(..., min_length=20)
    required_skills: List[str] = Field(default_factory=list)
    min_years: float = Field(default=0.0, ge=0.0, le=50.0)
    location: str = Field(default="Remote", max_length=100)
    work_mode: str = Field(default=WorkMode.REMOTE.value)
    salary_range: Optional[str] = Field(default=None, max_length=100)
    department: Optional[str] = Field(default=None, max_length=100)
    company_logo: Optional[str] = None
    company_website: Optional[str] = None
    company_about: Optional[str] = None
    company_size: Optional[str] = None
    company_industry: Optional[str] = None
    education_requirement_mode: str = Field(default="preferred")
    required_credentials: List[Dict[str, Any]] = Field(default_factory=list)
    occupation_code: Optional[str] = None
    requirements_structured: List[Dict[str, Any]] = Field(default_factory=list)


class JobResponse(BaseModel):
    """Public representation of a job posting returned to clients."""
    id: str
    company_name: str
    title: str
    jd_text_raw: str
    required_skills: List[str]
    min_years: float
    location: str
    work_mode: str
    salary_range: Optional[str] = None
    status: str
    department: Optional[str] = None
    company_logo: Optional[str] = None
    company_website: Optional[str] = None
    company_about: Optional[str] = None
    company_size: Optional[str] = None
    is_external: bool = False
    external_apply_url: Optional[str] = None
    external_job_id: Optional[str] = None
    company_industry: Optional[str] = None
    created_by: Optional[str] = None
    tenant_id: Optional[str] = "default"
    applicant_count: int = 0
    education_requirement_mode: str = "preferred"
    required_credentials: List[Dict[str, Any]] = Field(default_factory=list)
    occupation_code: Optional[str] = None
    requirements_structured: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime
    has_embedding: bool = True
    has_applied: bool = False

    class Config:
        populate_by_name = True


class CompanyProfilePayload(BaseModel):
    """Payload for updating or creating an employer brand profile."""
    company_name: str = Field(..., min_length=2, max_length=120)
    tagline: Optional[str] = Field(default=None, max_length=250)
    about: Optional[str] = Field(default=None)
    logo_url: Optional[str] = Field(default=None)
    cover_url: Optional[str] = Field(default=None)
    website: Optional[str] = Field(default=None)
    location: Optional[str] = Field(default="Remote")
    industry: Optional[str] = Field(default="Technology")
    team_size: Optional[str] = Field(default="50-200 employees")
    perks: List[str] = Field(default_factory=list)
    linkedin: Optional[str] = Field(default=None)
    github: Optional[str] = Field(default=None)
    twitter: Optional[str] = Field(default=None)


class JobUpdateRequest(BaseModel):
    """Payload for updating an existing job posting."""
    title: Optional[str] = None
    company_name: Optional[str] = None
    jd_text_raw: Optional[str] = None
    required_skills: Optional[List[str]] = None
    min_years: Optional[float] = None
    location: Optional[str] = None
    work_mode: Optional[str] = None
    salary_range: Optional[str] = None
    department: Optional[str] = None
    company_logo: Optional[str] = None
    company_website: Optional[str] = None
    company_about: Optional[str] = None
    company_size: Optional[str] = None
    company_industry: Optional[str] = None
    status: Optional[str] = None
    rescore_applicants: bool = False


