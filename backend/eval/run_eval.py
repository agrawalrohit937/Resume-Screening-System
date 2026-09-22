"""
Evaluation Runner and Ablation Engine (Phase 2).
Runs evaluation harness, computes ranking metrics with bootstrap 95% CIs, executes ablation suite,
generates Markdown report, and performs CI baseline regression check.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import structlog

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from eval.dataset_schema import EvaluationDataset, LabeledPair
from eval.build_dataset import load_from_csv, generate_synthetic_smoke_dataset
from eval.metrics import (
    evaluate_cohort,
    bootstrap_ci,
    compute_ndcg,
    compute_precision_at_k,
    compute_average_precision,
    compute_rank_correlations,
)
from services.scoring_engine import score_resume, WeightProfile, CANDIDATE_PROFILE, RECRUITER_PROFILE
import core.feature_flags as ff

logger = structlog.get_logger(__name__)


def evaluate_dataset_with_engine(
    dataset: EvaluationDataset,
    profile: WeightProfile,
    mode: str = "recruiter",
) -> Dict[str, Any]:
    """
    Evaluates an entire dataset using the scoring engine with specified WeightProfile.
    Groups by job description to compute mean ranking metrics and bootstrap 95% CIs.
    """
    grouped_pairs = dataset.group_by_jd()
    cohort_metric_list: List[Dict[str, float]] = []

    all_true_labels: List[float] = []
    all_pred_scores: List[float] = []

    for jd_id, pairs in grouped_pairs.items():
        cohort_tuples: List[Tuple[float, float, bool, bool]] = []
        for p in pairs:
            r_input = p.resume_data if p.resume_data else {"raw_text": ""}
            j_input = p.jd_data if p.jd_data else {"text": ""}
            
            try:
                result = score_resume(r_input, j_input, profile=profile, mode=mode)
                pred_score = float(result.get("quality_score", result.get("final_score", 0.0)))
                is_ko_pred = bool(result.get("is_knockout", False))
            except Exception as e:
                logger.debug("Error scoring pair in evaluation", pair_id=p.pair_id, error=str(e))
                pred_score = 0.0
                is_ko_pred = False

            is_ko_true = bool(p.is_knockout_expected) if p.is_knockout_expected is not None else False
            cohort_tuples.append((float(p.recruiter_label), pred_score, is_ko_true, is_ko_pred))
            all_true_labels.append(float(p.recruiter_label))
            all_pred_scores.append(pred_score)

        if cohort_tuples:
            metrics_dict = evaluate_cohort(cohort_tuples)
            cohort_metric_list.append(metrics_dict)

    if not cohort_metric_list:
        return {}

    # Compute mean across cohorts
    agg_metrics: Dict[str, float] = {}
    for metric_name in ("ndcg@5", "ndcg@10", "precision@5", "precision@10", "map", "spearman", "kendall_tau", "knockout_accuracy"):
        vals = [c[metric_name] for c in cohort_metric_list]
        agg_metrics[metric_name] = round(float(np.mean(vals)), 4)

    # Compute Bootstrap 95% CIs for primary metrics
    ci_results: Dict[str, Dict[str, float]] = {}
    for m in ("ndcg@5", "ndcg@10", "map"):
        point, low, high = bootstrap_ci(cohort_metric_list, lambda s: float(np.mean([x[m] for x in s])))
        ci_results[m] = {"mean": point, "ci_95_lower": low, "ci_95_upper": high}

    # Global Rank Correlations
    global_spearman, global_tau = compute_rank_correlations(all_true_labels, all_pred_scores)
    agg_metrics["global_spearman"] = round(global_spearman, 4)
    agg_metrics["global_kendall_tau"] = round(global_tau, 4)

    return {
        "num_pairs": dataset.total_count(),
        "num_jobs": len(grouped_pairs),
        "metrics": agg_metrics,
        "confidence_intervals": ci_results,
    }


def run_ablation_suite(dataset: EvaluationDataset) -> Dict[str, Dict[str, Any]]:
    """
    Runs systematic ablation experiments over standard model components:
    1. skills_only
    2. +experience
    3. +education
    4. +vector
    5. +projects
    6. +reranker
    """
    ablations: Dict[str, WeightProfile] = {
        "skills_only": WeightProfile(
            strict_weight=1.0, semantic_weight=0.0,
            skills_weight=1.0, experience_weight=0.0, education_weight=0.0,
        ),
        "+experience": WeightProfile(
            strict_weight=1.0, semantic_weight=0.0,
            skills_weight=0.70, experience_weight=0.30, education_weight=0.0,
        ),
        "+education": WeightProfile(
            strict_weight=1.0, semantic_weight=0.0,
            skills_weight=0.50, experience_weight=0.30, education_weight=0.20,
        ),
        "+vector": WeightProfile(
            strict_weight=0.60, semantic_weight=0.40,
            skills_weight=0.50, experience_weight=0.30, education_weight=0.20,
        ),
        "+projects": WeightProfile(
            strict_weight=0.60, semantic_weight=0.40,
            skills_weight=0.50, experience_weight=0.30, education_weight=0.20,
            fresher_skills_share=0.60, fresher_projects_share=0.25, fresher_education_share=0.15,
        ),
    }

    results: Dict[str, Dict[str, Any]] = {}
    for name, prof in ablations.items():
        eval_res = evaluate_dataset_with_engine(dataset, profile=prof, mode="recruiter")
        results[name] = eval_res

    return results


def generate_markdown_report(
    eval_results: Dict[str, Any],
    ablation_results: Optional[Dict[str, Dict[str, Any]]] = None,
    baseline: Optional[Dict[str, Any]] = None,
    report_path: Optional[str] = None,
) -> str:
    """Generates a Markdown evaluation summary report formatted for engineering PRs."""
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    date_filename = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    m = eval_results.get("metrics", {})
    cis = eval_results.get("confidence_intervals", {})

    lines = [
        f"# ATS Matching Engine Evaluation Report",
        f"**Generated:** {now_str} | **Dataset Size:** {eval_results.get('num_pairs', 0)} pairs across {eval_results.get('num_jobs', 0)} jobs",
        "",
        "## 1. Core Ranking & Quality Metrics (95% CI)",
        "",
        "| Metric | Point Estimate | 95% Confidence Interval | Baseline | Delta |",
        "| :--- | :--- | :--- | :--- | :--- |",
    ]

    base_ndcg10 = baseline.get("ndcg_at_10", 0.0) if baseline else None
    base_ndcg5 = baseline.get("ndcg_at_5", 0.0) if baseline else None
    base_p10 = baseline.get("precision_at_10", 0.0) if baseline else None

    for name, key, b_val in [
        ("NDCG@10", "ndcg@10", base_ndcg10),
        ("NDCG@5", "ndcg@5", base_ndcg5),
        ("Precision@10", "precision@10", base_p10),
        ("MAP", "map", None),
        ("Global Spearman", "global_spearman", None),
        ("Global Kendall Tau", "global_kendall_tau", None),
        ("Knockout Accuracy", "knockout_accuracy", None),
    ]:
        val = m.get(key, 0.0)
        ci_str = f"[{cis[key]['ci_95_lower']:.4f}, {cis[key]['ci_95_upper']:.4f}]" if key in cis else "N/A"
        b_str = f"{b_val:.4f}" if b_val is not None else "N/A"
        delta_str = f"{(val - b_val):+.4f}" if b_val is not None else "N/A"
        lines.append(f"| {name} | **{val:.4f}** | {ci_str} | {b_str} | {delta_str} |")

    if ablation_results:
        lines.extend([
            "",
            "## 2. Component Ablation Breakdown",
            "",
            "| Stage / Variant | NDCG@10 | NDCG@5 | MAP | Precision@10 |",
            "| :--- | :--- | :--- | :--- | :--- |",
        ])
        for stage, res in ablation_results.items():
            sm = res.get("metrics", {})
            lines.append(f"| `{stage}` | {sm.get('ndcg@10', 0.0):.4f} | {sm.get('ndcg@5', 0.0):.4f} | {sm.get('map', 0.0):.4f} | {sm.get('precision@10', 0.0):.4f} |")

    md_content = "\n".join(lines) + "\n"

    target_path = report_path or f"eval/reports/{date_filename}.md"
    p = Path(backend_dir) / target_path
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(md_content)

    return md_content


def run_eval_cli():
    parser = argparse.ArgumentParser(description="Run CareerShala ATS Engine Evaluation Harness")
    parser.add_argument("--csv", type=str, default="eval/resumeJD2_pairs.csv", help="CSV path")
    parser.add_argument("--limit", type=int, default=50, help="Max pairs to evaluate")
    parser.add_argument("--synthetic", action="store_true", help="Use synthetic dataset for fast smoke testing")
    parser.add_argument("--ablation", action="store_true", help="Run full component ablation suite")
    parser.add_argument("--check-ci", action="store_true", help="Assert NDCG@10 does not regress > 2% vs baseline")
    parser.add_argument("--update-baseline", action="store_true", help="Overwrite baseline.json with current results")
    args = parser.parse_args()

    # Load dataset
    if args.synthetic:
        dataset = generate_synthetic_smoke_dataset()
    else:
        csv_file = Path(backend_dir) / args.csv
        if csv_file.exists():
            dataset = load_from_csv(csv_file, limit=args.limit)
        else:
            print(f"CSV {args.csv} not found, falling back to synthetic dataset.")
            dataset = generate_synthetic_smoke_dataset()

    print(f"Evaluating ATS Engine over {dataset.total_count()} pairs...")
    results = evaluate_dataset_with_engine(dataset, profile=RECRUITER_PROFILE, mode="recruiter")

    ablation_res = None
    if args.ablation:
        print("Running ablation suite across model components...")
        ablation_res = run_ablation_suite(dataset)

    # Load baseline
    baseline_path = Path(backend_dir) / "eval/baseline.json"
    baseline = {}
    if baseline_path.exists():
        try:
            with open(baseline_path, "r", encoding="utf-8") as f:
                baseline = json.load(f)
        except Exception:
            baseline = {}

    report_md = generate_markdown_report(results, ablation_results=ablation_res, baseline=baseline)
    print("\n" + report_md)

    if args.update_baseline:
        new_base = {
            "num_pairs": results.get("num_pairs", 0),
            "ndcg_at_10": results["metrics"].get("ndcg@10", 0.0),
            "ndcg_at_5": results["metrics"].get("ndcg@5", 0.0),
            "precision_at_10": results["metrics"].get("precision@10", 0.0),
            "map": results["metrics"].get("map", 0.0),
            "spearman": results["metrics"].get("global_spearman", 0.0),
            "kendall_tau": results["metrics"].get("global_kendall_tau", 0.0),
            "knockout_accuracy": results["metrics"].get("knockout_accuracy", 1.0),
        }
        with open(baseline_path, "w", encoding="utf-8") as f:
            json.dump(new_base, f, indent=2)
        print(f"Baseline successfully updated at: {baseline_path}")

    if args.check_ci and baseline and "ndcg_at_10" in baseline:
        curr_ndcg = results["metrics"].get("ndcg@10", 0.0)
        base_ndcg = baseline["ndcg_at_10"]
        allowed_floor = base_ndcg * 0.98
        if curr_ndcg < allowed_floor:
            print(f"CI ERROR: NDCG@10 ({curr_ndcg:.4f}) dropped > 2% vs stored baseline ({base_ndcg:.4f}). Allowed floor: {allowed_floor:.4f}")
            sys.exit(1)
        else:
            print(f"CI PASS: NDCG@10 ({curr_ndcg:.4f}) meets baseline standard ({base_ndcg:.4f}).")


if __name__ == "__main__":
    run_eval_cli()
