"""
Feature Flags Module for CareerPilot ATS.
Provides environment-driven boolean feature toggles for zero-downtime, safe rollouts.
"""

import os

def _bool_flag(env_var: str, default: bool = False) -> bool:
    val = os.getenv(env_var)
    if val is None:
        return default
    return val.strip().lower() in ("true", "1", "yes", "on", "enable", "enabled")


# Phase 0 Flags
FEATURE_CRITICALITY_WEIGHTING: bool = _bool_flag("FEATURE_CRITICALITY_WEIGHTING", default=True)
FEATURE_SPLIT_ELIGIBILITY: bool = _bool_flag("FEATURE_SPLIT_ELIGIBILITY", default=True)
FEATURE_ATLAS_VECTOR_SEARCH: bool = _bool_flag("FEATURE_ATLAS_VECTOR_SEARCH", default=False)

# Phase 1-3 Future Flags (defaulting OFF per rules)
FEATURE_CROSS_ENCODER_RERANK: bool = _bool_flag("FEATURE_CROSS_ENCODER_RERANK", default=False)
FEATURE_BLIND_SCORING: bool = _bool_flag("FEATURE_BLIND_SCORING", default=False)
FEATURE_LTR_RANKER: bool = _bool_flag("FEATURE_LTR_RANKER", default=False)
