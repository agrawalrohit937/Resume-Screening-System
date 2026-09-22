"""
Copilot Tool Execution Context
==============================
Carries all user, tenant, repository, and session context required for tool execution.
"""

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Optional, Awaitable


@dataclass
class ToolExecutionContext:
    tenant_id: str
    user_id: str
    user_name: str
    trace_id: str
    session_id: str
    db: Any
    resume_repo: Any = None
    result_repo: Any = None
    copilot_repo: Any = None
    emit_event: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None
