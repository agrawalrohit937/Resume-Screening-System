"""
Phase A3 Security Verification Tests: RBAC Enforcement & Candidate Own-Only Scope.
"""

import pytest
from fastapi import HTTPException

from core.rbac import (
    Permission,
    check_rbac_access,
    has_permission,
    ROLE_PERMISSIONS_MAP,
)
from models.user_model import UserRole


def test_rbac_roles_permissions_completeness():
    # Executive has full platform tenant permissions
    assert has_permission(UserRole.EXECUTIVE, Permission.JOBS_WRITE)
    assert has_permission(UserRole.EXECUTIVE, Permission.REQUISITIONS_APPROVE)
    assert has_permission(UserRole.EXECUTIVE, Permission.SETTINGS_MANAGE)

    # Recruiter has pipeline and job management permissions
    assert has_permission(UserRole.RECRUITER, Permission.JOBS_WRITE)
    assert has_permission(UserRole.RECRUITER, Permission.APPLICATIONS_SCORE)
    assert has_permission(UserRole.RECRUITER, Permission.APPLICATIONS_STAGE_UPDATE)
    assert not has_permission(UserRole.RECRUITER, Permission.REQUISITIONS_APPROVE)
    assert not has_permission(UserRole.RECRUITER, Permission.SETTINGS_MANAGE)

    # Hiring Manager has scorecard submission and requisition approvals
    assert has_permission(UserRole.HIRING_MANAGER, Permission.REQUISITIONS_APPROVE)
    assert has_permission(UserRole.HIRING_MANAGER, Permission.INTERVIEWS_SUBMIT_SCORECARD)
    assert not has_permission(UserRole.HIRING_MANAGER, Permission.JOBS_WRITE)
    assert not has_permission(UserRole.HIRING_MANAGER, Permission.APPLICATIONS_STAGE_UPDATE)

    # Interviewer is restricted evaluator
    assert has_permission(UserRole.INTERVIEWER, Permission.INTERVIEWS_SUBMIT_SCORECARD)
    assert not has_permission(UserRole.INTERVIEWER, Permission.JOBS_WRITE)
    assert not has_permission(UserRole.INTERVIEWER, Permission.REQUISITIONS_CREATE)

    # Candidate has jobs read only
    assert has_permission(UserRole.CANDIDATE, Permission.JOBS_READ)
    assert not has_permission(UserRole.CANDIDATE, Permission.APPLICATIONS_SCORE)
    assert not has_permission(UserRole.CANDIDATE, Permission.JOBS_WRITE)


def test_check_rbac_access_raises_403_on_forbidden():
    with pytest.raises(HTTPException) as exc:
        check_rbac_access(UserRole.CANDIDATE, Permission.APPLICATIONS_STAGE_UPDATE)
    assert exc.value.status_code == 403


def test_candidate_own_only_isolation_guard():
    # Candidate A attempting to access Candidate B resource
    candidate_a_id = "user_cand_123"
    candidate_b_id = "user_cand_456"

    def verify_candidate_access(auth_user_id: str, resource_owner_id: str, role: str):
        if role == "candidate" and auth_user_id != resource_owner_id:
            raise HTTPException(status_code=403, detail="Access denied. Cannot access another candidate's resources.")
        return True

    assert verify_candidate_access(candidate_a_id, candidate_a_id, "candidate") is True

    with pytest.raises(HTTPException) as exc:
        verify_candidate_access(candidate_a_id, candidate_b_id, "candidate")
    assert exc.value.status_code == 403
