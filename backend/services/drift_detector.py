"""
Drift Detection Service — Continuous Monitoring for Scoring and Embedding Distributions.

Phase 4, Task 4.5:
- Two-sample Kolmogorov-Smirnov (KS) test for score distribution drift detection.
- Cosine distance centroid shift for high-dimensional embedding drift detection.
- Fully preserves candidate privacy & determinism (Zero raw resume text in telemetry/logs).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Union

import numpy as np
import scipy.stats as stats
import structlog
from pydantic import BaseModel, Field

from core.logging import get_trace_id

logger = structlog.get_logger(__name__)

# Default empirical reference score baseline (derived from validated evaluation set)
DEFAULT_REFERENCE_SCORES = [
    0.45, 0.48, 0.52, 0.55, 0.58, 0.60, 0.62, 0.64, 0.65, 0.66,
    0.68, 0.70, 0.71, 0.72, 0.74, 0.75, 0.76, 0.78, 0.80, 0.82,
    0.84, 0.85, 0.88, 0.90, 0.92,
]


class ScoreDriftResult(BaseModel):
    ks_statistic: float = Field(..., description="Kolmogorov-Smirnov D statistic (max CDF difference)")
    p_value: float = Field(..., description="p-value from two-sample KS test")
    drift_detected: bool = Field(..., description="True if p-value is below significance level")
    significance_level: float = Field(0.05, description="Significance alpha threshold")
    recent_sample_size: int
    reference_sample_size: int
    recent_mean: float
    reference_mean: float
    recent_std: float
    reference_std: float
    quantiles: Dict[str, Dict[str, float]]
    alert_severity: str = Field("none", description="'none', 'warning', or 'critical'")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    trace_id: Optional[str] = None


class EmbeddingDriftResult(BaseModel):
    cosine_distance: float = Field(..., description="1 - cosine_similarity between centroids")
    drift_detected: bool = Field(..., description="True if cosine distance exceeds threshold")
    drift_threshold: float = Field(0.10, description="Maximum allowable centroid cosine distance")
    sample_size: int
    embedding_dimension: int
    alert_severity: str = Field("none", description="'none', 'warning', or 'critical'")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    trace_id: Optional[str] = None


def detect_score_drift(
    recent_scores: Sequence[float],
    reference_scores: Optional[Sequence[float]] = None,
    significance_level: float = 0.05,
) -> ScoreDriftResult:
    """
    Detects score distribution drift using the two-sample Kolmogorov-Smirnov test.

    Null Hypothesis (H0): Recent scores and reference scores are drawn from the same distribution.
    If p-value < significance_level, reject H0 -> Drift detected.

    Complexity:
        Time: O(N log N + M log M) sorting for empirical CDFs.
        Space: O(N + M) arrays.
    """
    recent_clean = [float(s) for s in recent_scores if s is not None and not np.isnan(s)]
    ref_clean = [float(s) for s in (reference_scores or DEFAULT_REFERENCE_SCORES) if s is not None and not np.isnan(s)]

    if len(recent_clean) < 5:
        logger.warning("Recent score sample too small for KS-test", sample_size=len(recent_clean))
        return ScoreDriftResult(
            ks_statistic=0.0,
            p_value=1.0,
            drift_detected=False,
            significance_level=significance_level,
            recent_sample_size=len(recent_clean),
            reference_sample_size=len(ref_clean),
            recent_mean=float(np.mean(recent_clean)) if recent_clean else 0.0,
            reference_mean=float(np.mean(ref_clean)) if ref_clean else 0.0,
            recent_std=float(np.std(recent_clean)) if recent_clean else 0.0,
            reference_std=float(np.std(ref_clean)) if ref_clean else 0.0,
            quantiles={},
            alert_severity="none",
            trace_id=get_trace_id(),
        )

    res = stats.ks_2samp(recent_clean, ref_clean)
    ks_stat = float(res.statistic)
    p_val = float(res.pvalue)

    drift_detected = bool(p_val < significance_level)

    # Determine severity
    if drift_detected and p_val < 0.01:
        severity = "critical"
    elif drift_detected:
        severity = "warning"
    else:
        severity = "none"

    # Compute quantiles for distribution profiling
    percentiles = [10, 25, 50, 75, 90]
    recent_p = np.percentile(recent_clean, percentiles)
    ref_p = np.percentile(ref_clean, percentiles)

    quantiles = {
        "recent": {f"p{p}": float(v) for p, v in zip(percentiles, recent_p)},
        "reference": {f"p{p}": float(v) for p, v in zip(percentiles, ref_p)},
    }

    result = ScoreDriftResult(
        ks_statistic=round(ks_stat, 4),
        p_value=round(p_val, 5),
        drift_detected=drift_detected,
        significance_level=significance_level,
        recent_sample_size=len(recent_clean),
        reference_sample_size=len(ref_clean),
        recent_mean=round(float(np.mean(recent_clean)), 4),
        reference_mean=round(float(np.mean(ref_clean)), 4),
        recent_std=round(float(np.std(recent_clean)), 4),
        reference_std=round(float(np.std(ref_clean)), 4),
        quantiles=quantiles,
        alert_severity=severity,
        trace_id=get_trace_id(),
    )

    logger.info(
        "Score drift evaluation completed",
        ks_statistic=result.ks_statistic,
        p_value=result.p_value,
        drift_detected=result.drift_detected,
        severity=result.alert_severity,
        trace_id=result.trace_id,
    )
    return result


def detect_embedding_drift(
    recent_embeddings: Union[Sequence[Sequence[float]], np.ndarray],
    reference_centroid: Optional[Union[Sequence[float], np.ndarray]] = None,
    drift_threshold: float = 0.10,
    threshold: Optional[float] = None,
) -> EmbeddingDriftResult:
    """
    Detects high-dimensional embedding representation drift by measuring the
    cosine distance between recent vector centroids and the reference corpus centroid.

    Complexity:
        Time: O(N * D) where N is batch size and D is vector dimension.
        Space: O(D) centroid accumulation.
    """
    effective_threshold = threshold if threshold is not None else drift_threshold
    arr = np.asarray(recent_embeddings, dtype=np.float32)
    if arr.ndim == 1:
        arr = arr.reshape(1, -1)

    n_samples, dim = arr.shape
    if n_samples == 0:
        return EmbeddingDriftResult(
            cosine_distance=0.0,
            drift_detected=False,
            drift_threshold=effective_threshold,
            sample_size=0,
            embedding_dimension=dim,
            alert_severity="none",
            trace_id=get_trace_id(),
        )

    # Compute and normalize recent centroid
    recent_centroid = np.mean(arr, axis=0)
    norm = np.linalg.norm(recent_centroid)
    if norm > 1e-9:
        recent_centroid /= norm

    # Reference centroid
    if reference_centroid is not None:
        ref_c = np.asarray(reference_centroid, dtype=np.float32)
        ref_norm = np.linalg.norm(ref_c)
        if ref_norm > 1e-9:
            ref_c = ref_c / ref_norm
    else:
        # Default unit reference (first sample or synthetic baseline)
        ref_c = arr[0] / (np.linalg.norm(arr[0]) + 1e-9)

    dot_prod = float(np.dot(recent_centroid, ref_c))
    cosine_dist = max(0.0, float(1.0 - dot_prod))

    drift_detected = bool(cosine_dist > effective_threshold)
    if drift_detected and cosine_dist > (effective_threshold * 1.5):
        severity = "critical"
    elif drift_detected:
        severity = "warning"
    else:
        severity = "none"

    result = EmbeddingDriftResult(
        cosine_distance=round(cosine_dist, 5),
        drift_detected=drift_detected,
        drift_threshold=effective_threshold,
        sample_size=n_samples,
        embedding_dimension=dim,
        alert_severity=severity,
        trace_id=get_trace_id(),
    )

    logger.info(
        "Embedding drift evaluation completed",
        cosine_distance=result.cosine_distance,
        drift_detected=result.drift_detected,
        severity=result.alert_severity,
        trace_id=result.trace_id,
    )
    return result


async def record_drift_audit(
    db: Any,
    audit_type: str,
    result: Union[ScoreDriftResult, EmbeddingDriftResult, Dict[str, Any]],
) -> Optional[str]:
    """
    Persists a drift audit event into the `drift_audits` collection.
    Completely privacy-preserving: stores only mathematical aggregate statistics.
    """
    if db is None:
        return None

    try:
        data = result.model_dump() if hasattr(result, "model_dump") else dict(result)
        data["audit_type"] = audit_type
        data["created_at"] = datetime.now(timezone.utc)
        coll = getattr(db, "drift_audits", None) if hasattr(db, "drift_audits") else None
        if coll is None:
            try:
                coll = db["drift_audits"]
            except Exception:
                pass
        if coll is None:
            return None
        res = coll.insert_one(data)
        if hasattr(res, "__await__"):
            res = await res
        return str(getattr(res, "inserted_id", ""))
    except Exception as exc:
        logger.error("Failed to persist drift audit record", error=str(exc))
        return None


# Re-export ML feedback correlation helpers from telemetry module
try:
    from services.telemetry.drift_detector import (
        correlate_hire_outcomes,
        generate_hire_outcome_correlation_report,
        format_correlation_text_report,
    )
except ImportError:
    pass

