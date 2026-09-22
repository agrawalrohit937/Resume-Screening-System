"""
Granular Role-Based Access Control (RBAC) & Capabilities Matrix.

Phase 5, Task 5.1:
Defines fine-grained permission tokens and maps them across the expanded enterprise roles:
Admin, Executive (Read-only), Recruiter, Hiring Manager, Coordinator, Interviewer, Candidate.
"""

from __future__ import annotations

from enum import Enum
from typing import Dict, FrozenSet, List, Set, Union
from fastapi import HTTPException, status

from models.user_model import UserRole


class Permission(str, Enum):
    # Jobs
    JOBS_READ = "jobs:read"
    JOBS_WRITE = "jobs:write"
    JOBS_DELETE = "jobs:delete"

    # Applications & Pipeline
    APPLICATIONS_READ = "applications:read"
    APPLICATIONS_SCORE = "applications:score"
    APPLICATIONS_STAGE_UPDATE = "applications:stage_update"

    # Interviews & Scorecards
    INTERVIEWS_SCHEDULE = "interviews:schedule"
    INTERVIEWS_SUBMIT_SCORECARD = "interviews:submit_scorecard"

    # Requisitions & Approvals
    REQUISITIONS_CREATE = "requisitions:create"
    REQUISITIONS_APPROVE = "requisitions:approve"

    # Talent CRM & Pools
    TALENT_CRM_ACCESS = "talent_crm:access"
    TALENT_POOLS_SEARCH = "talent_pools:search"

    # System & Audit
    AUDIT_LOG_READ = "audit_log:read"
    SETTINGS_MANAGE = "settings:manage"


# Granular permission mapping per enterprise role
ROLE_PERMISSIONS_MAP: Dict[str, FrozenSet[str]] = {
    UserRole.PLATFORM_ADMIN.value: frozenset(p.value for p in Permission),
    UserRole.ADMIN.value: frozenset(p.value for p in Permission),
    # Company founder / owner inherits all permissions within their tenant
    UserRole.EXECUTIVE.value: frozenset(p.value for p in Permission),
    # Legacy read-only executive role (C-suite reporting)
    UserRole.EXEC.value: frozenset({
        Permission.JOBS_READ.value,
        Permission.APPLICATIONS_READ.value,
        Permission.AUDIT_LOG_READ.value,
    }),
    UserRole.RECRUITER.value: frozenset({
        Permission.JOBS_READ.value,
        Permission.JOBS_WRITE.value,
        Permission.APPLICATIONS_READ.value,
        Permission.APPLICATIONS_SCORE.value,
        Permission.APPLICATIONS_STAGE_UPDATE.value,
        Permission.INTERVIEWS_SCHEDULE.value,
        Permission.TALENT_CRM_ACCESS.value,
        Permission.TALENT_POOLS_SEARCH.value,
        Permission.REQUISITIONS_CREATE.value,
    }),
    UserRole.HIRING_MANAGER.value: frozenset({
        Permission.JOBS_READ.value,
        Permission.APPLICATIONS_READ.value,
        Permission.APPLICATIONS_SCORE.value,
        Permission.INTERVIEWS_SUBMIT_SCORECARD.value,
        Permission.REQUISITIONS_CREATE.value,
        Permission.REQUISITIONS_APPROVE.value,
    }),
    UserRole.COORDINATOR.value: frozenset({
        Permission.JOBS_READ.value,
        Permission.APPLICATIONS_READ.value,
        Permission.INTERVIEWS_SCHEDULE.value,
    }),
    UserRole.INTERVIEWER.value: frozenset({
        Permission.JOBS_READ.value,
        Permission.APPLICATIONS_READ.value,
        Permission.INTERVIEWS_SUBMIT_SCORECARD.value,
    }),
    UserRole.CANDIDATE.value: frozenset({
        Permission.JOBS_READ.value,
    }),
}


def get_role_permissions(role: Union[UserRole, str]) -> FrozenSet[str]:
    """Retrieves all granted permissions for a given user role."""
    r_val = role.value if isinstance(role, UserRole) else str(role).lower()
    return ROLE_PERMISSIONS_MAP.get(r_val, frozenset())


def get_user_combined_permissions(roles: Union[List[Union[UserRole, str]], UserRole, str]) -> FrozenSet[str]:
    """Aggregates all granted permissions across an array of roles."""
    if isinstance(roles, (UserRole, str)):
        return get_role_permissions(roles)
    combined: Set[str] = set()
    for r in roles:
        combined.update(get_role_permissions(r))
    return frozenset(combined)


def has_permission(role: Union[UserRole, str], permission: Union[Permission, str]) -> bool:
    """Verifies whether a single user role possesses a specific permission token."""
    perm_val = permission.value if isinstance(permission, Permission) else str(permission)
    return perm_val in get_role_permissions(role)


def has_any_permission(roles: Union[List[Union[UserRole, str]], UserRole, str], permission: Union[Permission, str]) -> bool:
    """Verifies whether a user's combined roles possess a specific permission token."""
    perm_val = permission.value if isinstance(permission, Permission) else str(permission)
    return perm_val in get_user_combined_permissions(roles)


def check_rbac_access(
    user_role_or_roles: Union[List[Union[UserRole, str]], UserRole, str],
    required_permission: Union[Permission, str],
) -> None:
    """
    Raises HTTP 403 Forbidden if the user's role(s) lack the required permission.
    """
    if not has_any_permission(user_role_or_roles, required_permission):
        perm_str = required_permission.value if isinstance(required_permission, Permission) else str(required_permission)
        roles_str = user_role_or_roles.value if isinstance(user_role_or_roles, UserRole) else str(user_role_or_roles)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Role '{roles_str}' lacks permission '{perm_str}'.",
        )
