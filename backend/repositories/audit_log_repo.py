"""
Audit Log Repository — Async MongoDB Append-Only Storage for Audit Logs.
========================================================================
Strictly enforces immutable append-only constraints (mutations and deletions
raise explicit errors) and ensures tenant-scoped query capabilities.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import structlog
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from models.audit_log_model import AuditLogModel
from repositories.base_repo import BaseRepository

logger = structlog.get_logger(__name__)


class AuditLogRepository(BaseRepository):
    """
    Append-only repository for compliance audit logs.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db["audit_logs"]

    async def log_event(self, event: AuditLogModel | Dict[str, Any]) -> AuditLogModel:
        """
        Appends an immutable audit event to MongoDB audit_logs collection.
        """
        if isinstance(event, AuditLogModel):
            doc = event.model_dump(by_alias=False, exclude_none=False)
        else:
            doc = dict(event)

        if "timestamp" not in doc or doc["timestamp"] is None:
            doc["timestamp"] = datetime.now(timezone.utc)
        elif isinstance(doc["timestamp"], str):
            try:
                doc["timestamp"] = datetime.fromisoformat(doc["timestamp"])
            except Exception:
                doc["timestamp"] = datetime.now(timezone.utc)

        if "tenant_id" not in doc or not doc["tenant_id"]:
            doc["tenant_id"] = "default"

        # Pop id if None or empty
        if "_id" in doc and doc["_id"] is None:
            doc.pop("_id")
        if "id" in doc and doc["id"] is None:
            doc.pop("id")

        res = await self.collection.insert_one(doc)
        doc["_id"] = str(res.inserted_id)
        doc["id"] = str(res.inserted_id)
        return AuditLogModel(**doc)

    async def query_logs(
        self,
        tenant_id: str,
        actor_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        action: Optional[str] = None,
        resource_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[AuditLogModel], int]:
        """
        Queries audit logs with multi-tenant filtering, optional criteria, and pagination.
        """
        filter_query: Dict[str, Any] = {}
        if tenant_id != "*":
            filter_query["tenant_id"] = tenant_id

        if actor_id:
            filter_query["actor_id"] = actor_id
        if resource_type:
            filter_query["resource_type"] = resource_type
        if action:
            filter_query["action"] = action
        if resource_id:
            filter_query["resource_id"] = resource_id

        if start_time or end_time:
            time_filter: Dict[str, Any] = {}
            if start_time:
                time_filter["$gte"] = start_time
            if end_time:
                time_filter["$lte"] = end_time
            filter_query["timestamp"] = time_filter

        total_count = await self.collection.count_documents(filter_query)
        cursor = self.collection.find(filter_query).sort("timestamp", -1).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)

        results = []
        for d in docs:
            d["_id"] = str(d["_id"])
            results.append(AuditLogModel(**d))

        return results, total_count

    async def update(self, *args, **kwargs):
        """Forbidden: Audit logs are immutable."""
        raise RuntimeError("Audit log entries are immutable and cannot be modified.")

    async def update_one(self, *args, **kwargs):
        """Forbidden: Audit logs are immutable."""
        raise RuntimeError("Audit log entries are immutable and cannot be modified.")

    async def delete(self, *args, **kwargs):
        """Forbidden: Audit logs are immutable."""
        raise RuntimeError("Audit log entries are immutable and cannot be deleted.")

    async def delete_one(self, *args, **kwargs):
        """Forbidden: Audit logs are immutable."""
        raise RuntimeError("Audit log entries are immutable and cannot be deleted.")

    async def delete_many(self, *args, **kwargs):
        """Forbidden: Audit logs are immutable."""
        raise RuntimeError("Audit log entries are immutable and cannot be deleted.")
