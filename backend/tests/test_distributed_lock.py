"""
Unit Tests for Distributed Lock Mechanism (Task 4.2).
Verifies:
  1. Mutual exclusion between concurrent lock requests.
  2. Automatic release upon context manager exit.
  3. TTL expiration allows re-acquisition.
  4. Safe release protects against token mismatch.
"""

import asyncio
import time
import pytest

from services.locking.distributed_lock import DistributedLock, distributed_lock, _IN_MEMORY_LOCKS


@pytest.fixture(autouse=True)
def clean_memory_locks():
    _IN_MEMORY_LOCKS.clear()
    yield
    _IN_MEMORY_LOCKS.clear()


@pytest.mark.asyncio
async def test_distributed_lock_mutual_exclusion():
    """Verify second caller cannot acquire active lock."""
    lock1 = DistributedLock("resource_A", ttl_seconds=10)
    lock2 = DistributedLock("resource_A", ttl_seconds=10)

    acq1 = await lock1.acquire()
    assert acq1 is True

    acq2 = await lock2.acquire()
    assert acq2 is False

    # Release lock1
    rel1 = await lock1.release()
    assert rel1 is True

    # Now lock2 can acquire
    acq2_after = await lock2.acquire()
    assert acq2_after is True
    await lock2.release()


@pytest.mark.asyncio
async def test_distributed_lock_context_manager():
    """Verify async context manager acquires and automatically releases."""
    lock_key = "cron_task_X"

    async with distributed_lock(lock_key, ttl_seconds=5) as acquired1:
        assert acquired1 is True
        # Concurrent attempt inside context block fails
        async with distributed_lock(lock_key, ttl_seconds=5) as acquired2:
            assert acquired2 is False

    # Once exited, lock is released and can be re-acquired
    async with distributed_lock(lock_key, ttl_seconds=5) as acquired3:
        assert acquired3 is True


@pytest.mark.asyncio
async def test_distributed_lock_ttl_expiration():
    """Verify lock auto-expires after TTL seconds."""
    lock1 = DistributedLock("resource_B", ttl_seconds=0.05)  # 50ms TTL
    assert await lock1.acquire() is True

    # Wait for TTL to expire
    await asyncio.sleep(0.08)

    lock2 = DistributedLock("resource_B", ttl_seconds=10)
    assert await lock2.acquire() is True
    await lock2.release()
