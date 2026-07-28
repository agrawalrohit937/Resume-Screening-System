"""
Pydantic v2 Schemas — ATS Matching, Skill Analysis
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

# ─── ATS Request (NO CHANGES HERE) ────────────────────────────────────────────
class ATSMatchRequest(BaseModel):
    resume_id: str
    job_title: str = Field(min_length=2, max_length=200)
    job_description: str = Field(min_length=50, max_length=10000)
    required_skills: List[str] = Field(default_factory=list)
    save_result: bool = True

    @field_validator("required_skills", mode="before")
    @classmethod
    def clean_skills(cls, value):
        if value is None:
            return []

        if isinstance(value, str):
            value = value.split(",")

        return [
            skill.strip().lower()
            for skill in value
            if skill and skill.strip()
        ]

class BulkATSMatchRequest(BaseModel):
    resume_ids: List[str] = Field(min_length=1, max_length=50)
    job_title: str = Field(min_length=2, max_length=200)
    job_description: str = Field(min_length=50, max_length=10000)
    required_skills: List[str] = Field(default_factory=list)

    @field_validator("required_skills", mode="before")
    @classmethod
    def clean_skills(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            value = value.split(",")
        return [
            skill.strip().lower()
            for skill in value
            if skill and skill.strip()
        ]

# ─── ATS Response (UPDATED WITH STRICT ATS FIELDS) ─────────────────────────────

class ATSMatchResponse(BaseModel):
    result_id: str
    resume_id: str
    job_title: str
    
    # ── Original AI / Semantic Engine Fields ──
    # [BUG-001] final_score is on a 0-100 scale (e.g. 75.5 = 75.5%).
    # experience_score and education_score are 0-1 sub-scores from the LangGraph evaluator.
    final_score: float          # 0-100 scale
    recommendation: str
    matched_skills: List[str]
    missing_skills: List[str]
    experience_score: float     # 0-1 scale
    education_score: float      # 0-1 scale
    feedback_suggestions: List[str]
    processing_time_ms: int

    # ── NEW: Strict / Corporate ATS Engine Fields (Deterministic, no LLM) ──
    is_knockout: bool = False
    knockout_reasons: List[str] = Field(default_factory=list)
    knockout_advisories: List[str] = Field(default_factory=list)

    strict_ats_score: float = 0.0
    strict_matched_keywords: List[str] = Field(default_factory=list)
    strict_missing_keywords: List[str] = Field(default_factory=list)

    parsing_is_healthy: bool = True
    parsing_confidence: float = 1.0
    parsing_warnings: List[str] = Field(default_factory=list)


class BulkATSResultItem(BaseModel):
    resume_id: str
    candidate_name: Optional[str]
    final_score: float
    recommendation: str
    matched_keywords: int
    missing_skills_count: int
    rank: int


class BulkATSMatchResponse(BaseModel):
    total_processed: int
    results: List[BulkATSResultItem]
    processing_time_ms: int


# ─── Skill Schema ─────────────────────────────────────────────────────────────

class LearningResource(BaseModel):
    title: str
    url: str
    platform: str
    type: str  # course | book | tutorial | certification
    duration: Optional[str] = None
    cost: str = "free"


class SkillGapDetail(BaseModel):
    skill: str
    importance: str
    current_level: str  # none | beginner | intermediate | advanced
    target_level: str
    resources: List[LearningResource]
    estimated_weeks: int


class LearningPathStep(BaseModel):
    week: int
    skill: str
    action: str
    resources: List[str]
    milestone: Optional[str] = None


class SkillAnalysisResponse(BaseModel):
    resume_id: str
    current_skills: List[str]
    technical_skills: List[str]
    soft_skills: List[str]
    skill_gaps: List[SkillGapDetail]
    learning_path: List[LearningPathStep]
    estimated_upskilling_weeks: int
    market_demand_score: float
    top_missing_skills: List[str]