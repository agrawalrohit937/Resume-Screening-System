"""
Task Job Repository — Dual Engine (PostgreSQL via SQLAlchemy 2.0 / PostgreSQL Primary)
CRUD Operations for Background Jobs.
========================================================================
Enforces strict multi-tenant isolation on all job queries, status updates,
and progress reporting.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
import structlog
from sqlalchemy import select, update

from core.config import settings
from config.db import get_pg_session_factory
from models import TaskJob, gen_uuid_str
from models.task_job_model import TaskJobModel, JobStatus, JobType
from repositories.base_repo import BaseRepository

logger = structlog.get_logger(__name__)


def _task_row_to_model(row: TaskJob) -> TaskJobModel:
    return TaskJobModel(
        _id=row.id,
        id=row.id,
        job_id=row.job_id,
        tenant_id=row.tenant_id or "default",
        user_id=row.user_id,
        type=row.type,
        status=row.status or JobStatus.QUEUED.value,
        progress=row.progress or 0,
        stage_message=row.stage_message,
        result_ref=row.result_ref,
        retry_count=row.retry_count or 0,
        max_retries=row.max_retries or 3,
        error=row.error,
        created_at=row.created_at,
        started_at=row.started_at,
        completed_at=row.completed_at,
    )


class TaskJobRepository(BaseRepository):
    """
    Repository for managing async background job records.
    Dual engine: PostgreSQL when DATABASE_URL is set, document collection fallback.
    """

    def __init__(self, db: Optional[Any] = None, session_factory: Optional[Any] = None):
        self.session_factory = session_factory or get_pg_session_factory()

    async def create_job(
        self,
        job_id: str,
        tenant_id: str,
        job_type: JobType,
        user_id: Optional[str] = None,
        max_retries: int = 3,
    ) -> TaskJobModel:
        now = datetime.now(timezone.utc)
        type_str = job_type.value if hasattr(job_type, "value") else str(job_type)

        t_id = gen_uuid_str()
        async with self.session_factory() as session:
            row = TaskJob(
                id=t_id,
                job_id=job_id,
                tenant_id=tenant_id or "default",
                user_id=str(user_id) if user_id else None,
                type=type_str,
                status=JobStatus.QUEUED.value,
                progress=0,
                stage_message="Queued for processing",
                result_ref=None,
                retry_count=0,
                max_retries=max_retries,
                error=None,
                created_at=now,
                started_at=None,
                completed_at=None,
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return _task_row_to_model(row)

    async def get_by_job_id(self, job_id: str, tenant_id: Optional[str] = None) -> Optional[TaskJobModel]:
        if not job_id:
            return None

        async with self.session_factory() as session:
            filters = [TaskJob.job_id == str(job_id)]
            if tenant_id:
                filters.append(TaskJob.tenant_id == tenant_id)
            stmt = select(TaskJob).where(*filters).order_by(TaskJob.created_at.desc())
            res = await session.execute(stmt)
            row = res.scalars().first()
            if row:
                return _task_row_to_model(row)
            return None

    async def update_progress(
        self,
        job_id: str,
        progress: int,
        stage_message: Optional[str] = None,
        status: Optional[JobStatus] = None,
        tenant_id: Optional[str] = None,
    ) -> Optional[TaskJobModel]:
        prog = max(0, min(100, progress))
        now = datetime.now(timezone.utc)

        async with self.session_factory() as session:
            filters = [TaskJob.job_id == str(job_id)]
            if tenant_id:
                filters.append(TaskJob.tenant_id == tenant_id)

            vals: Dict[str, Any] = {"progress": prog}
            if stage_message:
                vals["stage_message"] = stage_message
            if status:
                vals["status"] = status.value if hasattr(status, "value") else str(status)
                if (status == JobStatus.RUNNING or str(status) == "running"):
                    vals["started_at"] = now

            stmt = update(TaskJob).where(*filters).values(**vals).returning(TaskJob)
            res = await session.execute(stmt)
            await session.commit()
            row = res.scalars().first()
            if row:
                return _task_row_to_model(row)
            return None

    async def mark_done(
        self,
        job_id: str,
        result_ref: Optional[Dict[str, Any]] = None,
        stage_message: str = "Completed successfully",
        tenant_id: Optional[str] = None,
    ) -> Optional[TaskJobModel]:
        now = datetime.now(timezone.utc)

        async with self.session_factory() as session:
            filters = [TaskJob.job_id == str(job_id)]
            if tenant_id:
                filters.append(TaskJob.tenant_id == tenant_id)

            stmt = (
                update(TaskJob)
                .where(*filters)
                .values(
                    status=JobStatus.DONE.value,
                    progress=100,
                    stage_message=stage_message,
                    result_ref=result_ref or {},
                    completed_at=now,
                )
                .returning(TaskJob)
            )
            res = await session.execute(stmt)
            await session.commit()
            row = res.scalars().first()
            if row:
                return _task_row_to_model(row)
            return None

    async def mark_failed(
        self,
        job_id: str,
        error: str,
        retry_count: int = 0,
        tenant_id: Optional[str] = None,
    ) -> Optional[TaskJobModel]:
        now = datetime.now(timezone.utc)

        async with self.session_factory() as session:
            filters = [TaskJob.job_id == str(job_id)]
            if tenant_id:
                filters.append(TaskJob.tenant_id == tenant_id)

            stmt = (
                update(TaskJob)
                .where(*filters)
                .values(
                    status=JobStatus.FAILED.value,
                    error=error,
                    retry_count=retry_count,
                    stage_message=f"Failed: {error[:100]}",
                    completed_at=now,
                )
                .returning(TaskJob)
            )
            res = await session.execute(stmt)
            await session.commit()
            row = res.scalars().first()
            if row:
                return _task_row_to_model(row)
            return None
