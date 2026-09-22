"""
Learning-to-Rank (LTR) Training Module using XGBoost LambdaMART (rank:ndcg).
Trains per-occupation-family ranking models on persisted ScoringFeatures with:
- Inverse Propensity Weighting (IPW) for position-bias correction
- Strict protected attribute deny-list enforcement
- 5,000 labeled applications minimum sample gate
"""

import os
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
import numpy as np
import structlog

logger = structlog.get_logger(__name__)

# Minimum threshold of labeled applications per occupation family to train specialized ranker
MIN_LABELED_APPLICATIONS_THRESHOLD: int = 5000

# Explicit Deny-List for Protected Attributes and Demographic Proxies
PROTECTED_ATTRIBUTE_DENYLIST: Set[str] = {
    "name",
    "full_name",
    "first_name",
    "last_name",
    "gender",
    "sex",
    "age",
    "dob",
    "date_of_birth",
    "birth_date",
    "photo",
    "image",
    "avatar",
    "marital_status",
    "caste",
    "religion",
    "faith",
    "institution_name",
    "school_name",
    "university_name",
    "college_name",
    "graduation_year",
    "grad_year",
    "year_of_passing",
    "nationality",
    "citizenship",
    "address",
    "street_address",
    "first_language",
    "mother_tongue",
    "native_language",
}

# Standard numeric feature names extracted from ScoringFeatures for LTR
LTR_FEATURE_NAMES: List[str] = [
    "quality_score",
    "skills_score",
    "experience_score",
    "education_score",
    "vector_score",
    "keyword_score",
    "strict_score",
    "total_required_skills",
    "matched_skills_count",
    "transferable_skills_count",
    "missing_skills_count",
    "skill_match_ratio",
    "critical_skills_matched_count",
    "critical_skills_missing_count",
    "raw_calendar_years",
    "effective_years",
    "required_years",
    "experience_parity_ratio",
    "seniority_rank",
    "seniority_delta",
    "career_gaps_count",
    "education_rank",
    "required_education_rank",
    "degree_parity",
    "is_knockout",
    "hard_check_failures_count",
    "soft_check_advisories_count",
    "parsing_confidence",
    "parsing_warnings_count",
]


def validate_feature_set_cleanliness(feature_names: List[str]):
    """
    Enforces that NO protected or demographic proxy attributes appear in the feature vector.
    Raises ValueError if any violation is detected.

    Complexity:
        Time: O(N_features * N_denylist)
        Space: O(1)
    """
    violations = []
    for f in feature_names:
        f_low = f.lower()
        for denied in PROTECTED_ATTRIBUTE_DENYLIST:
            if denied == f_low or f"_{denied}" in f_low or f"{denied}_" in f_low:
                violations.append((f, denied))

    if violations:
        raise ValueError(
            f"Regulatory Compliance Violation: Protected attributes found in LTR feature set: {violations}"
        )


# Run check at import time to guarantee safety
validate_feature_set_cleanliness(LTR_FEATURE_NAMES)


def compute_inverse_propensity_weight(position_in_list: int, gamma: float = 0.5) -> float:
    """
    Computes Inverse Propensity Weight (IPW) to de-bias recruiter selection labels.
    Higher positions have higher exposure propensity; IPW upweights clicks/shortlists on lower ranks.

    Formula:
        propensity(p) = (1.0 / max(1, p))^gamma
        weight = 1.0 / propensity(p)

    Complexity:
        Time: O(1)
        Space: O(1)
    """
    pos = max(1, int(position_in_list))
    propensity = (1.0 / pos) ** gamma
    return float(min(10.0, max(1.0, 1.0 / propensity)))


def stage_to_relevance_label(stage: str) -> int:
    """
    Maps application recruitment stages to ordinal ranking labels:
      - hired / offer: 3 (strong positive)
      - interview: 2 (positive)
      - shortlisted / review: 1 (weak positive)
      - rejected / withdrew: 0 (negative)
    """
    st = (stage or "").strip().lower()
    if st in ("hired", "offer", "accepted"):
        return 3
    elif st in ("interview", "technical_round", "hr_round", "assessment"):
        return 2
    elif st in ("shortlisted", "reviewed", "screening_passed"):
        return 1
    return 0


def prepare_ranking_dataset(
    applications: List[Dict[str, Any]],
) -> Tuple[np.ndarray, np.ndarray, List[int], np.ndarray]:
    """
    Transforms applications grouped by job_id into XGBoost LambdaMART format:
    Returns: (X, y, qids/groups, sample_weights)

    Complexity:
        Time: O(N_apps log N_apps) for job-level grouping.
        Space: O(N_apps * D_features).
    """
    # Group applications by job_id
    jobs_map: Dict[str, List[Dict[str, Any]]] = {}
    for app in applications:
        j_id = str(app.get("job_id") or "default_job")
        jobs_map.setdefault(j_id, []).append(app)

    X_list: List[List[float]] = []
    y_list: List[int] = []
    groups: List[int] = []
    weights_list: List[float] = []

    for j_id, job_apps in jobs_map.items():
        if len(job_apps) < 2:
            # Need at least 2 candidates in a query group for pairwise ranking
            continue

        group_size = 0
        for app in job_apps:
            feat_dict = app.get("features") or {}
            # Build feature row
            row = []
            for fname in LTR_FEATURE_NAMES:
                val = feat_dict.get(fname, 0.0)
                if isinstance(val, bool):
                    row.append(1.0 if val else 0.0)
                elif isinstance(val, (int, float)):
                    row.append(float(val))
                else:
                    row.append(0.0)

            label = stage_to_relevance_label(app.get("stage") or app.get("status") or "")
            pos = int(app.get("position_in_list") or 1)
            weight = compute_inverse_propensity_weight(pos)

            X_list.append(row)
            y_list.append(label)
            weights_list.append(weight)
            group_size += 1

        if group_size > 0:
            groups.append(group_size)

    if not X_list:
        return np.empty((0, len(LTR_FEATURE_NAMES))), np.empty((0,)), [], np.empty((0,))

    return np.array(X_list, dtype=np.float32), np.array(y_list, dtype=np.int32), groups, np.array(weights_list, dtype=np.float32)


def train_xgboost_ranker(
    X: np.ndarray,
    y: np.ndarray,
    groups: List[int],
    sample_weights: Optional[np.ndarray] = None,
    n_estimators: int = 100,
    learning_rate: float = 0.05,
    max_depth: int = 4,
):
    """
    Trains an XGBoost LambdaMART ranking model (objective='rank:ndcg').

    Complexity:
        Time: O(n_estimators * max_depth * N_samples * D_features)
        Space: O(N_nodes) tree storage.
    """
    import xgboost as xgb

    ranker = xgb.XGBRanker(
        objective="rank:ndcg",
        eval_metric="ndcg@10",
        n_estimators=n_estimators,
        learning_rate=learning_rate,
        max_depth=max_depth,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
    )

    # If sample weights are per-sample but group is specified, aggregate per query group
    fit_weights = sample_weights
    if sample_weights is not None and groups is not None:
        if len(sample_weights) != len(groups):
            group_weights = []
            idx = 0
            for g_size in groups:
                gw = float(np.mean(sample_weights[idx : idx + g_size])) if g_size > 0 else 1.0
                group_weights.append(gw)
                idx += g_size
            fit_weights = np.array(group_weights, dtype=np.float32)

    ranker.fit(
        X,
        y,
        group=groups,
        sample_weight=fit_weights,
        verbose=False,
    )
    return ranker


def save_ranker_model(model: Any, output_path: Path):
    """Serializes the trained XGBoost ranker to JSON format."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(str(output_path))
    logger.info("Saved XGBoost LTR model", path=str(output_path))
