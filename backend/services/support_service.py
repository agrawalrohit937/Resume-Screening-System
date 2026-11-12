"""
Support Ticket Service — Business logic for ticket creation, replies, and premium routing
"""

import random
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import structlog

from schemas.support_schema import SupportTicketModel, TicketMessage
from schemas.user_schema import UserModel
from repositories.support_ticket_repo import SupportTicketRepository
from repositories.user_repo import UserRepository
from services.cloudinary_service import upload_file
from services.email_service import EmailService

logger = structlog.get_logger(__name__)

# Category definitions
SUPPORT_CATEGORIES = {
    "billing": {
        "label": "Billing & Payments",
        "icon": "CreditCard",
        "subcategories": [
            "upgrade_plan", "cancel_subscription", "refund_request",
            "failed_payment", "gst_invoice",
        ],
    },
    "account": {
        "label": "Account & Login",
        "icon": "UserCircle",
        "subcategories": [
            "password_reset", "email_verification", "google_login",
            "github_login", "linkedin_login", "delete_account",
        ],
    },
    "resume": {
        "label": "Resume & ATS",
        "icon": "FileText",
        "subcategories": [
            "resume_upload", "ats_score", "resume_parsing", "pdf_generation",
        ],
    },
    "ai_features": {
        "label": "AI Features",
        "icon": "Sparkles",
        "subcategories": [
            "ai_copilot", "mock_interview", "resume_enhancer", "career_recommendations",
        ],
    },
    "bug": {
        "label": "Report a Bug",
        "icon": "Bug",
        "subcategories": [],
    },
    "feature_request": {
        "label": "Feature Request",
        "icon": "Lightbulb",
        "subcategories": [],
    },
    "other": {
        "label": "Other",
        "icon": "HelpCircle",
        "subcategories": [],
    },
}

RESPONSE_TIMES = {
    "free": "24-48 Hours",
    "pro": "8 Hours",
    "premium": "2 Hours",
}


def generate_ticket_id() -> str:
    """Generate a human-readable ticket ID like CS-2026-001245."""
    year = datetime.now(timezone.utc).strftime("%Y")
    random_num = random.randint(100000, 999999)
    return f"CS-{year}-{random_num:06d}"


class SupportService:
    def __init__(
        self,
        ticket_repo: SupportTicketRepository,
        user_repo: UserRepository,
        email_service: EmailService,
    ):
        self.ticket_repo = ticket_repo
        self.user_repo = user_repo
        self.email_service = email_service

    @staticmethod
    def _is_admin(user: UserModel) -> bool:
        roles = getattr(user, "roles", None) or [getattr(user, "role", None)]
        return any(
            (role.value if hasattr(role, "value") else str(role)).lower()
            in ("admin", "platform_admin")
            for role in roles
            if role
        )

    def _get_response_time(self, plan: str) -> str:
        return RESPONSE_TIMES.get(plan.lower(), RESPONSE_TIMES["free"])

    async def create_ticket(
        self,
        user: UserModel,
        category: str,
        subject: str,
        description: str,
        priority: str = "low",
        subcategory: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create a new support ticket with auto-filled metadata."""
        ticket_id = generate_ticket_id()

        billing_data = {}
        bug_data = {}
        console_errors = []

        # Auto-attach billing data for billing category
        if category == "billing":
            billing_data = {
                "plan": user.plan,
                "subscription_active": user.subscription_active,
                "plan_updated_at": user.plan_updated_at.isoformat() if user.plan_updated_at else None,
                "total_resumes": user.total_resumes,
                "total_ats_checks": user.total_ats_checks,
            }

        # Auto-collect bug data
        if category == "bug" and metadata:
            bug_data = {
                "browser": metadata.get("browser"),
                "device": metadata.get("device"),
                "os": metadata.get("os"),
                "resolution": metadata.get("resolution"),
                "page_url": metadata.get("current_url"),
                "frontend_version": metadata.get("app_version"),
                "backend_version": metadata.get("backend_version"),
            }
            if metadata.get("console_errors"):
                console_errors = metadata["console_errors"]

        # Enforce priority limits for non-premium users
        if priority == "critical" and user.plan != "premium":
            priority = "high"

        ticket_dict = {
            "ticket_id": ticket_id,
            "user_id": user.id,
            "email": user.email,
            "category": category,
            "subcategory": subcategory,
            "subject": subject,
            "description": description,
            "priority": priority,
            "status": "open",
            "status_history": [{
                "status": "open",
                "changed_by": user.id,
                "changed_by_role": user.role,
                "changed_by_name": user.full_name,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }],
            "attachments": attachments or [],
            "messages": [],
            "browser": metadata.get("browser") if metadata else None,
            "os": metadata.get("os") if metadata else None,
            "route": metadata.get("route") if metadata else None,
            "current_url": metadata.get("current_url") if metadata else None,
            "app_version": metadata.get("app_version") if metadata else None,
            "login_provider": metadata.get("login_provider") if metadata else None,
            "plan": user.plan,
            "subscription_active": user.subscription_active,
            "billing_data": billing_data,
            "bug_data": bug_data,
            "console_errors": console_errors,
            "screen_resolution": metadata.get("resolution") if metadata else None,
            "device": metadata.get("device") if metadata else None,
            "frontend_version": metadata.get("frontend_version") if metadata else None,
            "backend_version": metadata.get("backend_version") if metadata else None,
        }

        ticket = await self.ticket_repo.create(ticket_dict)
        response_time = self._get_response_time(user.plan)
        notification_result: Dict[str, Any] = {"sent": False, "error": None}

        logger.info(
            "Support ticket saved successfully",
            ticket_id=ticket.ticket_id,
            user_id=user.id,
            category=category,
        )

        try:
            logger.info(
                "Dispatching support notification email",
                ticket_id=ticket.ticket_id,
                user_email=user.email,
            )
            notification_result = await self.email_service.send_support_ticket_notification(
                ticket=ticket,
                user=user,
                metadata=metadata,
                attachments=attachments or [],
            )
            if notification_result.get("sent"):
                logger.info(
                    "Support notification email completed",
                    ticket_id=ticket.ticket_id,
                    support_email=notification_result.get("to"),
                )
            else:
                logger.error(
                    "Support notification email failed",
                    ticket_id=ticket.ticket_id,
                    error=notification_result.get("error"),
                )
        except Exception as e:
            notification_result = {"sent": False, "error": str(e)}
            logger.exception(
                "Support notification email raised an unexpected error",
                ticket_id=ticket.ticket_id,
                error=str(e),
            )

        return {
            "ticket": ticket.model_dump(),
            "response_time": response_time,
            "email_notification": notification_result,
        }

    async def get_user_tickets(
        self,
        user_id: str,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        skip = (page - 1) * page_size
        tickets, total = await self.ticket_repo.get_user_tickets(
            user_id, status=status, skip=skip, limit=page_size
        )
        total_pages = (total + page_size - 1) // page_size

        return {
            "tickets": [t.model_dump() for t in tickets],
            "pagination": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
            },
        }

    async def get_ticket(self, ticket_id: str, user: UserModel) -> Optional[Dict[str, Any]]:
        # Try looking up by human-readable ticket_id first (e.g. CS-2026-001245)
        ticket = await self.ticket_repo.get_by_ticket_id(ticket_id)
        # Fallback: try database document _id (used by internal admin operations)
        if not ticket:
            ticket = await self.ticket_repo.get_by_id(ticket_id)
        if not ticket:
            return None
        # Ensure user can only view their own tickets (or admin)
        if ticket.user_id != user.id and not self._is_admin(user):
            return None
        return ticket.model_dump()

    async def _resolve_ticket_id(self, ticket_id: str) -> Optional[SupportTicketModel]:
        """Resolve a ticket_id that may be human-readable or document _id."""
        ticket = await self.ticket_repo.get_by_ticket_id(ticket_id)
        if not ticket:
            try:
                ticket = await self.ticket_repo.get_by_id(ticket_id)
            except Exception:
                pass
        return ticket

    async def add_reply(
        self,
        ticket_id: str,
        user: UserModel,
        body: str,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[Dict[str, Any]]:
        ticket = await self._resolve_ticket_id(ticket_id)
        if not ticket:
            return None
        if ticket.user_id != user.id and not self._is_admin(user):
            return None

        is_admin = self._is_admin(user)
        message = TicketMessage(
            role="support" if is_admin else "user",
            body=body,
            attachments=attachments or [],
            author_name="CareerShala Support" if is_admin else user.full_name,
        )

        updated = await self.ticket_repo.add_message(ticket.id, message.model_dump())
        if not updated:
            return None

        # If user replied and ticket was waiting_for_customer, set back to in_progress
        # If admin replied, set status to waiting_for_customer
        if not is_admin and ticket.status == "waiting_for_customer":
            updated = await self.ticket_repo.update_status(
                ticket.id,
                "in_progress",
                changed_by=user.id,
                changed_by_role=user.role,
                changed_by_name=user.full_name,
            )
        elif is_admin and ticket.status not in ("resolved", "closed"):
            updated = await self.ticket_repo.update_status(
                ticket.id,
                "waiting_for_customer",
                changed_by=user.id,
                changed_by_role=user.role,
                changed_by_name="CareerShala Support",
            )

        return updated.model_dump() if updated else None

    async def update_ticket_status(
        self, ticket_id: str, user: UserModel, status: str
    ) -> Optional[Dict[str, Any]]:
        ticket = await self._resolve_ticket_id(ticket_id)
        if not ticket:
            return None
        if ticket.user_id != user.id and not self._is_admin(user):
            return None

        valid_statuses = {"open", "in_progress", "waiting_for_customer", "resolved", "closed"}
        if status not in valid_statuses:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

        is_admin = self._is_admin(user)
        if not is_admin:
            if status == "resolved":
                if ticket.status in ("resolved", "closed"):
                    raise ValueError("Ticket is already resolved or closed")
            elif status == "open":
                if ticket.status not in ("resolved", "closed"):
                    raise ValueError("Only resolved or closed tickets can be reopened")
            else:
                raise ValueError("Candidates can only resolve or reopen their own tickets")

        updated = await self.ticket_repo.update_status(
            ticket.id,
            status,
            changed_by=user.id,
            changed_by_role=user.role,
            changed_by_name=user.full_name,
        )
        if not updated:
            return None
        return updated.model_dump()

    async def get_ticket_stats(self) -> Dict[str, Any]:
        return await self.ticket_repo.get_ticket_stats()

    async def upload_attachment(
        self, file_bytes: bytes, filename: str, content_type: str
    ) -> Dict[str, Any]:
        """Upload an attachment to Cloudinary."""
        url, public_id = await upload_file(
            file_bytes,
            folder="careerpilot/support_attachments",
            resource_type="auto",
        )
        return {
            "filename": filename,
            "url": url,
            "public_id": public_id,
            "content_type": content_type,
            "size_bytes": len(file_bytes),
        }
