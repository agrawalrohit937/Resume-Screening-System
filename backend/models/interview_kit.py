"""Structured Interview Kits and Scorecard Models.
CareerPilot ATS v2.0.0 - Enterprise ATS Workflows.
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
import uuid


class RecommendationEnum(str, Enum):
    STRONG_NO = "strong_no"
    NO = "no"
    MIXED = "mixed"
    YES = "yes"
    STRONG_YES = "strong_yes"


RECOMMENDATION_SCORES = {
    RecommendationEnum.STRONG_NO: 1.0,
    RecommendationEnum.NO: 2.0,
    RecommendationEnum.MIXED: 3.0,
    RecommendationEnum.YES: 4.0,
    RecommendationEnum.STRONG_YES: 5.0,
}


class Competency(BaseModel):
    name: str
    description: str
    weight: float = 1.0
    rubric: Dict[int, str] = Field(default_factory=dict)  # Anchor 1..5


class InterviewKitModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = "default"
    job_id: str
    stage_name: str  # e.g., "Screening", "Technical Interview", "System Design", "Values"
    competencies: List[Competency] = Field(default_factory=list)
    standard_questions: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ScorecardModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = "default"
    application_id: str
    candidate_id: str
    interviewer_id: str
    stage_name: str
    ratings: Dict[str, int] = Field(default_factory=dict)  # competency name -> 1..5 score
    recommendation: RecommendationEnum = RecommendationEnum.MIXED
    notes: Optional[str] = None
    submitted_at: datetime = Field(default_factory=datetime.utcnow)


class CalibrationReport(BaseModel):
    application_id: str
    stage_name: str
    scorecard_count: int
    mean_competency_score: float
    rating_variance: float
    consensus_recommendation: RecommendationEnum
    divergent_raters: List[str] = Field(default_factory=list)  # interviewers who deviated > 1.5 pts from mean
    calibration_status: str  # "calibrated", "split_decision", "insufficient_data"
