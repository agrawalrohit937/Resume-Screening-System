"""
Copilot Repository — Async MongoDB Persistence for Copilot v2
==============================================================
Provides strictly scoped tenant_id + user_id database operations for:
- copilot_sessions
- copilot_messages
- copilot_memory (with 40-item LRU capacity enforcement)
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
import structlog
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from models.copilot_model import (
    CopilotSessionModel,
    CopilotMessageModel,
    CopilotMemoryModel,
)
from repositories.base_repo import BaseRepository

logger = structlog.get_logger(__name__)

MAX_USER_MEMORY_ITEMS = 40


class CopilotRepository(BaseRepository):
    """
    Repository for all Copilot v2 persistence and memory operations.
    Enforces multi-tenant data isolation and candidate ownership on every query.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.sessions = db.copilot_sessions
        self.messages = db.copilot_messages
        self.memory = db.copilot_memory

    # ─── Sessions ─────────────────────────────────────────────────────────────

    async def create_session(
        self,
        tenant_id: str,
        user_id: str,
        title: Optional[str] = None,
    ) -> CopilotSessionModel:
        now = datetime.now(timezone.utc)
        tenant_id = tenant_id or "default"
        doc = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "title": title or "New Conversation",
            "created_at": now,
            "updated_at": now,
            "last_message_preview": None,
            "message_count": 0,
            "pinned": False,
            "archived": False,
            "total_tokens": 0,
            "total_cost_usd": 0.0,
            "deleted_at": None,
        }
        res = await self.sessions.insert_one(doc)
        doc["_id"] = str(res.inserted_id)
        return CopilotSessionModel(**doc)

    async def get_or_create_session(
        self,
        tenant_id: str,
        user_id: str,
        session_id: Optional[str] = None,
        initial_title: Optional[str] = None,
    ) -> CopilotSessionModel:
        if session_id:
            try:
                doc = await self.sessions.find_one({
                    "_id": ObjectId(session_id),
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "deleted_at": None,
                })
                if doc:
                    return CopilotSessionModel(**self._serialize(doc))
            except Exception as e:
                logger.debug("Invalid session_id lookup", session_id=session_id, error=str(e))
        
        return await self.create_session(tenant_id, user_id, title=initial_title)

    async def get_session(
        self,
        tenant_id: str,
        user_id: str,
        session_id: str,
    ) -> Optional[CopilotSessionModel]:
        try:
            doc = await self.sessions.find_one({
                "_id": ObjectId(session_id),
                "tenant_id": tenant_id,
                "user_id": user_id,
                "deleted_at": None,
            })
            if not doc:
                return None
            return CopilotSessionModel(**self._serialize(doc))
        except Exception:
            return None

    async def list_sessions(
        self,
        tenant_id: str,
        user_id: str,
        cursor: Optional[str] = None,
        limit: int = 20,
        include_archived: bool = False,
    ) -> Dict[str, Any]:
        """
        Returns cursor-paginated active sessions for user and tenant.
        Sort order: pinned (desc), updated_at (desc), _id (desc).
        """
        filter_query: Dict[str, Any] = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "deleted_at": None,
        }
        if not include_archived:
            filter_query["archived"] = {"$ne": True}

        if cursor:
            try:
                # cursor is the last session ObjectId
                cursor_doc = await self.sessions.find_one({
                    "_id": ObjectId(cursor),
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                })
                if cursor_doc:
                    cursor_updated = cursor_doc.get("updated_at")
                    filter_query["updated_at"] = {"$lt": cursor_updated}
            except Exception as e:
                logger.debug("Failed to decode cursor for sessions", cursor=cursor, error=str(e))

        cursor_obj = self.sessions.find(filter_query).sort([
            ("pinned", DESCENDING),
            ("updated_at", DESCENDING),
            ("_id", DESCENDING),
        ]).limit(limit + 1)

        docs = await cursor_obj.to_list(length=limit + 1)
        has_more = len(docs) > limit
        if has_more:
            items = docs[:limit]
            next_cursor = str(items[-1]["_id"])
        else:
            items = docs
            next_cursor = None

        serialized = [CopilotSessionModel(**self._serialize(d)) for d in items]
        return {
            "sessions": serialized,
            "next_cursor": next_cursor,
            "has_more": has_more,
        }

    async def update_session(
        self,
        tenant_id: str,
        user_id: str,
        session_id: str,
        title: Optional[str] = None,
        pinned: Optional[bool] = None,
        archived: Optional[bool] = None,
    ) -> Optional[CopilotSessionModel]:
        try:
            updates: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}
            if title is not None:
                updates["title"] = title.strip()
            if pinned is not None:
                updates["pinned"] = pinned
            if archived is not None:
                updates["archived"] = archived

            doc = await self.sessions.find_one_and_update(
                {
                    "_id": ObjectId(session_id),
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "deleted_at": None,
                },
                {"$set": updates},
                return_document=True,
            )
            if not doc:
                return None
            return CopilotSessionModel(**self._serialize(doc))
        except Exception:
            return None

    async def soft_delete_session(
        self,
        tenant_id: str,
        user_id: str,
        session_id: str,
    ) -> bool:
        try:
            res = await self.sessions.update_one(
                {
                    "_id": ObjectId(session_id),
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "deleted_at": None,
                },
                {"$set": {"deleted_at": datetime.now(timezone.utc)}},
            )
            return res.modified_count > 0
        except Exception:
            return False

    # ─── Messages ─────────────────────────────────────────────────────────────

    async def append_message(
        self,
        tenant_id: str,
        user_id: str,
        session_id: str,
        role: str,
        content: str,
        ui_cards: Optional[List[Dict[str, Any]]] = None,
        citations: Optional[List[Dict[str, Any]]] = None,
        tool_calls: Optional[List[Dict[str, Any]]] = None,
        model_used: Optional[str] = None,
        provider_used: Optional[str] = None,
        latency_ms: Optional[int] = None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
    ) -> CopilotMessageModel:
        now = datetime.now(timezone.utc)
        msg_doc = {
            "session_id": str(session_id),
            "tenant_id": tenant_id,
            "user_id": user_id,
            "role": role,
            "content": content,
            "ui_cards": ui_cards or [],
            "citations": citations or [],
            "tool_calls": tool_calls or [],
            "model_used": model_used,
            "provider_used": provider_used,
            "latency_ms": latency_ms,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "feedback": None,
            "feedback_note": None,
            "created_at": now,
        }
        res = await self.messages.insert_one(msg_doc)
        msg_doc["_id"] = str(res.inserted_id)

        # Update parent session stats
        snippet = (content[:120] + "...") if len(content) > 120 else content
        total_tokens = prompt_tokens + completion_tokens
        # Basic cost estimate: ~$0.50 per 1M tokens (average blend across Groq / Gemini Flash)
        cost_usd = round((total_tokens / 1_000_000) * 0.50, 6)

        try:
            await self.sessions.update_one(
                {"_id": ObjectId(session_id), "tenant_id": tenant_id, "user_id": user_id},
                {
                    "$inc": {"message_count": 1, "total_tokens": total_tokens, "total_cost_usd": cost_usd},
                    "$set": {"updated_at": now, "last_message_preview": snippet},
                },
            )
        except Exception as e:
            logger.warning("Failed to update session stats", session_id=session_id, error=str(e))

        return CopilotMessageModel(**msg_doc)

    async def list_messages(
        self,
        tenant_id: str,
        user_id: str,
        session_id: str,
        limit: int = 100,
        before_id: Optional[str] = None,
    ) -> List[CopilotMessageModel]:
        """
        Fetch transcript for a session, strictly scoped by tenant and user.
        Ordered by created_at ascending.
        """
        filter_query: Dict[str, Any] = {
            "session_id": str(session_id),
            "tenant_id": tenant_id,
            "user_id": user_id,
        }
        if before_id:
            try:
                filter_query["_id"] = {"$lt": ObjectId(before_id)}
            except Exception:
                pass

        cursor = self.messages.find(filter_query).sort("created_at", ASCENDING).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [CopilotMessageModel(**self._serialize(d)) for d in docs]

    async def get_last_user_message(
        self,
        tenant_id: str,
        user_id: str,
        session_id: str,
    ) -> Optional[CopilotMessageModel]:
        doc = await self.messages.find_one(
            {
                "session_id": str(session_id),
                "tenant_id": tenant_id,
                "user_id": user_id,
                "role": "user",
            },
            sort=[("created_at", DESCENDING)],
        )
        if not doc:
            return None
        return CopilotMessageModel(**self._serialize(doc))

    async def update_message_feedback(
        self,
        tenant_id: str,
        user_id: str,
        message_id: str,
        feedback: str,
        note: Optional[str] = None,
    ) -> bool:
        try:
            res = await self.messages.update_one(
                {
                    "_id": ObjectId(message_id),
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                },
                {
                    "$set": {
                        "feedback": feedback,
                        "feedback_note": note,
                    }
                },
            )
            return res.modified_count > 0
        except Exception:
            return False

    async def migrate_local_history(
        self,
        tenant_id: str,
        user_id: str,
        messages: List[Dict[str, Any]],
    ) -> Optional[str]:
        """
        Imports legacy localStorage messages into a new server-side session.
        Returns the new session_id.
        """
        if not messages:
            return None

        first_preview = None
        for m in messages:
            if m.get("text"):
                first_preview = m.get("text")[:60]
                break

        title = f"Migrated Chat — {first_preview}" if first_preview else "Migrated History"
        session = await self.create_session(tenant_id, user_id, title=title[:80])
        session_id = str(session.id)

        now = datetime.now(timezone.utc)
        docs_to_insert = []
        for m in messages:
            raw_role = m.get("role", "user")
            normalized_role = "assistant" if raw_role in ("bot", "assistant") else "user"
            content = m.get("text") or m.get("content") or ""
            docs_to_insert.append({
                "session_id": session_id,
                "tenant_id": tenant_id,
                "user_id": user_id,
                "role": normalized_role,
                "content": content,
                "ui_cards": [],
                "citations": [],
                "tool_calls": [],
                "model_used": "legacy-import",
                "provider_used": "localStorage",
                "latency_ms": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "feedback": None,
                "feedback_note": None,
                "created_at": now,
            })

        if docs_to_insert:
            await self.messages.insert_many(docs_to_insert)
            await self.sessions.update_one(
                {"_id": ObjectId(session_id)},
                {
                    "$set": {
                        "message_count": len(docs_to_insert),
                        "last_message_preview": docs_to_insert[-1]["content"][:120],
                        "updated_at": now,
                    }
                }
            )

        return session_id

    # ─── Durable Memory (LRU max 40) ──────────────────────────────────────────

    async def get_user_memory(
        self,
        tenant_id: str,
        user_id: str,
    ) -> List[CopilotMemoryModel]:
        cursor = self.memory.find({
            "tenant_id": tenant_id,
            "user_id": user_id,
        }).sort("updated_at", DESCENDING)
        docs = await cursor.to_list(length=MAX_USER_MEMORY_ITEMS)
        return [CopilotMemoryModel(**self._serialize(d)) for d in docs]

    async def upsert_user_memory(
        self,
        tenant_id: str,
        user_id: str,
        key: str,
        value: str,
        source_message_id: Optional[str] = None,
    ) -> CopilotMemoryModel:
        now = datetime.now(timezone.utc)
        normalized_key = key.strip().lower()

        doc = await self.memory.find_one_and_update(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "key": normalized_key,
            },
            {
                "$set": {
                    "value": value.strip(),
                    "source_message_id": source_message_id,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "created_at": now,
                }
            },
            upsert=True,
            return_document=True,
        )

        # LRU Eviction: ensure user never exceeds MAX_USER_MEMORY_ITEMS
        try:
            total_count = await self.memory.count_documents({"tenant_id": tenant_id, "user_id": user_id})
            if total_count > MAX_USER_MEMORY_ITEMS:
                # Find oldest updated items to trim
                excess = total_count - MAX_USER_MEMORY_ITEMS
                oldest_cursor = self.memory.find(
                    {"tenant_id": tenant_id, "user_id": user_id},
                    projection={"_id": 1}
                ).sort("updated_at", ASCENDING).limit(excess)
                oldest_docs = await oldest_cursor.to_list(length=excess)
                ids_to_del = [d["_id"] for d in oldest_docs]
                if ids_to_del:
                    await self.memory.delete_many({"_id": {"$in": ids_to_del}})
        except Exception as e:
            logger.warning("Copilot memory eviction check failed", error=str(e))

        return CopilotMemoryModel(**self._serialize(doc))

    async def delete_user_memory(
        self,
        tenant_id: str,
        user_id: str,
        key: str,
    ) -> bool:
        normalized_key = key.strip().lower()
        res = await self.memory.delete_one({
            "tenant_id": tenant_id,
            "user_id": user_id,
            "key": normalized_key,
        })
        return res.deleted_count > 0
