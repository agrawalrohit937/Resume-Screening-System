"""
Scoring Features Definition & Extraction Module.

Phase 1.5:
- Defines an explicit, ordered feature vector dataclass (ScoringFeatures) with FEATURE_SCHEMA_VERSION.
- Captures ~45 scoring features spanning skill alignment, experience metrics, education ranks,
  model metadata, and active feature flags.
- Persisted on applications and scoring results to enable cheap, deterministic scoring replay.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

FEATURE_SCHEMA_VERSION = "1.0.0"


@dataclass
class ScoringFeatures:
    # Schema Metadata
    feature_schema_version: str = FEATURE_SCHEMA_VERSION
    scoring_version: str = "2.0.0"
    embedding_model_version: str = "bge-m3-v1.0"
    created_at_iso: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    # Quality & Component Scores
    quality_score: float = 0.0
    final_score: float = 0.0
    skills_score: float = 0.0
    experience_score: float = 0.0
    education_score: float = 0.0
    vector_score: float = 0.0
    keyword_score: float = 0.0
    strict_score: float = 0.0

    # Skill Metrics
    total_required_skills: int = 0
    matched_skills_count: int = 0
    transferable_skills_count: int = 0
    missing_skills_count: int = 0
    skill_match_ratio: float = 0.0
    critical_skills_matched_count: int = 0
    critical_skills_missing_count: int = 0

    # Experience Metrics
    raw_calendar_years: float = 0.0
    effective_years: float = 0.0
    required_years: float = 0.0
    experience_parity_ratio: float = 0.0
    seniority_rank: int = 1
    seniority_delta: int = 0
    career_gaps_count: int = 0

    # Education Metrics
    education_rank: int = 1
    required_education_rank: int = 1
    degree_parity: bool = True

    # Eligibility & Knockout Signals
    eligibility_status: str = "eligible"  # eligible | ineligible | unverified
    eligibility_rank: int = 0            # 0 | 1 | 2
    is_knockout: bool = False
    hard_check_failures_count: int = 0
    soft_check_advisories_count: int = 0

    # Parsing Quality Metrics
    parsing_is_healthy: bool = True
    parsing_confidence: float = 1.0
    parsing_warnings_count: int = 0

    # Reranker Signals
    reranker_score: Optional[float] = None
    is_reranked: bool = False

    # Active Configuration Flags
    flags_active: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def compute_hash(self) -> str:
        serialized = json.dumps(self.to_dict(), sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> ScoringFeatures:
        valid_fields = {f for f in cls.__dataclass_fields__}
        filtered = {k: v for k, v in data.items() if k in valid_fields}
        return cls(**filtered)


def extract_scoring_features(
    result: Dict[str, Any],
    flags_active: Optional[List[str]] = None,
    embedding_version: str = "bge-m3-v1.0",
) -> ScoringFeatures:
    """Extracts a stable, standardized ScoringFeatures record from a scoring engine result dictionary."""
    elig = result.get("eligibility") or {}
    checks = elig.get("checks") or []
    hard_failures = sum(1 for c in checks if c.get("severity") == "hard" and not c.get("passed"))
    soft_advisories = sum(1 for c in checks if c.get("severity") == "soft" and not c.get("passed"))

    matched_cnt = len(result.get("matched_skills", []))
    transf_cnt = len(result.get("transferable_skills", []))
    missing_cnt = len(result.get("missing_skills", []))
    total_skills = matched_cnt + transf_cnt + missing_cnt

    health = result.get("parsing_health") or {}

    return ScoringFeatures(
        feature_schema_version=FEATURE_SCHEMA_VERSION,
        scoring_version=str(result.get("scoring_version", "2.0.0")),
        embedding_model_version=embedding_version,
        quality_score=float(result.get("quality_score", result.get("final_score", 0.0))),
        final_score=float(result.get("final_score", 0.0)),
        skills_score=float(result.get("skills_score", 0.0)),
        experience_score=float(result.get("experience_score", 0.0)),
        education_score=float(result.get("education_score", 0.0)),
        vector_score=float(result.get("vector_score", 0.0)),
        keyword_score=float(result.get("keyword_score", 0.0)),
        strict_score=float(result.get("strict_score", 0.0)),
        total_required_skills=total_skills,
        matched_skills_count=matched_cnt,
        transferable_skills_count=transf_cnt,
        missing_skills_count=missing_cnt,
        skill_match_ratio=round(matched_cnt / max(1, total_skills), 3),
        eligibility_status=str(elig.get("status", "eligible")),
        eligibility_rank=int(result.get("eligibility_rank", 0)),
        is_knockout=bool(result.get("is_knockout", False)),
        hard_check_failures_count=hard_failures,
        soft_check_advisories_count=soft_advisories,
        parsing_is_healthy=bool(health.get("is_healthy", True)),
        parsing_confidence=float(health.get("confidence", 1.0)),
        parsing_warnings_count=len(health.get("warnings", [])),
        reranker_score=result.get("reranker_score"),
        is_reranked=result.get("reranker_score") is not None,
        flags_active=list(flags_active or []),
    )
