"""
Phase A1 Security Verification Tests: Strict Multi-Tenant Isolation & Repository Guards.
"""

import pytest
from bson import ObjectId
from unittest.mock import AsyncMock, MagicMock
from fastapi import Request
from fastapi.responses import JSONResponse

from services.multi_tenancy.tenant_context import (
    tenant_context,
    platform_admin_context,
    get_current_tenant_id,
    is_platform_admin,
    TenantAccessDeniedError,
)
from services.multi_tenancy.tenant_repository import (
    TenantScopedCollection,
    TENANT_SCOPED_COLLECTIONS,
)
from services.multi_tenancy.tenant_middleware import TenantMiddleware
from core.security import create_access_token


@pytest.mark.asyncio
async def test_tenant_middleware_rejects_header_spoofing():
    middleware = TenantMiddleware(app=MagicMock())

    token = create_access_token(
        subject="user_123",
        extra_claims={"role": "recruiter", "roles": ["recruiter"], "tenant_id": "tenant_alpha"}
    )

    # 1. Matching header -> Allowed (proceeds to next call)
    req_valid = MagicMock(spec=Request)
    req_valid.headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": "tenant_alpha"}
    req_valid.cookies = {}
    req_valid.url.path = "/api/v1/jobs"
    req_valid.state = MagicMock()
    req_valid.client = MagicMock(host="127.0.0.1")

    called = False
    async def call_next(req):
        nonlocal called
        called = True
        return JSONResponse(status_code=200, content={"status": "ok"})

    resp = await middleware.dispatch(req_valid, call_next)
    assert called is True
    assert resp.status_code == 200

    # 2. Header spoofing (tenant_beta requested with token for tenant_alpha) -> 403 Forbidden
    req_spoof = MagicMock(spec=Request)
    req_spoof.headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": "tenant_beta"}
    req_spoof.cookies = {}
    req_spoof.url.path = "/api/v1/jobs"
    req_spoof.state = MagicMock()
    req_spoof.client = MagicMock(host="127.0.0.1")

    resp_spoof = await middleware.dispatch(req_spoof, call_next)
    assert resp_spoof.status_code == 403


@pytest.mark.asyncio
async def test_tenant_scoped_collection_cross_tenant_read_prevented():
    mock_mongo_col = AsyncMock()
    scoped_col = TenantScopedCollection(mock_mongo_col)

    with tenant_context("tenant_acme"):
        doc_id = ObjectId()
        # Query without tenant_id -> automatically scoped
        await scoped_col.find_one({"_id": doc_id})
        mock_mongo_col.find_one.assert_called_with({"_id": doc_id, "tenant_id": "tenant_acme"})

        # Query with explicit mismatched tenant_id -> raises TenantAccessDeniedError
        with pytest.raises(TenantAccessDeniedError):
            await scoped_col.find_one({"_id": doc_id, "tenant_id": "tenant_evil_corp"})


@pytest.mark.asyncio
async def test_platform_admin_bypass_tenant_filter():
    mock_mongo_col = AsyncMock()
    scoped_col = TenantScopedCollection(mock_mongo_col)

    with platform_admin_context(True):
        doc_id = ObjectId()
        await scoped_col.find_one({"_id": doc_id})
        # Root platform admin query is not forced to a single tenant
        mock_mongo_col.find_one.assert_called_with({"_id": doc_id})


def test_tenant_scoped_collections_contain_all_critical_entities():
    required = {
        "jobs", "resumes", "applications", "ats_results", "requisitions",
        "interview_kits", "scorecards", "talent_crm", "talent_pools",
        "eeo_vault", "webhook_subscriptions", "audit_logs", "offers",
        "pipeline_events", "copilot_sessions"
    }
    for entity in required:
        assert entity in TENANT_SCOPED_COLLECTIONS
