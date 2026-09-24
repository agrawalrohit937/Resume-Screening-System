"""
Job Cleanup Service — Automated Removal of Stale External Job Listings.

Provides automated garbage collection and maintenance for external jobs (is_external: true),
ensuring listings older than 7 days are pruned to maintain feed freshness and conserve
MongoDB storage. Strictly isolates internal employer listings from deletion.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import structlog

logger = structlog.get_logger(__name__)


def _get_jobs_collection(db: Any) -> Any:
    """Safely extracts the raw jobs collection from Motor or TenantScoped wrapper."""
    if hasattr(db, "_raw_db"):
        return db._raw_db["jobs"]
    if hasattr(db, "get_collection") and not hasattr(db, "client"):
        return db.get_collection("jobs")
    return db["jobs"]


async def cleanup_stale_external_jobs(
    db: Any,
    max_age_days: int = 7,
) -> Dict[str, Any]:
    """
    Hard-deletes external job listings older than `max_age_days` (default 7 days).

    Safety Guarantees:
    1. Strictly targets documents where `is_external` is True (or truthy string/int).
    2. Internal tenant jobs (`is_external: false` or missing) are NEVER deleted.
    3. Evaluates both `updated_at` and `created_at` against the cutoff timestamp.
    4. Supports datetime objects and ISO formatted strings in MongoDB.
    """
    try:
        jobs_coll = _get_jobs_collection(db)
        now = datetime.now(timezone.utc)
        cutoff_dt = now - timedelta(days=max_age_days)
        cutoff_iso = cutoff_dt.isoformat()

        # Query for stale external jobs: strictly is_external: True AND timestamp < cutoff
        query: Dict[str, Any] = {
            "is_external": {"$in": [True, "true", "True", 1]},
            "$or": [
                # 1. Stale updated_at (datetime or string)
                {"updated_at": {"$lt": cutoff_dt}},
                {"updated_at": {"$lt": cutoff_iso}},
                # 2. Stale created_at with missing updated_at
                {
                    "created_at": {"$lt": cutoff_dt},
                    "updated_at": {"$exists": False},
                },
                {
                    "created_at": {"$lt": cutoff_iso},
                    "updated_at": {"$exists": False},
                },
            ],
        }

        # Perform hard delete
        delete_result = await jobs_coll.delete_many(query)
        deleted_count = getattr(delete_result, "deleted_count", 0)

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
    from core.config import settings
    from config.db import connect_db, disconnect_db, get_database

    async def _run_manual_cleanup() -> None:
        try:
            await connect_db()
            db = get_database()
            result = await cleanup_stale_external_jobs(db, max_age_days=7)
            print(f"Stale external jobs cleanup result: {result}")
        except Exception as exc:
            print(f"Cleanup execution failed: {exc}")
            sys.exit(1)
        finally:
            await disconnect_db()

    asyncio.run(_run_manual_cleanup())
