from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from models.support_ticket_model import SupportTicketModel
from repositories.support_ticket_repo import SupportTicketRepository
from services.support_service import SupportService
from core.config import settings


class DummyTicketRepo:
    def __init__(self):
        self.created_payload = None

    async def create(self, ticket_data: dict) -> SupportTicketModel:
        self.created_payload = ticket_data
        return SupportTicketModel(id="mongo-ticket-id", **ticket_data)


class FakeEmailService:
    def __init__(self, result):
        self.result = result
        self.calls = []

    async def send_support_ticket_notification(self, *, ticket, user, metadata=None, attachments=None):
        self.calls.append(
            {
                "ticket_id": ticket.ticket_id,
                "user_email": user.email,
                "metadata": metadata or {},
                "attachments": attachments or [],
            }
        )
        return self.result


@pytest.mark.asyncio
async def test_support_ticket_email_is_sent_after_save():
    events = []

    class TrackingTicketRepo(DummyTicketRepo):
        async def create(self, ticket_data: dict) -> SupportTicketModel:
            events.append("saved")
            return await super().create(ticket_data)

    class TrackingEmailService(FakeEmailService):
        async def send_support_ticket_notification(self, *, ticket, user, metadata=None, attachments=None):
            assert events == ["saved"]
            events.append("emailed")
            return await super().send_support_ticket_notification(
                ticket=ticket,
                user=user,
                metadata=metadata,
                attachments=attachments,
            )

    service = SupportService(
        TrackingTicketRepo(),
        SimpleNamespace(),
        TrackingEmailService({"sent": True, "to": "support@example.com"}),
    )
    user = SimpleNamespace(
        id="user-1",
        email="user@example.com",
        full_name="Jane Doe",
        plan="premium",
        subscription_active=True,
        plan_updated_at=None,
        total_resumes=0,
        total_ats_checks=0,
        role="candidate",
    )

    result = await service.create_ticket(
        user=user,
        category="bug",
        subject="Support mail test",
        description="Please help",
        metadata={"browser": "Chrome", "os": "Windows", "current_url": "http://localhost/support"},
    )

    assert events == ["saved", "emailed"]
    assert result["email_notification"]["sent"] is True
    assert result["ticket"]["created_at"].tzinfo is not None
    assert result["ticket"]["created_at"].utcoffset() == timezone.utc.utcoffset(result["ticket"]["created_at"])


@pytest.mark.asyncio
async def test_support_ticket_creation_continues_when_email_fails():
    ticket_repo = DummyTicketRepo()
    email_service = FakeEmailService({"sent": False, "error": "SMTP timeout while sending email."})
    service = SupportService(ticket_repo, SimpleNamespace(), email_service)
    user = SimpleNamespace(
        id="user-2",
        email="user2@example.com",
        full_name="John Smith",
        plan="free",
        subscription_active=False,
        plan_updated_at=None,
        total_resumes=0,
        total_ats_checks=0,
        role="candidate",
    )

    result = await service.create_ticket(
        user=user,
        category="account",
        subject="Login issue",
        description="I cannot sign in",
    )

    assert ticket_repo.created_payload is not None
    assert result["ticket"]["ticket_id"]
    assert result["email_notification"]["sent"] is False
    assert "SMTP timeout" in result["email_notification"]["error"]


def test_support_ticket_repo_normalizes_naive_datetimes_to_utc():
    repo = SupportTicketRepository(SimpleNamespace(support_tickets=SimpleNamespace()))
    normalized = repo._serialize(
        {
            "_id": 123,
            "created_at": datetime(2026, 7, 21, 9, 0, 0),
            "messages": [
                {
                    "created_at": datetime(2026, 7, 21, 9, 15, 0),
                    "body": "Hello",
                }
            ],
        }
    )

    assert normalized["_id"] == "123"
    assert normalized["created_at"].tzinfo is not None
    assert normalized["messages"][0]["created_at"].tzinfo is not None


def test_email_settings_are_loaded_from_env_file():
    assert settings.SMTP_HOST == "smtp.gmail.com"
    assert settings.SMTP_USER
    assert settings.SMTP_PASSWORD
    assert settings.SUPPORT_EMAIL