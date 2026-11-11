"""
Cron Run & Job Alert Delivery Schemas.
"""

from __future__ import annotations
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CronRunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"
    SKIPPED = "skipped"


class DeliveryStatus(str, Enum):
    PENDING = "PENDING"
    CLAIMED = "CLAIMED"
    DELIVERED = "DELIVERED"
    FAILED_TRANSIENT = "FAILED_TRANSIENT"
    FAILED_PERMANENT = "FAILED_PERMANENT"
    UNCERTAIN = "UNCERTAIN"


class CronJobRunModel(BaseModel):
    """Domain Model for scheduled cron job batch tracking."""
    id: Optional[str] = Field(default=None, alias="_id")
    job_name: str = Field(default="job_alerts", description="Identifier of the cron task")
    slot_id: str = Field(..., description="Deterministic slot string e.g. 2026-10-03_07:30")
    slot_type: str = Field(default="morning", description="Slot type: 'morning' or 'afternoon' or 'manual'")
    status: CronRunStatus = Field(default=CronRunStatus.RUNNING)
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    candidates_scanned: int = 0
    candidates_claimed: int = 0
    emails_delivered: int = 0
    emails_uncertain: int = 0
    emails_failed_permanent: int = 0
    retries_count: int = 0
    triggered_by: str = Field(default="scheduler")
    sample_deliveries: List[Dict[str, Any]] = Field(default_factory=list)
    error_summary: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class JobAlertDeliveryModel(BaseModel):
    """Domain Model for atomic per-candidate per-slot email claims."""
    id: Optional[str] = Field(default=None, alias="_id")
    candidate_id: str
    slot_id: str
    email: str
    status: DeliveryStatus = Field(default=DeliveryStatus.CLAIMED)
    matched_job_ids: List[str] = Field(default_factory=list)
    brevo_message_id: Optional[str] = None
    attempt_count: int = 1
    claimed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    delivered_at: Optional[datetime] = None
    error: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


async def ensure_cron_indexes(db: Any = None) -> None:
    pass

