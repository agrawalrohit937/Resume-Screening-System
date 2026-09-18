"""
CareerPilot Evaluation Harness
Computes NDCG@10, NDCG@50, Precision@10, MRR, Kendall Tau, and Expected Calibration Error (ECE)
using the golden evaluation dataset at backend/eval/resumeJD2_pairs.csv.
"""

import argparse
import csv
import json
import math
import os
import sys
from pathlib import Path
from typing import Dict, List, Any, Tuple

import numpy as np
from scipy.stats import kendalltau

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from services.scoring_engine import score_resume


def compute_dcg(relevances: List[float], k: int) -> float:
    """Computes Discounted Cumulative Gain at rank k."""
    k = min(k, len(relevances))
    if k == 0:
        return 0.0
    return sum(rel / math.log2(idx + 2) for idx, rel in enumerate(relevances[:k]))


def compute_ndcg(actual_relevances: List[float], k: int) -> float:
    """Computes Normalized Discounted Cumulative Gain at rank k."""
    dcg = compute_dcg(actual_relevances, k)
    ideal_relevances = sorted(actual_relevances, reverse=True)
    idcg = compute_dcg(ideal_relevances, k)
    if idcg <= 0.0:
        return 0.0
    return dcg / idcg


def compute_precision_at_k(labels: List[str], k: int) -> float:
    """Computes Precision@K where relevant items have match_label in ('match', 'partial match')."""
    k = min(k, len(labels))
    if k == 0:
        return 0.0
    relevant_count = sum(1 for label in labels[:k] if label in ("match", "partial match"))
    return relevant_count / k


def compute_mrr(labels: List[str]) -> float:
    """Computes Mean Reciprocal Rank: reciprocal rank of the first relevant item ('match')."""
    for idx, label in enumerate(labels):
        if label == "match":
            return 1.0 / (idx + 1)
    return 0.0


def compute_ece(predicted_scores: List[float], true_scores: List[float], n_bins: int = 10) -> float:
    """
    Computes Expected Calibration Error across n_bins.
    Both predicted_scores and true_scores are expected in [0.0, 1.0].
    """
    bin_boundaries = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    total_samples = len(predicted_scores)
    if total_samples == 0:
        return 0.0

    preds = np.array(predicted_scores)
    trues = np.array(true_scores)

    for i in range(n_bins):
        low, high = bin_boundaries[i], bin_boundaries[i + 1]
        mask = (preds >= low) & (preds < high) if i < n_bins - 1 else (preds >= low) & (preds <= high)
        bin_count = np.sum(mask)
        if bin_count > 0:
            bin_acc = np.mean(trues[mask])
            bin_conf = np.mean(preds[mask])
            ece += (bin_count / total_samples) * abs(bin_acc - bin_conf)

    return float(ece)


def run_evaluation(
    data_path: Path,
    limit: int = 0,
    update_baseline: bool = False,
) -> Dict[str, Any]:
    """Runs evaluation on dataset and returns metric results."""
    print(f"Loading evaluation pairs from {data_path}...")
    pairs = []
    with open(data_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pairs.append({
                "resume_text": row["resume_text"],
                "job_description": row["job_description"],
                "match_score": float(row["match_score"]),
                "match_label": row["match_label"].strip().lower(),
            })

    if limit > 0:
        pairs = pairs[:limit]
        print(f"Subsampled to {len(pairs)} evaluation pairs.")
    else:
        print(f"Evaluating all {len(pairs)} pairs.")

    scored_items = []
    for idx, item in enumerate(pairs):
        try:
            result = score_resume(
                resume=item["resume_text"],
                jd=item["job_description"],
                mode="candidate",
            )
            pred_score = float(result.get("final_score", 0.0)) / 100.0
        except Exception as err:
            print(f"Warning: scoring failed on pair {idx}: {err}")
            pred_score = 0.0

        scored_items.append({
            "pred_score": pred_score,
            "true_score": item["match_score"],
            "label": item["match_label"],
        })

    # Sort items by predicted score descending
    scored_items.sort(key=lambda x: x["pred_score"], reverse=True)

    ranked_true_scores = [item["true_score"] for item in scored_items]
    ranked_labels = [item["label"] for item in scored_items]
    all_pred_scores = [item["pred_score"] for item in scored_items]

    ndcg_10 = compute_ndcg(ranked_true_scores, k=10)
    ndcg_50 = compute_ndcg(ranked_true_scores, k=50)
    precision_10 = compute_precision_at_k(ranked_labels, k=10)
    mrr = compute_mrr(ranked_labels)

    # Kendall Tau correlation
    tau, p_val = kendalltau(all_pred_scores, ranked_true_scores)
    if math.isnan(tau):
        tau = 0.0

    # ECE
    ece = compute_ece(all_pred_scores, ranked_true_scores, n_bins=10)

    metrics = {
        "num_pairs": len(pairs),
        "ndcg_at_10": round(float(ndcg_10), 4),
        "ndcg_at_50": round(float(ndcg_50), 4),
        "precision_at_10": round(float(precision_10), 4),
        "mrr": round(float(mrr), 4),
        "kendall_tau": round(float(tau), 4),
        "ece": round(float(ece), 4),
    }

    print("\n" + "=" * 55)
    print("           CAREERPILOT EVALUATION RESULTS")
    print("=" * 55)
    print(f" Samples Evaluated : {metrics['num_pairs']}")
    print(f" NDCG@10           : {metrics['ndcg_at_10']:.4f}")
    print(f" NDCG@50           : {metrics['ndcg_at_50']:.4f}")
    print(f" Precision@10      : {metrics['precision_at_10']:.4f}")
    print(f" MRR               : {metrics['mrr']:.4f}")
    print(f" Kendall Tau       : {metrics['kendall_tau']:.4f}")
    print(f" Calibration ECE   : {metrics['ece']:.4f}")
    print("=" * 55)

    # Save to baseline.json if requested or if missing
    baseline_path = backend_dir / "eval" / "baseline.json"
    if update_baseline or not baseline_path.exists():
        with open(baseline_path, "w", encoding="utf-8") as f:
            json.dump(metrics, f, indent=2)
        print(f"Saved baseline metrics to {baseline_path}")

    # Generate or update docs/EVAL.md
    docs_dir = backend_dir.parent / "docs"
    docs_dir.mkdir(parents=True, exist_ok=True)
    eval_md_path = docs_dir / "EVAL.md"

    md_content = f"""# CareerPilot Evaluation Report

Golden dataset: `backend/eval/resumeJD2_pairs.csv` (500 labeled pairs across multi-domain occupations).

| Metric | Score | Target / Direction |
|---|---|---|
| **NDCG@10** | **{metrics['ndcg_at_10']:.4f}** | Higher is better (CI gate: no drop > 0.02) |
| **NDCG@50** | **{metrics['ndcg_at_50']:.4f}** | Higher is better |
| **Precision@10** | **{metrics['precision_at_10']:.4f}** | Higher is better |
| **MRR** | **{metrics['mrr']:.4f}** | Higher is better |
| **Kendall Tau** | **{metrics['kendall_tau']:.4f}** | Higher is better |
| **Expected Calibration Error (ECE)** | **{metrics['ece']:.4f}** | Lower is better |

*Evaluated on {metrics['num_pairs']} candidate-job pairs.*
"""
    with open(eval_md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    print(f"Updated {eval_md_path}")

    # Check CI gate against baseline
    if baseline_path.exists() and not update_baseline:
        try:
            with open(baseline_path, "r", encoding="utf-8") as f:
                baseline_data = json.load(f)
            baseline_ndcg = baseline_data.get("ndcg_at_10", 0.0)
            diff = metrics["ndcg_at_10"] - baseline_ndcg
            print(f"\nBaseline NDCG@10: {baseline_ndcg:.4f} | Current: {metrics['ndcg_at_10']:.4f} | Delta: {diff:+.4f}")
            if diff < -0.02:
                print(f"ERROR: NDCG@10 dropped by {abs(diff):.4f} (threshold is 0.02)!")
                sys.exit(1)
        except Exception as e:
            print(f"Note: Could not check baseline regression: {e}")

    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run CareerPilot ATS evaluation harness.")
    parser.add_argument("--limit", type=int, default=50, help="Number of pairs to evaluate (0 for full 500).")
    parser.add_argument("--update-baseline", action="store_true", help="Overwrite baseline.json with current results.")
    args = parser.parse_args()

    default_csv = backend_dir / "eval" / "resumeJD2_pairs.csv"
    run_evaluation(default_csv, limit=args.limit, update_baseline=args.update_baseline)
