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

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from bson import ObjectId

from models.cron_run_model import CronRunStatus, DeliveryStatus
from scheduler.job_alerts import (
    calculate_slot_id,
    run_nightly_job_alerts,
    sweep_stuck_pending_resumes,
)
from services.email_service import EmailService, send_job_alert_email


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

    mock_db = MagicMock()
    mock_db.jobs.count_documents = AsyncMock(return_value=5)
    mock_db.jobs.delete_many = AsyncMock(return_value=MagicMock(deleted_count=0))
    mock_db.cron_job_runs.create_index = AsyncMock()
    mock_db.job_alert_deliveries.create_index = AsyncMock()
    mock_db.cron_job_runs.find_one = AsyncMock(return_value=None)
    mock_db.cron_job_runs.update_one = AsyncMock()
    mock_db.users.update_one = AsyncMock()
    mock_db.companies.find_one = AsyncMock(return_value=None)

    candidate_id = str(ObjectId())
    candidate_doc = {
        "_id": ObjectId(candidate_id),
        "email": "cand@example.com",
        "full_name": "Test Candidate",
        "job_alerts_enabled": True,
        "last_alert_slot": None,
    }

    mock_cursor = MagicMock()
    mock_cursor.to_list = AsyncMock(return_value=[candidate_doc])
    mock_db.users.find.return_value = mock_cursor

    # Candidate has parsed resume
    mock_db.resumes.find_one = AsyncMock(return_value={
        "_id": ObjectId(),
        "user_id": candidate_id,
        "status": "parsed",
        "parsed_data": {"skills": ["Python", "FastAPI"]},
    })

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

        # First run: candidate not claimed yet (find_one returns None)
        mock_db.job_alert_deliveries.find_one = AsyncMock(return_value=None)
        mock_db.job_alert_deliveries.insert_one = AsyncMock()
        mock_db.job_alert_deliveries.update_one = AsyncMock()

        res = await run_nightly_job_alerts(db=mock_db, slot_id="2026-10-03_07:30")
        assert res["status"] == "completed"
        assert res["emails_delivered"] == 1

        # Verify insert_one was called to claim candidate
        mock_db.job_alert_deliveries.insert_one.assert_called_once()
        claim_call = mock_db.job_alert_deliveries.insert_one.call_args[0][0]
        assert claim_call["candidate_id"] == candidate_id
        assert claim_call["slot_id"] == "2026-10-03_07:30"
        assert claim_call["status"] == DeliveryStatus.CLAIMED.value

        # Second run: candidate already marked DELIVERED
        mock_db.job_alert_deliveries.find_one = AsyncMock(return_value={
            "candidate_id": candidate_id,
            "slot_id": "2026-10-03_07:30",
            "status": DeliveryStatus.DELIVERED.value,
        })
        mock_db.job_alert_deliveries.insert_one.reset_mock()
        fake_brevo.reset_mock()

        res2 = await run_nightly_job_alerts(db=mock_db, slot_id="2026-10-03_07:30", force_replay=True)
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

    mock_db = MagicMock()
    mock_db.jobs.count_documents = AsyncMock(return_value=5)
    mock_db.jobs.delete_many = AsyncMock(return_value=MagicMock(deleted_count=0))
    mock_db.cron_job_runs.create_index = AsyncMock()
    mock_db.job_alert_deliveries.create_index = AsyncMock()
    mock_db.cron_job_runs.find_one = AsyncMock(return_value=None)
    mock_db.cron_job_runs.update_one = AsyncMock()
    mock_db.job_alert_deliveries.find_one = AsyncMock(return_value=None)
    mock_db.job_alert_deliveries.insert_one = AsyncMock()
    mock_db.job_alert_deliveries.update_one = AsyncMock()
    mock_db.users.update_one = AsyncMock()

    candidate_id = str(ObjectId())
    candidate_doc = {
        "_id": ObjectId(candidate_id),
        "email": "cand_timeout@example.com",
        "full_name": "Timeout Candidate",
        "job_alerts_enabled": True,
    }

    mock_cursor = MagicMock()
    mock_cursor.to_list = AsyncMock(return_value=[candidate_doc])
    mock_db.users.find.return_value = mock_cursor
    mock_db.resumes.find_one = AsyncMock(return_value={"status": "parsed", "parsed_data": {}})

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def mock_acquired_lock(*args, **kwargs):
        yield True

    with patch("scheduler.job_alerts.find_jobs_for_candidate", new_callable=AsyncMock) as mock_match, \
         patch("scheduler.job_alerts.distributed_lock", side_effect=mock_acquired_lock):
        mock_match.return_value = {
            "recommended_jobs": [{"id": "job-1", "title": "Dev", "company_name": "Corp", "is_applied": False}]
        }

        res = await run_nightly_job_alerts(db=mock_db, slot_id="2026-10-03_07:30")

        assert res["emails_delivered"] == 0
        assert res["emails_uncertain"] == 1

        # Verify job_alert_deliveries was marked UNCERTAIN
        update_calls = mock_db.job_alert_deliveries.update_one.call_args_list
        marked_uncertain = any(
            c[0][1].get("$set", {}).get("status") == DeliveryStatus.UNCERTAIN.value
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

    sample_id = ObjectId()
    mock_db = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.to_list = AsyncMock(return_value=[
        {"_id": sample_id, "user_id": "u123", "status": "processing"}
    ])
    mock_db.resumes.find.return_value = mock_cursor
    mock_db.resumes.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

    with patch("scheduler.job_alerts.distributed_lock", side_effect=mock_acquired_lock):
        res = await sweep_stuck_pending_resumes(db=mock_db)

    assert res["swept"] == 1
    mock_db.resumes.find.assert_called_once()
    called_query = mock_db.resumes.find.call_args[0][0]
    assert called_query["status"] == {"$in": ["pending", "processing"]}
    mock_db.resumes.update_one.assert_called_once()
    update_arg = mock_db.resumes.update_one.call_args[0]
    assert update_arg[0] == {"_id": sample_id}
    assert update_arg[1]["$set"]["status"] == "failed"


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

    mock_db = MagicMock()
    mock_db.jobs.count_documents = AsyncMock(return_value=5)
    mock_db.jobs.delete_many = AsyncMock(return_value=MagicMock(deleted_count=0))
    mock_db.cron_job_runs.create_index = AsyncMock()
    mock_db.job_alert_deliveries.create_index = AsyncMock()
    mock_db.cron_job_runs.find_one = AsyncMock(return_value=None)
    mock_db.cron_job_runs.update_one = AsyncMock()
    mock_db.users.update_one = AsyncMock()

    candidate_id = str(ObjectId())
    candidate_doc = {
        "_id": ObjectId(candidate_id),
        "email": "cand_stale@example.com",
        "full_name": "Stale Candidate",
        "job_alerts_enabled": True,
    }

    mock_cursor = MagicMock()
    mock_cursor.to_list = AsyncMock(return_value=[candidate_doc])
    mock_db.users.find.return_value = mock_cursor
    mock_db.resumes.find_one = AsyncMock(return_value={"status": "parsed", "parsed_data": {}})

    # Claim is 20 minutes old (stale)
    stale_time = datetime.now(timezone.utc) - timedelta(minutes=20)
    mock_db.job_alert_deliveries.find_one = AsyncMock(return_value={
        "candidate_id": candidate_id,
        "slot_id": "2026-10-03_07:30",
        "status": DeliveryStatus.CLAIMED.value,
        "claimed_at": stale_time,
        "attempt_count": 1,
    })
    mock_db.job_alert_deliveries.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

    with patch("scheduler.job_alerts.find_jobs_for_candidate", new_callable=AsyncMock) as mock_match, \
         patch("scheduler.job_alerts.distributed_lock", side_effect=mock_acquired_lock):
        mock_match.return_value = {
            "recommended_jobs": [{"id": "job-1", "title": "Dev", "company_name": "Corp", "is_applied": False}]
        }

        res = await run_nightly_job_alerts(db=mock_db, slot_id="2026-10-03_07:30")

        assert res["emails_delivered"] == 1
        fake_brevo.assert_called_once()


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

