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

# Phase 1 Flags
FEATURE_MULTI_VECTOR_EMBEDDING: bool = _bool_flag("FEATURE_MULTI_VECTOR_EMBEDDING", default=True)
FEATURE_CROSS_ENCODER_RERANK: bool = _bool_flag("FEATURE_CROSS_ENCODER_RERANK", default=False)
FEATURE_REAL_EXPERIENCE_MODEL: bool = _bool_flag("FEATURE_REAL_EXPERIENCE_MODEL", default=True)
FEATURE_MATCH_EVENT_LOGGING: bool = _bool_flag("FEATURE_MATCH_EVENT_LOGGING", default=True)

# Phase 2 Flags
FEATURE_OCCUPATION_GRAPH: bool = _bool_flag("FEATURE_OCCUPATION_GRAPH", default=True)
FEATURE_OCCUPATION_ADAPTERS: bool = _bool_flag("FEATURE_OCCUPATION_ADAPTERS", default=True)
FEATURE_CREDENTIAL_VERIFICATION: bool = _bool_flag("FEATURE_CREDENTIAL_VERIFICATION", default=True)
FEATURE_SKILLS_FIRST_EDUCATION: bool = _bool_flag("FEATURE_SKILLS_FIRST_EDUCATION", default=True)
FEATURE_LOCATION_GRAPH: bool = _bool_flag("FEATURE_LOCATION_GRAPH", default=True)
FEATURE_JD_QUALITY_ASSISTANT: bool = _bool_flag("FEATURE_JD_QUALITY_ASSISTANT", default=True)

# Phase 3 Flags
FEATURE_HYBRID_RETRIEVAL: bool = _bool_flag("FEATURE_HYBRID_RETRIEVAL", default=True)
FEATURE_BLIND_SCORING: bool = _bool_flag("FEATURE_BLIND_SCORING", default=False)
FEATURE_LTR_RANKER: bool = _bool_flag("FEATURE_LTR_RANKER", default=False)
FEATURE_CALIBRATION: bool = _bool_flag("FEATURE_CALIBRATION", default=True)

# Phase 4 Flags
FEATURE_ASYNC_WORKERS: bool = _bool_flag("FEATURE_ASYNC_WORKERS", default=False)
FEATURE_REDIS_CACHE: bool = _bool_flag("FEATURE_REDIS_CACHE", default=False)
FEATURE_DISTRIBUTED_LOCK: bool = _bool_flag("FEATURE_DISTRIBUTED_LOCK", default=False)
FEATURE_SHADOW_SCORING: bool = _bool_flag("FEATURE_SHADOW_SCORING", default=True)
FEATURE_DRIFT_DETECTION: bool = _bool_flag("FEATURE_DRIFT_DETECTION", default=True)

# Phase 5 Flags (Enterprise Surface)
FEATURE_MULTI_TENANCY: bool = _bool_flag("FEATURE_MULTI_TENANCY", default=True)
FEATURE_GRANULAR_RBAC: bool = _bool_flag("FEATURE_GRANULAR_RBAC", default=True)
FEATURE_SSO_SAML: bool = _bool_flag("FEATURE_SSO_SAML", default=True)
FEATURE_EEO_ISOLATION: bool = _bool_flag("FEATURE_EEO_ISOLATION", default=True)
FEATURE_ATS_WORKFLOWS: bool = _bool_flag("FEATURE_ATS_WORKFLOWS", default=True)
FEATURE_ECOSYSTEM_INTEGRATIONS: bool = _bool_flag("FEATURE_ECOSYSTEM_INTEGRATIONS", default=True)
FEATURE_CONSENTED_TALENT_POOLS: bool = _bool_flag("FEATURE_CONSENTED_TALENT_POOLS", default=True)

# ATS Engine Upgrade Flags (Phases 1-8)
FEATURE_PROJECTS_SCORING: bool = _bool_flag("FEATURE_PROJECTS_SCORING", default=True)
FEATURE_CONTEXTUAL_SKILLS: bool = _bool_flag("FEATURE_CONTEXTUAL_SKILLS", default=False)
FEATURE_DEP_NEGATION: bool = _bool_flag("FEATURE_DEP_NEGATION", default=False)
FEATURE_LEARNED_RANKER: bool = _bool_flag("FEATURE_LEARNED_RANKER", default=False)
FEATURE_OPENSEARCH_HYBRID: bool = _bool_flag("FEATURE_OPENSEARCH_HYBRID", default=False)



