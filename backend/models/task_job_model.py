"""
Task Job Model — Schema for Asynchronous Background Job Execution & Polling.
=============================================================================
Tracks asynchronous jobs (resume processing, batch scoring, memory compaction)
with multi-tenant isolation, live progress tracking, and retry lifecycle state.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from bson import ObjectId


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class JobType(str, Enum):
    RESUME_PARSE_EMBED = "resume_parse_embed"
    BATCH_ATS_SCORING = "batch_ats_scoring"
    COPILOT_LRU_EVICTION = "copilot_lru_eviction"
    BULK_RESCORE = "bulk_rescore"


class TaskJobModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    job_id: str
    tenant_id: str = "default"
    user_id: Optional[str] = None
    type: JobType
    status: JobStatus = JobStatus.QUEUED
    progress: int = Field(default=0, ge=0, le=100)
    stage_message: Optional[str] = None
    result_ref: Optional[Dict[str, Any]] = None
    retry_count: int = Field(default=0, ge=0)
    max_retries: int = Field(default=3)
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
