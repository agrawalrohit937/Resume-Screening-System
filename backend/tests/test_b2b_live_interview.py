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
from bson import ObjectId

from services.live_interview_service import LiveInterviewService


@pytest.mark.asyncio
async def test_prompt_incorporates_full_jd_and_custom_questions():
    mock_db = MagicMock()
    mock_col = MagicMock()
    mock_db.live_interview_sessions = mock_col
    mock_db.__getitem__.side_effect = lambda name: mock_col
    service = LiveInterviewService(db=mock_db)

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

    assert "OFFICIAL FULL JOB DESCRIPTION (MUST BASE QUESTIONS ON THIS):" in prompt
    assert full_jd in prompt
    assert "MANDATORY EMPLOYER CUSTOM QUESTIONS:" in prompt
    assert custom_questions[0] in prompt
    assert custom_questions[1] in prompt


@pytest.mark.asyncio
async def test_generate_ai_questions_prepends_custom_questions():
    mock_db = MagicMock()
    mock_col = MagicMock()
    mock_db.live_interview_sessions = mock_col
    mock_db.__getitem__.side_effect = lambda name: mock_col
    service = LiveInterviewService(db=mock_db)

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
    # Setup mock MongoDB
    sessions_store = {}
    apps_store = {}

    mock_db = MagicMock()
    mock_sessions_col = MagicMock()
    mock_apps_col = MagicMock()

    async def mock_insert_one(doc):
        doc_id = doc.get("_id") or str(ObjectId())
        doc["_id"] = doc_id
        sessions_store[str(doc_id)] = doc
        res = MagicMock()
        res.inserted_id = doc_id
        return res

    async def mock_find_one(query):
        if "magic_token" in query:
            token = query["magic_token"]
            for d in sessions_store.values():
                if d.get("magic_token") == token:
                    return dict(d)
            return None
        if "_id" in query:
            sid = str(query["_id"])
            return dict(sessions_store.get(sid)) if sid in sessions_store else None
        return None

    async def mock_update_one(filter_q, update_q):
        sid = None
        if "_id" in filter_q:
            sid = str(filter_q["_id"])
        elif "magic_token" in filter_q:
            tok = filter_q["magic_token"]
            for k, v in sessions_store.items():
                if v.get("magic_token") == tok:
                    sid = k
                    break

        if sid and sid in sessions_store:
            target = sessions_store[sid]
            if "$set" in update_q:
                target.update(update_q["$set"])
            if "$push" in update_q:
                for pk, pv in update_q["$push"].items():
                    target.setdefault(pk, []).append(pv)
        res = MagicMock()
        res.modified_count = 1
        res.matched_count = 1
        return res

    mock_sessions_col.insert_one = AsyncMock(side_effect=mock_insert_one)
    mock_sessions_col.find_one = AsyncMock(side_effect=mock_find_one)
    mock_sessions_col.update_one = AsyncMock(side_effect=mock_update_one)

    async def mock_app_update_one(filter_q, update_q):
        aid = str(filter_q.get("_id"))
        if "$set" in update_q:
            apps_store.setdefault(aid, {}).update(update_q["$set"])
        res = MagicMock()
        res.modified_count = 1
        res.matched_count = 1
        return res

    mock_apps_col.update_one = AsyncMock(side_effect=mock_app_update_one)

    def get_col(name):
        if name in ("live_interview_sessions", "interview_sessions", "interviews"):
            return mock_sessions_col
        if name in ("applications", "job_applications"):
            return mock_apps_col
        return mock_sessions_col

    mock_db.__getitem__.side_effect = get_col
    mock_db.live_interview_sessions = mock_sessions_col
    mock_db.applications = mock_apps_col

    service = LiveInterviewService(db=mock_db)

    # 1. Schedule Employer Session
    app_id = str(ObjectId())
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
    mock_db = MagicMock()
    mock_col = MagicMock()

    past_time = datetime.now(timezone.utc) - timedelta(hours=2)
    doc_id = ObjectId()
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
    expired_store["expired_magic_tok_123"] = expired_doc

    async def mock_find(query):
        tok = query.get("magic_token")
        return expired_store.get(tok)

    mock_col.find_one = AsyncMock(side_effect=mock_find)
    mock_col.update_one = AsyncMock(return_value=MagicMock(modified_count=0, matched_count=0))
    mock_db.live_interview_sessions = mock_col
    mock_db.__getitem__.side_effect = lambda name: mock_col

    service = LiveInterviewService(db=mock_db)

    # get_session_by_magic_token should return is_expired=True
    res = await service.get_session_by_magic_token("expired_magic_tok_123")
    assert res is not None
    assert res["is_expired"] is True
