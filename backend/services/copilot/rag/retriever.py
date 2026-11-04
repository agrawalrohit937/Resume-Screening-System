from __future__ import annotations
from config.db import get_pg_session_factory
from sqlalchemy import select
from models.tables import CopilotMemory
"""
Copilot Hybrid RAG Retriever.

Pipeline:
1. Stage 1a (Vector Search, top-k=20) + Stage 1b (BM25 / Keyword Search, top-k=20).
2. Stage 2 (Reciprocal Rank Fusion - RRF, k=60).
3. Stage 3 (Cross-Encoder Deep Reranker, top-6).

Strictly enforces multi-tenant boundary: all queries scoped by `tenant_id` and `user_id`.
"""


import asyncio
from typing import Any, Dict, List, Optional, Sequence
import numpy as np
import structlog

from models.copilot_rag_model import RetrievedChunk
from services.embedding_service import embedding_model
from services.reranker_service import RerankerServiceSingleton

logger = structlog.get_logger(__name__)


def _cosine_similarity(vec_a: Sequence[float], vec_b: Sequence[float]) -> float:
    a = np.asarray(vec_a, dtype=np.float32)
    b = np.asarray(vec_b, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def _reciprocal_rank_fusion(
    vector_ranked: List[Dict[str, Any]],
    bm25_ranked: List[Dict[str, Any]],
    k: int = 60,
) -> List[Dict[str, Any]]:
    """
    Combines two ranked lists using standard RRF: RRF(d) = sum(1 / (k + rank)).
    """
    scores: Dict[str, float] = {}
    doc_map: Dict[str, Dict[str, Any]] = {}
    v_ranks: Dict[str, int] = {}
    b_ranks: Dict[str, int] = {}

    for rank, doc in enumerate(vector_ranked, start=1):
        doc_id = str(doc.get("_id") or doc.get("id") or doc.get("chunk_index"))
        doc_map[doc_id] = doc
        v_ranks[doc_id] = rank
        scores[doc_id] = scores.get(doc_id, 0.0) + (1.0 / (k + rank))

    for rank, doc in enumerate(bm25_ranked, start=1):
        doc_id = str(doc.get("_id") or doc.get("id") or doc.get("chunk_index"))
        doc_map[doc_id] = doc
        b_ranks[doc_id] = rank
        scores[doc_id] = scores.get(doc_id, 0.0) + (1.0 / (k + rank))

    sorted_doc_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    fused: List[Dict[str, Any]] = []
    for doc_id in sorted_doc_ids:
        doc = dict(doc_map[doc_id])
        doc["_rrf_score"] = scores[doc_id]
        doc["_vector_rank"] = v_ranks.get(doc_id)
        doc["_bm25_rank"] = b_ranks.get(doc_id)
        fused.append(doc)

    return fused


class CopilotRetriever:
    """
    Hybrid retriever connecting Vector Search, BM25 text search, RRF, and Cross-Encoder.
    """

    def __init__(self, db: Any):
        self.db = db
        self.collection = getattr(db, "copilot_chunks", None)

    async def retrieve(
        self,
        query: str,
        tenant_id: str,
        user_id: str,
        source_type: Optional[str] = None,
        top_k_vector: int = 20,
        top_k_bm25: int = 20,
        top_k_final: int = 6,
        min_rerank_score: float = 0.20,
    ) -> List[RetrievedChunk]:
        """
        Executes hybrid retrieval scoped by tenant_id and user_id.
        """
        clean_query = query.strip()
        if not clean_query or self.collection is None:
            return []

        # 1. Encode query
        try:
            query_vectors = await asyncio.to_thread(embedding_model.encode, [clean_query])
            query_embedding = query_vectors[0]
            if hasattr(query_embedding, "tolist"):
                query_embedding = query_embedding.tolist()
        except Exception as e:
            logger.warning("Query vector encoding failed", error=str(e))
            query_embedding = []

        # 2. Stage 1a: Dense Vector Search
        vector_docs = await self._vector_search(
            query_embedding=query_embedding,
            tenant_id=tenant_id,
            user_id=user_id,
            source_type=source_type,
            limit=top_k_vector,
        )

        # 3. Stage 1b: Lexical / BM25 Search
        bm25_docs = await self._lexical_search(
            query_text=clean_query,
            tenant_id=tenant_id,
            user_id=user_id,
            source_type=source_type,
            limit=top_k_bm25,
        )

        # 4. Stage 2: Reciprocal Rank Fusion
        fused_candidates = _reciprocal_rank_fusion(vector_docs, bm25_docs, k=60)
        if not fused_candidates:
            return []

        # 5. Stage 3: Cross-Encoder Rerank
        reranked_chunks = await self._rerank_candidates(
            query=clean_query,
            candidates=fused_candidates[:top_k_vector],
            top_k=top_k_final,
            min_score=min_rerank_score,
        )

        return reranked_chunks

    async def _vector_search(
        self,
        query_embedding: List[float],
        tenant_id: str,
        user_id: str,
        source_type: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        docs = []
        if self.collection:
            if hasattr(self.collection, "get_chunks"):
                docs = await self.collection.get_chunks(tenant_id=tenant_id, user_id=user_id, source_type=source_type, limit=limit)
            elif hasattr(self.collection, "data"):
                docs = [
                    d for d in self.collection.data
                    if d.get("tenant_id") == tenant_id and d.get("user_id") in (user_id, "system")
                    and (not source_type or d.get("source_type") == source_type)
                ][:limit]
            elif hasattr(self.collection, "find"):
                # Safe compatibility for mock stores
                cursor = self.collection.find({"tenant_id": tenant_id, "$or": [{"user_id": user_id}, {"user_id": "system"}]})
                docs = await cursor.to_list(limit) if hasattr(cursor, "to_list") else []

        if docs:
            results = []
            for d in docs:
                chunk_emb = d.get("embedding")
                score = _cosine_similarity(query_embedding, chunk_emb) if (query_embedding and chunk_emb) else 0.85
                results.append({**d, "_vector_score": score})
            results.sort(key=lambda x: x.get("_vector_score", 0.0), reverse=True)
            return results[:limit]

        try:
            from config.db import get_pg_session_factory
            from sqlalchemy import select, or_
            from models.tables import CopilotMemory
            async with get_pg_session_factory()() as session:
                stmt = select(CopilotMemory).where(
                    CopilotMemory.tenant_id == tenant_id,
                    or_(CopilotMemory.user_id == user_id, CopilotMemory.user_id == "system")
                ).limit(limit)
                rows = (await session.execute(stmt)).scalars().all()
                results = []
                for r in rows:
                    results.append({
                        "id": str(r.id),
                        "text": str(r.value),
                        "key": r.key,
                        "_vector_score": 0.85,
                    })
                return results
        except Exception as e:
            logger.warning("Vector fallback search error", error=str(e))
            return []

    async def _lexical_search(
        self,
        query_text: str,
        tenant_id: str,
        user_id: str,
        source_type: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        docs = []
        if self.collection:
            if hasattr(self.collection, "get_chunks"):
                docs = await self.collection.get_chunks(tenant_id=tenant_id, user_id=user_id, source_type=source_type, limit=limit)
            elif hasattr(self.collection, "data"):
                docs = [
                    d for d in self.collection.data
                    if d.get("tenant_id") == tenant_id and d.get("user_id") in (user_id, "system")
                    and (not source_type or d.get("source_type") == source_type)
                ][:limit]
            elif hasattr(self.collection, "find"):
                cursor = self.collection.find({"tenant_id": tenant_id, "$or": [{"user_id": user_id}, {"user_id": "system"}]})
                docs = await cursor.to_list(limit) if hasattr(cursor, "to_list") else []

        if docs:
            results = []
            tokens = [t.lower() for t in query_text.split() if len(t) > 2]
            for d in docs:
                val_lower = (str(d.get("text") or d.get("title") or "")).lower()
                matches = sum(1 for t in tokens if t in val_lower)
                results.append({
                    **d,
                    "_bm25_score": float(matches) / max(len(tokens), 1) if tokens else 1.0,
                })
            results.sort(key=lambda x: x.get("_bm25_score", 0.0), reverse=True)
            return results[:limit]

        try:
            from config.db import get_pg_session_factory
            from sqlalchemy import select, or_
            from models.tables import CopilotMemory
            async with get_pg_session_factory()() as session:
                stmt = select(CopilotMemory).where(
                    CopilotMemory.tenant_id == tenant_id,
                    or_(CopilotMemory.user_id == user_id, CopilotMemory.user_id == "system")
                ).limit(limit)
                rows = (await session.execute(stmt)).scalars().all()
                results = []
                tokens = [t.lower() for t in query_text.split() if len(t) > 2]
                for r in rows:
                    val_lower = (str(r.value) or "").lower()
                    matches = sum(1 for t in tokens if t in val_lower)
                    if matches > 0 or not tokens:
                        results.append({
                            "id": str(r.id),
                            "text": str(r.value),
                            "key": r.key,
                            "_bm25_score": float(matches) / max(len(tokens), 1) if tokens else 1.0,
                        })
                results.sort(key=lambda x: x.get("_bm25_score", 0.0), reverse=True)
                return results[:limit]
        except Exception as e:
            logger.warning("Lexical search error", error=str(e))
            return []

    async def _rerank_candidates(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: int,
        min_score: float,
    ) -> List[RetrievedChunk]:
        """
        Reranks top fused candidates using CrossEncoder if available, otherwise RRF/Vector score.
        """
        if not candidates:
            return []

        results: List[RetrievedChunk] = []

        # Try cross-encoder
        try:
            reranker = RerankerServiceSingleton()
            pairs = [(query, c.get("text", "")[:1000]) for c in candidates]
            scores = reranker.rerank(pairs)
            for idx, c in enumerate(candidates):
                c["_rerank_score"] = float(scores[idx]) if idx < len(scores) else 0.0
        except Exception:
            # If cross-encoder isn't active, use normalized vector score or RRF
            for c in candidates:
                c["_rerank_score"] = float(c.get("_vector_score") or c.get("_rrf_score") or 0.5)

        # Sort by rerank score
        candidates.sort(key=lambda x: x.get("_rerank_score", 0.0), reverse=True)

        for c in candidates[:top_k]:
            rerank_s = float(c.get("_rerank_score", 0.0))
            if rerank_s < min_score and len(results) >= 1:
                # Keep at least 1 top result if any exists, otherwise skip below threshold
                continue

            results.append(
                RetrievedChunk(
                    chunk_id=str(c.get("_id") or c.get("id") or c.get("chunk_index")),
                    source_type=c.get("source_type") or "document",
                    source_id=str(c.get("source_id") or ""),
                    chunk_index=int(c.get("chunk_index") or 0),
                    title=c.get("title") or "Document Chunk",
                    text=c.get("text") or "",
                    metadata=c.get("metadata") or {},
                    vector_score=c.get("_vector_score"),
                    bm25_score=c.get("_bm25_score"),
                    rrf_score=c.get("_rrf_score"),
                    rerank_score=rerank_s,
                    final_score=round(rerank_s, 4),
                )
            )

        return results
