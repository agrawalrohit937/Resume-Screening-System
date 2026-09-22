"""
Retrieval Package for CareerPilot ATS.
Two-Stage Retrieve-Then-Rank Architecture:
- BM25 Lexical Retriever
- Dense Vector Retriever
- Reciprocal Rank Fusion (k=60)
- Hybrid Retrieval Pipeline
"""

from services.retrieval.rrf import reciprocal_rank_fusion, DEFAULT_RRF_K
from services.retrieval.bm25 import BM25Okapi, build_atlas_search_bm25_pipeline, tokenize_text
from services.retrieval.dense import DenseVectorRetriever, build_atlas_vector_search_pipeline
from services.retrieval.hybrid_pipeline import HybridRetrievalPipeline

__all__ = [
    "reciprocal_rank_fusion",
    "DEFAULT_RRF_K",
    "BM25Okapi",
    "build_atlas_search_bm25_pipeline",
    "tokenize_text",
    "DenseVectorRetriever",
    "build_atlas_vector_search_pipeline",
    "HybridRetrievalPipeline",
]
