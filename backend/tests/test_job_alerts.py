"""
Unit Tests for Simplified Job Alert Engine, Resume Sweeper & Webhooks.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from api.routes.resume import sweep_stuck_pending_resumes
from scheduler.job_alerts import calculate_slot_id, run_nightly_job_alerts
from services.email_service import EmailService
from tests.conftest import MockResult


def _make_mock_session_factory(open_jobs_count, users, resume_user_ids=None):
    """Build an async SQLAlchemy session factory mock for run_nightly_job_alerts."""
    execute_calls = []
    session = MagicMock()

    async def fake_execute(stmt, *args, **kwargs):
        sql = str(stmt).lower()
        execute_calls.append(sql)
        if "count(" in sql and "from jobs" in sql:
            return MockResult([open_jobs_count])
        if sql.startswith("select") and "from users" in sql:
            return MockResult(users)
        if sql.startswith("select") and "from resumes" in sql:
            return MockResult(resume_user_ids or [])
        return MockResult([], rowcount=1)

    @asynccontextmanager
    async def fake_begin():
        yield

    session.execute = AsyncMock(side_effect=fake_execute)
    session.begin = fake_begin

    @asynccontextmanager
    async def session_ctx():
        yield session

    return (lambda: session_ctx()), execute_calls


def test_slot_id_calculation():
    """Verify deterministic slot ID formatting in Asia/Kolkata timezone."""
    dt_morning = datetime(2026, 10, 3, 2, 0, 0, tzinfo=timezone.utc)
    assert calculate_slot_id(dt_morning, slot_type="morning") == "2026-10-03_07:30"

    dt_afternoon = datetime(2026, 10, 3, 8, 30, 0, tzinfo=timezone.utc)
    assert calculate_slot_id(dt_afternoon, slot_type="afternoon") == "2026-10-03_14:00"


@pytest.mark.asyncio
async def test_slot_idempotency_and_force_replay(monkeypatch):
    """Verify User.last_alert_slot prevents duplicate emails unless force_replay=True."""
    fake_brevo = AsyncMock(return_value={"sent": True, "message_id": "msg-12345"})
    monkeypatch.setattr(EmailService, "_send_brevo_email", fake_brevo)

    user = SimpleNamespace(
        id="cand_test_123",
        email="cand@example.com",
        full_name="Test Candidate",
        last_alert_slot=None,
    )
    sf, calls = _make_mock_session_factory(5, [user], ["cand_test_123"])

    with patch("scheduler.job_alerts.find_jobs_for_candidate", new_callable=AsyncMock) as mock_match, \
         patch("scheduler.job_alerts.run_external_job_scrape", new_callable=AsyncMock) as mock_scrape:
        mock_scrape.return_value = {"fetched": 0, "upserted": 0, "skipped": 0, "deleted": 0}
        mock_match.return_value = {
            "recommended_jobs": [{
                "id": "job-1",
                "title": "Python Developer",
                "company_name": "Tech Corp",
                "location": "Remote",
                "work_mode": "Remote",
                "match_score": 90,
                "is_applied": False,
            }]
        }

        res = await run_nightly_job_alerts(slot_id="2026-10-03_07:30", session_factory=sf)
        assert res["status"] == "completed"
        assert res["emails_delivered"] == 1
        assert res["candidates_with_resume"] == 1
        mock_scrape.assert_called_once()
        assert any(c.startswith("update users") for c in calls)

        # Second run with last_alert_slot already set should skip candidate
        user.last_alert_slot = "2026-10-03_07:30"
        fake_brevo.reset_mock()
        res2 = await run_nightly_job_alerts(slot_id="2026-10-03_07:30", session_factory=sf)
        assert res2["emails_delivered"] == 0
        fake_brevo.assert_not_called()

        # Replaying with force_replay=True sends again
        res3 = await run_nightly_job_alerts(
            slot_id="2026-10-03_07:30", force_replay=True, session_factory=sf
        )
        assert res3["emails_delivered"] == 1
        fake_brevo.assert_called_once()


@pytest.mark.asyncio
async def test_uncertain_outcome_does_not_mark_slot(monkeypatch):
    """Verify ReadTimeout logs UNCERTAIN and does not update last_alert_slot."""
    fake_brevo = AsyncMock(return_value={
        "sent": False,
        "uncertain": True,
        "error": "Brevo ReadTimeout after dispatch (uncertain provider status)",
    })
    monkeypatch.setattr(EmailService, "_send_brevo_email", fake_brevo)

    user = SimpleNamespace(
        id="cand_timeout_123",
        email="cand_timeout@example.com",
        full_name="Timeout Candidate",
        last_alert_slot=None,
    )
    sf, calls = _make_mock_session_factory(5, [user])

    with patch("scheduler.job_alerts.find_jobs_for_candidate", new_callable=AsyncMock) as mock_match, \
         patch("scheduler.job_alerts.run_external_job_scrape", new_callable=AsyncMock) as mock_scrape:
        mock_scrape.return_value = {"fetched": 0, "upserted": 0, "skipped": 0, "deleted": 0}
        mock_match.return_value = {
            "recommended_jobs": [{"id": "job-1", "title": "Dev", "company_name": "Corp", "is_applied": False}]
        }

        res = await run_nightly_job_alerts(slot_id="2026-10-03_07:30", session_factory=sf)
        assert res["emails_delivered"] == 0
        assert res["emails_uncertain"] == 1
        assert not any(c.startswith("update users") for c in calls)


@pytest.mark.asyncio
async def test_sweep_stuck_pending_resumes():
    """Verify sweep_stuck_pending_resumes updates stuck records to failed."""
    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=MockResult(rowcount=1))

    @asynccontextmanager
    async def mock_begin():
        yield

    mock_session.begin = mock_begin

    @asynccontextmanager
    async def mock_session_ctx():
        yield mock_session

    with patch("api.routes.resume.get_pg_session_factory", return_value=lambda: mock_session_ctx()):
        res = await sweep_stuck_pending_resumes()

    assert res["swept"] == 1
    mock_session.execute.assert_called_once()


@pytest.mark.asyncio
async def test_transient_error_retry_and_backoff():
    """Verify EmailService retries on HTTP 429 with Retry-After header and succeeds on retry."""
    import httpx
    svc = EmailService()
    call_count = 0

    async def mock_post(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return httpx.Response(
                status_code=429,
                headers={"Retry-After": "0.01"},
                text="Rate limited",
                request=httpx.Request("POST", "http://test"),
            )
        return httpx.Response(
            status_code=200,
            json={"messageId": "msg-retry-success"},
            request=httpx.Request("POST", "http://test"),
        )

    with patch.object(httpx.AsyncClient, "post", side_effect=mock_post), \
         patch("core.config.settings.BREVO_API_KEY", "mock-brevo-key"):
        res = await svc._send_brevo_email(
            to_email="candidate@example.com",
            subject="Test Subject",
            html_body="<p>Test</p>",
            max_retries=2,
        )

        assert res["sent"] is True
        assert res["message_id"] == "msg-retry-success"
        assert call_count == 2


@pytest.mark.asyncio
async def test_permanent_auth_error_fail_fast():
    """Verify EmailService fails fast on permanent 401 error with 0 retries."""
    import httpx
    svc = EmailService()
    call_count = 0

    async def mock_post(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        return httpx.Response(
            status_code=401,
            text="Unauthorized - Invalid API Key",
            request=httpx.Request("POST", "http://test"),
        )

    with patch.object(httpx.AsyncClient, "post", side_effect=mock_post), \
         patch("core.config.settings.BREVO_API_KEY", "invalid-key"):
        res = await svc._send_brevo_email(
            to_email="candidate@example.com",
            subject="Test Subject",
            html_body="<p>Test</p>",
            max_retries=3,
        )

        assert res["sent"] is False
        assert call_count == 1


@pytest.mark.asyncio
async def test_webhook_trigger_alerts_authentication():
    """Verify webhook endpoint enforces X-Cron-Secret authentication and executes run_nightly_job_alerts."""
    from api.routes.jobs import trigger_job_alerts_webhook
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await trigger_job_alerts_webhook(x_cron_secret="invalid-secret")
    assert exc_info.value.status_code == 403

    with patch("api.routes.jobs.settings") as mock_settings, \
         patch("scheduler.job_alerts.run_nightly_job_alerts", new_callable=AsyncMock) as mock_run:
        mock_settings.CRON_SECRET = "CareerShala-Cron-Token-9988!@#"
        mock_settings.SECRET_KEY = "jwt-secret-key"
        mock_run.return_value = {"status": "completed", "emails_delivered": 5}

        res = await trigger_job_alerts_webhook(
            x_cron_secret="CareerShala-Cron-Token-9988!@#",
        )
        assert res["success"] is True
        assert res["result"]["emails_delivered"] == 5
        mock_run.assert_called_once()


@pytest.mark.asyncio
async def test_webhook_sweep_stuck_resumes_authentication():
    """Verify POST /resume/admin/sweep-stuck validates X-Cron-Secret and executes sweep."""
    from api.routes.resume import sweep_stuck_resumes_webhook
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await sweep_stuck_resumes_webhook(x_cron_secret="wrong")
    assert exc_info.value.status_code == 401

    with patch("api.routes.resume.settings") as mock_settings, \
         patch("api.routes.resume.sweep_stuck_pending_resumes", new_callable=AsyncMock) as mock_sweep:
        mock_settings.CRON_SECRET = "CareerShala-Cron-Token-9988!@#"
        mock_settings.SECRET_KEY = "jwt-secret-key"
        mock_sweep.return_value = {"swept": 3}

        res = await sweep_stuck_resumes_webhook(
            x_cron_secret="CareerShala-Cron-Token-9988!@#",
        )
        assert res["status"] == "success"
        assert res["message"] == "Sweep completed"
        assert res["result"]["swept"] == 3
        mock_sweep.assert_called_once()


@pytest.mark.asyncio
async def test_webhook_expire_subscriptions_authentication():
    """Verify POST /users/admin/expire-subscriptions validates X-Cron-Secret and executes sweep."""
    from api.routes.users import expire_subscriptions_webhook
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await expire_subscriptions_webhook(x_cron_secret="wrong")
    assert exc_info.value.status_code == 401

    with patch("api.routes.users.settings") as mock_settings, \
         patch("api.routes.users.expire_overdue_subscriptions", new_callable=AsyncMock) as mock_expire:
        mock_settings.CRON_SECRET = "CareerShala-Cron-Token-9988!@#"
        mock_settings.SECRET_KEY = "jwt-secret-key"
        mock_expire.return_value = {"expired_count": 2}

        res = await expire_subscriptions_webhook(
            x_cron_secret="CareerShala-Cron-Token-9988!@#",
        )
        assert res["status"] == "success"
        assert res["message"] == "Subscription expiry sweep completed"
        assert res["result"]["expired_count"] == 2
        mock_expire.assert_called_once()
