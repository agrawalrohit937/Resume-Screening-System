"""
MongoDB Document Models — ATS Result, Job Description
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class SeniorityLevel(str, Enum):
    INTERN = "intern"
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"
    PRINCIPAL = "principal"
    EXECUTIVE = "executive"


class JobDescriptionModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    title: str
    company: Optional[str] = None
    description: str
    required_skills: List[str] = []
    preferred_skills: List[str] = []
    experience_years_min: Optional[int] = None
    experience_years_max: Optional[int] = None
    seniority_level: Optional[SeniorityLevel] = None
    location: Optional[str] = None
    remote: bool = False
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    industry: Optional[str] = None
    raw_text: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)


class ATSResultModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    resume_id: str
    job_description_id: str

    # ── Scores ────────────────────────────────────────────────────────────────
    # [BUG-001] final_score is on a 0-100 scale (e.g. 75.5 = 75.5%).
    # experience_score and education_score are 0-1 sub-scores from the LangGraph evaluator.
    final_score: float = 0.0          # 0-100 scale
    experience_score: float = 0.0     # 0-1 scale
    education_score: float = 0.0      # 0-1 scale

    # ── Skills & Keywords ─────────────────────────────────────────────────────
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    matched_keywords: List[str] = []
    missing_keywords: List[str] = []

    # ── Feedback & Suggestions ────────────────────────────────────────────────
    recommendation: str = ""          # strong_match | good_match | partial_match | poor_match
    improvement_suggestions: List[str] = []
    strengths: List[str] = []
    weaknesses: List[str] = []
    overall_assessment: str = ""

    processing_time_ms: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        protected_namespaces=(),
    )

