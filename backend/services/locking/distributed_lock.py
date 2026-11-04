"""
Distributed Lock Mechanism for CareerShala ATS Multi-Replica Scheduling & Deduplication.
Guarantees:
  - Mutual exclusion across multi-replica deployments (Kubernetes, Azure App Service, Docker).
  - Native atomic PostgreSQL row locking via ON CONFLICT DO UPDATE with TTL expiration.
  - Safe lock release via token comparison deletion.
"""

from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Optional
import structlog
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert

from config.db import get_pg_session_factory
from models import DistributedLockModel

logger = structlog.get_logger(__name__)


class DistributedLock:
    """
    Distributed lock utilizing native PostgreSQL atomic row upsert.

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
        session_factory=None,
    ):
        self.lock_key = f"lock:{lock_key}"
        self.ttl_seconds = ttl_seconds
        self.token = str(uuid.uuid4())
        self.session_factory = session_factory or get_pg_session_factory()
        self._acquired = False

    async def acquire(self) -> bool:
        """
        Attempts to acquire the lock atomically from PostgreSQL.
        Uses INSERT ... ON CONFLICT DO UPDATE WHERE ... to ensure mutual exclusion across replicas.
        """
        now = time.time()
        expires_at = now + self.ttl_seconds

        try:
            async with self.session_factory() as session:
                async with session.begin():
                    stmt = (
                        insert(DistributedLockModel)
                        .values(
                            id=str(uuid.uuid4()),
                            lock_key=self.lock_key,
                            owner=self.token,
                            acquired_at=now,
                            expires_at=expires_at,
                        )
                        .on_conflict_do_update(
                            index_elements=[DistributedLockModel.lock_key],
                            set_={
                                "owner": self.token,
                                "acquired_at": now,
                                "expires_at": expires_at,
                            },
                            where=(DistributedLockModel.expires_at < now)
                            | (DistributedLockModel.owner == self.token),
                        )
                        .returning(DistributedLockModel.owner)
                    )
                    res = await session.execute(stmt)
                    owner = res.scalar_one_or_none()
                    if owner == self.token:
                        self._acquired = True
                        logger.debug("Acquired distributed lock via PostgreSQL", key=self.lock_key)
                        return True
                    return False
        except Exception as e:
            logger.warning("PostgreSQL distributed lock acquire failed", error=str(e))
            return False

    async def release(self) -> bool:
        """
        Releases the lock safely if owned by this instance.
        """
        if not self._acquired:
            return False

        try:
            async with self.session_factory() as session:
                async with session.begin():
                    stmt = delete(DistributedLockModel).where(
                        DistributedLockModel.lock_key == self.lock_key,
                        DistributedLockModel.owner == self.token,
                    )
                    await session.execute(stmt)
                    self._acquired = False
                    logger.debug("Released distributed lock via PostgreSQL", key=self.lock_key)
                    return True
        except Exception as e:
            logger.warning("PostgreSQL distributed lock release failed", error=str(e))
            return False


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
