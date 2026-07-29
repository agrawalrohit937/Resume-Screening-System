"""
Notifications API Route — Dummy/stub endpoints to handle notification status checks.
"""

from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter()


@router.get("/me")
async def get_my_notifications() -> Dict[str, Any]:
    """Return user notifications list."""
    return {"notifications": [], "unread_count": 0}


@router.post("/{notification_id}/read")
async def mark_notification_as_read(notification_id: str) -> Dict[str, Any]:
    """Mark a notification as read."""
    return {"status": "success", "id": notification_id}


@router.post("/read-all")
async def mark_all_notifications_as_read() -> Dict[str, Any]:
    """Mark all notifications as read."""
    return {"status": "success"}
