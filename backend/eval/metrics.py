"""
Evaluation Metrics Module for CareerShala ATS Engine (Phase 2).
Computes ranking, classification, and calibration metrics with bootstrap 95% confidence intervals.
"""

from __future__ import annotations

import math
from typing import Any, Callable, Dict, List, Optional, Tuple
import numpy as np
from scipy.stats import kendalltau, spearmanr


def compute_dcg(relevances: List[float], k: int) -> float:
    """Computes Discounted Cumulative Gain at rank k."""
    k = min(k, len(relevances))
    if k == 0:
        return 0.0
    return float(sum(rel / math.log2(idx + 2) for idx, rel in enumerate(relevances[:k])))


def compute_ndcg(actual_relevances: List[float], k: int) -> float:
    """
    Computes Normalized Discounted Cumulative Gain at rank k.
    actual_relevances: list of true relevance scores for items in ranked order.
    """
    dcg = compute_dcg(actual_relevances, k)
    ideal_relevances = sorted(actual_relevances, reverse=True)
    idcg = compute_dcg(ideal_relevances, k)
    if idcg <= 0.0:
        return 0.0
    return float(dcg / idcg)


def compute_precision_at_k(relevances: List[float], k: int, threshold: float = 1.5) -> float:
    """Computes Precision@K (relevance >= threshold, e.g. label 2 or 3)."""
    k = min(k, len(relevances))
    if k == 0:
        return 0.0
    rel_count = sum(1 for r in relevances[:k] if r >= threshold)
    return float(rel_count / k)


def compute_average_precision(relevances: List[float], threshold: float = 1.5) -> float:
    """Computes Average Precision (AP) for a single query/job cohort."""
    if not relevances:
        return 0.0
    num_relevant = 0
    running_prec_sum = 0.0
    for idx, r in enumerate(relevances):
        if r >= threshold:
            num_relevant += 1
            running_prec_sum += num_relevant / (idx + 1)
    if num_relevant == 0:
        return 0.0
    return float(running_prec_sum / num_relevant)


def compute_rank_correlations(y_true: List[float], y_pred: List[float]) -> Tuple[float, float]:
    """Computes Spearman rho and Kendall tau rank correlations."""
    if len(y_true) < 2 or len(y_pred) < 2:
        return 0.0, 0.0
    try:
        spearman_res = spearmanr(y_true, y_pred)
        rho = float(spearman_res.statistic if hasattr(spearman_res, "statistic") else spearman_res[0])
        if math.isnan(rho):
            rho = 0.0
    except Exception:
        rho = 0.0

    try:
        kendall_res = kendalltau(y_true, y_pred)
        tau = float(kendall_res.statistic if hasattr(kendall_res, "statistic") else kendall_res[0])
        if math.isnan(tau):
            tau = 0.0
    except Exception:
        tau = 0.0

    return rho, tau


def compute_knockout_accuracy(
    actual_knockouts: List[bool],
    predicted_knockouts: List[bool],
) -> float:
    """Computes binary classification accuracy of hard knockout enforcement."""
    if not actual_knockouts or len(actual_knockouts) != len(predicted_knockouts):
        return 1.0
    correct = sum(1 for a, p in zip(actual_knockouts, predicted_knockouts) if a == p)
    return float(correct / len(actual_knockouts))


def bootstrap_ci(
    data: List[Any],
    metric_fn: Callable[[List[Any]], float],
    n_bootstraps: int = 500,
    confidence: float = 0.95,
    seed: int = 42,
) -> Tuple[float, float, float]:
    """
    Computes empirical bootstrap Confidence Interval for any ranking metric.
    Returns: (point_estimate, lower_bound, upper_bound)
    """
    if not data:
        return 0.0, 0.0, 0.0

    point_est = metric_fn(data)
    if len(data) < 3:
        return point_est, point_est, point_est

    rng = np.random.default_rng(seed)
    n = len(data)
    boot_stats = []

    for _ in range(n_bootstraps):
        sample_indices = rng.integers(0, n, size=n)
        sample = [data[i] for i in sample_indices]
        try:
            stat = metric_fn(sample)
            if not math.isnan(stat):
                boot_stats.append(stat)
        except Exception:
            continue

    if not boot_stats:
        return point_est, point_est, point_est

    alpha = (1.0 - confidence) / 2.0
    low = float(np.percentile(boot_stats, alpha * 100))
    high = float(np.percentile(boot_stats, (1.0 - alpha) * 100))
    return round(point_est, 4), round(low, 4), round(high, 4)


def evaluate_cohort(
    cohort_pairs: List[Tuple[float, float, bool, bool]],
) -> Dict[str, float]:
    """
    Evaluates a cohort of pairs for a single job description.
    cohort_pairs: list of tuples (true_label, predicted_score, is_ko_true, is_ko_pred)
    """
    # Sort descending by predicted score
    sorted_cohort = sorted(cohort_pairs, key=lambda x: x[1], reverse=True)
    sorted_true_labels = [x[0] for x in sorted_cohort]
    sorted_preds = [x[1] for x in sorted_cohort]

    ndcg5 = compute_ndcg(sorted_true_labels, 5)
    ndcg10 = compute_ndcg(sorted_true_labels, 10)
    p5 = compute_precision_at_k(sorted_true_labels, 5)
    p10 = compute_precision_at_k(sorted_true_labels, 10)
    ap = compute_average_precision(sorted_true_labels)
    spearman, tau = compute_rank_correlations(sorted_true_labels, sorted_preds)

    ko_true = [x[2] for x in sorted_cohort]
    ko_pred = [x[3] for x in sorted_cohort]
    ko_acc = compute_knockout_accuracy(ko_true, ko_pred)

    return {
        "ndcg@5": ndcg5,
        "ndcg@10": ndcg10,
        "precision@5": p5,
        "precision@10": p10,
        "map": ap,
        "spearman": spearman,
        "kendall_tau": tau,
        "knockout_accuracy": ko_acc,
    }
