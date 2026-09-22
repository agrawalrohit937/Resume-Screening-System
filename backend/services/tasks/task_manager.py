"""
Unified Asynchronous Task Manager for CareerPilot ATS.
Provides:
  - Idempotent task dispatching keyed on (resume_id, file_hash) or custom keys.
  - Exponential backoff retry execution.
  - Dead-Letter Queue (DLQ) tracking for unrecoverable failures into db.task_dlq.
  - Automatic in-process fallback when Celery/Redis is offline.
"""

from __future__ import annotations

import asyncio
import hashlib
import time
from datetime import datetime, timezone
from typing import Any, Callable, Coroutine, Dict, Optional, Tuple, Union
import structlog

from core.feature_flags import FEATURE_ASYNC_WORKERS

logger = structlog.get_logger(__name__)

# Local in-memory store for idempotency & DLQ fallback when Redis / DB is offline
_IN_MEMORY_IDEMPOTENCY: Dict[str, Dict[str, Any]] = {}
_IN_MEMORY_DLQ: list[Dict[str, Any]] = []


class TaskManager:
    """
    Unified task dispatcher with idempotency, exponential backoff, and DLQ tracking.

    Complexity:
        Time: O(1) for task dispatch, idempotency check, and DLQ routing.
        Space: O(N_tasks) for active idempotency keys and DLQ entries.
    """

    def __init__(self, db: Any = None, redis_client: Any = None):
        self.db = db
        self.redis = redis_client
        self._dlq_collection_name = "task_dlq"
        self._idempotency_collection_name = "task_idempotency"

    def compute_idempotency_key(self, prefix: str, identifier: str, content_hash: Optional[str] = None) -> str:
        """
        Computes a deterministic idempotency key.
        e.g. parse:resume_123:sha256_hash
        """
        if content_hash:
            return f"{prefix}:{identifier}:{content_hash}"
        return f"{prefix}:{identifier}"

    async def is_duplicate_or_in_progress(self, idempotency_key: str, ttl_seconds: int = 3600) -> Tuple[bool, Optional[str]]:
        """
        Checks if task has already been completed or is actively in-progress.
        Returns: (is_duplicate: bool, current_status: Optional[str])
        """
        now = time.time()

        # 1. Try Redis
        if self.redis is not None:
            try:
                status = await self.redis.get(f"task:idempotency:{idempotency_key}")
                if status:
                    return True, status.decode("utf-8") if isinstance(status, bytes) else str(status)
            except Exception as e:
                logger.debug("Redis idempotency check failed, checking fallback", error=str(e))

        # 2. Try MongoDB
        if self.db is not None:
            try:
                coll = self.db[self._idempotency_collection_name]
                record = await coll.find_one({"key": idempotency_key})
                if record:
                    expires_at = record.get("expires_at", 0)
                    if expires_at > now:
                        return True, record.get("status", "COMPLETED")
            except Exception as e:
                logger.debug("DB idempotency check failed", error=str(e))

        # 3. In-memory fallback
        mem = _IN_MEMORY_IDEMPOTENCY.get(idempotency_key)
        if mem and mem.get("expires_at", 0) > now:
            return True, mem.get("status")

        return False, None

    async def mark_task_status(
        self,
        idempotency_key: str,
        status: str,
        ttl_seconds: int = 3600,
        result_metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Updates task lifecycle state (QUEUED, PROCESSING, COMPLETED, FAILED)."""
        now = time.time()
        expires_at = now + ttl_seconds

        # Redis
        if self.redis is not None:
            try:
                await self.redis.set(f"task:idempotency:{idempotency_key}", status, ex=ttl_seconds)
            except Exception:
                pass

        # DB
        if self.db is not None:
            try:
                coll = self.db[self._idempotency_collection_name]
                op = coll.update_one(
                    {"key": idempotency_key},
                    {"$set": {
                        "key": idempotency_key,
                        "status": status,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "expires_at": expires_at,
                        "metadata": result_metadata or {},
                    }},
                    upsert=True,
                )
                if hasattr(op, "__await__"):
                    await op
            except Exception:
                pass

        # In-memory
        _IN_MEMORY_IDEMPOTENCY[idempotency_key] = {
            "status": status,
            "expires_at": expires_at,
            "metadata": result_metadata or {},
        }

    async def route_to_dlq(
        self,
        task_name: str,
        payload: Dict[str, Any],
        idempotency_key: str,
        error: str,
        attempts: int,
    ) -> Dict[str, Any]:
        """
        Routes permanently failed tasks to the Dead-Letter Queue (DLQ).
        """
        dlq_entry = {
            "task_name": task_name,
            "idempotency_key": idempotency_key,
            "payload_sanitized": {k: v for k, v in payload.items() if "password" not in k.lower() and "token" not in k.lower() and "raw_text" not in k.lower()},
            "error_detail": str(error),
            "attempts": attempts,
            "failed_at_iso": datetime.now(timezone.utc).isoformat(),
        }

        if self.db is not None:
            try:
                coll = self.db[self._dlq_collection_name]
                op = coll.insert_one(dlq_entry)
                if hasattr(op, "__await__"):
                    await op
            except Exception as e:
                logger.error("Failed writing DLQ entry to MongoDB", error=str(e))

        _IN_MEMORY_DLQ.append(dlq_entry)
        logger.error(
            "Task permanently failed, routed to DLQ",
            task_name=task_name,
            idempotency_key=idempotency_key,
            attempts=attempts,
            error=error,
        )
        return dlq_entry

    async def execute_with_retry(
        self,
        task_func: Callable[..., Coroutine[Any, Any, Any]],
        task_name: str,
        payload: Dict[str, Any],
        idempotency_key: str,
        max_retries: int = 3,
        base_backoff_sec: float = 0.5,
    ) -> Any:
        """
        Executes an async task with exponential backoff and DLQ routing.
        """
        # 1. Idempotency guard
        is_dup, current_status = await self.is_duplicate_or_in_progress(idempotency_key)
        if is_dup and current_status in ("COMPLETED", "PROCESSING"):
            logger.info(
                "Task skipped due to idempotency",
                task_name=task_name,
                idempotency_key=idempotency_key,
                status=current_status,
            )
            return {"status": "skipped", "reason": f"Task is {current_status}"}

        await self.mark_task_status(idempotency_key, "PROCESSING")

        attempts = 0
        last_exception = None

        while attempts < max_retries:
            attempts += 1
            try:
                logger.info("Executing task attempt", task_name=task_name, attempt=attempts)
                result = await task_func(**payload)
                await self.mark_task_status(idempotency_key, "COMPLETED")
                return result
            except Exception as exc:
                last_exception = exc
                logger.warning(
                    "Task execution failed, scheduling backoff retry",
                    task_name=task_name,
                    attempt=attempts,
                    max_retries=max_retries,
                    error=str(exc),
                )
                if attempts < max_retries:
                    backoff = base_backoff_sec * (2 ** (attempts - 1))
                    await asyncio.sleep(backoff)

        # Max retries exceeded -> DLQ
        await self.mark_task_status(idempotency_key, "FAILED")
        await self.route_to_dlq(
            task_name=task_name,
            payload=payload,
            idempotency_key=idempotency_key,
            error=str(last_exception),
            attempts=attempts,
        )
        raise RuntimeError(f"Task {task_name} failed after {attempts} attempts: {last_exception}")

    async def enqueue_job(
        self,
        job_type: Any,
        payload: Dict[str, Any],
        task_coro_func: Callable[..., Coroutine[Any, Any, Any]],
        tenant_id: str = "default",
        user_id: Optional[str] = None,
        job_id: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        max_retries: int = 3,
        base_backoff_sec: float = 0.5,
    ) -> Any:
        """
        Enqueues an asynchronous background job with persistent MongoDB tracking,
        progress updates, and retry-with-backoff.
        """
        import uuid
        from config.db import get_database
        from repositories.task_job_repo import TaskJobRepository
        from models.task_job_model import JobStatus, JobType

        j_id = job_id or uuid.uuid4().hex
        t_id = tenant_id or "default"
        db = self.db or get_database()
        repo = TaskJobRepository(db)

        j_type = job_type if isinstance(job_type, JobType) else JobType(str(job_type))
        job_record = await repo.create_job(
            job_id=j_id,
            tenant_id=t_id,
            job_type=j_type,
            user_id=user_id,
            max_retries=max_retries,
        )

        key = idempotency_key or f"job:{j_type.value}:{j_id}"

        async def _job_wrapper(**kwargs):
            start_t = time.perf_counter()
            try:
                await repo.update_progress(j_id, progress=10, stage_message="Processing started", status=JobStatus.RUNNING, tenant_id=t_id)
                call_kwargs = dict(kwargs)
                call_kwargs.pop("job_id", None)
                call_kwargs.pop("tenant_id", None)
                call_kwargs.pop("repo", None)
                res = await task_coro_func(job_id=j_id, tenant_id=t_id, repo=repo, **call_kwargs)
                await repo.mark_done(j_id, result_ref=res if isinstance(res, dict) else {"result": str(res)}, tenant_id=t_id)
                duration = time.perf_counter() - start_t
                try:
                    from core.metrics import record_queue_job_metrics
                    record_queue_job_metrics(job_type=j_type.value, duration_sec=duration, status="completed")
                except Exception:
                    pass
                return res
            except Exception as exc:
                duration = time.perf_counter() - start_t
                try:
                    from core.metrics import record_queue_job_metrics
                    record_queue_job_metrics(job_type=j_type.value, duration_sec=duration, status="failed")
                except Exception:
                    pass
                await repo.mark_failed(j_id, error=str(exc), tenant_id=t_id)
                raise exc

        # Execute in background async task
        async def _run_in_background():
            try:
                await self.execute_with_retry(
                    task_func=_job_wrapper,
                    task_name=f"job_{j_type.value}",
                    payload=payload,
                    idempotency_key=key,
                    max_retries=max_retries,
                    base_backoff_sec=base_backoff_sec,
                )
            except Exception as e:
                logger.error("Background job execution finished with error", error=str(e), task_name=f"job_{j_type.value}", job_id=j_id)

        asyncio.create_task(_run_in_background())

        return job_record

    async def enqueue_task(
        self,
        task_name: str,
        payload: Dict[str, Any],
        task_coro_func: Callable[..., Coroutine[Any, Any, Any]],
        idempotency_key: Optional[str] = None,
        max_retries: int = 3,
        base_backoff_sec: float = 0.5,
    ) -> Dict[str, Any]:
        """
        Dispatches a task via Celery worker if available & enabled, or in-process async worker fallback.
        """
        key = idempotency_key or hashlib.sha256(f"{task_name}:{sorted(payload.items())}".encode()).hexdigest()

        is_dup, current_status = await self.is_duplicate_or_in_progress(key)
        if is_dup and current_status in ("COMPLETED", "PROCESSING"):
            return {"enqueued": False, "status": current_status, "idempotency_key": key}

        await self.mark_task_status(key, "QUEUED")

        # Celery Dispatch
        from services.tasks.celery_app import celery_app
        if FEATURE_ASYNC_WORKERS and celery_app is not None:
            try:
                celery_task = celery_app.send_task(
                    f"careerpilot.{task_name}",
                    kwargs={"payload": payload, "idempotency_key": key},
                )
                logger.info("Dispatched task to Celery worker", task_id=celery_task.id, task_name=task_name)
                return {"enqueued": True, "broker": "celery", "task_id": celery_task.id, "idempotency_key": key}
            except Exception as e:
                logger.warning("Celery dispatch failed, falling back to in-process execution", error=str(e))

        # In-Process Fallback: run in background async task
        asyncio.create_task(
            self.execute_with_retry(
                task_func=task_coro_func,
                task_name=task_name,
                payload=payload,
                idempotency_key=key,
                max_retries=max_retries,
                base_backoff_sec=base_backoff_sec,
            )
        )
        return {"enqueued": True, "broker": "in_process", "idempotency_key": key}


# Global singleton instance
task_manager = TaskManager()

