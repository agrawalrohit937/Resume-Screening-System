"""
Phase 2 Verification Tests: Evaluation Harness, Dataset Schemas, Ranking Metrics, and Ablations.
"""

import pytest
from eval.dataset_schema import EvaluationDataset, LabeledPair, RecruiterLabel
from eval.build_dataset import generate_synthetic_smoke_dataset, load_from_csv
from eval.metrics import (
    compute_dcg,
    compute_ndcg,
    compute_precision_at_k,
    compute_average_precision,
    compute_rank_correlations,
    compute_knockout_accuracy,
    bootstrap_ci,
)
from eval.run_eval import (
    evaluate_dataset_with_engine,
    run_ablation_suite,
    generate_markdown_report,
)
from services.scoring_engine import RECRUITER_PROFILE


def test_recruiter_label_mapping():
    assert RecruiterLabel.from_str("hire") == RecruiterLabel.HIRE
    assert RecruiterLabel.from_str("match") == RecruiterLabel.SHORTLIST
    assert RecruiterLabel.from_str("maybe") == RecruiterLabel.MAYBE
    assert RecruiterLabel.from_str("0") == RecruiterLabel.REJECT


def test_ndcg_ranking_math():
    # Perfect ranking
    perfect = [3.0, 2.0, 1.0, 0.0]
    assert compute_ndcg(perfect, 4) == 1.0

    # Reversed ranking
    reversed_rel = [0.0, 1.0, 2.0, 3.0]
    rev_ndcg = compute_ndcg(reversed_rel, 4)
    assert 0.0 < rev_ndcg < 0.70

    # Empty list
    assert compute_ndcg([], 5) == 0.0


def test_precision_at_k_and_map():
    relevances = [3.0, 2.0, 0.0, 1.0, 3.0]
    # At k=2, labels >= 1.5 are [3.0, 2.0] -> 2/2 = 1.0
    assert compute_precision_at_k(relevances, 2, threshold=1.5) == 1.0
    # At k=3, labels >= 1.5 are [3.0, 2.0, 0.0] -> 2/3 = 0.6667
    assert round(compute_precision_at_k(relevances, 3, threshold=1.5), 3) == 0.667

    ap = compute_average_precision(relevances, threshold=1.5)
    assert 0.5 <= ap <= 1.0


def test_bootstrap_ci_coverage():
    data = [0.65, 0.70, 0.72, 0.68, 0.75, 0.71, 0.69, 0.73]
    point, low, high = bootstrap_ci(data, lambda x: sum(x) / len(x), n_bootstraps=200)
    assert low <= point <= high
    assert 0.60 <= low
    assert high <= 0.80


def test_synthetic_dataset_and_eval_run():
    dataset = generate_synthetic_smoke_dataset(n_jobs=2, candidates_per_job=4)
    assert dataset.is_synthetic_dataset is True
    assert dataset.total_count() == 8

    res = evaluate_dataset_with_engine(dataset, profile=RECRUITER_PROFILE, mode="recruiter")
    assert "metrics" in res
    assert "ndcg@10" in res["metrics"]
    assert "confidence_intervals" in res

    ablations = run_ablation_suite(dataset)
    assert "skills_only" in ablations
    assert "+vector" in ablations

    report = generate_markdown_report(res, ablation_results=ablations)
    assert "ATS Matching Engine Evaluation Report" in report
    assert "Component Ablation Breakdown" in report
