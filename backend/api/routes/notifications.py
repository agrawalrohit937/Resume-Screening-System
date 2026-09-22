"""
Notifications API Route — Dynamic real notification feed for users with MongoDB persistence.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from models.user_model import UserModel
from api.deps import get_current_user, get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

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


@router.get("/me")
async def get_my_notifications(
    current_user: UserModel = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """Return real user notifications synthesized from certificates, point activities, and streaks,
    filtered by persistent user notification state (cleared_at, dismissed_ids, read_ids)."""
    notifications = []
    user_id = str(current_user.id)

    # 1. Fetch persistent notification state for this user
    user_state = await db.user_notification_state.find_one({"user_id": user_id}) or {}
    read_ids = set(user_state.get("read_ids") or [])
    dismissed_ids = set(user_state.get("dismissed_ids") or [])
    cleared_at = _parse_dt(user_state.get("cleared_at"))
    all_read_at = _parse_dt(user_state.get("all_read_at"))

    # 2. Fetch user certificates
    cursor = db.certificates.find({"user_id": user_id}).sort("created_at", -1).limit(10)
    certificates = await cursor.to_list(length=10)
    for cert in certificates:
        cert_id = str(cert.get("_id") or cert.get("certificate_id", ""))
        notif_id = f"cert_{cert_id}"
        if notif_id in dismissed_ids:
            continue

        issue_date = cert.get("issued_at") or cert.get("created_at") or datetime.now(timezone.utc)
        issue_dt = _parse_dt(issue_date) or datetime.now(timezone.utc)
        if cleared_at and issue_dt <= cleared_at:
            continue

        cert_type = (cert.get("certificate_type") or "Skill Assessment").replace("_", " ").title()
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
    profile = await db.user_gamification.find_one({"user_id": user_id})
    if profile:
        recent_points = profile.get("recent_points", [])
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
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """Clear all current notifications for the user so they stay cleared even after reload."""
    user_id = str(current_user.id)
    now = datetime.now(timezone.utc)
    await db.user_notification_state.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "cleared_at": now,
                "read_ids": [],
                "updated_at": now,
            }
        },
        upsert=True,
    )
    return {"status": "success", "cleared_at": now.isoformat()}


@router.post("/read-all")
async def mark_all_notifications_as_read(
    current_user: UserModel = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """Mark all current notifications as read."""
    user_id = str(current_user.id)
    now = datetime.now(timezone.utc)
    await db.user_notification_state.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "all_read_at": now,
                "updated_at": now,
            }
        },
        upsert=True,
    )
    return {"status": "success", "all_read_at": now.isoformat()}


@router.post("/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """Mark a single notification as read."""
    user_id = str(current_user.id)
    await db.user_notification_state.update_one(
        {"user_id": user_id},
        {
            "$addToSet": {"read_ids": notification_id},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
        upsert=True,
    )
    return {"status": "success", "id": notification_id}


@router.post("/{notification_id}/dismiss")
@router.delete("/{notification_id}")
async def dismiss_notification(
    notification_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """Dismiss / delete a single notification."""
    if notification_id == "clear-all":
        return await clear_all_notifications(current_user=current_user, db=db)

    user_id = str(current_user.id)
    await db.user_notification_state.update_one(
        {"user_id": user_id},
        {
            "$addToSet": {"dismissed_ids": notification_id},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
        upsert=True,
    )
    return {"status": "success", "id": notification_id}

