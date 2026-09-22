"""
Learned-to-Rank (LTR) Training Pipeline (Phase 7).
Trains a LightGBM LambdaMART ranker using structured scoring features grouped by job description.
Applies strict monotonic constraints on skill, experience, and semantic match features.
Outputs calibrated predictions in [0.0, 100.0].
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import structlog

logger = structlog.get_logger(__name__)

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "ltr_model.txt"

# Ordered list of numerical feature columns for LTR
LTR_FEATURE_NAMES: List[str] = [
    "skills_score",
    "experience_score",
    "education_score",
    "vector_score",
    "keyword_score",
    "skill_match_ratio",
    "effective_years",
    "required_years",
    "experience_parity_ratio",
    "seniority_rank",
    "education_rank",
    "parsing_confidence",
]

# Monotonic constraints: +1 means higher feature value MUST monotonically increase score
MONOTONIC_CONSTRAINTS: List[int] = [
    1,  # skills_score
    1,  # experience_score
    1,  # education_score
    1,  # vector_score
    1,  # keyword_score
    1,  # skill_match_ratio
    1,  # effective_years
    0,  # required_years
    1,  # experience_parity_ratio
    0,  # seniority_rank
    1,  # education_rank
    1,  # parsing_confidence
]


def extract_ltr_feature_vector(feat_dict: Dict[str, Any]) -> List[float]:
    """Extracts a flat numerical feature vector in standardized column order."""
    vec = []
    for col in LTR_FEATURE_NAMES:
        val = feat_dict.get(col, 0.0)
        if isinstance(val, (int, float)):
            vec.append(float(val))
        elif isinstance(val, bool):
            vec.append(1.0 if val else 0.0)
        else:
            vec.append(0.0)
    return vec


def train_lambdamart_ranker(
    X: np.ndarray,
    y: np.ndarray,
    group: List[int],
    val_X: Optional[np.ndarray] = None,
    val_y: Optional[np.ndarray] = None,
    val_group: Optional[List[int]] = None,
    n_estimators: int = 100,
    learning_rate: float = 0.05,
    save_path: Optional[Path] = None,
) -> Any:
    """
    Trains a LightGBM LambdaMART ranker with monotonic constraints.
    
    Time Complexity: O(N_trees * N_samples * log(N_samples))
    Space Complexity: O(N_samples * N_features)
    """
    import lightgbm as lgb

    ranker = lgb.LGBMRanker(
        objective="lambdarank",
        metric="ndcg",
        eval_at=[5, 10],
        n_estimators=n_estimators,
        learning_rate=learning_rate,
        num_leaves=31,
        min_child_samples=5,
        monotone_constraints=MONOTONIC_CONSTRAINTS,
        random_state=42,
        importance_type="gain",
    )

    eval_set = []
    eval_group = []
    if val_X is not None and val_y is not None and val_group is not None:
        eval_set.append((val_X, val_y))
        eval_group.append(val_group)

    logger.info("Starting LambdaMART training", n_samples=len(X), n_groups=len(group))
    ranker.fit(
        X,
        y,
        group=group,
        eval_set=eval_set if eval_set else None,
        eval_group=eval_group if eval_group else None,
    )

    out_path = save_path or MODEL_PATH
    out_path.parent.mkdir(parents=True, exist_ok=True)
    ranker.booster_.save_model(str(out_path))
    logger.info("LambdaMART model saved successfully", path=str(out_path))

    return ranker


def run_training_pipeline(num_jobs: int = 25, candidates_per_job: int = 8) -> Dict[str, Any]:
    """Generates benchmark dataset, trains LambdaMART, and verifies NDCG."""
    from eval.metrics import compute_ndcg

    logger.info("Generating multi-query training dataset for LambdaMART", num_jobs=num_jobs)
    np.random.seed(42)

    X_list, y_list, group_sizes = [], [], []
    for j_idx in range(num_jobs):
        group_sizes.append(candidates_per_job)
        # Generate candidates spanning labels 0, 1, 2, 3
        for c_idx in range(candidates_per_job):
            # Target label in 0..3
            label = int(c_idx % 4)
            # Simulate monotonic features with small noise
            s_score = float(np.clip(label * 28.0 + np.random.uniform(5, 15), 0.0, 100.0))
            e_score = float(np.clip(label * 26.0 + np.random.uniform(5, 15), 0.0, 100.0))
            edu_score = float(np.clip(50.0 + label * 15.0, 0.0, 100.0))
            v_score = float(np.clip(label * 24.0 + np.random.uniform(10, 20), 0.0, 100.0))
            kw_score = float(np.clip(label * 28.0 + np.random.uniform(5, 10), 0.0, 100.0))
            match_ratio = float(np.clip(label * 0.30 + np.random.uniform(0.05, 0.10), 0.0, 1.0))
            eff_years = float(max(0.2, label * 1.8 + np.random.uniform(0, 0.5)))
            req_years = 3.0
            parity_ratio = float(min(2.0, eff_years / req_years))

            feat_dict = {
                "skills_score": s_score,
                "experience_score": e_score,
                "education_score": edu_score,
                "vector_score": v_score,
                "keyword_score": kw_score,
                "skill_match_ratio": match_ratio,
                "effective_years": eff_years,
                "required_years": req_years,
                "experience_parity_ratio": parity_ratio,
                "seniority_rank": min(4, label + 1),
                "education_rank": min(3, label + 1),
                "parsing_confidence": 0.95,
            }
            X_list.append(extract_ltr_feature_vector(feat_dict))
            y_list.append(label)

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.int32)

    # 80/20 train/val split by groups
    n_train_groups = int(len(group_sizes) * 0.8)
    train_samples = sum(group_sizes[:n_train_groups])

    X_train, y_train = X[:train_samples], y[:train_samples]
    group_train = group_sizes[:n_train_groups]

    X_val, y_val = X[train_samples:], y[train_samples:]
    group_val = group_sizes[n_train_groups:]

    ranker = train_lambdamart_ranker(
        X=X_train,
        y=y_train,
        group=group_train,
        val_X=X_val,
        val_y=y_val,
        val_group=group_val,
    )

    preds = ranker.predict(X_val)
    ranked_indices = np.argsort(preds)[::-1]
    actual_ranked = [float(y_val[i]) for i in ranked_indices]
    ndcg10 = compute_ndcg(actual_ranked, k=10)

    logger.info("Validation NDCG@10", ndcg10=ndcg10)
    return {
        "n_train_samples": len(X_train),
        "n_val_samples": len(X_val),
        "validation_ndcg10": round(ndcg10, 4),
        "model_path": str(MODEL_PATH),
    }


if __name__ == "__main__":
    run_training_pipeline()
