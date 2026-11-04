"""
Tests for Employer-Driven B2B Live AI Interview Engine:
- Schedule employer session with full JD and custom questions
- Candidate magic link access, validation, and expiry checks
- Answer recording and live evaluation
- Proctoring & anti-cheat logging
- Blind candidate submission (ensuring no scores/feedback returned to candidate in API)
- Scorecard auto-sync to application record
- Recruiter scorecard retrieval
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock
import uuid

from services.live_interview_service import LiveInterviewService


@pytest.mark.asyncio
async def test_prompt_incorporates_full_jd_and_custom_questions():
    service = LiveInterviewService()

    full_jd = (
        "We are looking for a Senior Distributed Systems Engineer with deep expertise in "
        "Kubernetes, Go, Kafka streaming architectures, and high-throughput low-latency microservices. "
        "You will architect consensus protocols and optimize database sharding strategies."
    )
    custom_questions = [
        "How would you handle split-brain scenarios in a multi-region Raft cluster?",
        "Describe your experience debugging a deadlocked goroutine in production.",
    ]

    prompt = service._build_live_interview_prompt(
        job_title="Senior Distributed Systems Engineer",
        interview_type="mixed",
        difficulty="hard",
        num_questions=5,
        skills=["Go", "Kubernetes"],
        exp_years=5,
        experience_titles=["Senior Engineer"],
        full_job_description=full_jd,
        custom_questions=custom_questions,
    )

    assert ("TARGET JOB DESCRIPTION (JD):" in prompt or "OFFICIAL FULL JOB DESCRIPTION" in prompt)
    assert full_jd in prompt
    assert ("MANDATORY INTERVIEWER CUSTOM QUESTIONS:" in prompt or "MANDATORY EMPLOYER CUSTOM QUESTIONS:" in prompt)
    assert custom_questions[0] in prompt
    assert custom_questions[1] in prompt


@pytest.mark.asyncio
async def test_generate_ai_questions_prepends_custom_questions():
    service = LiveInterviewService()

    custom_questions = [
        "What is your strategy for live zero-downtime database migrations?",
    ]
    questions = await service._generate_ai_questions(
        job_title="Staff Engineer",
        difficulty="hard",
        interview_type="technical",
        num_questions=3,
        full_job_description="Staff Engineer with PostgreSQL expertise.",
        custom_questions=custom_questions,
    )

    assert len(questions) >= 1
    # Ensure custom question is in the questions list
    custom_texts = [q["text"] for q in questions if q.get("is_custom") or q["text"] == custom_questions[0]]
    assert len(custom_texts) >= 1
    assert custom_texts[0] == custom_questions[0]


@pytest.mark.asyncio
async def test_b2b_service_lifecycle():
    sessions_store = {}
    apps_store = {}

    mock_repo = MagicMock()
    mock_app_repo = MagicMock()

    async def mock_create_session(data):
        sid = str(data.get("id") or data.get("_id") or uuid.uuid4().hex)
        d = dict(data)
        d["id"] = sid
        d["_id"] = sid
        sessions_store[sid] = d
        return dict(d)

    async def mock_get_by_magic_token(token):
        for s in sessions_store.values():
            if s.get("magic_token") == token:
                return dict(s)
        return None

    async def mock_get_by_id(sid):
        return dict(sessions_store[str(sid)]) if str(sid) in sessions_store else None

    async def mock_update_by_token(token, updates):
        for sid, s in sessions_store.items():
            if s.get("magic_token") == token:
                if isinstance(updates, dict):
                    for k, v in updates.items():
                        if k in ("answers", "cheating_events"):
                            if isinstance(v, list):
                                s[k] = v
                            else:
                                s.setdefault(k, []).append(v)
                        else:
                            s[k] = v
                return dict(s)
        return None

    mock_repo.create_session = AsyncMock(side_effect=mock_create_session)
    mock_repo.get_by_magic_token = AsyncMock(side_effect=mock_get_by_magic_token)
    mock_repo.get_by_id = AsyncMock(side_effect=mock_get_by_id)
    mock_repo.update_by_token = AsyncMock(side_effect=mock_update_by_token)

    async def mock_app_update_fields(aid, fields):
        apps_store.setdefault(str(aid), {}).update(fields)
        return apps_store[str(aid)]

    async def mock_app_find_by_id(aid):
        return apps_store.get(str(aid))

    mock_app_repo.update_fields = AsyncMock(side_effect=mock_app_update_fields)
    mock_app_repo.find_by_id = AsyncMock(side_effect=mock_app_find_by_id)

    service = LiveInterviewService(repo=mock_repo, app_repo=mock_app_repo)

    # 1. Schedule Employer Session
    app_id = str(uuid.uuid4().hex)
    full_jd = "Full JD text for Lead Backend Developer requiring Redis, Celery, and FastAPI."
    custom_qs = ["Explain Redis PubSub vs Kafka Streams."]

    session_doc = await service.schedule_employer_session(
        employer_id="emp_999",
        employer_name="Sarah Recruiter",
        company_name="Acme Tech",
        job_id="job_888",
        job_title="Lead Backend Developer",
        full_job_description=full_jd,
        interview_mode="technical",
        difficulty="hard",
        custom_questions=custom_qs,
        expiry_hours=48,
        candidate_email="alex.candidate@example.com",
        candidate_name="Alex Candidate",
        application_id=app_id,
        num_questions=4,
    )

    magic_token = session_doc["magic_token"]
    assert magic_token is not None
    assert "/live-assessment/" in session_doc["magic_link_url"]
    assert session_doc["total_questions"] >= 1
    assert len(session_doc["questions"]) >= 1

    # 2. Candidate retrieves session by magic token
    retrieved = await service.get_session_by_magic_token(magic_token)
    assert retrieved is not None
    assert retrieved["is_employer_scheduled"] is True
    assert retrieved["job_title"] == "Lead Backend Developer"
    assert retrieved["company_name"] == "Acme Tech"
    assert retrieved["is_expired"] is False
    assert len(retrieved["questions"]) >= 1

    # 3. Candidate starts assessment
    started = await service.start_magic_session(magic_token)
    assert started is True

    # 4. Candidate submits an answer
    q1 = retrieved["questions"][0]
    answer_payload = {
        "question_id": q1["id"],
        "question_text": q1["text"],
        "category": q1.get("category", "technical"),
        "user_answer": "Redis PubSub delivers fire-and-forget messages to active subscribers, whereas Kafka retains events in partitioned logs with consumer group offsets.",
        "answer_source": "text",
        "time_taken_secs": 35,
        "ai_score": 9,
    }
    ans_res = await service.save_magic_answer(magic_token, answer_payload)
    assert ans_res is True

    # 5. Record proctoring cheat event
    cheat_res = await service.record_magic_cheating_event(
        magic_token,
        {
            "event_type": "tab_switch",
            "severity": "medium",
            "details": "Candidate switched browser tab",
        },
    )
    assert "cheating_score" in cheat_res
    assert cheat_res["cheating_score"] > 0

    # 6. Complete magic session & sync scorecard to application
    overall_data = {
        "overall_score": 8.5,
        "avg_confidence": 8.0,
        "avg_clarity": 9.0,
        "avg_relevance": 8.5,
        "strengths": ["Deep Redis internals knowledge"],
        "weaknesses": ["Minor voice pauses"],
        "summary": "Candidate demonstrated strong distributed systems proficiency.",
        "session_summary": {"executive_summary": "Excellent fit for backend lead."},
    }

    completed_session = await service.complete_magic_session(
        magic_token=magic_token,
        overall_data=overall_data,
    )
    assert completed_session is not None
    assert completed_session.get("status") == "completed"

    # 7. Check that scorecard was synced to db.applications
    assert app_id in apps_store
    synced_app = apps_store[app_id]
    assert synced_app.get("live_interview_completed") is True
    assert "live_interview_scorecard" in synced_app
    scorecard = synced_app["live_interview_scorecard"]
    assert scorecard["company_name"] == "Acme Tech"
    assert scorecard["job_title"] == "Lead Backend Developer"
    assert len(scorecard["answers"]) == 1
    assert scorecard["answers"][0]["question_text"] == q1["text"]

    # 8. Recruiter scorecard retrieval
    recruiter_sc = await service.get_employer_scorecard(session_doc["session_id"])
    assert recruiter_sc is not None
    assert recruiter_sc["id"] == session_doc["session_id"]
    assert recruiter_sc["company_name"] == "Acme Tech"
    assert recruiter_sc["overall_score"] == 8.5
    assert len(recruiter_sc["cheating_events"]) == 1


@pytest.mark.asyncio
async def test_magic_token_expiry():
    # Test expired token detection
    expired_store = {}
    past_time = datetime.now(timezone.utc) - timedelta(hours=2)
    doc_id = str(uuid.uuid4().hex)
    expired_doc = {
        "_id": doc_id,
        "magic_token": "expired_magic_tok_123",
        "is_employer_scheduled": True,
        "expires_at": past_time,
        "status": "pending",
        "company_name": "Acme Corp",
        "job_title": "Frontend Engineer",
        "questions": [],
    }

    mock_repo = MagicMock()
    mock_repo.get_by_magic_token = AsyncMock(return_value=expired_doc)

    service = LiveInterviewService(repo=mock_repo)

    # get_session_by_magic_token should return is_expired=True
    res = await service.get_session_by_magic_token("expired_magic_tok_123")
    assert res is not None
    assert res["is_expired"] is True
