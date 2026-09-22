"""
Multi-Tenancy Package — Data Isolation & Context Management.
"""

from services.multi_tenancy.tenant_context import (
    TenantAccessDeniedError,
    clear_tenant_id,
    get_current_tenant_id,
    set_current_tenant_id,
    tenant_context,
)
from services.multi_tenancy.tenant_repository import TenantScopedRepository

__all__ = [
    "TenantAccessDeniedError",
    "get_current_tenant_id",
    "set_current_tenant_id",
    "clear_tenant_id",
    "tenant_context",
    "TenantScopedRepository",
]
