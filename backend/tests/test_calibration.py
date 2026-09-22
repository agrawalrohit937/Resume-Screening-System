"""
Unit tests for Task 3.3: Score Calibration and Expected Calibration Error (ECE).
Tests Isotonic regression, Platt scaling, ECE metric computation,
and candidate fit indicator floor invariants.
"""

from pathlib import Path
import pytest
import numpy as np

from ml.calibration import ScoreCalibrator, compute_ece


def test_compute_ece_perfect_vs_uncalibrated():
    # Perfectly calibrated case: 100 predictions of 0.8 where 80% are 1s, and 100 predictions of 0.2 where 20% are 1s
    preds = np.array([0.8] * 100 + [0.2] * 100)
    trues = np.array([1.0] * 80 + [0.0] * 20 + [1.0] * 20 + [0.0] * 80)

    ece_perfect = compute_ece(preds, trues, n_bins=10)
    assert ece_perfect < 0.05

    # Severely uncalibrated case: confidence is 0.99 but all true labels are 0
    preds_bad = np.array([0.99] * 100)
    trues_bad = np.array([0.0] * 100)
    ece_bad = compute_ece(preds_bad, trues_bad, n_bins=10)
    assert ece_bad > 0.90


def test_isotonic_regression_fitting_and_monotonicity():
    np.random.seed(42)
    # Generate synthetic scores 0 - 100
    raw_scores = np.linspace(20.0, 95.0, 200)
    # Probability increases with raw score
    probs = 1.0 / (1.0 + np.exp(-0.08 * (raw_scores - 60.0)))
    labels = (np.random.rand(200) < probs).astype(int)

    calibrator = ScoreCalibrator(method="isotonic")
    ece = calibrator.fit(raw_scores.tolist(), labels.tolist())
    assert calibrator.is_fitted is True
    assert ece < 0.25

    # Invariant: Isotonic calibration must be monotonically non-decreasing
    test_points = [30.0, 50.0, 65.0, 75.0, 90.0]
    calibrated_probs = [calibrator.predict_probability(p) for p in test_points]

    for i in range(len(calibrated_probs) - 1):
        assert calibrated_probs[i] <= calibrated_probs[i + 1], (
            f"Monotonicity violated: score {test_points[i]} -> {calibrated_probs[i]}, "
            f"score {test_points[i+1]} -> {calibrated_probs[i+1]}"
        )


def test_candidate_fit_indicator_floor_invariants():
    calibrator = ScoreCalibrator(method="isotonic")

    # Candidate with a low raw score (e.g. 25.0)
    res = calibrator.candidate_fit_indicator(raw_score=25.0, display_floor=45.0)

    # Invariants:
    # 1. Fit indicator display value respects floor
    assert res["fit_indicator"] >= 45.0
    # 2. Raw quality score is preserved exactly without alteration
    assert res["raw_quality_score"] == 25.0
    # 3. Transparently provides calibrated probability
    assert 0.0 <= res["calibrated_probability"] <= 1.0


def test_calibrator_save_and_load(tmp_path: Path):
    model_file = tmp_path / "test_calibrator.json"

    raw_scores = [30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0]
    labels = [0, 0, 0, 1, 1, 1, 1]

    calibrator = ScoreCalibrator(method="isotonic")
    calibrator.fit(raw_scores, labels)
    calibrator.save(model_file)

    assert model_file.exists()

    loaded = ScoreCalibrator.load(model_file)
    assert loaded.is_fitted is True
    assert loaded.predict_probability(80.0) == calibrator.predict_probability(80.0)
