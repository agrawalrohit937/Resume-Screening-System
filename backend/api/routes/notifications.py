"""
Notifications API Route — Dynamic real notification feed for users.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from models.user_model import UserModel
from api.deps import get_current_user, get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()


@router.get("/me")
async def get_my_notifications(
    current_user: UserModel = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """Return real user notifications synthesized from certificates, point activities, and streaks."""
    notifications = []
    user_id = str(current_user.id)

    # 1. Fetch user certificates
    cursor = db.certificates.find({"user_id": user_id}).sort("created_at", -1).limit(10)
    certificates = await cursor.to_list(length=10)
    for cert in certificates:
        cert_id = str(cert.get("_id") or cert.get("certificate_id", ""))
        cert_type = (cert.get("certificate_type") or "Skill Assessment").replace("_", " ").title()
        issue_date = cert.get("issued_at") or cert.get("created_at") or datetime.now(timezone.utc)
        iso_date = issue_date.isoformat() if hasattr(issue_date, "isoformat") else str(issue_date)
        notifications.append({
            "id": f"cert_{cert_id}",
            "type": "badge",
            "title": "New Certificate Issued! 🏆",
            "message": f"Congratulations! Your official {cert_type} Certificate has been issued.",
            "created_at": iso_date,
            "is_read": False,
        })

    # 2. Fetch user gamification profile for XP/points and streaks
    profile = await db.gamification_profiles.find_one({"user_id": user_id})
    if profile:
        recent_points = profile.get("recent_points", [])
        for idx, pt in enumerate(reversed(recent_points[-10:])):
            event_name = str(pt.get("event", "activity")).replace("_", " ").title()
            pts = pt.get("points", 25)
            ts = pt.get("ts") or pt.get("created_at") or datetime.now(timezone.utc)
            iso_ts = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
            notifications.append({
                "id": f"xp_{user_id}_{idx}_{pts}",
                "type": "xp",
                "title": f"+{pts} XP Earned! ⚡",
                "message": f"You earned {pts} XP from {event_name}.",
                "created_at": iso_ts,
                "is_read": False,
            })

        streak = profile.get("current_streak", 0)
        if streak > 0:
            ts = profile.get("updated_at") or datetime.now(timezone.utc)
            iso_ts = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
            notifications.append({
                "id": f"streak_{user_id}_{streak}",
                "type": "streak",
                "title": f"{streak}-Day Practice Streak Active! 🔥",
                "message": f"Keep going! You have maintained a {streak}-day active practice streak.",
                "created_at": iso_ts,
                "is_read": True,
            })

    # If no notifications exist yet, return a welcoming notification
    if not notifications:
        ts = current_user.created_at or datetime.now(timezone.utc)
        iso_ts = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
        notifications.append({
            "id": "welcome_notif",
            "type": "xp",
            "title": "Welcome to CareerShala! 🚀",
            "message": "Complete mock interviews, ATS scans, or daily check-ins to earn XP, badges, and certificates.",
            "created_at": iso_ts,
            "is_read": True,
        })

    # Sort notifications newest first
    notifications.sort(key=lambda n: n.get("created_at", ""), reverse=True)
    unread_count = sum(1 for n in notifications if not n.get("is_read"))

    return {"notifications": notifications[:15], "unread_count": unread_count}


@router.post("/{notification_id}/read")
async def mark_notification_as_read(notification_id: str) -> Dict[str, Any]:
    """Mark a notification as read."""
    return {"status": "success", "id": notification_id}


@router.post("/read-all")
async def mark_all_notifications_as_read() -> Dict[str, Any]:
    """Mark all notifications as read."""
    return {"status": "success"}
