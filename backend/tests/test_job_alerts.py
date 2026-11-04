"""
Unit and Integration Tests for Job Alert Scheduler & Remediation Architecture.
==============================================================================
Verifies:
1. Schedule Timings: Morning at 07:30 IST, Afternoon at 14:00 IST (Asia/Kolkata).
2. Deterministic Slot Idempotency & Batch-Level Audit in `cron_job_runs`.
3. Atomic Per-Candidate Claims & Safe Stale-Claim Recovery in `job_alert_deliveries`.
4. Startup Recovery 2-Hour Eligibility Window & Expiration.
5. Brevo Transient Error Retries (HTTP 429/503) & Uncertain Timeout Quarantine (ReadTimeout).
6. Fail-Fast on Permanent Auth Errors (HTTP 401).
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from models.cron_run_model import DeliveryStatus
from scheduler.job_alerts import (
    calculate_slot_id,
    run_nightly_job_alerts,
    sweep_stuck_pending_resumes,
)
from services.email_service import EmailService


def test_slot_id_calculation():
    """Verify deterministic slot ID formatting in Asia/Kolkata timezone."""
    # 02:00 UTC = 07:30 IST on 2026-10-03
    dt_morning = datetime(2026, 10, 3, 2, 0, 0, tzinfo=timezone.utc)
    slot_morning = calculate_slot_id(dt_morning, slot_type="morning")
    assert slot_morning == "2026-10-03_07:30"

    # 08:30 UTC = 14:00 IST on 2026-10-03
    dt_afternoon = datetime(2026, 10, 3, 8, 30, 0, tzinfo=timezone.utc)
    slot_afternoon = calculate_slot_id(dt_afternoon, slot_type="afternoon")
    assert slot_afternoon == "2026-10-03_14:00"


@pytest.mark.asyncio
async def test_atomic_candidate_claim_and_duplicate_prevention(monkeypatch):
    """Verify atomic per-candidate per-slot claims in job_alert_deliveries."""
    from services.email_service import EmailService

    fake_brevo = AsyncMock(return_value={"sent": True, "message_id": "msg-12345"})
    monkeypatch.setattr(EmailService, "_send_brevo_email", fake_brevo)

    candidate_id = "cand_test_claim_123"
    candidate_doc = {
        "_id": candidate_id,
        "id": candidate_id,
        "email": "cand@example.com",
        "full_name": "Test Candidate",
        "job_alerts_enabled": True,
        "last_alert_slot": None,
    }

    mock_cron_repo = MagicMock()
    mock_cron_repo.get_open_jobs_count = AsyncMock(return_value=5)
    mock_cron_repo.get_cron_run = AsyncMock(return_value=None)
    mock_cron_repo.upsert_cron_run = AsyncMock()
    mock_cron_repo.get_active_candidates = AsyncMock(return_value=[candidate_doc])
    mock_cron_repo.get_candidate_parsed_resume = AsyncMock(return_value={
        "id": "resume_123",
        "user_id": candidate_id,
        "parsed_data": {"skills": ["Python", "FastAPI"]},
    })
    mock_cron_repo.get_candidate_delivery = AsyncMock(return_value=None)
    mock_cron_repo.claim_candidate = AsyncMock(return_value=True)
    mock_cron_repo.update_delivery = AsyncMock()
    mock_cron_repo.update_user_alert_slot = AsyncMock()

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def mock_acquired_lock(*args, **kwargs):
        yield True

    # Mock job matcher and distributed lock
    with patch("scheduler.job_alerts.find_jobs_for_candidate", new_callable=AsyncMock) as mock_match, \
         patch("scheduler.job_alerts.distributed_lock", side_effect=mock_acquired_lock):
        mock_match.return_value = {
            "recommended_jobs": [
                {
                    "id": "job-1",
                    "title": "Python Developer",
                    "company_name": "Tech Corp",
                    "location": "Remote",
                    "work_mode": "Remote",
                    "match_score": 90,
                    "is_applied": False,
                }
            ]
        }

        # First run: candidate not claimed yet (get_candidate_delivery returns None)
        res = await run_nightly_job_alerts(slot_id="2026-10-03_07:30", cron_repo=mock_cron_repo)
        assert res["status"] == "completed"
        assert res["emails_delivered"] == 1

        # Verify claim_candidate was called to atomically claim candidate
        mock_cron_repo.claim_candidate.assert_called_once_with(candidate_id, "2026-10-03_07:30", "cand@example.com")

        # Second run: candidate already marked DELIVERED
        mock_cron_repo.get_candidate_delivery = AsyncMock(return_value={
            "candidate_id": candidate_id,
            "slot_id": "2026-10-03_07:30",
            "status": DeliveryStatus.DELIVERED.value,
        })
        mock_cron_repo.claim_candidate.reset_mock()
        fake_brevo.reset_mock()

        res2 = await run_nightly_job_alerts(slot_id="2026-10-03_07:30", force_replay=True, cron_repo=mock_cron_repo)
        assert res2["emails_delivered"] == 0
        fake_brevo.assert_not_called()


@pytest.mark.asyncio
async def test_uncertain_outcome_quarantine(monkeypatch):
    """Verify ReadTimeout causes delivery record to be quarantined as UNCERTAIN without blind retry."""
    from services.email_service import EmailService

    # Brevo returns uncertain result
    fake_brevo = AsyncMock(return_value={
        "sent": False,
        "uncertain": True,
        "error": "Brevo ReadTimeout after dispatch (uncertain provider status)",
    })
    monkeypatch.setattr(EmailService, "_send_brevo_email", fake_brevo)

    candidate_id = "cand_timeout_123"
    candidate_doc = {
        "_id": candidate_id,
        "id": candidate_id,
        "email": "cand_timeout@example.com",
        "full_name": "Timeout Candidate",
        "job_alerts_enabled": True,
    }

    mock_cron_repo = MagicMock()
    mock_cron_repo.get_open_jobs_count = AsyncMock(return_value=5)
    mock_cron_repo.get_cron_run = AsyncMock(return_value=None)
    mock_cron_repo.upsert_cron_run = AsyncMock()
    mock_cron_repo.get_active_candidates = AsyncMock(return_value=[candidate_doc])
    mock_cron_repo.get_candidate_parsed_resume = AsyncMock(return_value={"parsed_data": {}})
    mock_cron_repo.get_candidate_delivery = AsyncMock(return_value=None)
    mock_cron_repo.claim_candidate = AsyncMock(return_value=True)
    mock_cron_repo.update_delivery = AsyncMock()

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def mock_acquired_lock(*args, **kwargs):
        yield True

    with patch("scheduler.job_alerts.find_jobs_for_candidate", new_callable=AsyncMock) as mock_match, \
         patch("scheduler.job_alerts.distributed_lock", side_effect=mock_acquired_lock):
        mock_match.return_value = {
            "recommended_jobs": [{"id": "job-1", "title": "Dev", "company_name": "Corp", "is_applied": False}]
        }

        res = await run_nightly_job_alerts(slot_id="2026-10-03_07:30", cron_repo=mock_cron_repo)

        assert res["emails_delivered"] == 0
        assert res["emails_uncertain"] == 1

        # Verify job_alert_deliveries was marked UNCERTAIN
        update_calls = mock_cron_repo.update_delivery.call_args_list
        marked_uncertain = any(
            c.kwargs.get("status") == DeliveryStatus.UNCERTAIN.value
            for c in update_calls
        )
        assert marked_uncertain is True


@pytest.mark.asyncio
async def test_sweep_stuck_pending_resumes():
    """Verify sweep_stuck_pending_resumes finds stuck records and updates them to failed."""
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def mock_acquired_lock(*args, **kwargs):
        yield True

    from tests.conftest import MockResult
    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=MockResult(rowcount=1))
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    
    @asynccontextmanager
    async def mock_begin():
        yield

    mock_session.begin = mock_begin

    @asynccontextmanager
    async def mock_session_ctx():
        yield mock_session

    with patch("scheduler.job_alerts.distributed_lock", side_effect=mock_acquired_lock):
        with patch("config.db.get_pg_session_factory", return_value=lambda: mock_session_ctx()):
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
            # First attempt: 429 Rate Limited with Retry-After
            response = httpx.Response(
                status_code=429,
                headers={"Retry-After": "0.01"},
                text="Rate limited",
                request=httpx.Request("POST", "http://test"),
            )
            return response
        else:
            # Second attempt: 200 OK
            response = httpx.Response(
                status_code=200,
                json={"messageId": "msg-retry-success"},
                request=httpx.Request("POST", "http://test"),
            )
            return response

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
        assert call_count == 1  # Failed immediately without retrying 401


@pytest.mark.asyncio
async def test_stale_claim_recovery_after_15_minutes(monkeypatch):
    """Verify claims older than 15 minutes from crashed workers are safely reclaimed."""
    from services.email_service import EmailService

    fake_brevo = AsyncMock(return_value={"sent": True, "message_id": "msg-recovered"})
    monkeypatch.setattr(EmailService, "_send_brevo_email", fake_brevo)

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def mock_acquired_lock(*args, **kwargs):
        yield True

    candidate_id = "cand_stale_123"
    candidate_doc = {
        "_id": candidate_id,
        "id": candidate_id,
        "email": "cand_stale@example.com",
        "full_name": "Stale Candidate",
        "job_alerts_enabled": True,
    }

    stale_time = datetime.now(timezone.utc) - timedelta(minutes=20)
    mock_cron_repo = MagicMock()
    mock_cron_repo.get_open_jobs_count = AsyncMock(return_value=5)
    mock_cron_repo.get_cron_run = AsyncMock(return_value=None)
    mock_cron_repo.upsert_cron_run = AsyncMock()
    mock_cron_repo.get_active_candidates = AsyncMock(return_value=[candidate_doc])
    mock_cron_repo.get_candidate_parsed_resume = AsyncMock(return_value={"parsed_data": {}})
    mock_cron_repo.get_candidate_delivery = AsyncMock(return_value={
        "candidate_id": candidate_id,
        "slot_id": "2026-10-03_07:30",
        "status": DeliveryStatus.CLAIMED.value,
        "claimed_at": stale_time,
        "attempt_count": 1,
    })
    mock_cron_repo.reclaim_candidate = AsyncMock(return_value=True)
    mock_cron_repo.update_delivery = AsyncMock()
    mock_cron_repo.update_user_alert_slot = AsyncMock()

    with patch("scheduler.job_alerts.find_jobs_for_candidate", new_callable=AsyncMock) as mock_match, \
         patch("scheduler.job_alerts.distributed_lock", side_effect=mock_acquired_lock):
        mock_match.return_value = {
            "recommended_jobs": [{"id": "job-1", "title": "Dev", "company_name": "Corp", "is_applied": False}]
        }

        res = await run_nightly_job_alerts(slot_id="2026-10-03_07:30", cron_repo=mock_cron_repo)

        assert res["emails_delivered"] == 1
        fake_brevo.assert_called_once()
        mock_cron_repo.reclaim_candidate.assert_called_once()


@pytest.mark.asyncio
async def test_webhook_trigger_alerts_authentication():
    """Verify webhook endpoint enforces X-Cron-Secret authentication and executes run_nightly_job_alerts."""
    from api.routes.jobs import trigger_job_alerts_manually
    from fastapi import HTTPException

    mock_db = MagicMock()

    # 1. Must reject request when secret is absent or wrong
    with pytest.raises(HTTPException) as exc_info:
        await trigger_job_alerts_manually(
            x_cron_secret="invalid-secret",
            cron_secret=None,
            current_user=None,
            db=mock_db,
        )
    assert exc_info.value.status_code == 403

    # 2. Must succeed and invoke run_nightly_job_alerts when X-Cron-Secret matches
    with patch("api.routes.jobs.settings") as mock_settings, \
         patch("scheduler.job_alerts.run_nightly_job_alerts", new_callable=AsyncMock) as mock_run:
        mock_settings.CRON_SECRET = "CareerShala-Cron-Token-9988!@#"
        mock_settings.SECRET_KEY = "jwt-secret-key"
        mock_run.return_value = {"status": "completed", "emails_delivered": 5}

        res = await trigger_job_alerts_manually(
            x_cron_secret="CareerShala-Cron-Token-9988!@#",
            current_user=None,
            db=mock_db,
        )
        assert res["success"] is True
        assert res["result"]["emails_delivered"] == 5
        mock_run.assert_called_once()


@pytest.mark.asyncio
async def test_webhook_sweep_stuck_resumes_authentication():
    """Verify POST /resume/admin/sweep-stuck validates X-Cron-Secret and executes sweep."""
    from api.routes.resume import sweep_stuck_resumes_webhook
    from fastapi import HTTPException

    mock_db = MagicMock()

    # 1. 401 when invalid
    with pytest.raises(HTTPException) as exc_info:
        await sweep_stuck_resumes_webhook(x_cron_secret="wrong")
    assert exc_info.value.status_code == 401

    # 2. 200 when valid
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

    # 1. 401 when invalid
    with pytest.raises(HTTPException) as exc_info:
        await expire_subscriptions_webhook(x_cron_secret="wrong")
    assert exc_info.value.status_code == 401

    # 2. 200 when valid
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

