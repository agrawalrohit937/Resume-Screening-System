"""
Tenant Scoped Repository Layer — Enforces Mathematical Multi-Tenant Data Isolation (PostgreSQL).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import structlog

from services.multi_tenancy.tenant_context import (
    TenantAccessDeniedError,
    get_current_tenant_id,
    is_platform_admin,
)

logger = structlog.get_logger(__name__)

TENANT_SCOPED_TABLES = {
    "jobs", "resumes", "applications", "ats_results", "requisitions",
    "interview_kits", "scorecards", "talent_crm", "talent_pools",
    "eeo_vault", "webhook_subscriptions", "audit_logs", "offers",
    "pipeline_events", "copilot_sessions"
}
TENANT_SCOPED_COLLECTIONS = TENANT_SCOPED_TABLES


def apply_tenant_filter(stmt: Any, model: Any, tenant_id: Optional[str] = None) -> Any:
    """Enforces strict tenant partitioning on SQLAlchemy select/update/delete statements."""
    if is_platform_admin() and not tenant_id:
        return stmt
    tid = tenant_id or get_current_tenant_id()
    if hasattr(model, "tenant_id"):
        return stmt.where(model.tenant_id == str(tid))
    return stmt


class TenantScopedRepository:
    """Multi-tenant isolation wrapper for database tables and queries."""
    def __init__(self, raw_repo: Any = None, tenant_id: Optional[str] = None):
        self._raw = raw_repo
        self._fixed_tenant_id = tenant_id

    def _resolve_tenant(self) -> str:
        return self._fixed_tenant_id or get_current_tenant_id()

    def _scope_query(self, query: Dict[str, Any]) -> Dict[str, Any]:
        if is_platform_admin():
            return dict(query)
        tid = self._resolve_tenant()
        if "tenant_id" in query and query["tenant_id"] != tid:
            raise TenantAccessDeniedError(f"Cross-tenant query rejected: {query['tenant_id']} != {tid}")
        scoped = dict(query)
        scoped["tenant_id"] = tid
        return scoped

    def _scope_doc(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        if is_platform_admin():
            return dict(doc)
        tid = self._resolve_tenant()
        if "tenant_id" in doc and doc["tenant_id"] != tid:
            raise TenantAccessDeniedError(f"Cross-tenant payload rejected: {doc['tenant_id']} != {tid}")
        scoped = dict(doc)
        scoped["tenant_id"] = tid
        return scoped

    def filter(self, stmt: Any, model: Any) -> Any:
        return apply_tenant_filter(stmt, model, self._resolve_tenant())

    async def get(self, filter_query: Dict[str, Any], *args, **kwargs) -> Optional[Dict[str, Any]]:
        scoped_q = self._scope_query(filter_query)
        if self._raw and hasattr(self._raw, "get"):
            return await self._raw.get(scoped_q, *args, **kwargs)
        return None

    async def add(self, doc: Dict[str, Any], *args, **kwargs) -> Any:
        scoped_doc = self._scope_doc(doc)
        if self._raw and hasattr(self._raw, "add"):
            return await self._raw.add(scoped_doc, *args, **kwargs)
        return None

    async def count(self, filter_query: Optional[Dict[str, Any]] = None, *args, **kwargs) -> int:
        scoped_q = self._scope_query(filter_query or {})
        if self._raw and hasattr(self._raw, "count"):
            return await self._raw.count(scoped_q, *args, **kwargs)
        return 0

    async def delete(self, filter_query: Dict[str, Any], *args, **kwargs) -> Any:
        scoped_q = self._scope_query(filter_query)
        if self._raw and hasattr(self._raw, "delete"):
            return await self._raw.delete(scoped_q, *args, **kwargs)
        return None


TenantScopedCollection = TenantScopedRepository
TenantScopedDatabase = TenantScopedRepository
