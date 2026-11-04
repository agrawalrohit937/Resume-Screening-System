"""
Match Events Telemetry Service (Pure PostgreSQL SQLAlchemy 2.0).
Records impression, interaction, and outcome telemetry to PostgreSQL audit_logs.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import structlog

from core.feature_flags import FEATURE_MATCH_EVENT_LOGGING
from config.db import get_pg_session_factory
from models.tables import AuditLog

logger = structlog.get_logger(__name__)


async def ensure_telemetry_indexes(db: Any = None) -> None:
    pass


async def log_match_event(
    db: Any = None,
    event_type: str = "match_preview",
    candidate_id: str = "anonymous",
    job_id: str = "",
    application_id: Optional[str] = None,
    position_in_list: Optional[int] = None,
    surface: str = "jobs_for_you",
    quality_score: Optional[float] = None,
    features_hash: Optional[str] = None,
    shown_at: Optional[datetime] = None,
    action: Optional[str] = None,
    extra_metadata: Optional[Dict[str, Any]] = None,
) -> None:
    if not FEATURE_MATCH_EVENT_LOGGING:
        return

    now = datetime.now(timezone.utc)
    clean_meta = {}
    if extra_metadata:
        for k, v in extra_metadata.items():
            if "text" not in k.lower() and "resume" not in k.lower() and "raw" not in k.lower():
                clean_meta[k] = v

    payload = {
        "event_type": str(event_type),
        "candidate_id": str(candidate_id),
        "job_id": str(job_id),
        "application_id": str(application_id) if application_id else None,
        "position_in_list": position_in_list,
        "surface": str(surface),
        "quality_score": round(float(quality_score), 1) if quality_score is not None else None,
        "features_hash": str(features_hash) if features_hash else None,
        "shown_at": (shown_at or now).isoformat(),
        "action": action,
        "metadata": clean_meta,
    }

    try:
        session_factory = get_pg_session_factory()
        async with session_factory() as session:
            entry = AuditLog(
                id=str(uuid.uuid4()),
                event_id=f"telem_{uuid.uuid4().hex[:12]}",
                tenant_id="default",
                actor_id=str(candidate_id),
                action=str(event_type),
                target_id=str(job_id),
                payload=payload,
                created_at=now,
            )
            session.add(entry)
            await session.commit()
    except Exception as e:
        logger.warning("Failed to log match telemetry event", event_type=event_type, error=str(e))
