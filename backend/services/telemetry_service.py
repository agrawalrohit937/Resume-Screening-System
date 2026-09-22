"""
Match Events Telemetry Service.

Phase 1.6:
- Records impression, interaction, and outcome telemetry to `db.match_events`.
- Supports event types: job_impression, job_click, match_preview, apply, stage_change,
  resume_download, eligibility_override.
- Sets 24-month TTL index on `created_at`.
- Strict Privacy Guarantee: Raw resume text is NEVER logged to this collection.
- Guarded behind FEATURE_MATCH_EVENT_LOGGING.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import structlog

from core.feature_flags import FEATURE_MATCH_EVENT_LOGGING

logger = structlog.get_logger(__name__)

TTL_24_MONTHS_SECONDS = 24 * 30 * 86400  # ~62,208,000 seconds
_INDEX_INITIALIZED = False


async def ensure_telemetry_indexes(db: Any) -> None:
    """Idempotently ensures 24-month TTL and lookup indexes on db.match_events."""
    global _INDEX_INITIALIZED
    if _INDEX_INITIALIZED or db is None:
        return

    try:
        await db.match_events.create_index(
            "created_at",
            expireAfterSeconds=TTL_24_MONTHS_SECONDS,
            background=True,
        )
        await db.match_events.create_index(
            [("candidate_id", 1), ("job_id", 1), ("event_type", 1)],
            background=True,
        )
        _INDEX_INITIALIZED = True
        logger.info("Telemetry match_events indexes verified")
    except Exception as e:
        logger.warning("Failed to initialize match_events telemetry index", error=str(e))


async def log_match_event(
    db: Any,
    event_type: str,
    candidate_id: str,
    job_id: str,
    application_id: Optional[str] = None,
    position_in_list: Optional[int] = None,
    surface: str = "jobs_for_you",
    quality_score: Optional[float] = None,
    features_hash: Optional[str] = None,
    shown_at: Optional[datetime] = None,
    action: Optional[str] = None,
    extra_metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Asynchronously logs a structured match or impression event to db.match_events.
    Never logs raw resume text.
    """
    if not FEATURE_MATCH_EVENT_LOGGING or db is None:
        return

    await ensure_telemetry_indexes(db)

    now = datetime.now(timezone.utc)
    clean_meta = {}
    if extra_metadata:
        # Sanitize metadata: explicitly purge any text fields
        for k, v in extra_metadata.items():
            if "text" not in k.lower() and "resume" not in k.lower() and "raw" not in k.lower():
                clean_meta[k] = v

    doc = {
        "event_type": str(event_type),
        "candidate_id": str(candidate_id),
        "job_id": str(job_id),
        "application_id": str(application_id) if application_id else None,
        "position_in_list": position_in_list,
        "surface": str(surface),
        "quality_score": round(float(quality_score), 1) if quality_score is not None else None,
        "features_hash": str(features_hash) if features_hash else None,
        "shown_at": shown_at or now,
        "acted_at": now,
        "action": action,
        "metadata": clean_meta,
        "created_at": now,
    }

    try:
        await db.match_events.insert_one(doc)
    except Exception as e:
        # Telemetry failures must never disrupt user requests
        logger.warning("Failed to log match telemetry event", event_type=event_type, error=str(e))
