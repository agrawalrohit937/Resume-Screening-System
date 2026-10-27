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
FEATURE_MATCH_EVENT_LOGGING: bool = _bool_flag("FEATURE_MATCH_EVENT_LOGGING", default=True)
FEATURE_PROJECTS_SCORING: bool = _bool_flag("FEATURE_PROJECTS_SCORING", default=True)
FEATURE_CONTEXTUAL_SKILLS: bool = _bool_flag("FEATURE_CONTEXTUAL_SKILLS", default=True)
FEATURE_HYBRID_RETRIEVAL: bool = _bool_flag("FEATURE_HYBRID_RETRIEVAL", default=True)
FEATURE_CALIBRATION: bool = _bool_flag("FEATURE_CALIBRATION", default=True)
FEATURE_CROSS_ENCODER_RERANK: bool = _bool_flag("FEATURE_CROSS_ENCODER_RERANK", default=False)

# Ontology & Domain Adapters
FEATURE_OCCUPATION_GRAPH: bool = _bool_flag("FEATURE_OCCUPATION_GRAPH", default=True)
FEATURE_OCCUPATION_ADAPTERS: bool = _bool_flag("FEATURE_OCCUPATION_ADAPTERS", default=True)
FEATURE_CREDENTIAL_VERIFICATION: bool = _bool_flag("FEATURE_CREDENTIAL_VERIFICATION", default=True)
FEATURE_SKILLS_FIRST_EDUCATION: bool = _bool_flag("FEATURE_SKILLS_FIRST_EDUCATION", default=True)
FEATURE_JD_QUALITY_ASSISTANT: bool = _bool_flag("FEATURE_JD_QUALITY_ASSISTANT", default=True)

# Infrastructure & Multi-Tenancy
FEATURE_MULTI_TENANCY: bool = _bool_flag("FEATURE_MULTI_TENANCY", default=True)
FEATURE_REDIS_CACHE: bool = _bool_flag("FEATURE_REDIS_CACHE", default=False)
FEATURE_DISTRIBUTED_LOCK: bool = _bool_flag("FEATURE_DISTRIBUTED_LOCK", default=False)
FEATURE_BLIND_SCORING: bool = _bool_flag("FEATURE_BLIND_SCORING", default=False)
