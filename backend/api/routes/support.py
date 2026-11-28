"""
Support Ticket API Routes — Create, list, reply, and manage support tickets
"""

from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Query, status

from api.deps import (
    get_admin_user,
    get_current_user,
    get_email_service,
    get_user_repo,
)
from schemas.user_schema import UserModel
from repositories.support_ticket_repo import SupportTicketRepository
from repositories.user_repo import UserRepository
from services.support_service import SupportService

router = APIRouter(prefix="/support", tags=["Support"])
def get_support_service(
    user_repo: UserRepository = Depends(get_user_repo),
    email_service = Depends(get_email_service),
) -> SupportService:
    ticket_repo = SupportTicketRepository()
    return SupportService(ticket_repo, user_repo, email_service)


@router.post("/tickets", status_code=status.HTTP_201_CREATED)
async def create_ticket(
    category: str = Form(...),
    subject: str = Form(...),
    description: str = Form(...),
    priority: str = Form(default="low"),
    user: UserModel = Depends(get_current_user),
    service: SupportService = Depends(get_support_service),
):
    """Create a new support ticket."""
    valid_categories = {"billing", "account", "resume", "ai_features", "bug", "feature_request", "other"}
    if category not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Invalid category. Must be one of: {', '.join(sorted(valid_categories))}",
        )

    if not subject.strip() or not description.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Subject and description are required",
        )

    return await service.create_ticket(
        user=user,
        category=category,
        subject=subject.strip(),
        description=description.strip(),
        priority=priority,
    )


@router.get("/tickets")
async def list_tickets(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: UserModel = Depends(get_current_user),
    service: SupportService = Depends(get_support_service),
):
    """List support tickets for the current user."""
    return await service.get_user_tickets(
        user_id=user.id,
        status=status_filter,
        page=page,
        page_size=page_size,
    )


@router.get("/tickets/{ticket_id}")
async def get_ticket(
    ticket_id: str,
    user: UserModel = Depends(get_current_user),
    service: SupportService = Depends(get_support_service),
):
    """Get a single support ticket with full conversation timeline."""
    result = await service.get_ticket(ticket_id, user)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found or access denied",
        )
    return result


@router.post("/tickets/{ticket_id}/reply")
async def reply_to_ticket(
    ticket_id: str,
    body: str = Form(...),
    user: UserModel = Depends(get_current_user),
    service: SupportService = Depends(get_support_service),
):
    """Add a reply to an existing ticket."""
    result = await service.add_reply(ticket_id, user, body)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found or access denied",
        )
    return result


@router.patch("/tickets/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: str,
    status: str = Form(...),
    user: UserModel = Depends(get_current_user),
    service: SupportService = Depends(get_support_service),
):
    """Update the status of a support ticket."""
    try:
        result = await service.update_ticket_status(ticket_id, user, status)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found",
            )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(e),
        )


@router.get("/stats", dependencies=[Depends(get_admin_user)])
async def get_ticket_stats(
    service: SupportService = Depends(get_support_service),
):
    """Get overall ticket statistics (admin only)."""
    return await service.get_ticket_stats()


@router.get("/categories")
async def get_support_categories():
    """Get all support categories and their subcategories."""
    from services.support_service import SUPPORT_CATEGORIES
    return SUPPORT_CATEGORIES
