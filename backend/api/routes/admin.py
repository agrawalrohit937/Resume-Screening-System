"""
Admin API Routes — Secure endpoints for managing support tickets,
career applications, and viewing platform statistics.

All endpoints require admin role (enforced via get_admin_user dependency).
"""

from typing import Optional

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status

from api.deps import get_admin_user, get_db
from config.db import get_database
from models.user_model import UserModel, UserRole
from repositories.career_application_repo import CareerApplicationRepository
from repositories.support_ticket_repo import SupportTicketRepository

logger = structlog.get_logger(__name__)

router = APIRouter()


# ── Dependency helpers ────────────────────────────────────────────────────────

def get_ticket_repo(db=Depends(get_database)):
    return SupportTicketRepository(db)


def get_career_repo(db=Depends(get_database)):
    return CareerApplicationRepository(db)


# ═══════════════════════════════════════════════════════════════════════════════
# DASHBOARD OVERVIEW
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard/stats")
async def get_dashboard_stats(
    admin: UserModel = Depends(get_admin_user),
    db=Depends(get_database),
):
    """Aggregated platform statistics for the admin dashboard overview."""
    ticket_repo = SupportTicketRepository(db)
    career_repo = CareerApplicationRepository(db)

    # Parallel aggregation
    ticket_stats = await ticket_repo.get_ticket_stats()
    career_stats = await career_repo.count_by_status()

    # User count
    user_count = await db.users.count_documents({})
    active_users = await db.users.count_documents({"status": "active"})

    return {
        "users": {
            "total": user_count,
            "active": active_users,
        },
        "tickets": ticket_stats,
        "career_applications": career_stats,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SUPPORT TICKETS — Admin Management
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/support/tickets")
async def list_all_tickets(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: UserModel = Depends(get_admin_user),
    ticket_repo: SupportTicketRepository = Depends(get_ticket_repo),
):
    """List all support tickets with filtering, search, and pagination."""
    skip = (page - 1) * page_size

    # Build query — the repo's get_all_tickets already handles status/priority/category
    tickets, total = await ticket_repo.get_all_tickets(
        status=status_filter,
        priority=priority,
        category=category,
        skip=skip,
        limit=page_size,
    )

    # If search query is provided, do a secondary text filter (repo doesn't support it natively)
    if search and search.strip():
        search_lower = search.lower().strip()
        tickets = [
            t for t in tickets
            if search_lower in (t.subject or "").lower()
            or search_lower in (t.email or "").lower()
            or search_lower in (t.ticket_id or "").lower()
            or search_lower in (t.description or "").lower()
        ]

    total_pages = (total + page_size - 1) // page_size

    return {
        "tickets": [t.model_dump(by_alias=True) for t in tickets],
        "pagination": {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        },
    }


@router.get("/support/tickets/{ticket_id}")
async def get_ticket_detail(
    ticket_id: str,
    admin: UserModel = Depends(get_admin_user),
    ticket_repo: SupportTicketRepository = Depends(get_ticket_repo),
):
    """Get full ticket detail including conversation timeline."""
    ticket = await ticket_repo.get_by_id(ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    return ticket.model_dump(by_alias=True)


@router.patch("/support/tickets/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: str,
    body: dict = Body(...),
    admin: UserModel = Depends(get_admin_user),
    ticket_repo: SupportTicketRepository = Depends(get_ticket_repo),
):
    """Update the status of a support ticket (admin action)."""
    new_status = body.get("status")
    valid_statuses = {"open", "in_progress", "waiting_for_customer", "resolved", "closed"}
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}",
        )

    updated = await ticket_repo.update_status(ticket_id, new_status)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    logger.info(
        "Admin updated ticket status",
        ticket_id=ticket_id,
        new_status=new_status,
        admin_email=admin.email,
    )

    return updated.model_dump(by_alias=True)


@router.get("/support/stats")
async def get_ticket_stats(
    admin: UserModel = Depends(get_admin_user),
    ticket_repo: SupportTicketRepository = Depends(get_ticket_repo),
):
    """Get support ticket statistics."""
    return await ticket_repo.get_ticket_stats()


# ═══════════════════════════════════════════════════════════════════════════════
# CAREER APPLICATIONS — Admin Management
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/careers/applications")
async def list_all_applications(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: UserModel = Depends(get_admin_user),
    career_repo: CareerApplicationRepository = Depends(get_career_repo),
):
    """List all career applications with filtering and pagination."""
    skip = (page - 1) * page_size

    apps, total = await career_repo.get_all(
        status=status_filter,
        search=search,
        skip=skip,
        limit=page_size,
    )

    total_pages = (total + page_size - 1) // page_size

    return {
        "applications": [a.model_dump(by_alias=True) for a in apps],
        "pagination": {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        },
    }


@router.get("/careers/applications/{app_id}")
async def get_application_detail(
    app_id: str,
    admin: UserModel = Depends(get_admin_user),
    career_repo: CareerApplicationRepository = Depends(get_career_repo),
):
    """Get full career application detail."""
    app = await career_repo.get_by_id(app_id)
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )
    return app.model_dump(by_alias=True)


@router.patch("/careers/applications/{app_id}/status")
async def update_application_status(
    app_id: str,
    body: dict = Body(...),
    admin: UserModel = Depends(get_admin_user),
    career_repo: CareerApplicationRepository = Depends(get_career_repo),
):
    """Update career application status with optional admin notes."""
    new_status = body.get("status")
    admin_notes = body.get("admin_notes")

    valid_statuses = {"applied", "shortlisted", "interviewed", "rejected", "hired"}
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}",
        )

    updated = await career_repo.update_status(app_id, new_status, admin_notes)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    logger.info(
        "Admin updated application status",
        app_id=app_id,
        new_status=new_status,
        admin_email=admin.email,
    )

    return updated.model_dump(by_alias=True)


@router.get("/careers/stats")
async def get_career_stats(
    admin: UserModel = Depends(get_admin_user),
    career_repo: CareerApplicationRepository = Depends(get_career_repo),
):
    """Get career application statistics."""
    return await career_repo.count_by_status()
