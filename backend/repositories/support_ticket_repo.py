"""
Support Ticket Repository — Async MongoDB CRUD for support tickets
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import structlog
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.support_ticket_model import SupportTicketModel

logger = structlog.get_logger(__name__)


class SupportTicketRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.support_tickets

    def _normalize_value(self, value: Any) -> Any:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, list):
            return [self._normalize_value(item) for item in value]
        if isinstance(value, dict):
            return {key: self._normalize_value(item) for key, item in value.items()}
        return value

    def _serialize(self, doc: dict) -> dict:
        if doc and "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return self._normalize_value(doc)

    async def create(self, ticket_data: dict) -> SupportTicketModel:
        ticket_data["created_at"] = datetime.now(timezone.utc)
        ticket_data["updated_at"] = datetime.now(timezone.utc)
        result = await self.collection.insert_one(ticket_data)
        ticket_data["_id"] = str(result.inserted_id)
        return SupportTicketModel(**ticket_data)

    async def get_by_id(self, ticket_id: str) -> Optional[SupportTicketModel]:
        try:
            doc = await self.collection.find_one({"_id": ObjectId(ticket_id)})
        except Exception:
            return None
        if not doc:
            return None
        return SupportTicketModel(**self._serialize(doc))

    async def get_by_ticket_id(self, ticket_id: str) -> Optional[SupportTicketModel]:
        doc = await self.collection.find_one({"ticket_id": ticket_id})
        if not doc:
            return None
        return SupportTicketModel(**self._serialize(doc))

    async def get_user_tickets(
        self,
        user_id: str,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[SupportTicketModel], int]:
        query: Dict[str, Any] = {"user_id": user_id}
        if status:
            query["status"] = status

        total = await self.collection.count_documents(query)
        cursor = (
            self.collection.find(query)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        tickets = [SupportTicketModel(**self._serialize(d)) for d in docs]
        return tickets, total

    async def get_all_tickets(
        self,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        category: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[SupportTicketModel], int]:
        query: Dict[str, Any] = {}
        if status:
            query["status"] = status
        if priority:
            query["priority"] = priority
        if category:
            query["category"] = category

        total = await self.collection.count_documents(query)
        cursor = (
            self.collection.find(query)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        tickets = [SupportTicketModel(**self._serialize(d)) for d in docs]
        return tickets, total

    async def update_ticket(
        self, ticket_id: str, update_data: dict
    ) -> Optional[SupportTicketModel]:
        update_data["updated_at"] = datetime.now(timezone.utc)
        result = await self.collection.find_one_and_update(
            {"_id": ObjectId(ticket_id)},
            {"$set": update_data},
            return_document=True,
        )
        if not result:
            return None
        return SupportTicketModel(**self._serialize(result))

    async def add_message(
        self, ticket_id: str, message: dict
    ) -> Optional[SupportTicketModel]:
        message["created_at"] = datetime.now(timezone.utc)
        result = await self.collection.find_one_and_update(
            {"_id": ObjectId(ticket_id)},
            {
                "$push": {"messages": message},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
            return_document=True,
        )
        if not result:
            return None
        return SupportTicketModel(**self._serialize(result))

    async def add_attachment(
        self, ticket_id: str, attachment: dict
    ) -> Optional[SupportTicketModel]:
        result = await self.collection.find_one_and_update(
            {"_id": ObjectId(ticket_id)},
            {
                "$push": {"attachments": attachment},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
            return_document=True,
        )
        if not result:
            return None
        return SupportTicketModel(**self._serialize(result))

    async def update_status(
        self, ticket_id: str, status: str
    ) -> Optional[SupportTicketModel]:
        update: Dict[str, Any] = {
            "status": status,
            "updated_at": datetime.now(timezone.utc),
        }
        if status == "resolved":
            update["resolved_at"] = datetime.now(timezone.utc)
        elif status == "closed":
            update["closed_at"] = datetime.now(timezone.utc)

        result = await self.collection.find_one_and_update(
            {"_id": ObjectId(ticket_id)},
            {"$set": update},
            return_document=True,
        )
        if not result:
            return None
        return SupportTicketModel(**self._serialize(result))

    async def count_by_user(self, user_id: str) -> int:
        return await self.collection.count_documents({"user_id": user_id})

    async def count_open_by_user(self, user_id: str) -> int:
        return await self.collection.count_documents(
            {"user_id": user_id, "status": {"$nin": ["resolved", "closed"]}}
        )

    async def get_ticket_stats(self) -> dict:
        pipeline = [
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1},
            }},
        ]
        cursor = self.collection.aggregate(pipeline)
        stats = {"open": 0, "in_progress": 0, "waiting_for_customer": 0, "resolved": 0, "closed": 0}
        async for doc in cursor:
            stats[doc["_id"]] = doc["count"]
        total = await self.collection.count_documents({})
        return {"by_status": stats, "total": total}

