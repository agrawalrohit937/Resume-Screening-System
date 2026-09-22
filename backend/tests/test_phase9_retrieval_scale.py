"""
Phase 9 Verification Tests: Vector Store, Hybrid Retrieval, Version Invalidation, and Latency Benchmark.
"""

import time
from unittest.mock import MagicMock
import numpy as np
import pytest

from services.retrieval.vector_store import InMemoryVectorStore
from services.retrieval.hybrid_pipeline import HybridRetrievalPipeline
from services.scoring_engine import score_resume
import services.embedding_service as emb_svc


@pytest.fixture(autouse=True)
def mock_embeddings(monkeypatch):
    """Mock local embedding calls."""
    mock_model = MagicMock()
    def fake_encode(sentences, *args, **kwargs):
        if isinstance(sentences, str):
            return np.ones(1024, dtype=np.float32)
        return np.ones((len(sentences), 1024), dtype=np.float32)
    mock_model.encode.side_effect = fake_encode
    monkeypatch.setattr("services.embedding_service.embedding_model", mock_model)
    monkeypatch.setattr("services.scoring_engine.embedding_model", mock_model)


def test_vector_store_operations_and_invalidation():
    vs = InMemoryVectorStore()

    # 1. Upsert document vectors
    vec1 = [0.1] * 1024
    vec2 = [0.5] * 1024
    vs.upsert(
        doc_id="cand_1",
        vector=vec1,
        metadata={"role": "Backend", "status": "open"},
        content_hash="hash_1",
        model_version="bge-m3-v1.0",
    )
    vs.upsert(
        doc_id="cand_2",
        vector=vec2,
        metadata={"role": "Frontend", "status": "open"},
        content_hash="hash_2",
        model_version="bge-m3-v1.0",
    )

    # 2. Get document
    doc = vs.get("cand_1")
    assert doc is not None
    assert doc["id"] == "cand_1"
    assert doc["metadata"]["role"] == "Backend"

    # 3. Search with filter
    results = vs.search(query_vector=[0.1] * 1024, top_k=5, filters={"role": "Backend"})
    assert len(results) == 1
    assert results[0][0]["id"] == "cand_1"
    assert results[0][1] >= 0.99

    # 4. Invalidate on model version change
    invalidated = vs.invalidate_by_version("bge-m3-v2.0")
    assert invalidated == 2
    assert vs.get("cand_1") is None


def test_hybrid_pipeline_retrieval():
    corpus = [
        {"id": "doc_1", "jd_text_raw": "Senior Python Developer with FastAPI and Redis experience.", "jd_embedding": [0.2] * 1024},
        {"id": "doc_2", "jd_text_raw": "React Frontend Engineer with TypeScript and Redux.", "jd_embedding": [0.8] * 1024},
    ]
    pipeline = HybridRetrievalPipeline(corpus, text_field="jd_text_raw", vector_field="jd_embedding", id_field="id")
    results = pipeline.retrieve(query_text="Python FastAPI", query_vector=[0.2] * 1024, top_k=2)

    assert len(results) >= 1
    assert results[0]["id"] == "doc_1"


def test_scoring_latency_under_1_5s():
    """
    Target Benchmark: p95 latency for one resume-JD match < 1.5s on CPU with warm cache.
    """
    resume = {
        "raw_text": "Experienced Python Backend Developer. Built FastAPI APIs and PostgreSQL databases.",
        "skills": ["Python", "FastAPI", "PostgreSQL"],
    }
    jd = {
        "text": "Senior Python Engineer with FastAPI and PostgreSQL experience.",
        "min_years": 3.0,
    }

    # Warmup
    _ = score_resume(resume, jd, mode="recruiter")

    # Measure 5 runs
    latencies = []
    for _ in range(5):
        t0 = time.perf_counter()
        _ = score_resume(resume, jd, mode="recruiter")
        latencies.append(time.perf_counter() - t0)

    p95_latency = float(np.percentile(latencies, 95))
    assert p95_latency < 1.5, f"p95 latency {p95_latency:.3f}s exceeds 1.5s threshold"
