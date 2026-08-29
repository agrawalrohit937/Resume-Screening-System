"""
MongoDB Document Models — Revenue Recovery & Risk Management
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from bson import ObjectId


class RecoveryStatus(str, Enum):
    AT_RISK = "AT_RISK"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    RECOVERY_ACTIVE = "RECOVERY_ACTIVE"
    CONTACTED = "CONTACTED"
    RETRY_SCHEDULED = "RETRY_SCHEDULED"
    RECOVERED = "RECOVERED"
    ESCALATED = "ESCALATED"
    STOPPED = "STOPPED"
    FAILED = "FAILED"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RecoveryStrategy(str, Enum):
    MONITOR = "MONITOR"
    RETRY_NOW = "RETRY_NOW"
    RETRY_LATER = "RETRY_LATER"
    SEND_EMAIL = "SEND_EMAIL"
    SEND_IN_APP_NOTIFICATION = "SEND_IN_APP_NOTIFICATION"
    VOICE_RECOVERY = "VOICE_RECOVERY"
    SEND_PAYMENT_UPDATE_REQUEST = "SEND_PAYMENT_UPDATE_REQUEST"
    WIN_BACK_OFFER = "WIN_BACK_OFFER"
    ESCALATE_TO_HUMAN = "ESCALATE_TO_HUMAN"
    STOP_RECOVERY = "STOP_RECOVERY"


class RecoveryChannel(str, Enum):
    EMAIL = "EMAIL"
    IN_APP = "IN_APP"
    VOICE = "VOICE"
    SMS = "SMS"
    NONE = "NONE"


class ActorType(str, Enum):
    AI_AGENT = "AI_AGENT"
    ADMIN = "ADMIN"
    SYSTEM = "SYSTEM"
    USER = "USER"


class AuditLogEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    actor: ActorType = ActorType.AI_AGENT
    actor_name: Optional[str] = "AI Recovery Agent"
    action: str
    details: Dict[str, Any] = Field(default_factory=dict)
    reasoning: Optional[str] = None


class VoiceMessage(BaseModel):
    role: str  # "agent" | "user" | "system"
    text: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VoiceRecoveryData(BaseModel):
    voice_attempted: bool = False
    voice_outcome: Optional[str] = None  # "agreed_retry" | "declined" | "requested_callback" | "unreachable"
    user_response: Optional[str] = None
    transcript: List[VoiceMessage] = Field(default_factory=list)
    call_duration_seconds: int = 0
    language: str = "hi-IN"
    timestamp: Optional[datetime] = None


class WinBackOffer(BaseModel):
    offered: bool = False
    discount_pct: int = 0  # Hard guardrail <= 20%
    promo_code: Optional[str] = None
    original_amount: float = 0.0
    discounted_amount: float = 0.0
    valid_until: Optional[datetime] = None
    status: str = "none"  # "none" | "pending_approval" | "offered" | "accepted" | "rejected" | "expired"
    requires_human_approval: bool = False
    approved_by_admin: Optional[str] = None


class RecoveryCaseModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    case_id: str  # e.g., REC-2026-0042
    user_id: str
    user_name: str
    user_email: str
    user_phone: Optional[str] = None

    # Subscription / Payment Context
    subscription_id: Optional[str] = None
    order_id: Optional[str] = None
    payment_id: Optional[str] = None
    plan: str = "pro"  # "pro" | "premium" | "custom"
    amount: float = 299.0
    currency: str = "INR"
    renewal_date: Optional[datetime] = None

    # Failure details
    failure_reason: Optional[str] = None
    failure_code: Optional[str] = None  # "insufficient_funds", "card_expired", "user_cancelled", etc.
    failed_at: Optional[datetime] = None

    # Risk Scoring
    risk_score: int = 0  # 0 to 100
    risk_level: RiskLevel = RiskLevel.LOW
    risk_factors: List[str] = Field(default_factory=list)
    explanation: Optional[str] = None

    # Strategy & Execution
    selected_strategy: RecoveryStrategy = RecoveryStrategy.MONITOR
    selected_channel: RecoveryChannel = RecoveryChannel.NONE
    status: RecoveryStatus = RecoveryStatus.AT_RISK
    attempt_count: int = 0
    max_attempts: int = 3
    next_retry_at: Optional[datetime] = None
    last_contacted_at: Optional[datetime] = None
    recovered_at: Optional[datetime] = None

    # Human-In-The-Loop
    human_review_required: bool = False
    human_review_reason: Optional[str] = None
    assigned_admin_id: Optional[str] = None

    # Offer & Channels
    offer: WinBackOffer = Field(default_factory=WinBackOffer)
    voice_data: VoiceRecoveryData = Field(default_factory=VoiceRecoveryData)
    message_subject: Optional[str] = None
    message_content: Optional[str] = None

    # Explainability & Audit
    agent_reasoning: Optional[str] = None
    audit_trail: List[AuditLogEntry] = Field(default_factory=list)

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
