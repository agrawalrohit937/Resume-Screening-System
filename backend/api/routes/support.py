"""
Support Ticket API Routes — Create, list, reply, and manage support tickets
"""

from typing import Annotated, List, Optional
import structlog

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from api.deps import (
    get_current_user,
    get_current_active_user,
    get_db,
    get_email_service,
    get_user_repo,
    PaginationParams,
)
from config.db import get_database
from core.config import settings
from models.user_model import UserModel, UserRole
from repositories.support_ticket_repo import SupportTicketRepository
from repositories.user_repo import UserRepository
from services.support_service import SupportService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/support", tags=["Support"])


def get_support_service(
    db=Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repo),
    email_service = Depends(get_email_service),
) -> SupportService:
    ticket_repo = SupportTicketRepository(db)
    return SupportService(ticket_repo, user_repo, email_service)


@router.post("/tickets", status_code=status.HTTP_201_CREATED)
async def create_ticket(
    category: str = Form(...),
    subject: str = Form(...),
    description: str = Form(...),
    priority: str = Form(default="low"),
    subcategory: Optional[str] = Form(None),
    browser: Optional[str] = Form(None),
    os: Optional[str] = Form(None),
    route: Optional[str] = Form(None),
    current_url: Optional[str] = Form(None),
    app_version: Optional[str] = Form(None),
    login_provider: Optional[str] = Form(None),
    device: Optional[str] = Form(None),
    resolution: Optional[str] = Form(None),
    console_errors: Optional[str] = Form(None),
    frontend_version: Optional[str] = Form(None),
    backend_version: Optional[str] = Form(None),
    attachments: Optional[List[UploadFile]] = File(None),
    user: UserModel = Depends(get_current_user),
    service: SupportService = Depends(get_support_service),
):
    """Create a new support ticket with auto-collected metadata."""
    # Validate category
    valid_categories = {"billing", "account", "resume", "ai_features", "bug", "feature_request", "other"}
    if category not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}",
        )

    if not subject or not description:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Subject and description are required",
        )

    # Upload attachments if provided
    attachment_list = []
    if attachments:
        for file in attachments:
            if file.filename:
                try:
                    file_bytes = await file.read()
                    attachment = await service.upload_attachment(
                        file_bytes, file.filename, file.content_type or "application/octet-stream"
                    )
                    attachment_list.append(attachment)
                except Exception as e:
                    logger.error("Failed to upload attachment", filename=file.filename, error=str(e))

    # Parse console errors from JSON string
    parsed_console_errors = []
    if console_errors:
        try:
            import json
            parsed_console_errors = json.loads(console_errors)
        except (json.JSONDecodeError, TypeError):
            parsed_console_errors = [console_errors]

    metadata = {
        "browser": browser,
        "os": os,
        "route": route,
        "current_url": current_url,
        "app_version": app_version or settings.APP_VERSION,
        "login_provider": login_provider,
        "device": device,
        "resolution": resolution,
        "console_errors": parsed_console_errors,
        "frontend_version": frontend_version or settings.APP_VERSION,
        "backend_version": backend_version or settings.APP_VERSION,
    }

    result = await service.create_ticket(
        user=user,
        category=category,
        subject=subject,
        description=description,
        priority=priority,
        subcategory=subcategory,
        attachments=attachment_list,
        metadata=metadata,
    )

    return result


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
    attachments: Optional[List[UploadFile]] = File(None),
    user: UserModel = Depends(get_current_user),
    service: SupportService = Depends(get_support_service),
):
    """Add a reply to an existing ticket."""
    attachment_list = []
    if attachments:
        for file in attachments:
            if file.filename:
                try:
                    file_bytes = await file.read()
                    attachment = await service.upload_attachment(
                        file_bytes, file.filename, file.content_type or "application/octet-stream"
                    )
                    attachment_list.append(attachment)
                except Exception as e:
                    logger.error("Failed to upload attachment", filename=file.filename, error=str(e))

    result = await service.add_reply(ticket_id, user, body, attachment_list)
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
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


@router.get("/stats", dependencies=[Depends(get_current_user)])
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

