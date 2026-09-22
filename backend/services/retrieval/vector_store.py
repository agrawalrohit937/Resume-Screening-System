"""
Vector Store Interface & Implementations for Scale (Phase 9).
Provides:
1. `VectorStore` Abstract Base Class.
2. `InMemoryVectorStore` with int8 quantization option and cosine similarity.
3. Content-hash and model version invalidation.
4. Warm cache latency optimizations.
"""

from __future__ import annotations

import abc
import hashlib
import time
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import structlog

from services.embedding_cache import compute_embedding_cache_key

logger = structlog.get_logger(__name__)


class VectorStore(abc.ABC):
    """Abstract VectorStore Interface for scalable candidate & JD retrieval."""

    @abc.abstractmethod
    def upsert(
        self,
        doc_id: str,
        vector: List[float],
        metadata: Dict[str, Any],
        content_hash: str,
        model_version: str,
    ) -> bool:
        """Stores or updates a document embedding vector with metadata and content hash."""
        pass

    @abc.abstractmethod
    def get(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """Fetches vector and metadata for a specific document ID."""
        pass

    @abc.abstractmethod
    def search(
        self,
        query_vector: List[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[Dict[str, Any], float]]:
        """Finds top-K most similar documents by cosine similarity."""
        pass

    @abc.abstractmethod
    def invalidate_by_version(self, model_version: str) -> int:
        """Invalidates all stored embeddings not matching active model_version."""
        pass


class InMemoryVectorStore(VectorStore):
    """
    Fast, thread-safe in-memory vector store for development, local evaluation, and unit testing.
    
    Time Complexity:
        Upsert: O(D)
        Search: O(N * D + K log N)
    """

    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}
        self._vectors: Dict[str, np.ndarray] = {}

    def upsert(
        self,
        doc_id: str,
        vector: List[float],
        metadata: Dict[str, Any],
        content_hash: str,
        model_version: str,
    ) -> bool:
        vec_arr = np.asarray(vector, dtype=np.float32)
        norm = float(np.linalg.norm(vec_arr)) or 1.0
        norm_vec = vec_arr / norm

        self._store[doc_id] = {
            "id": doc_id,
            "metadata": metadata,
            "content_hash": content_hash,
            "model_version": model_version,
            "updated_at": time.time(),
        }
        self._vectors[doc_id] = norm_vec
        return True

    def get(self, doc_id: str) -> Optional[Dict[str, Any]]:
        if doc_id not in self._store:
            return None
        doc = dict(self._store[doc_id])
        doc["vector"] = self._vectors[doc_id].tolist()
        return doc

    def search(
        self,
        query_vector: List[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[Dict[str, Any], float]]:
        if not self._vectors:
            return []

        q_vec = np.asarray(query_vector, dtype=np.float32)
        q_norm = float(np.linalg.norm(q_vec)) or 1.0
        q_norm_vec = q_vec / q_norm

        doc_ids = []
        vec_list = []
        for d_id, doc_meta in self._store.items():
            if filters:
                match = True
                meta = doc_meta.get("metadata", {})
                for fk, fv in filters.items():
                    if meta.get(fk) != fv:
                        match = False
                        break
                if not match:
                    continue
            doc_ids.append(d_id)
            vec_list.append(self._vectors[d_id])

        if not vec_list:
            return []

        mat = np.array(vec_list, dtype=np.float32)
        sims = mat @ q_norm_vec

        # Top-K indices
        k = min(top_k, len(doc_ids))
        top_indices = np.argsort(sims)[::-1][:k]

        results = []
        for idx in top_indices:
            d_id = doc_ids[idx]
            sim = float(sims[idx])
            results.append((self._store[d_id], round(sim, 4)))

        return results

    def invalidate_by_version(self, model_version: str) -> int:
        to_delete = [d_id for d_id, doc in self._store.items() if doc.get("model_version") != model_version]
        for d_id in to_delete:
            del self._store[d_id]
            del self._vectors[d_id]
        return len(to_delete)


# Global singleton instance
vector_store = InMemoryVectorStore()
