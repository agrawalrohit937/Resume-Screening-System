"""
Workstream 1 Verification Tests — Asynchronous Job Queue & Polling.
===================================================================
Tests:
1. Concurrent batch scoring submission returning 202 Accepted and job tracking ID.
2. Live task polling (/api/v1/ats/tasks/{task_id}) progress reporting.
3. Multi-tenant task isolation (Tenant B cannot read Tenant A's job).
4. Exponential backoff retry execution and DLQ routing on failures.
5. Background Copilot LRU memory eviction compaction.
"""

import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import MagicMock, AsyncMock

from main import app
from models.task_job_model import JobStatus, JobType
from repositories.task_job_repo import TaskJobRepository
from services.tasks import task_manager
from services.tasks.workers import (
    execute_resume_upload_pipeline,
    execute_batch_ats_scoring,
    execute_copilot_lru_eviction,
)
from core.security import create_access_token

BASE_URL = "http://test"
API = "/api/v1"

USER_A_ID = "665f1a2b3c4d5e6f7a8b9c0d"
TENANT_ALPHA = "tenant_alpha"
TENANT_BETA = "tenant_beta"


@pytest.fixture
def user_a_token():
    return create_access_token(
        subject=USER_A_ID,
        extra_claims={"role": "recruiter", "email": "recruiter@alpha.com", "tenant_id": TENANT_ALPHA},
    )


@pytest.fixture
def user_b_token():
    return create_access_token(
        subject="665f1a2b3c4d5e6f7a8b9c0e",
        extra_claims={"role": "recruiter", "email": "recruiter@beta.com", "tenant_id": TENANT_BETA},
    )


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class MockJobDB:
    def __init__(self):
        self.task_jobs_docs = {}
        self.dlq_docs = []

    def __getitem__(self, name):
        if name == "task_jobs":
            return self.make_job_collection()
        if name == "task_dlq":
            return self.make_dlq_collection()
        return MagicMock()

    def make_job_collection(self):
        coll = MagicMock()

        async def _insert_one(doc):
            d = dict(doc)
            d["_id"] = "job_db_id_" + d["job_id"]
            self.task_jobs_docs[d["job_id"]] = d
            return MagicMock(inserted_id=d["_id"])

        async def _find_one(query):
            job_id = query.get("job_id")
            doc = self.task_jobs_docs.get(job_id)
            if not doc:
                return None
            if "tenant_id" in query and doc.get("tenant_id") != query["tenant_id"]:
                return None
            return dict(doc)

        async def _find_one_and_update(query, update, return_document=True):
            job_id = query.get("job_id")
            doc = self.task_jobs_docs.get(job_id)
            if not doc:
                return None
            if "tenant_id" in query and doc.get("tenant_id") != query["tenant_id"]:
                return None
            if "$set" in update:
                doc.update(update["$set"])
            return dict(doc)

        coll.insert_one = AsyncMock(side_effect=_insert_one)
        coll.find_one = AsyncMock(side_effect=_find_one)
        coll.find_one_and_update = AsyncMock(side_effect=_find_one_and_update)
        return coll

    def make_dlq_collection(self):
        coll = MagicMock()

        async def _insert_one(doc):
            self.dlq_docs.append(doc)
            return MagicMock(inserted_id="dlq_1")

        coll.insert_one = AsyncMock(side_effect=_insert_one)
        return coll


@pytest.mark.asyncio
async def test_batch_match_enqueues_and_returns_202(client, user_a_token):
    """Ensure batch ATS scoring returns HTTP 202 immediately with job_id."""
    headers = auth_header(user_a_token)
    payload = {
        "job_id": "665f1a2b3c4d5e6f7a8b9c0e",
        "resume_ids": ["665f1a2b3c4d5e6f7a8b9c0d", "665f1a2b3c4d5e6f7a8b9c0f"],
        "mode": "recruiter",
    }

    res = await client.post(f"{API}/ats/match/batch", json=payload, headers=headers)
    assert res.status_code == 202
    data = res.json()
    assert data["status"] == "queued"
    assert "job_id" in data
    assert data["total_candidates"] == 2


@pytest.mark.asyncio
async def test_job_repository_lifecycle():
    """Verify task job repository creates, updates progress, and marks completion."""
    mock_db = MockJobDB()
    repo = TaskJobRepository(mock_db)

    job = await repo.create_job(
        job_id="test_job_101",
        tenant_id=TENANT_ALPHA,
        job_type=JobType.BATCH_ATS_SCORING,
        user_id=USER_A_ID,
    )
    assert job.job_id == "test_job_101"
    assert job.status == JobStatus.QUEUED
    assert job.progress == 0

    # Update progress
    updated = await repo.update_progress("test_job_101", progress=50, stage_message="Scored 5/10", status=JobStatus.RUNNING, tenant_id=TENANT_ALPHA)
    assert updated.status == JobStatus.RUNNING
    assert updated.progress == 50

    # Mark done
    done = await repo.mark_done("test_job_101", result_ref={"scored": 10}, tenant_id=TENANT_ALPHA)
    assert done.status == JobStatus.DONE
    assert done.progress == 100
    assert done.result_ref == {"scored": 10}


@pytest.mark.asyncio
async def test_multi_tenant_job_isolation(user_a_token, user_b_token):
    """Ensure Tenant B cannot retrieve or observe Tenant A's background job."""
    mock_db = MockJobDB()
    repo = TaskJobRepository(mock_db)

    await repo.create_job(
        job_id="job_alpha_secret",
        tenant_id=TENANT_ALPHA,
        job_type=JobType.RESUME_PARSE_EMBED,
    )

    # Tenant Alpha lookup succeeds
    job_a = await repo.get_by_job_id("job_alpha_secret", tenant_id=TENANT_ALPHA)
    assert job_a is not None

    # Tenant Beta lookup is blocked
    job_b = await repo.get_by_job_id("job_alpha_secret", tenant_id=TENANT_BETA)
    assert job_b is None


@pytest.mark.asyncio
async def test_retry_with_backoff_and_dlq_routing():
    """Ensure failing background jobs retry up to 3 times before routing to DLQ."""
    mock_db = MockJobDB()
    tm = task_manager
    tm.db = mock_db

    attempt_counter = 0

    async def flaky_task():
        nonlocal attempt_counter
        attempt_counter += 1
        raise ValueError("Simulated network timeout")

    with pytest.raises(RuntimeError):
        await tm.execute_with_retry(
            task_func=flaky_task,
            task_name="flaky_test_task",
            payload={},
            idempotency_key="flaky_test_key_1",
            max_retries=3,
            base_backoff_sec=0.01,
        )

    assert attempt_counter == 3
    assert len(mock_db.dlq_docs) == 1
    assert mock_db.dlq_docs[0]["task_name"] == "flaky_test_task"
    assert "Simulated network timeout" in mock_db.dlq_docs[0]["error_detail"]


@pytest.mark.asyncio
async def test_copilot_lru_eviction_worker():
    """Verify background LRU memory compaction worker trims excess records."""
    mock_db = MagicMock()
    mock_mem_coll = MagicMock()

    # Seed 45 memory records
    mock_records = [{"_id": f"mem_{i}", "last_accessed_at": i} for i in range(45)]
    mock_cursor = MagicMock()
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=mock_records)
    mock_mem_coll.find.return_value = mock_cursor
    mock_mem_coll.delete_many = AsyncMock(return_value=MagicMock(deleted_count=5))
    mock_db.copilot_memory = mock_mem_coll

    res = await execute_copilot_lru_eviction(
        user_id="test_user",
        tenant_id="default",
        max_items=40,
        db=mock_db,
    )
    assert res["status"] == "success"
    assert res["evicted_count"] == 5
    assert res["remaining_count"] == 40
