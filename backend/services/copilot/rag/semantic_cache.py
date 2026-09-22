"""
Semantic Response Cache for CareerShala Copilot.

Stores vector-indexed assistant responses keyed by (tenant_id, user_id, context_version).
If a user query matches a previously answered query with cosine similarity >= 0.97
and the underlying resume/context version has not changed, the response is replayed
immediately with zero LLM inference cost.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import hashlib
import time
from typing import Any, Dict, List, Optional, Sequence
import numpy as np
import structlog

from services.embedding_service import embedding_model

logger = structlog.get_logger(__name__)

CACHE_SIMILARITY_THRESHOLD = 0.97
MAX_IN_MEMORY_ENTRIES = 500


def _cosine_similarity(vec_a: Sequence[float], vec_b: Sequence[float]) -> float:
    a = np.asarray(vec_a, dtype=np.float32)
    b = np.asarray(vec_b, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def compute_context_version(resume_data: Optional[Dict[str, Any]] = None, user_profile: Optional[Dict[str, Any]] = None) -> str:
    """
    Computes a deterministic context version string.
    Invalidates when resume or user profile data changes.
    """
    raw_str = ""
    if resume_data:
        raw_str += str(resume_data.get("updated_at") or resume_data.get("_id") or "")
        raw_str += str(len(resume_data.get("skills") or []))
        raw_str += str(len(resume_data.get("experience") or []))
    if user_profile:
        raw_str += str(user_profile.get("updated_at") or user_profile.get("email") or "")
    if not raw_str:
        raw_str = "default_context_v1"
    return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()[:16]


class SemanticResponseCache:
    """
    Thread-safe semantic response cache with dual in-memory + MongoDB persistence.
    """

    def __init__(self, db: Optional[Any] = None):
        self.db = db
        self.collection = getattr(db, "copilot_cache", None) if db else None
        # Local in-memory cache: (tenant_id, user_id) -> list of entries
        self._memory_cache: Dict[str, List[Dict[str, Any]]] = {}

    async def get(
        self,
        query: str,
        tenant_id: str,
        user_id: str,
        context_version: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Looks up a cached response if query similarity >= 0.97 and context_version matches.
        """
        clean_query = query.strip()
        if not clean_query or len(clean_query) < 5:
            return None

        # 1. Vectorize query
        try:
            vectors = await asyncio.to_thread(embedding_model.encode, [clean_query])
            query_vec = vectors[0]
            if hasattr(query_vec, "tolist"):
                query_vec = query_vec.tolist()
        except Exception as e:
            logger.warning("Cache query encoding failed", error=str(e))
            return None

        user_key = f"{tenant_id}:{user_id}"

        # 2. Check in-memory first
        mem_entries = self._memory_cache.get(user_key, [])
        for entry in mem_entries:
            if entry.get("context_version") != context_version:
                continue
            sim = _cosine_similarity(query_vec, entry.get("embedding", []))
            if sim >= CACHE_SIMILARITY_THRESHOLD:
                logger.info("Semantic cache memory HIT", similarity=sim, query=clean_query[:50])
                return {
                    "text": entry["text"],
                    "citations": entry.get("citations", []),
                    "suggestions": entry.get("suggestions", []),
                    "similarity": sim,
                    "cache_hit": True,
                }

        # 3. Check MongoDB copilot_cache
        if self.collection is not None:
            try:
                cursor = self.collection.find({
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "context_version": context_version,
                })
                db_entries = await cursor.to_list(length=50)
                for entry in db_entries:
                    sim = _cosine_similarity(query_vec, entry.get("embedding", []))
                    if sim >= CACHE_SIMILARITY_THRESHOLD:
                        logger.info("Semantic cache DB HIT", similarity=sim, query=clean_query[:50])
                        # Populate in-memory cache
                        self._add_to_memory(user_key, entry)
                        return {
                            "text": entry["text"],
                            "citations": entry.get("citations", []),
                            "suggestions": entry.get("suggestions", []),
                            "similarity": sim,
                            "cache_hit": True,
                        }
            except Exception as e:
                logger.warning("Semantic cache DB read error", error=str(e))

        return None

    async def set(
        self,
        query: str,
        response_text: str,
        tenant_id: str,
        user_id: str,
        context_version: str,
        citations: Optional[List[Dict[str, Any]]] = None,
        suggestions: Optional[List[str]] = None,
        has_tool_actions: bool = False,
    ) -> None:
        """
        Stores query embedding, response text, citations, and context_version.
        Only caches pure read-only Q&A responses; turns with tool executions or dynamic actions are bypassed.
        """
        if has_tool_actions:
            logger.debug("Skipping semantic cache storage for tool-invoking turn")
            return

        clean_query = query.strip()
        if not clean_query or not response_text:
            return

        try:
            vectors = await asyncio.to_thread(embedding_model.encode, [clean_query])
            query_vec = vectors[0]
            if hasattr(query_vec, "tolist"):
                query_vec = query_vec.tolist()
        except Exception:
            return

        entry = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "context_version": context_version,
            "query": clean_query,
            "text": response_text,
            "citations": citations or [],
            "suggestions": suggestions or [],
            "embedding": query_vec,
            "created_at": datetime.now(timezone.utc),
        }

        user_key = f"{tenant_id}:{user_id}"
        self._add_to_memory(user_key, entry)

        if self.collection is not None:
            try:
                await self.collection.insert_one(dict(entry))
            except Exception as e:
                logger.warning("Semantic cache DB write error", error=str(e))

    def _add_to_memory(self, user_key: str, entry: Dict[str, Any]) -> None:
        if user_key not in self._memory_cache:
            self._memory_cache[user_key] = []
        entries = self._memory_cache[user_key]
        entries.append(entry)
        # Cap per-user in-memory cache to 20 entries
        if len(entries) > 20:
            entries.pop(0)

    def clear_user_cache(self, tenant_id: str, user_id: str) -> None:
        """Invalidates user cache upon major profile or resume updates."""
        user_key = f"{tenant_id}:{user_id}"
        self._memory_cache.pop(user_key, None)
