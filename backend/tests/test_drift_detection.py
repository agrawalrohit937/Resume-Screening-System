"""
Unit tests for Task 4.5: Observability, Metrics & Drift Detection.
Tests trace_id propagation and KS-test / cosine drift detection for scores and embeddings.
"""

from __future__ import annotations

import numpy as np
import pytest
from unittest.mock import AsyncMock, MagicMock

from core.logging import clear_trace_id, get_trace_id, set_trace_id, trace_context
from services.drift_detector import (
    detect_embedding_drift,
    detect_score_drift,
    record_drift_audit,
)


def test_trace_id_context_propagation():
    clear_trace_id()
    assert get_trace_id() is None

    # Manual set
    tid = set_trace_id("custom_trace_123")
    assert get_trace_id() == "custom_trace_123"
    clear_trace_id()
    assert get_trace_id() is None

    # Context manager
    with trace_context("scoped_trace_abc") as ctx_id:
        assert ctx_id == "scoped_trace_abc"
        assert get_trace_id() == "scoped_trace_abc"

    assert get_trace_id() is None

    # Auto-generated trace ID
    with trace_context() as auto_id:
        assert auto_id is not None
        assert len(auto_id) == 16
        assert get_trace_id() == auto_id

    assert get_trace_id() is None


def test_score_drift_no_drift():
    # Similar distributions
    np.random.seed(42)
    reference = np.random.normal(loc=0.70, scale=0.10, size=100).tolist()
    recent = np.random.normal(loc=0.69, scale=0.10, size=100).tolist()

    with trace_context("test_trace_eval"):
        res = detect_score_drift(recent, reference)
        assert res.drift_detected is False
        assert res.p_value > 0.05
        assert res.alert_severity == "none"
        assert res.trace_id == "test_trace_eval"
        assert "recent" in res.quantiles


def test_score_drift_detected():
    # Severely shifted distribution
    np.random.seed(42)
    reference = [0.75, 0.78, 0.80, 0.82, 0.85, 0.79, 0.81, 0.84, 0.77, 0.83]
    recent = [0.20, 0.22, 0.18, 0.25, 0.19, 0.21, 0.23, 0.17, 0.24, 0.20]

    res = detect_score_drift(recent, reference)
    assert res.drift_detected is True
    assert res.p_value < 0.01
    assert res.ks_statistic > 0.80
    assert res.alert_severity == "critical"


def test_score_drift_insufficient_sample():
    res = detect_score_drift([0.8, 0.9])
    assert res.drift_detected is False
    assert res.recent_sample_size == 2


def test_embedding_drift_no_drift():
    # Two identical centroids
    np.random.seed(42)
    base_vec = np.random.randn(768).astype(np.float32)
    base_vec /= np.linalg.norm(base_vec)

    # Slight perturbation (noise)
    perturbed = [base_vec + np.random.normal(0, 0.01, 768) for _ in range(10)]
    res = detect_embedding_drift(perturbed, reference_centroid=base_vec, threshold=0.10)

    assert res.drift_detected is False
    assert res.cosine_distance < 0.05
    assert res.alert_severity == "none"


def test_embedding_drift_detected():
    # Orthogonal vectors
    dim = 128
    ref = np.zeros(dim, dtype=np.float32)
    ref[0] = 1.0  # Points along axis 0

    recent = []
    for _ in range(10):
        v = np.zeros(dim, dtype=np.float32)
        v[1] = 1.0  # Points along axis 1 (orthogonal)
        recent.append(v)

    res = detect_embedding_drift(recent, reference_centroid=ref, threshold=0.10)
    assert res.drift_detected is True
    # Cosine distance between orthogonal vectors is 1.0
    assert res.cosine_distance > 0.90
    assert res.alert_severity == "critical"


@pytest.mark.asyncio
async def test_record_drift_audit():
    mock_db = MagicMock()
    mock_db.drift_audits.insert_one = AsyncMock(return_value=MagicMock(inserted_id="audit_12345"))

    res = detect_score_drift([0.7, 0.8, 0.75, 0.72, 0.79])
    audit_id = await record_drift_audit(mock_db, "score_ks_test", res)
    assert audit_id == "audit_12345"
    mock_db.drift_audits.insert_one.assert_called_once()
