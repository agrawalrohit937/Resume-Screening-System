"""
Unit tests for Task 3.2: Learning-to-Rank (LTR) Model.
Tests protected attribute deny-list, inverse propensity weighting (IPW),
XGBoost LambdaMART training, and shadow mode logging.
"""

import pytest
import numpy as np

from ml.train_ranker import (
    LTR_FEATURE_NAMES,
    PROTECTED_ATTRIBUTE_DENYLIST,
    validate_feature_set_cleanliness,
    compute_inverse_propensity_weight,
    prepare_ranking_dataset,
    train_xgboost_ranker,
)
from ml.ranker_service import LTRRankerService


def test_protected_attribute_denylist_enforcement():
    # 1. Active feature names must be 100% clean of all protected attributes
    validate_feature_set_cleanliness(LTR_FEATURE_NAMES)

    # 2. Strict anti-bias guard: injecting any protected attribute must raise ValueError
    forbidden_examples = [
        ["quality_score", "candidate_gender"],
        ["skills_score", "institution_name"],
        ["vector_score", "graduation_year"],
        ["experience_score", "candidate_caste"],
        ["strict_score", "religion_code"],
        ["skills_score", "dob"],
        ["quality_score", "marital_status"],
    ]

    for bad_feature_set in forbidden_examples:
        with pytest.raises(ValueError, match="Regulatory Compliance Violation"):
            validate_feature_set_cleanliness(bad_feature_set)


def test_inverse_propensity_weighting():
    # Rank 1 (top of list) should have base propensity weight (1.0)
    w1 = compute_inverse_propensity_weight(1)
    assert w1 == 1.0

    # Lower positions (e.g. 4, 9) must have higher weights to counteract position exposure bias
    w4 = compute_inverse_propensity_weight(4)
    w9 = compute_inverse_propensity_weight(9)
    assert w4 == 2.0
    assert w9 == 3.0
    assert w9 > w4 > w1


def test_xgboost_ranker_training_and_prediction():
    # Construct mock dataset with 3 query groups (jobs) and 4 candidates each
    mock_apps = []
    for job_idx in range(3):
        j_id = f"job-{job_idx}"
        for cand_idx in range(4):
            # Candidate with higher skills gets shortlisted/hired
            is_good = cand_idx >= 2
            mock_apps.append({
                "job_id": j_id,
                "stage": "hired" if cand_idx == 3 else ("interview" if cand_idx == 2 else "rejected"),
                "position_in_list": cand_idx + 1,
                "features": {
                    "quality_score": 85.0 if is_good else 45.0,
                    "skills_score": 0.90 if is_good else 0.30,
                    "experience_score": 0.80 if is_good else 0.40,
                    "education_score": 0.75,
                    "vector_score": 0.85 if is_good else 0.50,
                    "matched_skills_count": 8 if is_good else 2,
                    "effective_years": 5.0 if is_good else 1.0,
                    "is_knockout": False,
                }
            })

    X, y, groups, weights = prepare_ranking_dataset(mock_apps)
    assert len(groups) == 3
    assert len(X) == 12
    assert len(y) == 12

    ranker = train_xgboost_ranker(
        X, y, groups=groups, sample_weights=weights, n_estimators=10, max_depth=2
    )
    assert ranker is not None

    # Predict on high-scoring vs low-scoring candidate
    good_features = np.array([X[3]], dtype=np.float32)   # hired candidate
    poor_features = np.array([X[0]], dtype=np.float32)   # rejected candidate

    pred_good = ranker.predict(good_features)
    pred_poor = ranker.predict(poor_features)

    assert pred_good[0] > pred_poor[0]


def test_ranker_service_graceful_fallback_when_no_model():
    service = LTRRankerService()
    # Query an occupation family that has no serialized model
    score = service.predict_rank_score(
        features_dict={"quality_score": 75.0, "skills_score": 0.8},
        occupation_family="unseen_family",
    )
    # Must return None so engine falls back gracefully to deterministic adapter
    assert score is None
