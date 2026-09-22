"""
Shadow Scoring Service — Parallel Offline Evaluation of Experimental Scoring & Ranking.

Phase 4, Task 4.6:
Executes shadow models (e.g., LTR rankers, experimental weight profiles) asynchronously alongside
production scoring requests, recording comparison metrics to `db.shadow_scores` without impacting
candidate or recruiter user experiences.

Privacy & Determinism:
- Zero raw resume or JD text logged or stored in db.shadow_scores.
- Strictly mathematical metrics, IDs, deltas, and trace IDs.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Union

import structlog
from pydantic import BaseModel, Field

from core.feature_flags import FEATURE_SHADOW_SCORING, FEATURE_LTR_RANKER
from core.logging import get_trace_id

logger = structlog.get_logger(__name__)


class ShadowScoreRecord(BaseModel):
    job_id: str
    candidate_id: str
    tenant_id: str = "default"
    primary_score: float
    shadow_score: float
    score_delta: float
    shadow_model_version: str = "shadow-ltr-v2"
    occupation_family: str = "generic"
    feature_schema_version: str = "1.0.0"
    trace_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ShadowScoringService:
    """
    Manages non-blocking parallel evaluation for experimental scoring models.
    """

    def __init__(self):
        self._in_memory_records: list[Dict[str, Any]] = []

    async def execute_shadow_score(
        self,
        job_id: str,
        candidate_id: str,
        primary_score: float,
        features_dict: Optional[Dict[str, Any]] = None,
        occupation_family: str = "generic",
        db: Any = None,
        shadow_model_version: str = "shadow-ltr-v2",
        tenant_id: str = "default",
    ) -> Optional[Dict[str, Any]]:
        """
        Calculates a shadow ranking/quality score and asynchronously records it into `db.shadow_scores`.
        """
        if not FEATURE_SHADOW_SCORING:
            return None

        features = features_dict or {}
        shadow_score: Optional[float] = None

        # 1. Evaluate LTR ranker model if enabled and features present
        if FEATURE_LTR_RANKER or features:
            try:
                from ml.ranker_service import ltr_ranker_service
                raw_pred = ltr_ranker_service.predict_rank_score(features, occupation_family)
                if raw_pred is not None:
                    # Scale ranker prediction to 0-100 or preserve raw
                    shadow_score = round(float(raw_pred), 2)
            except Exception as e:
                logger.debug("Shadow LTR inference fallback", error=str(e))

        # 2. Fallback shadow model: experimental non-linear calibration or weighted formulation
        if shadow_score is None:
            # Baseline experimental shadow algorithm: calibrated semantic-dominant formulation
            sem_score = float(features.get("semantic_similarity", primary_score / 100.0 if primary_score > 1.0 else primary_score))
            skill_score = float(features.get("skill_coverage_ratio", sem_score))
            # Experimental shadow formula: 0.65 * semantic + 0.35 * skill
            exp_score = (0.65 * sem_score + 0.35 * skill_score) * 100.0 if sem_score <= 1.0 else (0.65 * sem_score + 0.35 * skill_score)
            shadow_score = round(min(100.0, max(0.0, exp_score)), 2)

        delta = round(float(shadow_score - primary_score), 4)

        record = {
            "job_id": str(job_id),
            "candidate_id": str(candidate_id),
            "tenant_id": str(tenant_id),
            "primary_score": float(primary_score),
            "shadow_score": float(shadow_score),
            "score_delta": delta,
            "shadow_model_version": shadow_model_version,
            "occupation_family": occupation_family,
            "feature_schema_version": features.get("feature_schema_version", "1.0.0"),
            "trace_id": get_trace_id(),
            "created_at": datetime.now(timezone.utc),
        }

        # Persist to database if provided
        if db is not None:
            try:
                coll = getattr(db, "shadow_scores", None) if hasattr(db, "shadow_scores") else None
                if coll is None:
                    try:
                        coll = db["shadow_scores"]
                    except Exception:
                        pass
                if coll is not None:
                    op = coll.insert_one(record)
                    if hasattr(op, "__await__"):
                        await op
            except Exception as e:
                logger.debug("Failed inserting shadow score to MongoDB", error=str(e))
        else:
            self._in_memory_records.append(record)

        logger.info(
            "Shadow score evaluated",
            job_id=str(job_id),
            primary_score=primary_score,
            shadow_score=shadow_score,
            delta=delta,
            model_version=shadow_model_version,
            trace_id=record["trace_id"],
        )
        return record

    def dispatch_shadow_score(
        self,
        job_id: str,
        candidate_id: str,
        primary_score: float,
        features_dict: Optional[Dict[str, Any]] = None,
        occupation_family: str = "generic",
        db: Any = None,
        shadow_model_version: str = "shadow-ltr-v2",
    ) -> None:
        """
        Fire-and-forget asynchronous dispatch to prevent adding any latency to the critical response path.
        """
        if not FEATURE_SHADOW_SCORING:
            return

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(
                    self.execute_shadow_score(
                        job_id=job_id,
                        candidate_id=candidate_id,
                        primary_score=primary_score,
                        features_dict=features_dict,
                        occupation_family=occupation_family,
                        db=db,
                        shadow_model_version=shadow_model_version,
                    )
                )
        except Exception as e:
            logger.debug("Async shadow score dispatch ignored", error=str(e))


shadow_scoring_service = ShadowScoringService()
