"""
Job Cleanup Service — Automated Removal of Stale External Job Listings.
100% Native PostgreSQL via SQLAlchemy 2.0.
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import structlog
from sqlalchemy import delete, or_

from config.db import get_pg_session_factory
from models import Job

logger = structlog.get_logger(__name__)


async def cleanup_stale_external_jobs(
    db: Optional[Any] = None,
    max_age_days: int = 5,
    session_factory=None,
) -> Dict[str, Any]:
    """
    Hard-deletes external job listings older than `max_age_days` (default 5 days).
    Strictly isolates internal employer listings from deletion.
    """
    session_factory = session_factory or get_pg_session_factory()
    now = datetime.now(timezone.utc)
    cutoff_dt = now - timedelta(days=max_age_days)
    cutoff_iso = cutoff_dt.isoformat()

    try:
        async with session_factory() as session:
            async with session.begin():
                stmt = delete(Job).where(
                    Job.is_external == True,
                    or_(
                        Job.updated_at < cutoff_dt,
                        Job.created_at < cutoff_dt,
                    ),
                )
                res = await session.execute(stmt)
                deleted_count = getattr(res, "rowcount", 0) or 0

        logger.info(
            "Stale external jobs cleanup completed",
            deleted_count=deleted_count,
            max_age_days=max_age_days,
            cutoff=cutoff_iso,
        )

        return {
            "success": True,
            "deleted_count": deleted_count,
            "cutoff": cutoff_iso,
            "max_age_days": max_age_days,
        }

    except Exception as exc:
        logger.error(
            "Failed to cleanup stale external jobs",
            error=str(exc),
            max_age_days=max_age_days,
        )
        return {
            "success": False,
            "deleted_count": 0,
            "error": str(exc),
            "max_age_days": max_age_days,
        }


if __name__ == "__main__":
    import asyncio
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

    async def _run_manual_cleanup() -> None:
        try:
            result = await cleanup_stale_external_jobs(max_age_days=7)
            print(f"Stale external jobs cleanup result: {result}")
        except Exception as exc:
            print(f"Cleanup execution failed: {exc}")
            sys.exit(1)

    asyncio.run(_run_manual_cleanup())
