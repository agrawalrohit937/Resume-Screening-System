"""
Audit Log API Router — Compliance and Security Event Querying.
==============================================================
Provides strictly scoped, paginated audit log queries for compliance officers,
tenant executives, and platform administrators.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from api.deps import get_database, get_current_user, PaginationParams
from core.rbac import Permission, check_rbac_access
from models.user_model import UserModel
from models.audit_log_model import AuditLogModel
from repositories.audit_log_repo import AuditLogRepository

logger = structlog.get_logger(__name__)
router = APIRouter()


class AuditLogResponse(BaseModel):
    items: List[AuditLogModel]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


@router.get("", response_model=AuditLogResponse)
@router.get("/", response_model=AuditLogResponse)
async def list_audit_logs(
    actor_id: Optional[str] = Query(None, description="Filter by actor ID"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    action: Optional[str] = Query(None, description="Filter by action code"),
    resource_id: Optional[str] = Query(None, description="Filter by resource ID"),
    start_time: Optional[datetime] = Query(None, description="Filter records starting at ISO timestamp"),
    end_time: Optional[datetime] = Query(None, description="Filter records ending at ISO timestamp"),
    tenant_override: Optional[str] = Query(None, alias="tenant_id", description="Platform Admin only: filter by tenant ID"),
    pagination: PaginationParams = Depends(),
    current_user: UserModel = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Retrieves compliance audit logs with strict tenant isolation and filtering.
    """
    # Verify RBAC permission for reading audit logs
    user_roles = [r.value if hasattr(r, "value") else str(r).lower() for r in (current_user.roles or [current_user.role])]
    is_admin = "platform_admin" in user_roles or "admin" in user_roles
    is_executive = "executive" in user_roles or "exec" in user_roles

    if not is_admin and not is_executive:
        try:
            check_rbac_access(user_roles, Permission.AUDIT_LOG_READ)
        except HTTPException:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: AUDIT_LOG_READ permission or Executive/Admin role required.",
            )

    # Clean Query parameter objects when invoked directly in tests
    from fastapi.params import Query as QueryParam
    actor_id = None if isinstance(actor_id, QueryParam) else actor_id
    resource_type = None if isinstance(resource_type, QueryParam) else resource_type
    action = None if isinstance(action, QueryParam) else action
    resource_id = None if isinstance(resource_id, QueryParam) else resource_id
    start_time = None if isinstance(start_time, QueryParam) else start_time
    end_time = None if isinstance(end_time, QueryParam) else end_time
    tenant_override = None if isinstance(tenant_override, QueryParam) else tenant_override

    # Determine tenant scoping
    if is_admin and tenant_override:
        target_tenant = tenant_override
    elif is_admin and not tenant_override:
        target_tenant = current_user.tenant_id or "*"
    else:
        target_tenant = current_user.tenant_id or "default"

    repo = AuditLogRepository(db)
    items, total = await repo.query_logs(
        tenant_id=target_tenant,
        actor_id=actor_id,
        resource_type=resource_type,
        action=action,
        resource_id=resource_id,
        start_time=start_time,
        end_time=end_time,
        skip=pagination.skip,
        limit=pagination.page_size,
    )

    meta = pagination.to_response_meta(total)
    return AuditLogResponse(
        items=items,
        total=total,
        page=meta["page"],
        page_size=meta["page_size"],
        total_pages=meta["total_pages"],
        has_next=meta["has_next"],
        has_prev=meta["has_prev"],
    )
