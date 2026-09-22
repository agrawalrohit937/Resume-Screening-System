"""
Unit tests for Task 5.1: Multi-Tenancy & Granular RBAC.
Validates strict repository tenant isolation (cross-tenant read impossible)
and enterprise RBAC capabilities matrix.
"""

from __future__ import annotations

import pytest
from bson import ObjectId
from fastapi import HTTPException

from core.rbac import (
    Permission,
    check_rbac_access,
    get_role_permissions,
    has_permission,
)
from models.user_model import UserRole
from services.multi_tenancy import (
    TenantAccessDeniedError,
    TenantScopedRepository,
    clear_tenant_id,
    get_current_tenant_id,
    set_current_tenant_id,
    tenant_context,
)


class MockMongoCollection:
    """In-memory mock collection that models MongoDB find, insert, update, delete."""
    def __init__(self):
        self.docs: list[dict] = []

    async def insert_one(self, doc: dict):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = ObjectId()
        self.docs.append(d)
        class Res:
            inserted_id = d["_id"]
        return Res()

    async def find_one(self, filter_query: dict, projection=None):
        for d in self.docs:
            match = True
            for k, v in filter_query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                return dict(d)
        return None

    def find(self, filter_query: dict, projection=None):
        matching = []
        for d in self.docs:
            match = True
            for k, v in filter_query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                matching.append(dict(d))
        return matching

    async def update_one(self, filter_query: dict, update_query: dict, upsert=False):
        matched = 0
        for d in self.docs:
            match = True
            for k, v in filter_query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                matched += 1
                if "$set" in update_query:
                    d.update(update_query["$set"])
                break
        class Res:
            matched_count = matched
        return Res()

    async def delete_one(self, filter_query: dict):
        deleted = 0
        for i, d in enumerate(self.docs):
            match = True
            for k, v in filter_query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                self.docs.pop(i)
                deleted = 1
                break
        class Res:
            deleted_count = deleted
        return Res()

    async def count_documents(self, filter_query: dict):
        count = 0
        for d in self.docs:
            match = True
            for k, v in filter_query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                count += 1
        return count


# ══════════════════════════════════════════════════════════════════════════════
# 1. MULTI-TENANCY CONTEXT & REPOSITORY ISOLATION TESTS
# ══════════════════════════════════════════════════════════════════════════════

def test_tenant_context_scoping():
    clear_tenant_id()
    assert get_current_tenant_id() == "default"

    set_current_tenant_id("acme_corp")
    assert get_current_tenant_id() == "acme_corp"

    with tenant_context("globex_inc") as tid:
        assert tid == "globex_inc"
        assert get_current_tenant_id() == "globex_inc"

    # Reverts upon exiting context
    assert get_current_tenant_id() == "acme_corp"
    clear_tenant_id()
    assert get_current_tenant_id() == "default"


@pytest.mark.asyncio
async def test_cross_tenant_read_is_impossible():
    """
    CRITICAL TEST: Proves that an entity created in Tenant A can NEVER be
    read by Tenant B through the TenantScopedRepository.
    """
    mock_coll = MockMongoCollection()
    repo = TenantScopedRepository(mock_coll)

    # 1. Tenant Alpha creates job listing
    with tenant_context("tenant_alpha"):
        inserted = await repo.insert_one({
            "title": "Senior Backend Engineer",
            "department": "Infrastructure",
        })
        job_id = inserted.inserted_id

        # Tenant Alpha can find their own document
        alpha_doc = await repo.find_one({"_id": job_id})
        assert alpha_doc is not None
        assert alpha_doc["tenant_id"] == "tenant_alpha"
        assert alpha_doc["title"] == "Senior Backend Engineer"

    # 2. Tenant Beta attempts to read the same document by _id
    with tenant_context("tenant_beta"):
        beta_doc = await repo.find_one({"_id": job_id})
        # MATHEMATICAL GUARANTEE: Must be None!
        assert beta_doc is None

    # 3. Direct cross-tenant query injection raises TenantAccessDeniedError
    with tenant_context("tenant_beta"):
        with pytest.raises(TenantAccessDeniedError):
            await repo.find_one({"_id": job_id, "tenant_id": "tenant_alpha"})


@pytest.mark.asyncio
async def test_cross_tenant_mutations_and_counts():
    mock_coll = MockMongoCollection()
    repo = TenantScopedRepository(mock_coll)

    # Seed 3 documents in tenant_alpha and 2 in tenant_beta
    with tenant_context("tenant_alpha"):
        await repo.insert_one({"item": 1})
        await repo.insert_one({"item": 2})
        await repo.insert_one({"item": 3})

    with tenant_context("tenant_beta"):
        await repo.insert_one({"item": 10})
        await repo.insert_one({"item": 20})

    # Validate partitioned counts
    with tenant_context("tenant_alpha"):
        assert await repo.count_documents({}) == 3

    with tenant_context("tenant_beta"):
        assert await repo.count_documents({}) == 2

    # Cross-tenant delete does not affect other tenants
    with tenant_context("tenant_beta"):
        res = await repo.delete_one({"item": 1})  # Exists in alpha, not beta
        assert res.deleted_count == 0

    with tenant_context("tenant_alpha"):
        assert await repo.count_documents({}) == 3


# ══════════════════════════════════════════════════════════════════════════════
# 2. GRANULAR RBAC CAPABILITIES MATRIX TESTS
# ══════════════════════════════════════════════════════════════════════════════

def test_admin_role_has_full_permissions():
    perms = get_role_permissions(UserRole.ADMIN)
    assert len(perms) == len(Permission)
    assert has_permission(UserRole.ADMIN, Permission.SETTINGS_MANAGE)
    assert has_permission(UserRole.ADMIN, Permission.JOBS_DELETE)
    assert has_permission(UserRole.ADMIN, Permission.REQUISITIONS_APPROVE)


def test_exec_role_is_read_only():
    assert has_permission(UserRole.EXEC, Permission.JOBS_READ) is True
    assert has_permission(UserRole.EXEC, Permission.APPLICATIONS_READ) is True
    assert has_permission(UserRole.EXEC, Permission.AUDIT_LOG_READ) is True
    # Cannot mutate
    assert has_permission(UserRole.EXEC, Permission.JOBS_WRITE) is False
    assert has_permission(UserRole.EXEC, Permission.JOBS_DELETE) is False
    assert has_permission(UserRole.EXEC, Permission.APPLICATIONS_SCORE) is False


def test_recruiter_and_hiring_manager_differential():
    # Recruiter can manage jobs and candidate pipelines, but cannot approve requisitions
    assert has_permission(UserRole.RECRUITER, Permission.JOBS_WRITE) is True
    assert has_permission(UserRole.RECRUITER, Permission.APPLICATIONS_STAGE_UPDATE) is True
    assert has_permission(UserRole.RECRUITER, Permission.REQUISITIONS_APPROVE) is False

    # Hiring Manager can approve requisitions and submit scorecards, but cannot delete jobs
    assert has_permission(UserRole.HIRING_MANAGER, Permission.REQUISITIONS_APPROVE) is True
    assert has_permission(UserRole.HIRING_MANAGER, Permission.INTERVIEWS_SUBMIT_SCORECARD) is True
    assert has_permission(UserRole.HIRING_MANAGER, Permission.JOBS_DELETE) is False


def test_coordinator_and_interviewer_isolation():
    # Coordinator schedules interviews but does not submit scorecards
    assert has_permission(UserRole.COORDINATOR, Permission.INTERVIEWS_SCHEDULE) is True
    assert has_permission(UserRole.COORDINATOR, Permission.INTERVIEWS_SUBMIT_SCORECARD) is False

    # Interviewer submits scorecards but does not schedule interviews
    assert has_permission(UserRole.INTERVIEWER, Permission.INTERVIEWS_SUBMIT_SCORECARD) is True
    assert has_permission(UserRole.INTERVIEWER, Permission.INTERVIEWS_SCHEDULE) is False


def test_check_rbac_access_forbidden():
    # Should not raise
    check_rbac_access(UserRole.RECRUITER, Permission.JOBS_WRITE)

    # Should raise HTTP 403
    with pytest.raises(HTTPException) as exc_info:
        check_rbac_access(UserRole.INTERVIEWER, Permission.JOBS_DELETE)
    assert exc_info.value.status_code == 403
    assert "lacks permission 'jobs:delete'" in exc_info.value.detail
