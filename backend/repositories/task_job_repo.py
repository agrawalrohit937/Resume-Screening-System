"""
Task Job Repository — Async MongoDB CRUD Operations for Background Jobs.
========================================================================
Enforces strict multi-tenant isolation on all job queries, status updates,
and progress reporting.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import structlog
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from models.task_job_model import TaskJobModel, JobStatus, JobType
from repositories.base_repo import BaseRepository

logger = structlog.get_logger(__name__)


class TaskJobRepository(BaseRepository):
    """
    Repository for managing async background job records in MongoDB.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db["task_jobs"]

    async def create_job(
        self,
        job_id: str,
        tenant_id: str,
        job_type: JobType,
        user_id: Optional[str] = None,
        max_retries: int = 3,
    ) -> TaskJobModel:
        now = datetime.now(timezone.utc)
        doc = {
            "job_id": job_id,
            "tenant_id": tenant_id or "default",
            "user_id": user_id,
            "type": job_type.value if hasattr(job_type, "value") else str(job_type),
            "status": JobStatus.QUEUED.value,
            "progress": 0,
            "stage_message": "Queued for processing",
            "result_ref": None,
            "retry_count": 0,
            "max_retries": max_retries,
            "error": None,
            "created_at": now,
            "started_at": None,
            "completed_at": None,
        }
        res = await self.collection.insert_one(doc)
        doc["_id"] = str(res.inserted_id)
        return TaskJobModel(**doc)

    async def get_by_job_id(self, job_id: str, tenant_id: Optional[str] = None) -> Optional[TaskJobModel]:
        query: Dict[str, Any] = {"job_id": job_id}
        if tenant_id:
            query["tenant_id"] = tenant_id
        doc = await self.collection.find_one(query)
        if not doc:
            return None
        return TaskJobModel(**self._serialize(doc))

    async def update_progress(
        self,
        job_id: str,
        progress: int,
        stage_message: Optional[str] = None,
        status: Optional[JobStatus] = None,
        tenant_id: Optional[str] = None,
    ) -> Optional[TaskJobModel]:
        update_fields: Dict[str, Any] = {"progress": max(0, min(100, progress))}
        if stage_message:
            update_fields["stage_message"] = stage_message
        if status:
            update_fields["status"] = status.value
            if status == JobStatus.RUNNING and "started_at" not in update_fields:
                update_fields["started_at"] = datetime.now(timezone.utc)

        query: Dict[str, Any] = {"job_id": job_id}
        if tenant_id:
            query["tenant_id"] = tenant_id

        doc = await self.collection.find_one_and_update(
            query,
            {"$set": update_fields},
            return_document=True,
        )
        if not doc:
            return None
        return TaskJobModel(**self._serialize(doc))

    async def mark_done(
        self,
        job_id: str,
        result_ref: Optional[Dict[str, Any]] = None,
        stage_message: str = "Completed successfully",
        tenant_id: Optional[str] = None,
    ) -> Optional[TaskJobModel]:
        now = datetime.now(timezone.utc)
        query: Dict[str, Any] = {"job_id": job_id}
        if tenant_id:
            query["tenant_id"] = tenant_id

        doc = await self.collection.find_one_and_update(
            query,
            {
                "$set": {
                    "status": JobStatus.DONE.value,
                    "progress": 100,
                    "stage_message": stage_message,
                    "result_ref": result_ref or {},
                    "completed_at": now,
                }
            },
            return_document=True,
        )
        if not doc:
            return None
        return TaskJobModel(**self._serialize(doc))

    async def mark_failed(
        self,
        job_id: str,
        error: str,
        retry_count: int = 0,
        tenant_id: Optional[str] = None,
    ) -> Optional[TaskJobModel]:
        now = datetime.now(timezone.utc)
        query: Dict[str, Any] = {"job_id": job_id}
        if tenant_id:
            query["tenant_id"] = tenant_id

        doc = await self.collection.find_one_and_update(
            query,
            {
                "$set": {
                    "status": JobStatus.FAILED.value,
                    "error": error,
                    "retry_count": retry_count,
                    "stage_message": f"Failed: {error[:100]}",
                    "completed_at": now,
                }
            },
            return_document=True,
        )
        if not doc:
            return None
        return TaskJobModel(**self._serialize(doc))
