"""
Audit Log Model — Schema for Compliance-Grade Immutable Platform Action Audits.
================================================================================
Defines tamper-evident, append-only audit event records across all platform
domains (candidate lifecycle, ATS scoring replay, offer approvals, RBAC updates).
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from uuid import uuid4
from pydantic import BaseModel, Field
from bson import ObjectId


class AuditAction(str, Enum):
    # Candidate / Application Pipeline
    CANDIDATE_STAGE_CHANGED = "candidate.stage_changed"
    CANDIDATE_TAG_ADDED = "candidate.tag_added"
    CANDIDATE_NOTE_ADDED = "candidate.note_added"
    CANDIDATE_REJECTED = "candidate.rejected"
    CANDIDATE_HIRED = "candidate.hired"

    # ATS & Scoring Replay
    ATS_MATCH_EXECUTED = "ats.match_executed"
    ATS_BATCH_SCORED = "ats.batch_scored"
    ATS_DECISION_OVERRIDE = "ats.decision_override"

    # Offers & Requisitions
    OFFER_CREATED = "offer.created"
    OFFER_SENT = "offer.sent"
    OFFER_APPROVED = "offer.approved"
    OFFER_ACCEPTED = "offer.accepted"
    OFFER_DECLINED = "offer.declined"

    # Access Control & RBAC
    RBAC_ROLE_ASSIGNED = "rbac.role_assigned"
    RBAC_PERMISSIONS_MODIFIED = "rbac.permissions_modified"
    USER_INVITED = "user.invited"
    USER_SUSPENDED = "user.suspended"

    # Auth & Sessions
    AUTH_LOGIN = "auth.login"
    AUTH_LOGOUT = "auth.logout"
    AUTH_FAILED_LOGIN = "auth.failed_login"
    AUTH_PASSWORD_RESET = "auth.password_reset"

    # AI Copilot & Automated Agents
    COPILOT_TOOL_EXECUTED = "copilot.tool_executed"
    COPILOT_SESSION_STARTED = "copilot.session_started"


class AuditResourceType(str, Enum):
    CANDIDATE = "candidate"
    APPLICATION = "application"
    JOB = "job"
    ATS_RESULT = "ats_result"
    OFFER = "offer"
    USER = "user"
    TENANT = "tenant"
    COPILOT_SESSION = "copilot_session"
    SYSTEM = "system"


class AuditLogModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    event_id: str = Field(default_factory=lambda: f"evt_{uuid4().hex[:16]}")
    tenant_id: str = "default"
    actor_id: str = "system"
    actor_email: Optional[str] = None
    actor_role: str = "system"
    action: str
    resource_type: str
    resource_id: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
