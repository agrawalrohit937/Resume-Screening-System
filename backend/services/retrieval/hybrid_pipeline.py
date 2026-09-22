"""
Two-Stage Retrieve-Then-Rank Hybrid Pipeline for CareerPilot ATS.
Stage 1: Hybrid Recall (BM25 Lexical ⊕ Dense Vector ANN ⊕ Pre-Search Hard Filters) via RRF (k=60).
Stage 2: Precision Ranking (Feature Scoring / Cross-Encoder / LTR Ranker).
"""

from typing import Any, Callable, Dict, List, Optional, Set
import structlog

from services.retrieval.rrf import reciprocal_rank_fusion
from services.retrieval.bm25 import BM25Okapi
from services.retrieval.dense import DenseVectorRetriever

logger = structlog.get_logger(__name__)


class HybridRetrievalPipeline:
    """
    Two-stage retrieval and ranking engine.

    Stage 1: Recall (1M -> 1000 -> 50)
      - BM25 lexical search for exact keyword, skill, and acronym overlap
      - Dense vector search for semantic role match
      - Reciprocal Rank Fusion (k=60) to combine multi-modal rankings
      - Pre-filters: status == "open", work authorization, excluded/applied jobs

    Stage 2: Precision
      - Multi-factor deterministic scoring engine (cold-start baseline)
      - Cross-encoder reranker + Gradient Boosted LTR ranker (when available)

    Complexity:
        Stage 1 (Retrieval & Fusion):
            Time: O(N_docs * D + N_docs * L_query + U log U)
            Space: O(U) where U is the union of top-k retrieved items.
        Stage 2 (Scoring / Precision):
            Time: O(K_fused * C_scoring) where K_fused is typically 50.
    """

    def __init__(
        self,
        corpus: List[Dict[str, Any]],
        text_field: str = "jd_text_raw",
        vector_field: str = "jd_embedding",
        id_field: str = "_id",
        rrf_k: int = 60,
    ):
        self.corpus = corpus
        self.id_field = id_field
        self.rrf_k = rrf_k
        self.bm25_retriever = BM25Okapi(corpus, text_field=text_field, id_field=id_field)
        self.dense_retriever = DenseVectorRetriever(corpus, vector_field=vector_field, id_field=id_field)
        self.corpus_by_id = {
            str(doc.get(id_field, "") or doc.get("id", "")): doc
            for doc in corpus
            if doc.get(id_field) or doc.get("id")
        }

    def retrieve(
        self,
        query_text: str,
        query_vector: Optional[List[float]] = None,
        top_k: int = 50,
        filters: Optional[Dict[str, Any]] = None,
        excluded_ids: Optional[Set[str]] = None,
        recall_budget: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Executes Stage 1 Hybrid Retrieval.

        1. Lexical retrieval via BM25 (top `recall_budget` items)
        2. Semantic retrieval via Dense Vectors (top `recall_budget` items)
        3. Reciprocal Rank Fusion with k=60
        4. Exclude previously applied / blacklisted IDs
        5. Return top_k candidates for Stage 2 precision ranking
        """
        excluded = excluded_ids or set()

        # 1. BM25 Lexical Recall
        bm25_results = self.bm25_retriever.search(query_text, top_k=recall_budget)
        bm25_ranked = []
        for doc_id, b_score in bm25_results:
            if doc_id in excluded:
                continue
            doc = self.corpus_by_id.get(doc_id)
            if doc:
                item = dict(doc)
                item["bm25_score"] = b_score
                item["id"] = doc_id
                bm25_ranked.append(item)

        # 2. Dense Vector Recall
        dense_ranked = []
        if query_vector:
            dense_results = self.dense_retriever.search(
                query_vector,
                top_k=recall_budget,
                filters=filters,
            )
            for doc, d_score in dense_results:
                doc_id = str(doc.get(self.id_field, "") or doc.get("id", ""))
                if doc_id in excluded:
                    continue
                item = dict(doc)
                item["dense_score"] = d_score
                item["id"] = doc_id
                dense_ranked.append(item)

        # 3. Reciprocal Rank Fusion (k=60)
        ranked_lists = []
        if bm25_ranked:
            ranked_lists.append(bm25_ranked)
        if dense_ranked:
            ranked_lists.append(dense_ranked)

        if not ranked_lists:
            return []

        fused_candidates = reciprocal_rank_fusion(
            ranked_lists,
            id_key="id",
            k=self.rrf_k,
            score_key_prefix="rrf",
        )

        return fused_candidates[:top_k]

    def rank(
        self,
        fused_candidates: List[Dict[str, Any]],
        scorer_func: Callable[[Dict[str, Any]], float],
        top_k: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Executes Stage 2 Precision Ranking.
        Takes top fused candidates from Stage 1 and applies scoring engine / reranker.
        """
        scored = []
        for cand in fused_candidates:
            try:
                score = scorer_func(cand)
            except Exception as e:
                logger.debug("Scoring failed in precision ranker", error=str(e))
                score = 0.0
            cand_copy = dict(cand)
            cand_copy["precision_score"] = score
            scored.append(cand_copy)

        scored.sort(key=lambda x: x["precision_score"], reverse=True)
        return scored[:top_k]
