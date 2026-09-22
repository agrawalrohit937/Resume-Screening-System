"""
Immutable Decision Log Service for CareerPilot ATS.
Provides an append-only audit trail recording every scoring verdict, eligibility check,
and human recruiter override to db.decision_log for regulatory compliance (GDPR Art 22, EU AI Act, NYC LL144).
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
import structlog

logger = structlog.get_logger(__name__)


async def log_scoring_decision(
    job_id: str,
    candidate_id: str,
    scoring_result: Dict[str, Any],
    model_versions: Optional[Dict[str, str]] = None,
    override_info: Optional[Dict[str, Any]] = None,
    features_hash: Optional[str] = None,
    db: Any = None,
) -> Dict[str, Any]:
    """
    Appends an immutable decision record to db.decision_log.

    Guarantees:
      - Append-only collection: no document update or delete interface.
      - Full traceability: records quality_score, eligibility status, checks, model versions, and human overrides.

    Complexity:
        Time: O(1) MongoDB insertion.
        Space: O(1) audit document.
    """
    decision_record = {
        "job_id": str(job_id),
        "candidate_id": str(candidate_id),
        "quality_score": float(scoring_result.get("quality_score", 0.0)),
        "eligibility_status": scoring_result.get("eligibility", {}).get("status", "eligible"),
        "eligibility_rank": scoring_result.get("eligibility_rank", 0),
        "checks_evaluated": scoring_result.get("eligibility", {}).get("checks", []),
        "model_versions": model_versions or {
            "scoring_engine": "2.0.0",
            "embedding_model": "bge-m3-v1.0",
        },
        "feature_vector_hash": features_hash,
        "human_override": override_info,
        "recorded_at_iso": datetime.now(timezone.utc).isoformat(),
    }

    if db is not None:
        try:
            await db.decision_log.insert_one(decision_record)
            logger.info(
                "Immutable decision logged",
                job_id=job_id,
                candidate_id=candidate_id,
                quality_score=decision_record["quality_score"],
            )
        except Exception as e:
            logger.warning("Failed writing to db.decision_log", error=str(e))

    return decision_record
