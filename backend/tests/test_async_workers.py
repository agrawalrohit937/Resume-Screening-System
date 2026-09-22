"""
Tests for Asynchronous Task Workers, Idempotency, Exponential Backoff, and DLQ (Task 4.1).
Verifies:
  1. Idempotency key prevents duplicate execution.
  2. Exponential backoff retry handler recovers transient failures.
  3. Exhausted retries route to Dead-Letter Queue (DLQ).
  4. Seamless in-process fallback when Celery/Redis is offline.
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock

from services.tasks.task_manager import TaskManager, _IN_MEMORY_IDEMPOTENCY, _IN_MEMORY_DLQ


@pytest.fixture(autouse=True)
def clean_memory_stores():
    _IN_MEMORY_IDEMPOTENCY.clear()
    _IN_MEMORY_DLQ.clear()
    yield
    _IN_MEMORY_IDEMPOTENCY.clear()
    _IN_MEMORY_DLQ.clear()


@pytest.mark.asyncio
async def test_idempotency_prevents_duplicate_runs():
    """Validates that identical (resume_id, file_hash) task skips duplicate execution."""
    mgr = TaskManager()
    idempotency_key = mgr.compute_idempotency_key("parse", "res_123", "hash_abc")

    call_count = 0
    async def sample_task(x: int):
        nonlocal call_count
        call_count += 1
        return {"result": x * 2}

    # 1. First execution
    res1 = await mgr.execute_with_retry(
        task_func=sample_task,
        task_name="sample_task",
        payload={"x": 5},
        idempotency_key=idempotency_key,
    )
    assert res1 == {"result": 10}
    assert call_count == 1

    # 2. Second execution with same idempotency key
    res2 = await mgr.execute_with_retry(
        task_func=sample_task,
        task_name="sample_task",
        payload={"x": 5},
        idempotency_key=idempotency_key,
    )
    assert res2["status"] == "skipped"
    assert call_count == 1  # Function not re-invoked


@pytest.mark.asyncio
async def test_exponential_backoff_retry():
    """Validates exponential backoff retry logic on transient errors."""
    mgr = TaskManager()
    idempotency_key = "test:retry:123"

    attempts = 0
    async def flaky_task():
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise ConnectionError("Transient database timeout")
        return {"status": "recovered"}

    # Run with 0.01s base backoff for fast test execution
    res = await mgr.execute_with_retry(
        task_func=flaky_task,
        task_name="flaky_task",
        payload={},
        idempotency_key=idempotency_key,
        max_retries=4,
        base_backoff_sec=0.01,
    )
    assert res == {"status": "recovered"}
    assert attempts == 3


@pytest.mark.asyncio
async def test_dlq_routing_on_max_retries_exceeded():
    """Validates that permanent failure routes to DLQ with sanitized payload."""
    mock_db = MagicMock()
    mock_db.task_dlq.insert_one = AsyncMock()

    mgr = TaskManager(db=mock_db)
    idempotency_key = "test:permanent:456"

    attempts = 0
    async def broken_task(resume_id: str, password: str):
        nonlocal attempts
        attempts += 1
        raise ValueError("Corrupt PDF file header")

    payload = {"resume_id": "res_999", "password": "super_secret_password"}

    with pytest.raises(RuntimeError, match="Corrupt PDF file header"):
        await mgr.execute_with_retry(
            task_func=broken_task,
            task_name="broken_task",
            payload=payload,
            idempotency_key=idempotency_key,
            max_retries=2,
            base_backoff_sec=0.01,
        )

    # Verify DLQ recording
    assert len(_IN_MEMORY_DLQ) == 1
    dlq_record = _IN_MEMORY_DLQ[0]
    assert dlq_record["task_name"] == "broken_task"
    assert dlq_record["attempts"] == 2
    assert "Corrupt PDF file header" in dlq_record["error_detail"]
    # Sensitive fields sanitized
    assert "password" not in dlq_record["payload_sanitized"]
    assert dlq_record["payload_sanitized"]["resume_id"] == "res_999"


@pytest.mark.asyncio
async def test_in_process_fallback_enqueue():
    """Validates enqueue_task runs seamlessly in-process when Celery is offline."""
    mgr = TaskManager()
    idempotency_key = "test:enqueue:789"

    completed_event = asyncio.Event()
    async def sample_coro(val: str):
        await asyncio.sleep(0.01)
        completed_event.set()
        return val

    res = await mgr.enqueue_task(
        task_name="test_coro",
        payload={"val": "hello"},
        task_coro_func=sample_coro,
        idempotency_key=idempotency_key,
        max_retries=2,
        base_backoff_sec=0.01,
    )

    assert res["enqueued"] is True
    assert res["broker"] == "in_process"

    # Wait for async completion
    await asyncio.wait_for(completed_event.wait(), timeout=1.0)
    assert completed_event.is_set()
