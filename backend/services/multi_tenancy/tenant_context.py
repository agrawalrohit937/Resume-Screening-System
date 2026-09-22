"""
Multi-Tenancy Context & Isolation Layer for CareerPilot ATS.

Phase 5, Task 5.1:
Provides contextvars-driven tenant scoping, ensuring every database operation,
log entry, and repository call is strictly isolated to the authenticated organization.
"""

from __future__ import annotations

import contextvars
from contextlib import contextmanager
from typing import Optional

import structlog

logger = structlog.get_logger(__name__)

# Default tenant context variable
_current_tenant_ctx: contextvars.ContextVar[str] = contextvars.ContextVar(
    "current_tenant_id", default="default"
)

# Root Platform Admin exemption flag (only role exempt from tenant filter)
_is_platform_admin_ctx: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "is_platform_admin", default=False
)


class TenantAccessDeniedError(PermissionError):
    """Raised when a cross-tenant data access or mutation attempt is detected."""
    pass


def get_current_tenant_id() -> str:
    """Retrieves the active tenant ID from the current async execution context."""
    return _current_tenant_ctx.get()


def set_current_tenant_id(tenant_id: Optional[str] = None) -> str:
    """Sets the active tenant ID in the current execution context."""
    tid = (tenant_id or "default").strip() or "default"
    _current_tenant_ctx.set(tid)
    try:
        structlog.contextvars.bind_contextvars(tenant_id=tid)
    except Exception:
        pass
    return tid


def is_platform_admin() -> bool:
    """Returns True if the active execution context has root PLATFORM_ADMIN privileges."""
    return _is_platform_admin_ctx.get()


def set_platform_admin(is_admin: bool = True) -> bool:
    """Sets whether the current context possesses root PLATFORM_ADMIN tenant bypass."""
    _is_platform_admin_ctx.set(bool(is_admin))
    return bool(is_admin)


def clear_platform_admin() -> None:
    """Clears root PLATFORM_ADMIN tenant bypass flag."""
    _is_platform_admin_ctx.set(False)


def clear_tenant_id() -> None:
    """Resets the tenant context to the default tenant and clears platform admin bypass."""
    _current_tenant_ctx.set("default")
    _is_platform_admin_ctx.set(False)
    try:
        structlog.contextvars.unbind_contextvars("tenant_id")
    except Exception:
        pass


clear_current_tenant_id = clear_tenant_id


@contextmanager
def tenant_context(tenant_id: Optional[str] = None):
    """
    Context manager that guarantees all operations inside the block execute
    under the specified tenant scope, resetting to previous scope on exit.
    """
    previous_tid = get_current_tenant_id()
    tid = set_current_tenant_id(tenant_id)
    try:
        yield tid
    finally:
        set_current_tenant_id(previous_tid)


@contextmanager
def platform_admin_context(is_admin: bool = True):
    """
    Context manager granting or revoking PLATFORM_ADMIN tenant exemption for the block.
    """
    prev = is_platform_admin()
    set_platform_admin(is_admin)
    try:
        yield is_admin
    finally:
        set_platform_admin(prev)
