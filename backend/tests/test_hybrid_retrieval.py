"""
Unit tests for Task 3.1: Two-Stage Retrieve-Then-Rank Architecture.
Tests BM25 lexical search, Dense vector ANN search, Reciprocal Rank Fusion (k=60),
and end-to-end two-stage retrieval pipeline.
"""

import pytest
import numpy as np

from services.retrieval.rrf import reciprocal_rank_fusion
from services.retrieval.bm25 import BM25Okapi, tokenize_text
from services.retrieval.dense import DenseVectorRetriever
from services.retrieval.hybrid_pipeline import HybridRetrievalPipeline


def test_tokenize_text_and_stopword_removal():
    text = "The Senior Python Developer with FastAPI and PostgreSQL in Bangalore!"
    tokens = tokenize_text(text)
    assert "senior" in tokens
    assert "python" in tokens
    assert "developer" in tokens
    assert "fastapi" in tokens
    assert "postgresql" in tokens
    assert "the" not in tokens
    assert "with" not in tokens
    assert "in" not in tokens
    assert "and" not in tokens


def test_rrf_scoring_and_fusion_logic():
    # List 1: Dense ANN results
    list1 = [
        {"id": "job-A", "title": "Backend Python Engineer"},
        {"id": "job-B", "title": "Fullstack React Developer"},
        {"id": "job-C", "title": "Data Scientist"},
    ]
    # List 2: Lexical BM25 results
    list2 = [
        {"id": "job-B", "title": "Fullstack React Developer"},
        {"id": "job-A", "title": "Backend Python Engineer"},
        {"id": "job-D", "title": "DevOps Engineer"},
    ]

    fused = reciprocal_rank_fusion([list1, list2], id_key="id", k=60)

    assert len(fused) == 4
    # job-A rank: list1=1, list2=2 -> 1/61 + 1/62 = 0.016393 + 0.016129 = 0.032522
    # job-B rank: list1=2, list2=1 -> 1/62 + 1/61 = 0.032522
    # Both job-A and job-B should be top 2
    top_ids = {fused[0]["id"], fused[1]["id"]}
    assert top_ids == {"job-A", "job-B"}

    # Documents present in both lists must rank strictly higher than documents present in only one list
    job_c = next(item for item in fused if item["id"] == "job-C")
    job_d = next(item for item in fused if item["id"] == "job-D")
    assert fused[0]["rrf_score"] > job_c["rrf_score"]
    assert fused[0]["rrf_score"] > job_d["rrf_score"]

    # Verify RRF formula
    expected_score_c = 1.0 / (60 + 3)  # rank 3 in list1
    assert pytest.approx(job_c["rrf_score"], rel=1e-4) == expected_score_c


def test_bm25_lexical_search():
    corpus = [
        {"_id": "doc1", "text": "Senior Python Developer specializing in FastAPI, microservices, and Docker."},
        {"_id": "doc2", "text": "Frontend UI Developer with React, Next.js, and Tailwind CSS."},
        {"_id": "doc3", "text": "DevOps Cloud Engineer with Kubernetes, Terraform, and AWS CI/CD pipelines."},
    ]

    bm25 = BM25Okapi(corpus, text_field="text", id_field="_id")
    assert bm25.corpus_size == 3

    # Query for Python FastAPI
    results = bm25.search("Python FastAPI microservices", top_k=2)
    assert len(results) >= 1
    top_id, top_score = results[0]
    assert top_id == "doc1"
    assert top_score > 0.0

    # Query for Kubernetes
    results_k8s = bm25.search("Kubernetes cloud infrastructure", top_k=2)
    assert len(results_k8s) >= 1
    assert results_k8s[0][0] == "doc3"


def test_dense_vector_retriever():
    # 4-dimensional mock vectors for unit testing
    corpus = [
        {"_id": "job1", "jd_embedding": [1.0, 0.0, 0.0, 0.0], "status": "open", "title": "Job 1"},
        {"_id": "job2", "jd_embedding": [0.0, 1.0, 0.0, 0.0], "status": "open", "title": "Job 2"},
        {"_id": "job3", "jd_embedding": [0.0, 0.0, 1.0, 0.0], "status": "closed", "title": "Job 3"},
    ]

    retriever = DenseVectorRetriever(corpus, vector_field="jd_embedding", id_field="_id")

    # Query aligned with job2
    query_vec = [0.1, 0.95, 0.0, 0.0]
    results = retriever.search(query_vec, top_k=2)
    assert len(results) >= 1
    top_doc, top_sim = results[0]
    assert top_doc["_id"] == "job2"
    assert top_sim > 0.90

    # Test filtering status == 'open'
    results_filtered = retriever.search(
        [0.0, 0.0, 1.0, 0.0],  # Exactly matches closed job3
        top_k=2,
        filters={"status": "open"}
    )
    # job3 is closed so it should not appear
    assert not any(d["_id"] == "job3" for d, _ in results_filtered)


def test_two_stage_hybrid_retrieval_pipeline():
    corpus = [
        {
            "_id": "j1",
            "jd_text_raw": "Python FastAPI backend engineer microservices architecture",
            "jd_embedding": [0.9, 0.1, 0.0, 0.0],
            "title": "Backend Engineer",
            "status": "open",
        },
        {
            "_id": "j2",
            "jd_text_raw": "Python React full stack developer web applications",
            "jd_embedding": [0.6, 0.6, 0.0, 0.0],
            "title": "Full Stack Developer",
            "status": "open",
        },
        {
            "_id": "j3",
            "jd_text_raw": "Registered Staff Nurse ICU clinical patient care",
            "jd_embedding": [0.0, 0.0, 0.9, 0.1],
            "title": "Staff Nurse",
            "status": "open",
        },
    ]

    pipeline = HybridRetrievalPipeline(
        corpus=corpus,
        text_field="jd_text_raw",
        vector_field="jd_embedding",
        id_field="_id",
        rrf_k=60,
    )

    # Stage 1: Retrieve for a Python query
    fused_candidates = pipeline.retrieve(
        query_text="Python FastAPI backend",
        query_vector=[0.9, 0.1, 0.0, 0.0],
        top_k=2,
        excluded_ids={"j3"},  # Exclude unrelated or applied
    )

    assert len(fused_candidates) == 2
    assert fused_candidates[0]["id"] == "j1"
    assert "rrf_score" in fused_candidates[0]
    assert "rrf_ranks" in fused_candidates[0]

    # Stage 2: Precision Ranker
    def mock_precision_scorer(doc: dict) -> float:
        # Simple scoring simulation
        if "FastAPI" in doc.get("jd_text_raw", ""):
            return 92.5
        return 75.0

    ranked = pipeline.rank(fused_candidates, scorer_func=mock_precision_scorer, top_k=2)
    assert len(ranked) == 2
    assert ranked[0]["id"] == "j1"
    assert ranked[0]["precision_score"] == 92.5
    assert ranked[1]["precision_score"] == 75.0
