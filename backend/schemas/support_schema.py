"""
Support Ticket Schemas.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class TicketAttachment(BaseModel):
    filename: str
    url: str
    public_id: Optional[str] = None
    content_type: str = "application/octet-stream"
    size_bytes: Optional[int] = None
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TicketMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: str = "user"
    body: str
    attachments: List[TicketAttachment] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    author_name: Optional[str] = None


class TicketStatusChange(BaseModel):
    status: str
    changed_by: Optional[str] = None
    changed_by_role: Optional[str] = None
    changed_by_name: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SupportTicketModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    ticket_id: str
    user_id: str
    email: str
    category: str
    subcategory: Optional[str] = None
    subject: str
    description: str
    priority: str = "low"
    status: str = "open"
    status_history: List[TicketStatusChange] = Field(default_factory=list)
    attachments: List[TicketAttachment] = Field(default_factory=list)
    messages: List[TicketMessage] = Field(default_factory=list)
    browser: Optional[str] = None
    os: Optional[str] = None
    route: Optional[str] = None
    current_url: Optional[str] = None
    app_version: Optional[str] = None
    login_provider: Optional[str] = None
    plan: Optional[str] = None
    subscription_active: Optional[bool] = None
    billing_data: Optional[Dict[str, Any]] = Field(default_factory=dict)
    bug_data: Optional[Dict[str, Any]] = Field(default_factory=dict)
    console_errors: Optional[List[str]] = Field(default_factory=list)
    screen_resolution: Optional[str] = None
    device: Optional[str] = None
    frontend_version: Optional[str] = None
    backend_version: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

