"""
Cron Run & Job Alert Delivery Models — Structured Audit & State Tracking.
========================================================================
Persists:
1. `cron_job_runs`: Batch-level execution records keyed by deterministic slot_id.
2. `job_alert_deliveries`: Per-candidate, per-slot atomic claim & delivery states.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


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
    """MongoDB document model for scheduled cron job batch tracking."""
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
    triggered_by: str = Field(default="scheduler", description="'scheduler' | 'recovery_on_startup' | 'manual_admin_api'")
    sample_deliveries: List[Dict[str, Any]] = Field(default_factory=list)
    error_summary: Optional[str] = None


class JobAlertDeliveryModel(BaseModel):
    """MongoDB document model for atomic per-candidate per-slot email claims."""
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


async def ensure_cron_indexes(db: Any) -> None:
    """Ensures required unique and query indexes exist on cron audit collections."""
    try:
        if db is None:
            return
        # Unique slot index for batch-level anti-replay
        await db.cron_job_runs.create_index([("slot_id", 1), ("job_name", 1)], unique=True)
        await db.cron_job_runs.create_index([("started_at", -1)])

        # Unique compound index for per-candidate per-slot atomic claim
        await db.job_alert_deliveries.create_index([("candidate_id", 1), ("slot_id", 1)], unique=True)
        await db.job_alert_deliveries.create_index([("slot_id", 1), ("status", 1)])
        await db.job_alert_deliveries.create_index([("claimed_at", 1)])
    except Exception:
        # Gracefully tolerate index creation conflicts if already initialized
        pass
