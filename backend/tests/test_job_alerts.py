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
    get_eligible_missed_slot,
    job_alerts_scheduler,
    recover_missed_job_alerts_on_startup,
    run_nightly_job_alerts,
    start_job_alert_scheduler,
    stop_job_alert_scheduler,
    sweep_stuck_pending_resumes,
)
from services.email_service import EmailService, send_job_alert_email


@pytest.mark.asyncio
async def test_afternoon_trigger_hour_is_14():
    """Verify afternoon cron trigger is registered for 14:00 (2:00 PM IST)."""
    start_job_alert_scheduler()
    try:
        assert job_alerts_scheduler.running is True
        afternoon_job = job_alerts_scheduler.get_job("afternoon_job_alerts")
        assert afternoon_job is not None
        
        # Verify trigger fields
        fields = {f.name: str(f) for f in afternoon_job.trigger.fields}
        assert "hour" in fields
        assert "14" in str(fields["hour"])
        assert "minute" in fields
        assert "0" in str(fields["minute"])
        assert str(afternoon_job.trigger.timezone) in ("Asia/Kolkata", "Asia/Calcutta")

        morning_job = job_alerts_scheduler.get_job("morning_job_alerts")
        assert morning_job is not None
        m_fields = {f.name: str(f) for f in morning_job.trigger.fields}
        assert "7" in str(m_fields["hour"])
        assert "30" in str(m_fields["minute"])
    finally:
        stop_job_alert_scheduler()


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


def test_missed_slot_recovery_window():
    """Verify 2-hour recovery window eligibility."""
    # 08:15 AM IST (02:45 UTC) -> Within 07:30-09:30 morning recovery window
    dt_morning_eligible = datetime(2026, 10, 3, 2, 45, 0, tzinfo=timezone.utc)
    res_m = get_eligible_missed_slot(dt_morning_eligible)
    assert res_m is not None
    assert res_m["slot_id"] == "2026-10-03_07:30"
    assert res_m["slot_type"] == "morning"

    # 10:00 AM IST (04:30 UTC) -> Past morning recovery window (expired)
    dt_morning_expired = datetime(2026, 10, 3, 4, 30, 0, tzinfo=timezone.utc)
    res_exp = get_eligible_missed_slot(dt_morning_expired)
    assert res_exp is None

    # 02:30 PM IST (09:00 UTC) -> Within 14:00-16:00 afternoon recovery window
    dt_afternoon_eligible = datetime(2026, 10, 3, 9, 0, 0, tzinfo=timezone.utc)
    res_a = get_eligible_missed_slot(dt_afternoon_eligible)
    assert res_a is not None
    assert res_a["slot_id"] == "2026-10-03_14:00"
    assert res_a["slot_type"] == "afternoon"


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
async def test_startup_recovery_execution():
    """Verify startup recovery triggers execution when missed slot is eligible."""
    mock_db = MagicMock()
    mock_db.cron_job_runs.find_one = AsyncMock(return_value=None)

    # Mock morning time within recovery window
    mock_now = datetime(2026, 10, 3, 2, 45, 0, tzinfo=timezone.utc)

    with patch("scheduler.job_alerts.datetime") as mock_dt:
        mock_dt.now.return_value = mock_now
        mock_dt.side_effect = lambda *args, **kwargs: datetime(*args, **kwargs)

        with patch("scheduler.job_alerts.run_nightly_job_alerts", new_callable=AsyncMock) as mock_run:
            mock_run.return_value = {"status": "completed"}

            await recover_missed_job_alerts_on_startup(db=mock_db)

            mock_run.assert_called_once()
            called_kwargs = mock_run.call_args[1]
            assert called_kwargs["slot_id"] == "2026-10-03_07:30"
            assert called_kwargs["triggered_by"] == "recovery_on_startup"


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

