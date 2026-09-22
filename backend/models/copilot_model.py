"""
CareerShala AI Copilot v2 Document Models & Typed Schemas
=========================================================
MongoDB schemas and Pydantic validation models for:
- copilot_sessions: conversation threads with metadata and token accounting
- copilot_messages: transcript items with role, cards, citations, and feedback
- copilot_memory: durable user facts learned by the agent (max 40/user, LRU)
- SSE event protocol payloads and API request/response structures.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class CopilotSessionModel(BaseModel):
    """
    Represents an ongoing or archived conversation thread.
    Scoped strictly by tenant_id + user_id.
    """
    id: Optional[str] = Field(default=None, alias="_id")
    tenant_id: str = Field(default="default", description="Multi-tenant organization partition identifier")
    user_id: str = Field(..., description="Owner user ID")
    title: str = Field(default="New Conversation", description="Thread title, LLM-generated or user edited")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_message_preview: Optional[str] = Field(default=None, description="Truncated preview of last message")
    message_count: int = Field(default=0, description="Total messages in thread")
    pinned: bool = Field(default=False, description="Whether pinned to top of thread list")
    archived: bool = Field(default=False, description="Whether archived by user")
    total_tokens: int = Field(default=0, description="Cumulative token count for session")
    total_cost_usd: float = Field(default=0.0, description="Estimated USD cost for session")
    deleted_at: Optional[datetime] = Field(default=None, description="Soft-delete timestamp")

    model_config = ConfigDict(
        populate_by_name=True,
        protected_namespaces=(),
    )


class CopilotMessageModel(BaseModel):
    """
    A single conversational turn (user prompt, assistant answer, or tool execution).
    """
    id: Optional[str] = Field(default=None, alias="_id")
    session_id: str = Field(..., description="ID of parent copilot_sessions record")
    tenant_id: str = Field(default="default", description="Multi-tenant organization identifier")
    user_id: str = Field(..., description="User ID for audit and ownership checks")
    role: Literal["user", "assistant", "tool", "system"] = Field(..., description="Message role")
    content: str = Field(default="", description="Text content or markdown answer")
    ui_cards: List[Dict[str, Any]] = Field(default_factory=list, description="Generative UI card directives")
    citations: List[Dict[str, Any]] = Field(default_factory=list, description="Grounded citations to sources")
    tool_calls: List[Dict[str, Any]] = Field(default_factory=list, description="Tool calls executed during turn")
    model_used: Optional[str] = Field(default=None, description="LLM model identifier")
    provider_used: Optional[str] = Field(default=None, description="LLM provider name (groq, gemini, etc.)")
    latency_ms: Optional[int] = Field(default=None, description="End-to-end generation latency in milliseconds")
    prompt_tokens: int = Field(default=0, description="Tokens used for prompt")
    completion_tokens: int = Field(default=0, description="Tokens generated in completion")
    feedback: Optional[Literal["up", "down"]] = None
    feedback_note: Optional[str] = Field(default=None, description="User feedback note or reason")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        protected_namespaces=(),
    )


class CopilotMemoryModel(BaseModel):
    """
    Durable user facts learned by the copilot (e.g. goals, preferences, deadlines).
    Max 40 entries per user with LRU eviction.
    """
    id: Optional[str] = Field(default=None, alias="_id")
    tenant_id: str = Field(default="default", description="Multi-tenant organization identifier")
    user_id: str = Field(..., description="User ID owning this memory fact")
    key: str = Field(..., description="Normalized memory key / aspect identifier")
    value: str = Field(..., description="Extracted fact or preference value")
    source_message_id: Optional[str] = Field(default=None, description="Originating message ID")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        protected_namespaces=(),
    )


# ─── API Payloads & Responses ──────────────────────────────────────────────────

class CreateSessionPayload(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120, description="Optional initial session title")


class UpdateSessionPayload(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120, description="Updated session title")
    pinned: Optional[bool] = Field(default=None, description="Set pinned state")
    archived: Optional[bool] = Field(default=None, description="Set archived state")


class MessageFeedbackPayload(BaseModel):
    feedback: Literal["up", "down"] = Field(..., description="Thumbs up or down")
    note: Optional[str] = Field(default=None, max_length=1000, description="Optional feedback note")


class CopilotV2ChatPayload(BaseModel):
    message: str = Field(..., min_length=1, description="Current user query")
    session_id: Optional[str] = Field(default=None, description="Existing session ID to continue")
    history: List[Dict[str, Any]] = Field(default_factory=list, description="Recent client history fallback")
    quick_action: Optional[str] = Field(default=None, description="Optional quick action key")
    force_refresh: bool = False


class MigrateLocalPayload(BaseModel):
    messages: List[Dict[str, Any]] = Field(..., description="Legacy localStorage history items to migrate")
