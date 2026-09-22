"""
Dense Vector Retriever for Semantic ANN Search.
Supports Atlas Vector Search ($vectorSearch) and high-performance in-memory matrix multiplication.
"""

from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import structlog

logger = structlog.get_logger(__name__)


class DenseVectorRetriever:
    """
    Retrieves top candidate documents by dense vector similarity.

    Complexity:
        In-Memory:
            Time: O(N_docs * D + N_docs log K)
            Space: O(N_docs * D)
        Atlas Search ($vectorSearch with HNSW):
            Time: O(log(N_docs) * D)
            Space: logarithmic graph traversal
    """

    def __init__(
        self,
        corpus: List[Dict[str, Any]],
        vector_field: str = "jd_embedding",
        id_field: str = "id",
    ):
        self.doc_ids: List[str] = []
        self.doc_meta: List[Dict[str, Any]] = []
        vectors: List[List[float]] = []

        for doc in corpus:
            d_id = str(doc.get(id_field, "") or doc.get("_id", ""))
            vec = doc.get(vector_field)
            if d_id and vec and isinstance(vec, (list, np.ndarray)):
                self.doc_ids.append(d_id)
                self.doc_meta.append(doc)
                vectors.append(vec)

        if vectors:
            mat = np.array(vectors, dtype=np.float32)
            # Ensure L2 normalization
            norms = np.linalg.norm(mat, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            self.matrix = mat / norms
        else:
            self.matrix = np.empty((0, 0), dtype=np.float32)

    def search(
        self,
        query_vector: List[float],
        top_k: int = 100,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[Dict[str, Any], float]]:
        """
        Computes cosine similarity against indexed document vectors and returns top_k matches.
        """
        if len(self.doc_ids) == 0 or not query_vector:
            return []

        q_vec = np.array(query_vector, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return []
        q_vec = q_vec / q_norm

        if self.matrix.shape[1] != len(q_vec):
            logger.warning(
                "Dimension mismatch in dense retrieval",
                matrix_dim=self.matrix.shape[1],
                query_dim=len(q_vec),
            )
            return []

        # Batched dot product: O(N * D)
        sims = np.dot(self.matrix, q_vec)

        # Apply in-memory pre-filters if specified
        valid_indices = []
        for idx, doc in enumerate(self.doc_meta):
            if filters:
                match = True
                for k, v in filters.items():
                    if doc.get(k) != v:
                        match = False
                        break
                if not match:
                    continue
            valid_indices.append(idx)

        if not valid_indices:
            return []

        filtered_sims = sims[valid_indices]
        top_sub_indices = np.argsort(-filtered_sims)[:top_k]

        results = []
        for sub_idx in top_sub_indices:
            orig_idx = valid_indices[sub_idx]
            results.append((self.doc_meta[orig_idx], float(sims[orig_idx])))

        return results


def build_atlas_vector_search_pipeline(
    query_vector: List[float],
    index_name: str = "vector_index",
    path: str = "jd_embedding",
    num_candidates: int = 500,
    limit: int = 100,
    filter_dict: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Builds MongoDB Atlas `$vectorSearch` pipeline stage with HNSW graph indexing.

    Complexity:
        Time: O(log(N_jobs) * D) ANN retrieval.
    """
    search_stage: Dict[str, Any] = {
        "index": index_name,
        "path": path,
        "queryVector": query_vector,
        "numCandidates": max(num_candidates, limit * 5),
        "limit": limit,
    }
    if filter_dict:
        search_stage["filter"] = filter_dict

    return [
        {"$vectorSearch": search_stage},
        {
            "$project": {
                "score": {"$meta": "vectorSearchScore"},
                "_id": 1,
                "title": 1,
                "company_name": 1,
                "status": 1,
                "location": 1,
                "work_mode": 1,
                "min_years": 1,
            }
        },
    ]
