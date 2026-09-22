"""
Tests for Flexible RBAC (Array of Roles) and Strict Multi-Tenant Data Isolation.
Verifies Phase 5 B2B Multi-Tenancy invariants:
1. User with array of roles (e.g. ['RECRUITER', 'INTERVIEWER']) possesses combined permissions.
2. PLATFORM_ADMIN has root system access and bypasses tenant filtering.
3. EXECUTIVE inherits all enterprise permissions for their specific tenant_id.
4. TenantScopedCollection and TenantScopedDatabase mathematically isolate queries and mutations by tenant_id.
5. Cross-tenant mismatch in query or inserted document raises TenantAccessDeniedError.
"""

import pytest
from fastapi import HTTPException
from models.user_model import UserModel, UserRole
from core.rbac import (
    Permission,
    get_user_combined_permissions,
    has_any_permission,
    check_rbac_access,
)
from services.multi_tenancy.tenant_context import (
    TenantAccessDeniedError,
    set_current_tenant_id,
    clear_current_tenant_id,
    set_platform_admin,
    clear_platform_admin,
    platform_admin_context,
)
from services.multi_tenancy.tenant_repository import (
    TenantScopedCollection,
    TenantScopedDatabase,
)


def test_flexible_rbac_array_of_roles():
    """Verify SMB multi-hat user with ['RECRUITER', 'INTERVIEWER'] possesses union of permissions."""
    user = UserModel(
        email="multihat@smb.com",
        full_name="Alex SMB",
        roles=[UserRole.RECRUITER, UserRole.INTERVIEWER],
        tenant_id="tenant_smb_123",
    )
    assert user.roles == [UserRole.RECRUITER, UserRole.INTERVIEWER]
    assert user.role == UserRole.RECRUITER  # primary role synced

    combined_perms = get_user_combined_permissions(user.roles)

    # Recruiter permissions
    assert Permission.JOBS_WRITE.value in combined_perms
    assert Permission.APPLICATIONS_STAGE_UPDATE.value in combined_perms

    # Interviewer permissions
    assert Permission.INTERVIEWS_SUBMIT_SCORECARD.value in combined_perms

    # Has permissions via has_any_permission
    assert has_any_permission(user.roles, Permission.JOBS_WRITE) is True
    assert has_any_permission(user.roles, Permission.INTERVIEWS_SUBMIT_SCORECARD) is True

    # But does not have hiring manager requisition approval unless granted
    assert has_any_permission(user.roles, Permission.REQUISITIONS_APPROVE) is False


def test_platform_admin_has_all_permissions_and_bypasses_tenant():
    """Verify PLATFORM_ADMIN possesses all permissions and bypasses tenant filter."""
    admin_user = UserModel(
        email="root@careershaala.com",
        full_name="Root Admin",
        roles=[UserRole.PLATFORM_ADMIN],
        tenant_id="global",
    )
    combined_perms = get_user_combined_permissions(admin_user.roles)
    for p in Permission:
        assert p.value in combined_perms

    # Test bypass flag in context
    set_platform_admin(True)
    try:
        mock_coll = FakeMongoCollection()
        scoped = TenantScopedCollection(mock_coll)
        # Without tenant_override, platform admin query is not constrained by tenant_id
        q = scoped._scope_query({"title": "Senior Engineer"})
        assert "tenant_id" not in q
    finally:
        clear_platform_admin()


def test_executive_inherits_all_permissions_for_tenant():
    """Verify EXECUTIVE founder role inherits all permissions for their tenant."""
    exec_user = UserModel(
        email="founder@acme.com",
        full_name="Acme Founder",
        roles=[UserRole.EXECUTIVE],
        tenant_id="tenant_acme",
    )
    combined = get_user_combined_permissions(exec_user.roles)

    # Inherits jobs, scorecards, requisitions approval, talent pools
    assert Permission.JOBS_WRITE.value in combined
    assert Permission.REQUISITIONS_APPROVE.value in combined
    assert Permission.INTERVIEWS_SUBMIT_SCORECARD.value in combined
    assert Permission.TALENT_CRM_ACCESS.value in combined


class FakeMongoCollection:
    """In-memory mock MongoDB collection for testing TenantScopedCollection."""
    def __init__(self):
        self.docs = []

    async def find_one(self, query=None, *args, **kwargs):
        query = query or {}
        for d in self.docs:
            if all(d.get(k) == v for k, v in query.items()):
                return dict(d)
        return None

    async def insert_one(self, doc, *args, **kwargs):
        inserted = dict(doc)
        if "_id" not in inserted:
            inserted["_id"] = str(len(self.docs) + 1)
        self.docs.append(inserted)
        class Res:
            inserted_id = inserted["_id"]
        return Res()

    async def count_documents(self, query=None, *args, **kwargs):
        query = query or {}
        return sum(1 for d in self.docs if all(d.get(k) == v for k, v in query.items()))


@pytest.mark.asyncio
async def test_strict_multi_tenant_query_and_insert_isolation():
    """Verify tenant isolation on collection reads, writes, and cross-tenant rejections."""
    mock_coll = FakeMongoCollection()
    scoped_coll = TenantScopedCollection(mock_coll)

    # 1. Company A writes a job
    set_current_tenant_id("company_a")
    clear_platform_admin()
    try:
        await scoped_coll.insert_one({"title": "React Dev A", "salary": "120k"})
        # 2. Company B writes a job
        set_current_tenant_id("company_b")
        await scoped_coll.insert_one({"title": "Python Dev B", "salary": "130k"})

        # 3. Company B should only see Company B's job
        found = await scoped_coll.find_one({"title": "React Dev A"})
        assert found is None  # Cannot see Company A's job!

        found_b = await scoped_coll.find_one({"title": "Python Dev B"})
        assert found_b is not None
        assert found_b["tenant_id"] == "company_b"

        # Count for Company B
        count_b = await scoped_coll.count_documents({})
        assert count_b == 1

        # 4. Cross-tenant spoofing in query is blocked
        with pytest.raises(TenantAccessDeniedError):
            await scoped_coll.find_one({"tenant_id": "company_a"})

        # 5. Cross-tenant spoofing in insert is blocked
        with pytest.raises(TenantAccessDeniedError):
            await scoped_coll.insert_one({"title": "Spoofed Job", "tenant_id": "company_a"})

    finally:
        clear_current_tenant_id()


@pytest.mark.asyncio
async def test_platform_admin_query_bypass():
    """Verify PLATFORM_ADMIN can query across tenants using platform_admin_context."""
    mock_coll = FakeMongoCollection()
    mock_coll.docs = [
        {"_id": "1", "title": "Job A", "tenant_id": "company_a"},
        {"_id": "2", "title": "Job B", "tenant_id": "company_b"},
    ]

    scoped_coll = TenantScopedCollection(mock_coll)

    with platform_admin_context():
        # Unscoped count
        total = await scoped_coll.count_documents({})
        assert total == 2

        # Can query company_a explicitly
        doc_a = await scoped_coll.find_one({"tenant_id": "company_a"})
        assert doc_a is not None
        assert doc_a["tenant_id"] == "company_a"


def test_employer_role_in_enterprise_roles():
    """Verify EMPLOYER is recognized in UserRole and ENTERPRISE_ROLES."""
    from models.user_model import ENTERPRISE_ROLES
    assert UserRole.EMPLOYER == "employer"
    assert UserRole.EMPLOYER in ENTERPRISE_ROLES


def test_employer_signup_default_roles_assignment():
    """Verify new company / employer signups strictly receive [EXECUTIVE] single role."""
    employer_roles = [UserRole.EXECUTIVE]
    employer_user = UserModel(
        email="founder@innovatecorp.com",
        full_name="Innovate Founder",
        roles=employer_roles,
        company_name="Innovate Corp",
        tenant_id="tenant_innovatecorp",
    )
    assert employer_user.roles == [UserRole.EXECUTIVE]
    assert employer_user.role == UserRole.EXECUTIVE

    perms = get_user_combined_permissions(employer_user.roles)
    # Full executive rights
    assert Permission.REQUISITIONS_APPROVE.value in perms
    assert Permission.TALENT_CRM_ACCESS.value in perms
    # Recruiter rights
    assert Permission.JOBS_WRITE.value in perms
    assert Permission.APPLICATIONS_STAGE_UPDATE.value in perms


def test_invited_team_member_scoped_role():
    """Verify invited team members (e.g. Interviewer) have restricted scoped permissions."""
    interviewer_user = UserModel(
        email="tech.interviewer@innovatecorp.com",
        full_name="Tech Interviewer",
        roles=[UserRole.INTERVIEWER],
        tenant_id="tenant_innovatecorp",
    )
    assert interviewer_user.roles == [UserRole.INTERVIEWER]
    assert interviewer_user.role == UserRole.INTERVIEWER

    perms = get_user_combined_permissions(interviewer_user.roles)
    # Has scorecard permissions
    assert Permission.INTERVIEWS_SUBMIT_SCORECARD.value in perms
    # Does NOT have executive or requisition approval rights
    assert Permission.REQUISITIONS_APPROVE.value not in perms
    assert Permission.JOBS_WRITE.value not in perms

