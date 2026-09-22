"""
Machine Learning & Learning-to-Rank (LTR) Package for CareerPilot ATS.
"""

from ml.train_ranker import (
    train_xgboost_ranker,
    prepare_ranking_dataset,
    compute_inverse_propensity_weight,
    validate_feature_set_cleanliness,
    LTR_FEATURE_NAMES,
    PROTECTED_ATTRIBUTE_DENYLIST,
)
from ml.ranker_service import LTRRankerService, ltr_ranker_service

__all__ = [
    "train_xgboost_ranker",
    "prepare_ranking_dataset",
    "compute_inverse_propensity_weight",
    "validate_feature_set_cleanliness",
    "LTR_FEATURE_NAMES",
    "PROTECTED_ATTRIBUTE_DENYLIST",
    "LTRRankerService",
    "ltr_ranker_service",
]
