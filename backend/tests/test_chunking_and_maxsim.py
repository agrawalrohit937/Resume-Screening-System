"""
Unit tests for Chunking & Max-Sim Late Interaction (Phase 1.2).
"""

import numpy as np
import pytest

from services.chunking_service import chunk_resume, chunk_jd, compute_max_sim_vector_score


def test_chunk_resume_structure():
    parsed = {
        "summary": "Full-stack developer with 5 years experience building scalable SaaS products.",
        "skills": ["Python", "FastAPI", "React", "Docker"],
        "experience": [
            {
                "role": "Senior Engineer",
                "company": "Acme Corp",
                "description": "Architected microservices using FastAPI and Kafka.",
                "highlights": ["Reduced latency by 40%"],
            },
            {
                "role": "Software Developer",
                "company": "Startup Labs",
                "description": "Built user-facing web apps with React.",
            },
        ],
        "education": [
            {
                "degree": "B.Tech",
                "field_of_study": "Computer Science",
                "institution": "IIT Bombay",
            }
        ],
    }

    chunks = chunk_resume(parsed, raw_text="Full text fallback")
    assert len(chunks) >= 4

    types = [c["chunk_type"] for c in chunks]
    assert "summary" in types
    assert "skills" in types
    assert "experience" in types
    assert "education" in types

    for c in chunks:
        assert "text_hash" in c
        assert len(c["text_hash"]) == 64  # SHA-256
        assert len(c["text"]) > 0


def test_chunk_jd_requirements():
    jd_text = """
    We are looking for a Senior Python Developer.
    Required Qualifications:
    - 5+ years of experience with Python and FastAPI.
    - Deep knowledge of PostgreSQL and distributed systems.
    - Must have experience with Docker and Kubernetes.
    Preferred:
    - Nice to have AWS or GCP cloud certification.
    """

    reqs = chunk_jd(jd_text, skills=["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"])
    assert len(reqs) >= 4

    # Criticality should be assigned
    criticalities = [r["criticality"] for r in reqs]
    assert all(c in (1.0, 2.0, 3.0) for c in criticalities)


def test_compute_max_sim_vector_score():
    # 3 requirements, 4 chunks, dimension = 8
    np.random.seed(42)
    req_vecs = np.random.randn(3, 8)
    chunk_vecs = np.random.randn(4, 8)

    # Normalize
    req_vecs = req_vecs / np.linalg.norm(req_vecs, axis=1, keepdims=True)
    chunk_vecs = chunk_vecs / np.linalg.norm(chunk_vecs, axis=1, keepdims=True)

    weights = np.array([3.0, 2.0, 1.0])
    req_meta = [{"text": f"Req {i}"} for i in range(3)]
    chunk_meta = [{"title": f"Chunk {i}", "chunk_type": "exp", "text": f"Content {i}"} for i in range(4)]

    score, evidence = compute_max_sim_vector_score(
        req_vectors=req_vecs,
        chunk_vectors=chunk_vecs,
        weights=weights,
        req_meta=req_meta,
        chunk_meta=chunk_meta,
    )

    assert 0.0 <= score <= 100.0
    assert len(evidence) == 3
    for ev in evidence:
        assert "best_chunk_index" in ev
        assert "raw_cosine" in ev
        assert "matched_score" in ev
        assert 0 <= ev["best_chunk_index"] < 4
