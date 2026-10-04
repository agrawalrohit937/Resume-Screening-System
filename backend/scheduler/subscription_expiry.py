"""
Subscription Expiry Sweep — Automated Retention & Plan Management.

Sweep to auto-downgrade expired paid plans to Free.
Executed via authenticated webhook from Azure Logic App or manual admin trigger.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import structlog
from bson import ObjectId

from config.db import get_database

logger = structlog.get_logger(__name__)


async def expire_overdue_subscriptions(db: Optional[Any] = None) -> Dict[str, Any]:
    """
    Finds active subscriptions whose end date is past, and downgrades them to 'free'.
    Accepts an optional database instance; falls back to get_database() if None.
    """
    now = datetime.now(timezone.utc)
    legacy_cutoff = now - timedelta(days=30)
    if db is None:
        try:
            db = get_database()
        except Exception as exc:
            logger.error("Database connection unavailable for subscription sweep", error=str(exc))
            return {"error": "Database not initialized", "expired_count": 0}

    raw_db = getattr(db, "_raw_db", db)

    filter_query = {
        "subscription_active": True,
        "$or": [
            {"subscription_end_date": {"$lte": now, "$ne": None}},
            {
                "$or": [
                    {"subscription_end_date": None},
                    {"subscription_end_date": {"$exists": False}},
                ],
                "plan_updated_at": {"$lte": legacy_cutoff},
            },
        ],
    }

    try:
        expired_docs = await raw_db.users.find(
            filter_query, {"_id": 1, "email": 1, "plan": 1}
        ).to_list(length=2000)

        if not expired_docs:
            logger.info("subscription_expiry_sweep: no expired subscriptions found")
            return {"expired_count": 0}

        object_ids = [ObjectId(str(d["_id"])) for d in expired_docs if d.get("_id")]
        emails = [d.get("email", "?") for d in expired_docs]

        result = await raw_db.users.update_many(
            {"_id": {"$in": object_ids}},
            {
                "$set": {
                    "plan": "free",
                    "subscription_active": False,
                    "subscription_status": "expired",
                    "subscription_end_date": None,
                    "plan_updated_at": now,
                }
            },
        )

        logger.warning(
            "subscription_expiry_sweep: auto-downgraded expired subscriptions",
            expired_count=result.modified_count,
            user_emails=emails,
        )
        return {"expired_count": result.modified_count}

    except Exception as exc:
        logger.error("Failed to execute subscription expiry sweep", error=str(exc))
        return {"error": str(exc), "expired_count": 0}
