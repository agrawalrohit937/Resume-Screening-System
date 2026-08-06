"""
Career Application Repository — Async MongoDB CRUD for career page submissions
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import structlog
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.career_application_model import (
    CareerApplicationModel,
    CAREER_APPLICATION_COLLECTION,
)

logger = structlog.get_logger(__name__)


class CareerApplicationRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db[CAREER_APPLICATION_COLLECTION]

    def _serialize(self, doc: dict) -> dict:
        """Normalize ObjectId and datetime fields for Pydantic."""
        if doc and "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return doc

    async def create(self, data: dict) -> CareerApplicationModel:
        data["created_at"] = datetime.now(timezone.utc)
        data["updated_at"] = datetime.now(timezone.utc)
        result = await self.collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return CareerApplicationModel(**data)

    async def get_by_id(self, app_id: str) -> Optional[CareerApplicationModel]:
        try:
            doc = await self.collection.find_one({"_id": ObjectId(app_id)})
        except Exception:
            return None
        if not doc:
            return None
        return CareerApplicationModel(**self._serialize(doc))

    async def get_all(
        self,
        *,
        status: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[CareerApplicationModel], int]:
        query: Dict[str, Any] = {}
        if status:
            query["status"] = status
        if search:
            query["$or"] = [
                {"applicant_name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"role_title": {"$regex": search, "$options": "i"}},
            ]

        total = await self.collection.count_documents(query)
        cursor = (
            self.collection.find(query)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        apps = [CareerApplicationModel(**self._serialize(d)) for d in docs]
        return apps, total

    async def update_status(
        self,
        app_id: str,
        status: str,
        admin_notes: Optional[str] = None,
    ) -> Optional[CareerApplicationModel]:
        update: Dict[str, Any] = {
            "status": status,
            "updated_at": datetime.now(timezone.utc),
        }
        if admin_notes is not None:
            update["admin_notes"] = admin_notes

        try:
            result = await self.collection.find_one_and_update(
                {"_id": ObjectId(app_id)},
                {"$set": update},
                return_document=True,
            )
        except Exception:
            return None
        if not result:
            return None
        return CareerApplicationModel(**self._serialize(result))

    async def count_by_status(self) -> dict:
        pipeline = [
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        ]
        cursor = self.collection.aggregate(pipeline)
        stats = {
            "applied": 0,
            "shortlisted": 0,
            "interviewed": 0,
            "rejected": 0,
            "hired": 0,
        }
        async for doc in cursor:
            if doc["_id"] in stats:
                stats[doc["_id"]] = doc["count"]
        total = await self.collection.count_documents({})
        return {"by_status": stats, "total": total}
