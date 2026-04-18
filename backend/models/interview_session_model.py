"""
Interview Session Model — MongoDB schema for full live interview sessions
"""
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field
from bson import ObjectId


class SessionStatus(str, Enum):
    PENDING   = "pending"
    ACTIVE    = "active"
    COMPLETED = "completed"
    ABORTED   = "aborted"   # terminated due to cheating


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
    PHONE_DETECTED    = "phone_detected"
    COPY_PASTE        = "copy_paste"
    DEVTOOLS_OPEN     = "devtools_open"
    WINDOW_BLUR       = "window_blur"


class CheatingEventRecord(BaseModel):
    event_type:       CheatingEventType
    timestamp:        str
    severity:         str = "medium"       # low | medium | high | critical
    frame_snapshot:   Optional[str] = None  # base64 thumb (optional)
    details:          Optional[str] = None


class QuestionAnswer(BaseModel):
    question_id:       int
    question_text:     str
    category:          str                  # technical | behavioral | situational
    difficulty:        str
    user_answer:       str
    answer_source:     str = "text"         # text | voice
    time_taken_secs:   int = 0
    reattempted:       bool = False

    # AI evaluation
    ai_score:          Optional[float] = None   # 0-100
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

    # Questions & answers
    questions:        List[Dict] = []
    answers:          List[QuestionAnswer] = []

    # Cheating tracking
    cheating_events:  List[CheatingEventRecord] = []
    cheating_score:   float = 0.0          # 0-1
    warning_count:    int = 0
    session_aborted:  bool = False
    abort_reason:     Optional[str] = None

    # Performance
    overall_score:        Optional[float] = None  # 0-100
    avg_confidence:       Optional[float] = None
    avg_clarity:          Optional[float] = None
    avg_relevance:        Optional[float] = None
    total_filler_words:   int = 0
    total_time_secs:      int = 0
    improvement_summary:  Optional[str] = None
    strength_areas:       List[str] = []
    weakness_areas:       List[str] = []

    started_at:   Optional[str] = None
    completed_at: Optional[str] = None
    created_at:   str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at:   str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
