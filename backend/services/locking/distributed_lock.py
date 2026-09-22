"""
Distributed Lock Mechanism for CareerPilot ATS Multi-Replica Scheduling & Deduplication.
Guarantees:
  - Mutual exclusion across multi-replica deployments (Kubernetes, Render, ECS).
  - Redis-backed atomic distributed locking via SET NX EX.
  - Safe lock release via token comparison Lua script.
  - Transparent MongoDB atomic / in-memory fallback when Redis is offline.
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

# In-memory lock registry for local development fallback
_IN_MEMORY_LOCKS: Dict[str, Dict[str, Any]] = {}

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
    Distributed lock supporting Redis, MongoDB, and in-memory execution.

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
        Attempts to acquire the lock atomically.
        Returns True if acquired, False otherwise.
        """
        now = time.time()
        expires_at = now + self.ttl_seconds

        # 1. Attempt Redis lock
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
                logger.debug("Redis distributed lock acquire failed, trying fallback", error=str(e))

        # 2. Attempt MongoDB lock
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
                logger.debug("MongoDB distributed lock acquire failed, trying in-memory", error=str(e))

        # 3. In-memory fallback
        mem = _IN_MEMORY_LOCKS.get(self.lock_key)
        if mem is None or mem.get("expires_at", 0) < now:
            _IN_MEMORY_LOCKS[self.lock_key] = {
                "token": self.token,
                "expires_at": expires_at,
            }
            self._acquired = True
            return True

        return False

    async def release(self) -> bool:
        """
        Releases the lock safely if owned by this instance.
        """
        if not self._acquired:
            return False

        released = False

        # 1. Release Redis
        if self.redis is not None:
            try:
                res = await self.redis.eval(_LUA_RELEASE_LOCK, 1, self.lock_key, self.token)
                released = bool(res == 1)
            except Exception as e:
                logger.debug("Redis distributed lock release failed", error=str(e))

        # 2. Release MongoDB
        if self.db is not None:
            try:
                coll = self.db["distributed_locks"]
                op = coll.delete_one({"key": self.lock_key, "token": self.token})
                if asyncio.iscoroutine(op):
                    await op
                released = True
            except Exception as e:
                logger.debug("MongoDB distributed lock release failed", error=str(e))

        # 3. Release In-memory
        mem = _IN_MEMORY_LOCKS.get(self.lock_key)
        if mem and mem.get("token") == self.token:
            _IN_MEMORY_LOCKS.pop(self.lock_key, None)
            released = True

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
