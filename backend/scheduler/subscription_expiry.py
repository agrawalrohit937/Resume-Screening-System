"""
Subscription Expiry Scheduler.

Daily cron to auto-downgrade expired paid plans to Free.
Schedule: Every day at midnight IST (18:30 UTC).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import structlog

from config.db import get_database

logger = structlog.get_logger(__name__)


async def expire_overdue_subscriptions():
    now = datetime.now(timezone.utc)
    db = get_database()

    filter_query = {
        "subscription_active": True,
        "subscription_end_date": {"": now, "": None},
    }

    expired_docs = await db.users.find(
        filter_query, {"_id": 1, "email": 1, "plan": 1}
    ).to_list(length=2000)

    if not expired_docs:
        logger.info("subscription_expiry_sweep: no expired subscriptions found")
        return {"expired_count": 0}

    from bson import ObjectId
    object_ids = [ObjectId(str(d["_id"])) for d in expired_docs if d.get("_id")]
    emails = [d.get("email", "?") for d in expired_docs]

    result = await db.users.update_many(
        {"_id": {"": object_ids}},
        {
            "": {
                "plan": "free",
                "subscription_active": False,
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

