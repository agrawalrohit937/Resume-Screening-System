"""
MongoDB Document Model — Support Tickets
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from bson import ObjectId


class TicketAttachment(BaseModel):
    filename: str
    url: str
    public_id: Optional[str] = None
    content_type: str = "application/octet-stream"
    size_bytes: Optional[int] = None
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TicketMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    role: str = "user"  # "user" | "support" | "system"
    body: str
    attachments: List[TicketAttachment] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    author_name: Optional[str] = None


class SupportTicketModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")

    # Core fields
    ticket_id: str  # Human-readable: CS-2026-001245
    user_id: str
    email: str
    category: str  # "billing" | "account" | "resume" | "ai_features" | "bug" | "feature_request" | "other"
    subcategory: Optional[str] = None  # e.g. "upgrade_plan", "password_reset"
    subject: str
    description: str
    priority: str = "low"  # "low" | "medium" | "high" | "critical"

    # Status
    status: str = "open"  # "open" | "in_progress" | "waiting_for_customer" | "resolved" | "closed"

    # Attachments
    attachments: List[TicketAttachment] = Field(default_factory=list)

    # Conversation timeline
    messages: List[TicketMessage] = Field(default_factory=list)

    # Auto-collected metadata
    browser: Optional[str] = None
    os: Optional[str] = None
    route: Optional[str] = None
    current_url: Optional[str] = None
    app_version: Optional[str] = None
    login_provider: Optional[str] = None
    plan: Optional[str] = None
    subscription_active: Optional[bool] = None

    # Billing integration data
    billing_data: Optional[Dict[str, Any]] = Field(default_factory=dict)

    # Bug report data
    bug_data: Optional[Dict[str, Any]] = Field(default_factory=dict)
    console_errors: Optional[List[str]] = Field(default_factory=list)
    screen_resolution: Optional[str] = None
    device: Optional[str] = None
    frontend_version: Optional[str] = None
    backend_version: Optional[str] = None

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

