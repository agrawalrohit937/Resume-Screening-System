"""
Pydantic Schemas for Structured Interview Kits, Scorecards, and Live AI Interview Sessions.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


# ─── Structured Interview Kits & Scorecards ────────────────────────────────────

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
    rubric: Dict[int, str] = Field(default_factory=dict)


class InterviewKitModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = "default"
    job_id: str
    stage_name: str
    competencies: List[Competency] = Field(default_factory=list)
    standard_questions: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ScorecardModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = "default"
    application_id: str
    candidate_id: str
    interviewer_id: str
    stage_name: str
    ratings: Dict[str, int] = Field(default_factory=dict)
    recommendation: RecommendationEnum = RecommendationEnum.MIXED
    notes: Optional[str] = None
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CalibrationReport(BaseModel):
    application_id: str
    stage_name: str
    scorecard_count: int
    mean_competency_score: float
    rating_variance: float
    consensus_recommendation: RecommendationEnum
    divergent_raters: List[str] = Field(default_factory=list)
    calibration_status: str


# ─── Live Interview Sessions & Proctoring ──────────────────────────────────────

class SessionStatus(str, Enum):
    PENDING   = "pending"
    ACTIVE    = "active"
    COMPLETED = "completed"
    ABORTED   = "aborted"


class DifficultyLevel(str, Enum):
    EASY   = "easy"
    MEDIUM = "medium"
    HARD   = "hard"
    MIXED  = "mixed"


class CheatingEventType(str, Enum):
    TAB_SWITCH        = "tab_switch"
    FACE_MISSING      = "face_missing"
    MULTIPLE_FACES    = "multiple_faces"
    LOOKING_AWAY      = "looking_away"
    LOOKING_DOWN      = "looking_down"
    PHONE_DETECTED    = "phone_detected"
    COPY_PASTE        = "copy_paste"
    DEVTOOLS_OPEN     = "devtools_open"
    WINDOW_BLUR       = "window_blur"


class CheatingEventRecord(BaseModel):
    event_type:       CheatingEventType
    timestamp:        str
    severity:         str = "medium"
    frame_snapshot:   Optional[str] = None
    details:          Optional[str] = None


class QuestionAnswer(BaseModel):
    question_id:       int
    question_text:     str
    category:          str
    difficulty:        str
    user_answer:       str
    answer_source:     str = "text"
    time_taken_secs:   int = 0
    reattempted:       bool = False
    ai_score:          Optional[float] = None
    relevance_score:   Optional[float] = None
    clarity_score:     Optional[float] = None
    confidence_score:  Optional[float] = None
    filler_word_count: Optional[int]   = None
    ai_feedback:       Optional[str]   = None
    improvement_tips:  Optional[List[str]] = None
    keywords_found:    Optional[List[str]] = None
    keywords_missing:  Optional[List[str]] = None


class InterviewSession(BaseModel):
    id:               Optional[str] = None
    user_id:          str
    job_title:        str
    difficulty:       DifficultyLevel = DifficultyLevel.MEDIUM
    interview_type:   str = "mixed"
    status:           SessionStatus = SessionStatus.PENDING
    questions:        List[Dict[str, Any]] = []
    answers:          List[QuestionAnswer] = []
    cheating_events:  List[CheatingEventRecord] = []
    cheating_score:   float = 0.0
    warning_count:    int = 0
    session_aborted:  bool = False
    abort_reason:     Optional[str] = None
    overall_score:        Optional[float] = None
    avg_confidence:       Optional[float] = None
    avg_clarity:          Optional[float] = None
    avg_relevance:        Optional[float] = None
    total_filler_words:   int = 0
    total_time_secs:      int = 0
    improvement_summary:  Optional[str] = None
    strength_areas:       List[str] = []
    weakness_areas:       List[str] = []
    is_employer_scheduled: bool = False
    magic_token:           Optional[str] = None
    expires_at:            Optional[str] = None
    employer_id:           Optional[str] = None
    employer_name:         Optional[str] = None
    company_name:          Optional[str] = None
    job_id:                Optional[str] = None
    full_job_description:  Optional[str] = None
    custom_questions:      Optional[List[str]] = []
    candidate_email:       Optional[str] = None
    candidate_name:        Optional[str] = None
    application_id:        Optional[str] = None
    magic_link_url:        Optional[str] = None
    started_at:   Optional[str] = None
    completed_at: Optional[str] = None
    created_at:   str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at:   str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

