"""
Subscription Expiry Scheduler Job (Pure PostgreSQL SQLAlchemy 2.0).
Sweeps active paid subscriptions periodically; downgrades expired users to Free.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any
import structlog
from sqlalchemy import select, update, and_, or_

from config.db import get_pg_session_factory
from models.tables import User

logger = structlog.get_logger(__name__)


async def expire_stale_subscriptions(db: Any = None) -> Dict[str, Any]:
    """
    Sweeps active paid subscriptions and downgrades users whose
    subscription has passed its end date to Free.
    """
    now = datetime.now(timezone.utc)
    legacy_cutoff = now - timedelta(days=30)



    try:
        session_factory = get_pg_session_factory()
        async with session_factory() as session:
            stmt = (
                select(User)
                .where(
                    and_(
                        User.subscription_active == True,
                        User.plan != "free",
                        or_(
                            User.subscription_end_date <= now,
                            and_(User.subscription_end_date.is_(None), User.plan_updated_at <= legacy_cutoff)
                        )
                    )
                )
            )
            expired_users = (await session.execute(stmt)).scalars().all()

            if not expired_users:
                logger.info("subscription_expiry_sweep: no expired subscriptions found")
                return {"expired_count": 0}

            expired_ids = [u.id for u in expired_users]
            emails = [u.email for u in expired_users]

            up_stmt = (
                update(User)
                .where(User.id.in_(expired_ids))
                .values(
                    plan="free",
                    subscription_active=False,
                    subscription_status="expired",
                    subscription_end_date=None,
                    plan_updated_at=now,
                )
            )
            res = await session.execute(up_stmt)
            await session.commit()

            logger.info(
                "subscription_expiry_sweep: successfully downgraded expired users",
                count=len(expired_ids),
                emails=emails[:10],
            )
            return {"expired_count": len(expired_ids), "downgraded_ids": expired_ids}

    except Exception as exc:
        logger.exception("subscription_expiry_sweep failed", error=str(exc))
        return {"error": str(exc), "expired_count": 0}

expire_overdue_subscriptions = expire_stale_subscriptions
