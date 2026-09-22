"""
Drift Detection & Hire Outcome ML Feedback Correlation Service.

Provides:
- Kolmogorov-Smirnov (KS) two-sample test for score distribution drift.
- Centroid cosine distance test for high-dimensional embedding drift.
- Point-Biserial correlation between ATS match scores and real-world candidate hire outcomes.
- Score bracket conversion profiling (Precision@TopK and Quintile Conversion).
- Text and JSON report generation for ML model calibration and feedback loops.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

import numpy as np
import scipy.stats as stats
import structlog
from pydantic import BaseModel, Field

from core.logging import get_trace_id
from services.multi_tenancy.tenant_context import get_current_tenant_id

logger = structlog.get_logger(__name__)

# Default empirical reference score baseline
DEFAULT_REFERENCE_SCORES = [
    0.45, 0.48, 0.52, 0.55, 0.58, 0.60, 0.62, 0.64, 0.65, 0.66,
    0.68, 0.70, 0.71, 0.72, 0.74, 0.75, 0.76, 0.78, 0.80, 0.82,
    0.84, 0.85, 0.88, 0.90, 0.92,
]

POSITIVE_OUTCOMES = {"hired", "probation_passed", "accepted", "offer_accepted", "hire"}
NEGATIVE_OUTCOMES = {"rejected", "interview_failed", "knocked_out", "reject", "failed"}


class ScoreDriftResult(BaseModel):
    ks_statistic: float = Field(..., description="Kolmogorov-Smirnov D statistic")
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

    severity = "none"
    if drift_detected and p_val < 0.01:
        severity = "critical"
    elif drift_detected:
        severity = "warning"

    percentiles = [10, 25, 50, 75, 90]
    recent_p = np.percentile(recent_clean, percentiles)
    ref_p = np.percentile(ref_clean, percentiles)

    quantiles = {
        "recent": {f"p{p}": float(v) for p, v in zip(percentiles, recent_p)},
        "reference": {f"p{p}": float(v) for p, v in zip(percentiles, ref_p)},
    }

    return ScoreDriftResult(
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


def detect_embedding_drift(
    recent_embeddings: Union[Sequence[Sequence[float]], np.ndarray],
    reference_centroid: Optional[Union[Sequence[float], np.ndarray]] = None,
    drift_threshold: float = 0.10,
    threshold: Optional[float] = None,
) -> EmbeddingDriftResult:
    """
    Detects high-dimensional embedding representation drift.
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

    recent_centroid = np.mean(arr, axis=0)
    norm = np.linalg.norm(recent_centroid)
    if norm > 1e-9:
        recent_centroid /= norm

    if reference_centroid is not None:
        ref_c = np.asarray(reference_centroid, dtype=np.float32)
        ref_norm = np.linalg.norm(ref_c)
        if ref_norm > 1e-9:
            ref_c = ref_c / ref_norm
    else:
        ref_c = arr[0] / (np.linalg.norm(arr[0]) + 1e-9)

    dot_prod = float(np.dot(recent_centroid, ref_c))
    cosine_dist = max(0.0, float(1.0 - dot_prod))
    drift_detected = bool(cosine_dist > effective_threshold)

    severity = "none"
    if drift_detected and cosine_dist > (effective_threshold * 1.5):
        severity = "critical"
    elif drift_detected:
        severity = "warning"

    return EmbeddingDriftResult(
        cosine_distance=round(cosine_dist, 5),
        drift_detected=drift_detected,
        drift_threshold=effective_threshold,
        sample_size=n_samples,
        embedding_dimension=dim,
        alert_severity=severity,
        trace_id=get_trace_id(),
    )


def correlate_hire_outcomes(
    records: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Correlates ATS evaluation match scores against actual candidate hire outcomes.

    Calculates:
    - Point-biserial correlation (r_pb) between continuous score and binary hire outcome.
    - Mean and standard deviation by outcome group (Hired vs Rejected).
    - Conversion rate across score brackets ([90-100], [80-89], [70-79], [60-69], [<60]).
    - ML Calibration status and recommendations.
    """
    hired_scores: List[float] = []
    rejected_scores: List[float] = []
    all_pairs: List[Tuple[float, int]] = []

    # Score bracket counters: {bracket_label: [hired_count, total_count]}
    brackets = {
        "90-100": [0, 0],
        "80-89": [0, 0],
        "70-79": [0, 0],
        "60-69": [0, 0],
        "0-59": [0, 0],
    }

    for rec in records:
        score = rec.get("final_score")
        if score is None:
            score = rec.get("match_score")
        if score is None:
            continue

        try:
            score_val = float(score)
            # Normalize 0.0-1.0 scale to 0-100 if necessary
            if score_val <= 1.0 and score_val > 0.0:
                score_val *= 100.0
        except (ValueError, TypeError):
            continue

        outcome_raw = str(rec.get("hire_outcome") or rec.get("stage") or "").lower().strip()

        is_hired = outcome_raw in POSITIVE_OUTCOMES or outcome_raw == "hired"
        is_rejected = outcome_raw in NEGATIVE_OUTCOMES or outcome_raw == "rejected"

        if is_hired:
            hired_scores.append(score_val)
            all_pairs.append((score_val, 1))
        elif is_rejected:
            rejected_scores.append(score_val)
            all_pairs.append((score_val, 0))

        # Classify into bracket
        if is_hired or is_rejected:
            if score_val >= 90:
                b = "90-100"
            elif score_val >= 80:
                b = "80-89"
            elif score_val >= 70:
                b = "70-79"
            elif score_val >= 60:
                b = "60-69"
            else:
                b = "0-59"

            brackets[b][1] += 1
            if is_hired:
                brackets[b][0] += 1

    total_evaluated = len(all_pairs)
    n_hired = len(hired_scores)
    n_rejected = len(rejected_scores)

    if total_evaluated >= 2 and n_hired > 0 and n_rejected > 0:
        scores_arr = np.array([p[0] for p in all_pairs])
        labels_arr = np.array([p[1] for p in all_pairs])

        # Point-biserial correlation
        pb_res = stats.pointbiserialr(labels_arr, scores_arr)
        r_pb = float(pb_res.correlation)
        p_val = float(pb_res.pvalue)
    else:
        r_pb = 0.0
        p_val = 1.0

    bracket_conversions = {}
    for b_name, (h_cnt, tot_cnt) in brackets.items():
        rate = round((h_cnt / tot_cnt) * 100.0, 2) if tot_cnt > 0 else 0.0
        bracket_conversions[b_name] = {
            "hired": h_cnt,
            "total": tot_cnt,
            "conversion_rate_pct": rate,
        }

    # Calibration health evaluation
    top_tier_conv = bracket_conversions["90-100"]["conversion_rate_pct"]
    low_tier_conv = bracket_conversions["0-59"]["conversion_rate_pct"]

    if total_evaluated < 10:
        calibration_status = "insufficient_data"
        recommendation = "Collect more candidate hire decisions (minimum 10) for statistically significant calibration."
    elif r_pb >= 0.40 and top_tier_conv > low_tier_conv:
        calibration_status = "healthy"
        recommendation = "Strong positive correlation between ATS match scores and hiring outcomes. Scoring weights are well calibrated."
    elif r_pb >= 0.15:
        calibration_status = "moderate"
        recommendation = "Moderate correlation detected. Consider fine-tuning skill vs experience weighting on recruiter job templates."
    else:
        calibration_status = "miscalibrated"
        recommendation = "Weak or negative correlation detected. ATS scoring may require recalibration of vector threshold or domain criticality."

    result = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_evaluated_samples": total_evaluated,
        "hired_count": n_hired,
        "rejected_count": n_rejected,
        "point_biserial_correlation": round(r_pb, 4),
        "correlation_p_value": round(p_val, 5),
        "hired_score_mean": round(float(np.mean(hired_scores)), 2) if hired_scores else 0.0,
        "hired_score_std": round(float(np.std(hired_scores)), 2) if hired_scores else 0.0,
        "rejected_score_mean": round(float(np.mean(rejected_scores)), 2) if rejected_scores else 0.0,
        "rejected_score_std": round(float(np.std(rejected_scores)), 2) if rejected_scores else 0.0,
        "bracket_conversions": bracket_conversions,
        "calibration_status": calibration_status,
        "recommendation": recommendation,
    }

    logger.info(
        "Hire outcome correlation calculated",
        total_samples=total_evaluated,
        correlation=r_pb,
        status=calibration_status,
    )
    return result


async def generate_hire_outcome_correlation_report(
    db: Any,
    tenant_id: str = "default",
) -> Dict[str, Any]:
    """
    Generates hire outcome correlation report for a tenant from the MongoDB database.
    """
    if db is None:
        return correlate_hire_outcomes([])

    coll = getattr(db, "job_applications", None) if hasattr(db, "job_applications") else None
    if coll is None:
        try:
            coll = db["job_applications"]
        except Exception:
            pass

    if coll is None:
        return correlate_hire_outcomes([])

    cursor = coll.find({"tenant_id": tenant_id})
    if hasattr(cursor, "to_list"):
        apps = await cursor.to_list(length=1000)
    else:
        apps = list(cursor)

    report = correlate_hire_outcomes(apps)
    report["tenant_id"] = tenant_id

    # Persist audit record
    try:
        audit_coll = getattr(db, "ml_feedback_audits", None) if hasattr(db, "ml_feedback_audits") else None
        if audit_coll is None:
            try:
                audit_coll = db["ml_feedback_audits"]
            except Exception:
                pass
        if audit_coll is not None:
            ins = audit_coll.insert_one(dict(report))
            if hasattr(ins, "__await__"):
                await ins
    except Exception as exc:
        logger.warning("Failed to persist ML feedback correlation audit", error=str(exc))

    return report


def format_correlation_text_report(report: Dict[str, Any]) -> str:
    """Formats correlation report dictionary as human-readable text."""
    lines = [
        "================================================================",
        "     CAREERSHALA ATS - HIRE OUTCOME ML FEEDBACK REPORT         ",
        "================================================================",
        f"Generated At: {report.get('timestamp')}",
        f"Tenant ID:    {report.get('tenant_id', 'default')}",
        f"Total Evaluated Candidates: {report.get('total_evaluated_samples')}",
        f"  - Hired / Accepted:       {report.get('hired_count')}",
        f"  - Rejected / Failed:      {report.get('rejected_count')}",
        "",
        "--- CORRELATION STATISTICS ---",
        f"Point-Biserial Correlation (r_pb): {report.get('point_biserial_correlation'):.4f}",
        f"Statistical Significance (p-value):{report.get('correlation_p_value'):.5f}",
        f"Hired Candidates Average Score:    {report.get('hired_score_mean'):.2f} (±{report.get('hired_score_std'):.2f})",
        f"Rejected Candidates Average Score: {report.get('rejected_score_mean'):.2f} (±{report.get('rejected_score_std'):.2f})",
        "",
        "--- HIRE CONVERSION BY SCORE BRACKET ---",
    ]

    for b_name, b_info in report.get("bracket_conversions", {}).items():
        lines.append(
            f"  Score [{b_name:>6}]: {b_info.get('hired'):>3}/{b_info.get('total'):<3} hired ({b_info.get('conversion_rate_pct'):>5.1f}%)"
        )

    lines.extend([
        "",
        f"CALIBRATION STATUS: {report.get('calibration_status', '').upper()}",
        f"RECOMMENDATION:     {report.get('recommendation')}",
        "================================================================",
    ])

    return "\n".join(lines)
