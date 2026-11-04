"""
Notifications API Route — Dynamic real notification feed for users with PostgreSQL persistence.
"""

import uuid
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user, get_db, get_gamification_repo
from models.user_model import UserModel
from models.tables import UserNotificationState, Certificate
from repositories.gamification_repo import GamificationRepository

router = APIRouter()


def _parse_dt(val: Any) -> Optional[datetime]:
    """Safely parse a timestamp into a timezone-aware UTC datetime."""
    if not val:
        return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val.astimezone(timezone.utc)
    if isinstance(val, str):
        try:
            cleaned = val.replace("Z", "+00:00")
            dt = datetime.fromisoformat(cleaned)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except Exception:
            return None
    return None


async def _get_pg_notification_state(session: AsyncSession, user_id: str) -> Dict[str, Any]:
    stmt = select(UserNotificationState).where(UserNotificationState.user_id == str(user_id))
    res = await session.execute(stmt)
    row = res.scalar_one_or_none()
    if not row:
        return {}
    return {
        "read_ids": row.read_ids or [],
        "dismissed_ids": row.dismissed_ids or [],
        "cleared_at": row.cleared_at,
        "all_read_at": row.all_read_at,
    }


async def _update_pg_notification_state(
    session: AsyncSession,
    user_id: str,
    *,
    cleared_at: Optional[datetime] = None,
    all_read_at: Optional[datetime] = None,
    add_read_id: Optional[str] = None,
    add_dismissed_id: Optional[str] = None,
) -> None:
    stmt = select(UserNotificationState).where(UserNotificationState.user_id == str(user_id))
    res = await session.execute(stmt)
    row = res.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if not row:
        row = UserNotificationState(
            id=str(uuid.uuid4()),
            user_id=str(user_id),
            read_ids=[add_read_id] if add_read_id else [],
            dismissed_ids=[add_dismissed_id] if add_dismissed_id else [],
            cleared_at=cleared_at,
            all_read_at=all_read_at,
            created_at=now,
            updated_at=now,
        )
        session.add(row)
    else:
        if cleared_at is not None:
            row.cleared_at = cleared_at
            row.read_ids = []
        if all_read_at is not None:
            row.all_read_at = all_read_at
        if add_read_id:
            current_reads = list(row.read_ids or [])
            if add_read_id not in current_reads:
                current_reads.append(add_read_id)
            row.read_ids = current_reads
        if add_dismissed_id:
            current_dismissed = list(row.dismissed_ids or [])
            if add_dismissed_id not in current_dismissed:
                current_dismissed.append(add_dismissed_id)
            row.dismissed_ids = current_dismissed
        row.updated_at = now
    await session.commit()


@router.get("/me")
async def get_my_notifications(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    gamification_repo: GamificationRepository = Depends(get_gamification_repo),
) -> Dict[str, Any]:
    """Return real user notifications synthesized from certificates, point activities, and streaks,
    filtered by persistent user notification state (cleared_at, dismissed_ids, read_ids)."""
    notifications = []
    user_id = str(current_user.id)

    # 1. Fetch persistent notification state for this user
    user_state = await _get_pg_notification_state(session, user_id)
    read_ids = set(user_state.get("read_ids") or [])
    dismissed_ids = set(user_state.get("dismissed_ids") or [])
    cleared_at = _parse_dt(user_state.get("cleared_at"))
    all_read_at = _parse_dt(user_state.get("all_read_at"))

    # 2. Fetch user certificates
    stmt = (
        select(Certificate)
        .where(Certificate.user_id == user_id)
        .order_by(Certificate.issued_at.desc())
        .limit(10)
    )
    res = await session.execute(stmt)
    certificates = res.scalars().all()
    for cert in certificates:
        cert_id = str(cert.id)
        notif_id = f"cert_{cert_id}"
        if notif_id in dismissed_ids:
            continue

        issue_dt = _parse_dt(cert.issued_at) or datetime.now(timezone.utc)
        if cleared_at and issue_dt <= cleared_at:
            continue

        cert_type = (cert.certificate_type or "Skill Assessment").replace("_", " ").title()
        is_read = notif_id in read_ids or (all_read_at and issue_dt <= all_read_at)

        notifications.append({
            "id": notif_id,
            "type": "badge",
            "title": "New Certificate Issued! 🏆",
            "message": f"Congratulations! Your official {cert_type} Certificate has been issued.",
            "created_at": issue_dt.isoformat(),
            "is_read": bool(is_read),
            "link": "/profile",
        })

    # 3. Fetch user gamification profile for XP/points and streaks
    profile = await gamification_repo.get_by_user_id(user_id)
    if profile:
        recent_points = profile.get("recent_points", []) or []
        for pt in reversed(recent_points[-15:]):
            ts_raw = pt.get("ts") or pt.get("created_at") or datetime.now(timezone.utc)
            pt_dt = _parse_dt(ts_raw) or datetime.now(timezone.utc)
            event_name = str(pt.get("event", "activity")).replace("_", " ").title()
            pts = pt.get("points", 25)
            clean_ts = "".join(filter(str.isalnum, str(ts_raw)))[:20]
            notif_id = f"xp_{user_id}_{event_name.lower().replace(' ', '_')}_{clean_ts}_{pts}"

            if notif_id in dismissed_ids:
                continue
            if cleared_at and pt_dt <= cleared_at:
                continue

            is_read = notif_id in read_ids or (all_read_at and pt_dt <= all_read_at)
            notifications.append({
                "id": notif_id,
                "type": "xp",
                "title": f"+{pts} XP Earned! ⚡",
                "message": f"You earned {pts} XP from {event_name}.",
                "created_at": pt_dt.isoformat(),
                "is_read": bool(is_read),
                "link": "/dashboard",
            })

        streak = profile.get("current_streak", 0)
        if streak > 0:
            ts = profile.get("updated_at") or datetime.now(timezone.utc)
            streak_dt = _parse_dt(ts) or datetime.now(timezone.utc)
            streak_id = f"streak_{user_id}_{streak}"
            if streak_id not in dismissed_ids and (not cleared_at or streak_dt > cleared_at):
                is_read = streak_id in read_ids or (all_read_at and streak_dt <= all_read_at)
                notifications.append({
                    "id": streak_id,
                    "type": "streak",
                    "title": f"{streak}-Day Practice Streak Active! 🔥",
                    "message": f"Keep going! You have maintained a {streak}-day active practice streak.",
                    "created_at": streak_dt.isoformat(),
                    "is_read": bool(is_read),
                    "link": "/interview",
                })

    # 4. If no notifications exist and user hasn't cleared them, return a welcoming notification
    if not notifications and not cleared_at and "welcome_notif" not in dismissed_ids:
        user_created_dt = _parse_dt(getattr(current_user, "created_at", None)) or datetime.now(timezone.utc)
        is_read = "welcome_notif" in read_ids or (all_read_at and user_created_dt <= all_read_at)
        notifications.append({
            "id": "welcome_notif",
            "type": "xp",
            "title": "Welcome to CareerShala! 🚀",
            "message": "Complete mock interviews, ATS scans, or daily check-ins to earn XP, badges, and certificates.",
            "created_at": user_created_dt.isoformat(),
            "is_read": bool(is_read),
            "link": "/dashboard",
        })

    # Sort notifications newest first
    notifications.sort(key=lambda n: n.get("created_at", ""), reverse=True)
    unread_count = sum(1 for n in notifications if not n.get("is_read"))

    return {"notifications": notifications[:20], "unread_count": unread_count}


@router.post("/clear-all")
@router.delete("/clear-all")
async def clear_all_notifications(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Clear all current notifications for the user so they stay cleared even after reload."""
    user_id = str(current_user.id)
    now = datetime.now(timezone.utc)
    await _update_pg_notification_state(session, user_id, cleared_at=now)
    return {"status": "success", "cleared_at": now.isoformat()}


@router.post("/read-all")
async def mark_all_notifications_as_read(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Mark all current notifications as read."""
    user_id = str(current_user.id)
    now = datetime.now(timezone.utc)
    await _update_pg_notification_state(session, user_id, all_read_at=now)
    return {"status": "success", "all_read_at": now.isoformat()}


@router.post("/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Mark a single notification as read."""
    user_id = str(current_user.id)
    await _update_pg_notification_state(session, user_id, add_read_id=notification_id)
    return {"status": "success", "id": notification_id}


@router.post("/{notification_id}/dismiss")
@router.delete("/{notification_id}")
async def dismiss_notification(
    notification_id: str,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Dismiss / delete a single notification."""
    if notification_id == "clear-all":
        return await clear_all_notifications(current_user=current_user, session=session)

    user_id = str(current_user.id)
    await _update_pg_notification_state(session, user_id, add_dismissed_id=notification_id)
    return {"status": "success", "id": notification_id}
