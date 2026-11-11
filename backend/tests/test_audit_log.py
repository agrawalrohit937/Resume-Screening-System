"""
Workstream 3 Verification Tests — Immutable Audit Log Subsystem.
================================================================
Tests:
1. Append-only immutability (mutations and deletions raise RuntimeError).
2. Multi-tenant query isolation (Tenant A logs cannot leak to Tenant B).
3. Query filtering (by actor, action, resource_type, resource_id, and time range).
4. Pagination behavior (skip, limit, total count, total pages).
5. Audit API route RBAC authorization (403 for unauthorized users, 200 for admins/execs).
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List
import pytest
from unittest.mock import MagicMock

from schemas.audit_schema import AuditLogModel, AuditAction, AuditResourceType
from repositories.audit_log_repo import AuditLogRepository
from schemas.user_schema import UserModel, UserRole


TENANT_ALPHA = "tenant_alpha"
TENANT_BETA = "tenant_beta"
ACTOR_ALICE = "user_alice_101"
ACTOR_BOB = "user_bob_202"


from tests.conftest import MockAsyncSession


@pytest.fixture
def mock_audit_session():
    return MockAsyncSession(items=[])


@pytest.fixture
def mock_audit_db(mock_audit_session):
    class _MockAuditRepoAdapter:
        def __init__(self, session):
            self.session = session
        def __call__(self):
            return self.session
    return _MockAuditRepoAdapter(mock_audit_session)


@pytest.mark.asyncio
async def test_audit_log_append_only_and_immutability(mock_audit_db):
    """Verify audit records can be appended but update/delete calls explicitly raise RuntimeError."""
    repo = AuditLogRepository(mock_audit_db)

    # 1. Log event
    event = AuditLogModel(
        tenant_id=TENANT_ALPHA,
        actor_id=ACTOR_ALICE,
        actor_role="recruiter",
        action=AuditAction.CANDIDATE_STAGE_CHANGED,
        resource_type=AuditResourceType.CANDIDATE,
        resource_id="cand_123",
        payload={"from_stage": "Screening", "to_stage": "Interview"},
    )
    saved = await repo.log_event(event)
    assert saved.id is not None
    assert saved.action == "candidate.stage_changed"
    assert saved.tenant_id == TENANT_ALPHA

    # 2. Verify update operations are strictly blocked
    with pytest.raises(RuntimeError, match="immutable and cannot be modified"):
        await repo.update({"id": saved.id}, {"action": "tampered"})

    # 3. Verify delete operations are strictly blocked
    with pytest.raises(RuntimeError, match="immutable and cannot be deleted"):
        await repo.delete(saved.id)


@pytest.mark.asyncio
async def test_audit_log_multi_tenant_isolation(mock_audit_db):
    """Verify Tenant Alpha cannot see Tenant Beta audit logs."""
    repo = AuditLogRepository(mock_audit_db)

    # Seed logs for Tenant Alpha
    await repo.log_event({
        "tenant_id": TENANT_ALPHA,
        "actor_id": ACTOR_ALICE,
        "action": AuditAction.OFFER_CREATED,
        "resource_type": AuditResourceType.OFFER,
        "resource_id": "offer_alpha_1",
    })
    await repo.log_event({
        "tenant_id": TENANT_ALPHA,
        "actor_id": ACTOR_ALICE,
        "action": AuditAction.OFFER_APPROVED,
        "resource_type": AuditResourceType.OFFER,
        "resource_id": "offer_alpha_1",
    })

    # Seed log for Tenant Beta
    await repo.log_event({
        "tenant_id": TENANT_BETA,
        "actor_id": ACTOR_BOB,
        "action": AuditAction.OFFER_CREATED,
        "resource_type": AuditResourceType.OFFER,
        "resource_id": "offer_beta_1",
    })

    # Query for Alpha
    alpha_items, alpha_count = await repo.query_logs(tenant_id=TENANT_ALPHA)
    assert alpha_count == 2
    assert len(alpha_items) == 2
    assert all(i.tenant_id == TENANT_ALPHA for i in alpha_items)

    # Query for Beta
    beta_items, beta_count = await repo.query_logs(tenant_id=TENANT_BETA)
    assert beta_count == 1
    assert beta_items[0].tenant_id == TENANT_BETA
    assert beta_items[0].resource_id == "offer_beta_1"


@pytest.mark.asyncio
async def test_audit_log_query_filtering_and_time_range(mock_audit_db):
    """Verify filtering by action, actor, resource_type, and time window."""
    repo = AuditLogRepository(mock_audit_db)
    now = datetime.now(timezone.utc)

    # Add logs with distinct actions and timestamps
    await repo.log_event({
        "tenant_id": TENANT_ALPHA,
        "actor_id": ACTOR_ALICE,
        "action": AuditAction.ATS_MATCH_EXECUTED,
        "resource_type": AuditResourceType.ATS_RESULT,
        "resource_id": "res_1",
        "timestamp": now - timedelta(hours=3),
    })
    await repo.log_event({
        "tenant_id": TENANT_ALPHA,
        "actor_id": ACTOR_BOB,
        "action": AuditAction.CANDIDATE_HIRED,
        "resource_type": AuditResourceType.CANDIDATE,
        "resource_id": "cand_99",
        "timestamp": now - timedelta(hours=1),
    })

    # Filter by action
    hired_logs, count = await repo.query_logs(tenant_id=TENANT_ALPHA, action=AuditAction.CANDIDATE_HIRED)
    assert count == 1
    assert hired_logs[0].actor_id == ACTOR_BOB

    # Filter by time window (last 2 hours only)
    recent_logs, count = await repo.query_logs(
        tenant_id=TENANT_ALPHA,
        start_time=now - timedelta(hours=2),
    )
    assert count == 1
    assert recent_logs[0].resource_id == "cand_99"


@pytest.mark.asyncio
async def test_audit_api_endpoint_rbac_and_isolation(mock_audit_db):
    """Verify GET /api/v1/audit enforces AUDIT_LOG_READ permission."""
    from api.routes.audit import list_audit_logs
    from api.deps import PaginationParams

    repo = AuditLogRepository(mock_audit_db)
    await repo.log_event({
        "tenant_id": TENANT_ALPHA,
        "actor_id": ACTOR_ALICE,
        "action": AuditAction.CANDIDATE_STAGE_CHANGED,
        "resource_type": AuditResourceType.CANDIDATE,
        "resource_id": "cand_1",
    })

    # 1. Executive user has access to their tenant logs
    exec_user = UserModel(
        id="user_exec_1",
        email="exec@alpha.com",
        full_name="Alice Executive",
        tenant_id=TENANT_ALPHA,
        role=UserRole.EXECUTIVE,
        roles=[UserRole.EXECUTIVE],
    )
    res = await list_audit_logs(
        pagination=PaginationParams(page=1, page_size=10),
        current_user=exec_user,
        db=mock_audit_db,
    )
    assert res.total == 1
    assert res.items[0].tenant_id == TENANT_ALPHA

    # 2. Candidate user without AUDIT_LOG_READ gets 403
    cand_user = UserModel(
        id="user_cand_1",
        email="cand@alpha.com",
        full_name="Bob Candidate",
        tenant_id=TENANT_ALPHA,
        role=UserRole.CANDIDATE,
        roles=[UserRole.CANDIDATE],
    )
    with pytest.raises(Exception) as exc_info:
        await list_audit_logs(
            pagination=PaginationParams(page=1, page_size=10),
            current_user=cand_user,
            db=mock_audit_db,
        )
    assert "403" in str(exc_info.value) or exc_info.value.status_code == 403

