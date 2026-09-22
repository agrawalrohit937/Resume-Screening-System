"""
Unit Tests for Phase D: Retention Loops — Nightly AI Job Alerts & Email Service.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from services.email_service import send_job_alert_email
from scheduler.job_alerts import (
    run_nightly_job_alerts,
    start_job_alert_scheduler,
    stop_job_alert_scheduler,
    job_alerts_scheduler,
)


@pytest.mark.asyncio
async def test_send_job_alert_email_rendering():
    """Verify HTML generation, job cards rendering, and fallback simulation for email alert."""
    sample_jobs = [
        {
            "id": "660000000000000000000010",
            "title": "Junior Fullstack Engineer",
            "company_name": "Acme Software",
            "location": "Remote",
            "work_mode": "Remote",
            "salary_range": "$95,000 - $125,000",
            "match_score": 92.4,
            "required_skills": ["React", "Python", "FastAPI"],
            "matched_skills": ["React", "Python"],
        },
        {
            "id": "660000000000000000000011",
            "title": "Frontend Developer",
            "company_name": "Vercel Inc",
            "location": "San Francisco, CA",
            "work_mode": "Hybrid",
            "salary_range": "$110,000 - $140,000",
            "match_score": 84.1,
            "required_skills": ["Next.js", "TypeScript", "TailwindCSS"],
            "matched_skills": ["Next.js", "TypeScript"],
        },
    ]

    res = await send_job_alert_email(
        to_email="alex.candidate@example.com",
        candidate_name="Alex Mercer",
        matched_jobs=sample_jobs,
    )

    assert res["sent"] is True
    assert res["to"] == "alex.candidate@example.com"
    assert res["count"] == 2


@pytest.mark.asyncio
async def test_run_nightly_job_alerts_empty_db():
    """Verify batch alert handles empty candidate pool gracefully without crashing."""
    mock_db = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.to_list = AsyncMock(return_value=[])
    mock_db.users.find.return_value = mock_cursor

    result = await run_nightly_job_alerts(db=mock_db)

    assert result["status"] == "completed"
    assert result["candidates_scanned"] == 0
    assert result["emails_sent"] == 0
    assert result["errors"] == 0


@pytest.mark.asyncio
async def test_scheduler_lifecycle():
    """Verify scheduler startup and shutdown methods execute cleanly."""
    import asyncio
    start_job_alert_scheduler()
    assert job_alerts_scheduler.running is True
    assert job_alerts_scheduler.get_job("nightly_job_alerts") is not None

    stop_job_alert_scheduler()
    await asyncio.sleep(0.05)
    assert job_alerts_scheduler.running is False


@pytest.mark.asyncio
async def test_admin_trigger_alerts_endpoint_rbac():
    """Verify POST /api/v1/jobs/admin/trigger-alerts enforces Admin role."""
    import httpx
    from main import create_application
    from api.deps import get_current_user, get_database
    from models.user_model import UserModel, UserRole
    from bson import ObjectId

    app = create_application()

    # 1. Candidate must be forbidden (403)
    candidate_user = UserModel(
        id=str(ObjectId()),
        email="cand@example.com",
        full_name="Candidate User",
        role=UserRole.CANDIDATE,
        status="active",
    )
    app.dependency_overrides[get_current_user] = lambda: candidate_user

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/jobs/admin/trigger-alerts")
        assert res.status_code == 403

        # 2. Administrator must be accepted (200)
        admin_user = UserModel(
            id=str(ObjectId()),
            email="admin@example.com",
            full_name="Admin User",
            role=UserRole.ADMIN,
            status="active",
        )
        app.dependency_overrides[get_current_user] = lambda: admin_user

        mock_db = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.users.find.return_value = mock_cursor
        app.dependency_overrides[get_database] = lambda: mock_db

        res2 = await client.post("/api/v1/jobs/admin/trigger-alerts")
        assert res2.status_code == 200
        data = res2.json()
        assert data["success"] is True
        assert data["result"]["status"] == "completed"


@pytest.mark.asyncio
async def test_sweep_stuck_pending_resumes():
    """Verify sweep_stuck_pending_resumes finds stuck records and updates them to failed."""
    from scheduler.job_alerts import sweep_stuck_pending_resumes
    from bson import ObjectId

    sample_id = ObjectId()
    mock_db = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.to_list = AsyncMock(return_value=[
        {"_id": sample_id, "user_id": "u123", "status": "processing"}
    ])
    mock_db.resumes.find.return_value = mock_cursor
    mock_db.resumes.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

    res = await sweep_stuck_pending_resumes(db=mock_db)

    assert res["swept"] == 1
    mock_db.resumes.find.assert_called_once()
    called_query = mock_db.resumes.find.call_args[0][0]
    assert called_query["status"] == {"$in": ["pending", "processing"]}
    mock_db.resumes.update_one.assert_called_once()
    update_arg = mock_db.resumes.update_one.call_args[0]
    assert update_arg[0] == {"_id": sample_id}
    assert update_arg[1]["$set"]["status"] == "failed"


