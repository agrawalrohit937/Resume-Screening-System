"""
Feature Flags Module for CareerShala ATS.
Provides environment-driven boolean feature toggles for zero-downtime, safe rollouts.
"""

import os

def _bool_flag(env_var: str, default: bool = False) -> bool:
    val = os.getenv(env_var)
    if val is None:
        return default
    return val.strip().lower() in ("true", "1", "yes", "on", "enable", "enabled")


# Core ATS & Scoring Flags
FEATURE_CRITICALITY_WEIGHTING: bool = _bool_flag("FEATURE_CRITICALITY_WEIGHTING", default=True)
FEATURE_SPLIT_ELIGIBILITY: bool = _bool_flag("FEATURE_SPLIT_ELIGIBILITY", default=True)
FEATURE_MULTI_VECTOR_EMBEDDING: bool = _bool_flag("FEATURE_MULTI_VECTOR_EMBEDDING", default=True)
FEATURE_REAL_EXPERIENCE_MODEL: bool = _bool_flag("FEATURE_REAL_EXPERIENCE_MODEL", default=True)
FEATURE_PROJECTS_SCORING: bool = _bool_flag("FEATURE_PROJECTS_SCORING", default=True)
FEATURE_CONTEXTUAL_SKILLS: bool = _bool_flag("FEATURE_CONTEXTUAL_SKILLS", default=True)

# Ontology & Domain Adapters
FEATURE_OCCUPATION_GRAPH: bool = _bool_flag("FEATURE_OCCUPATION_GRAPH", default=True)
FEATURE_OCCUPATION_ADAPTERS: bool = _bool_flag("FEATURE_OCCUPATION_ADAPTERS", default=True)
FEATURE_CREDENTIAL_VERIFICATION: bool = _bool_flag("FEATURE_CREDENTIAL_VERIFICATION", default=True)
