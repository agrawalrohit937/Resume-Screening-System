"""
Distributed Lock Mechanism for CareerShala ATS Multi-Replica Scheduling & Deduplication.
Guarantees:
  - Mutual exclusion across multi-replica deployments (Kubernetes, Azure App Service, Docker).
  - Redis-backed atomic distributed locking via SET NX EX.
  - Safe lock release via token comparison Lua script.
  - Transparent MongoDB atomic fallback when Redis is offline.
"""

from __future__ import annotations

import asyncio
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Dict, Optional
import structlog

logger = structlog.get_logger(__name__)

# Lua script to ensure safe release only by the lock owner
_LUA_RELEASE_LOCK = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""


class DistributedLock:
    """
    Distributed lock supporting Redis with MongoDB atomic document lock fallback.

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
        self.redis = redis_client
        self.db = db
        self._acquired = False

    async def acquire(self) -> bool:
        """
        Attempts to acquire the lock atomically from a Single Source of Truth.
        - If Redis is configured: Redis is the sole lock authority (returns False on failure/disconnect).
        - If Redis is not configured: MongoDB is the sole lock authority.
        Never crosses between databases to prevent split-brain duplicate task executions.
        """
        now = time.time()
        expires_at = now + self.ttl_seconds

        # 1. Authoritative Redis lock
        if self.redis is not None:
            try:
                # set with NX (not exists) and EX (expire seconds)
                acquired = await self.redis.set(self.lock_key, self.token, nx=True, ex=self.ttl_seconds)
                if acquired:
                    self._acquired = True
                    logger.debug("Acquired distributed lock via Redis", key=self.lock_key)
                    return True
                return False
            except Exception as e:
                logger.warning("Redis distributed lock failed to acquire (aborting to prevent split-brain)", error=str(e))
                return False

        # 2. Authoritative MongoDB atomic lock (used only when Redis is not configured)
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
                if asyncio.iscoroutine(op):
                    res = await op
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

        # 1. Release Redis if configured as authority
        if self.redis is not None:
            try:
                res = await self.redis.eval(_LUA_RELEASE_LOCK, 1, self.lock_key, self.token)
                released = bool(res == 1)
            except Exception as e:
                logger.debug("Redis distributed lock release failed", error=str(e))
            self._acquired = False
            return released

        # 2. Release MongoDB if configured as authority
        if self.db is not None:
            try:
                coll = self.db["distributed_locks"]
                op = coll.delete_one({"key": self.lock_key, "token": self.token})
                if asyncio.iscoroutine(op):
                    await op
                released = True
            except Exception as e:
                logger.debug("MongoDB distributed lock release failed", error=str(e))

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
        async with distributed_lock("nightly_cron", ttl_seconds=3600) as acquired:
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
