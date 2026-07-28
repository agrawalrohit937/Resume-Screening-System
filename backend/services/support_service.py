"""
Support Ticket Service — Business logic for ticket creation, replies, and premium routing
"""

import random
import string
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import structlog

from models.support_ticket_model import SupportTicketModel, TicketAttachment, TicketMessage
from models.user_model import UserModel
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

STATUS_LABELS = {
    "open": "Open",
    "in_progress": "In Progress",
    "waiting_for_customer": "Waiting for Customer",
    "resolved": "Resolved",
    "closed": "Closed",
}

STATUS_COLORS = {
    "open": "bg-blue-100 text-blue-700 border-blue-200",
    "in_progress": "bg-amber-100 text-amber-700 border-amber-200",
    "waiting_for_customer": "bg-purple-100 text-purple-700 border-purple-200",
    "resolved": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "closed": "bg-slate-100 text-slate-600 border-slate-200",
}

PRIORITY_LABELS = {
    "low": "Low",
    "medium": "Medium",
    "high": "High",
    "critical": "Critical",
}

PRIORITY_COLORS = {
    "low": "bg-slate-100 text-slate-600 border-slate-200",
    "medium": "bg-blue-100 text-blue-700 border-blue-200",
    "high": "bg-amber-100 text-amber-700 border-amber-200",
    "critical": "bg-rose-100 text-rose-700 border-rose-200",
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
        # Fallback: try MongoDB _id (used by internal admin operations)
        if not ticket:
            ticket = await self.ticket_repo.get_by_id(ticket_id)
        if not ticket:
            return None
        # Ensure user can only view their own tickets (or admin)
        if ticket.user_id != user.id and user.role != "admin":
            return None
        return ticket.model_dump()

    async def _resolve_ticket_id(self, ticket_id: str) -> Optional[SupportTicketModel]:
        """Resolve a ticket_id that may be human-readable or MongoDB _id."""
        ticket = await self.ticket_repo.get_by_ticket_id(ticket_id)
        if not ticket:
            try:
                ticket = await self.ticket_repo.get_by_id(ticket_id)
            except Exception:
                pass
        return ticket

    async def _resolve_ticket_doc_id(self, ticket_id: str) -> Optional[str]:
        """Return the MongoDB _id (as string) for a given ticket identifier."""
        ticket = await self._resolve_ticket_id(ticket_id)
        if not ticket:
            return None
        return ticket.id

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
        if ticket.user_id != user.id and user.role != "admin":
            return None

        message = TicketMessage(
            role="user",
            body=body,
            attachments=attachments or [],
            author_name=user.full_name,
        )

        updated = await self.ticket_repo.add_message(ticket.id, message.model_dump())
        if not updated:
            return None

        # If ticket was waiting_for_customer, set back to in_progress
        if ticket.status == "waiting_for_customer":
            await self.ticket_repo.update_status(ticket.id, "in_progress")

        return updated.model_dump()

    async def add_support_reply(
        self,
        ticket_id: str,
        body: str,
        attachments: Optional[List[Dict[str, Any]]] = None,
        author_name: str = "CareerShala Support",
    ) -> Optional[Dict[str, Any]]:
        ticket = await self._resolve_ticket_id(ticket_id)
        if not ticket:
            return None

        message = TicketMessage(
            role="support",
            body=body,
            attachments=attachments or [],
            author_name=author_name,
        )

        updated = await self.ticket_repo.add_message(ticket.id, message.model_dump())
        if not updated:
            return None

        # Set status to waiting_for_customer when support replies
        if ticket.status not in ("resolved", "closed"):
            await self.ticket_repo.update_status(ticket.id, "waiting_for_customer")

        return updated.model_dump()

    async def update_ticket_status(
        self, ticket_id: str, user: UserModel, status: str
    ) -> Optional[Dict[str, Any]]:
        ticket = await self._resolve_ticket_id(ticket_id)
        if not ticket:
            return None
        if ticket.user_id != user.id and user.role != "admin":
            return None

        valid_statuses = {"open", "in_progress", "waiting_for_customer", "resolved", "closed"}
        if status not in valid_statuses:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

        # Users can only resolve/close their own tickets
        if user.role != "admin" and status not in ("resolved", "closed"):
            if ticket.status not in ("open", "in_progress", "waiting_for_customer"):
                raise ValueError("Cannot change status from resolved/closed without admin")

        updated = await self.ticket_repo.update_status(ticket.id, status)
        if not updated:
            return None
        return updated.model_dump()

    async def get_ticket_stats(self) -> Dict[str, Any]:
        return await self.ticket_repo.get_ticket_stats()

    def _render_ticket_email(self, user, ticket_id, category, subject, description, priority, metadata):
        """Render HTML email for support ticket notification."""
        cat_labels = {k: v["label"] for k, v in SUPPORT_CATEGORIES.items()}
        meta = metadata or {}
        return f"""<html><body style="font-family:Inter,sans-serif;background:#f8fafc;padding:24px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e2e8f0;">
<div style="width:48px;height:48px;background:#eef2ff;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;">
  <span style="font-size:24px;">🎫</span>
</div>
<h2 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 4px;">New Support Ticket</h2>
<p style="font-size:13px;color:#64748b;margin:0 0 20px;">A new ticket has been created by <strong>{user.full_name}</strong></p>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
<tr><td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Ticket ID</td><td style="padding:8px 12px;color:#0f172a;font-weight:700;border-bottom:1px solid #f1f5f9;font-family:monospace;">{ticket_id}</td></tr>
<tr><td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">User</td><td style="padding:8px 12px;color:#0f172a;border-bottom:1px solid #f1f5f9;">{user.full_name} ({user.email})</td></tr>
<tr><td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Plan</td><td style="padding:8px 12px;color:#0f172a;border-bottom:1px solid #f1f5f9;text-transform:capitalize;">{user.plan or 'free'}</td></tr>
<tr><td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Category</td><td style="padding:8px 12px;color:#0f172a;border-bottom:1px solid #f1f5f9;">{cat_labels.get(category, category)}</td></tr>
<tr><td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Subject</td><td style="padding:8px 12px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;">{subject}</td></tr>
<tr><td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Priority</td><td style="padding:8px 12px;color:#0f172a;text-transform:capitalize;border-bottom:1px solid #f1f5f9;">{priority}</td></tr>
<tr><td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Description</td><td style="padding:8px 12px;color:#334155;border-bottom:1px solid #f1f5f9;white-space:pre-wrap;">{description[:500]}</td></tr>
<tr><td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Browser</td><td style="padding:8px 12px;color:#64748b;border-bottom:1px solid #f1f5f9;">{meta.get('browser', 'N/A')}</td></tr>
<tr><td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">OS</td><td style="padding:8px 12px;color:#64748b;border-bottom:1px solid #f1f5f9;">{meta.get('os', 'N/A')}</td></tr>
<tr><td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Page</td><td style="padding:8px 12px;color:#64748b;border-bottom:1px solid #f1f5f9;">{meta.get('current_url', 'N/A')}</td></tr>
</table>
<p style="font-size:12px;color:#94a3b8;margin-top:20px;text-align:center;">CareerShala Support System</p>
</div></body></html>"""

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

