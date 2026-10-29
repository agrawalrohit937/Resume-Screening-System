"""
Distributed Lock Mechanism for CareerShala ATS Multi-Replica Scheduling & Deduplication.
Guarantees:
  - Mutual exclusion across multi-replica deployments (Kubernetes, Azure App Service, Docker).
  - Native MongoDB atomic document locking via find_one_and_update with TTL expiration.
  - Safe lock release via token comparison deletion.
"""

from __future__ import annotations

import inspect
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Optional
import structlog

logger = structlog.get_logger(__name__)


class DistributedLock:
    """
    Distributed lock utilizing MongoDB atomic document locks.

    Complexity:
        Time: O(1) for acquire and release operations.
        Space: O(1) per lock token.
    """

    def __init__(
        self,
        lock_key: str,
        ttl_seconds: int = 300,
        redis_client: Optional[Any] = None,
        db: Optional[Any] = None,
    ):
        self.lock_key = f"lock:{lock_key}"
        self.ttl_seconds = ttl_seconds
        self.token = str(uuid.uuid4())
        self.db = db
        self._acquired = False

    async def acquire(self) -> bool:
        """
        Attempts to acquire the lock atomically from MongoDB.
        Uses find_one_and_update to ensure mutual exclusion across replicas.
        """
        now = time.time()
        expires_at = now + self.ttl_seconds

        if self.db is not None:
            try:
                coll = self.db["distributed_locks"]
                # Atomically claim lock if expired or not exists
                op = coll.find_one_and_update(
                    {
                        "key": self.lock_key,
                        "$or": [
                            {"expires_at": {"$lt": now}},
                            {"token": None},
                        ],
                    },
                    {
                        "$set": {
                            "key": self.lock_key,
                            "token": self.token,
                            "acquired_at": now,
                            "expires_at": expires_at,
                        }
                    },
                    upsert=True,
                    return_document=True,
                )
                if inspect.isawaitable(op):
                    res = await op
                elif isinstance(op, dict):
                    res = op
                else:
                    res = None

                if res and res.get("token") == self.token:
                    self._acquired = True
                    logger.debug("Acquired distributed lock via MongoDB", key=self.lock_key)
                    return True
                return False
            except Exception as e:
                logger.warning("MongoDB distributed lock acquire failed", error=str(e))
                return False

        return False

    async def release(self) -> bool:
        """
        Releases the lock safely if owned by this instance.
        """
        if not self._acquired:
            return False

        if self.db is not None:
            try:
                coll = self.db["distributed_locks"]
                op = coll.delete_one({"key": self.lock_key, "token": self.token})
                if inspect.isawaitable(op):
                    await op
                released = True
            except Exception as e:
                logger.debug("MongoDB distributed lock release failed", error=str(e))
                released = False
        else:
            released = False

        self._acquired = False
        return released


@asynccontextmanager
async def distributed_lock(
    lock_key: str,
    ttl_seconds: int = 300,
    redis_client: Optional[Any] = None,
    db: Optional[Any] = None,
) -> AsyncGenerator[bool, None]:
    """
    Asynchronous context manager for distributed locking.
    Usage:
        async with distributed_lock("nightly_cron", ttl_seconds=3600, db=db) as acquired:
            if not acquired:
                return  # Skip duplicate execution on another pod
            do_work()
    """
    lock = DistributedLock(lock_key, ttl_seconds=ttl_seconds, redis_client=redis_client, db=db)
    acquired = await lock.acquire()
    try:
        yield acquired
    finally:
        if acquired:
            await lock.release()

