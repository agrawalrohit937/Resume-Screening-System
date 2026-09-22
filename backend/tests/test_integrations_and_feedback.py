"""
Tests for Workstream 6: Integration Layer + ML Feedback Loop.

Covers:
- HMAC-SHA256 outbound webhook signing and constant-time verification.
- Webhook dispatcher event routing, retry policy, and tenant isolation.
- Job board syndication (Indeed XML feed & LinkedIn JSON feed).
- Calendar sync (RFC 5545 .ics generation, Google & Outlook adapters).
- E-Signature offer letter envelope generation and status parsing.
- Hire outcome ML feedback correlation, point-biserial statistics, and reporting.
"""

from datetime import datetime, timezone
import pytest
import httpx

from models.job import JobModel, WorkMode
from services.integrations.webhook_dispatcher import (
    WebhookDispatcher,
    compute_webhook_signature,
    verify_webhook_signature,
)
from services.integrations.job_board_syndication import (
    generate_indeed_xml_feed,
    generate_linkedin_jobs_json_feed,
)
from services.integrations.calendar_sync import (
    generate_interview_ics,
    GoogleCalendarAdapter,
    OutlookCalendarAdapter,
)
from services.integrations.esignature_handoff import (
    build_offer_letter_envelope,
    parse_esignature_webhook_status,
)
from services.telemetry.drift_detector import (
    correlate_hire_outcomes,
    format_correlation_text_report,
)


# --- 1. HMAC Webhook Dispatcher Tests ---

def test_webhook_hmac_signature_generation_and_verification():
    """Verify HMAC-SHA256 signature computation and constant-time verification."""
    secret = "whsec_live_topsecret998877"
    payload = '{"event":"candidate.hired","candidate_id":"cand_123","tenant_id":"tenant_acme"}'

    signature = compute_webhook_signature(payload, secret)
    assert signature.startswith("sha256=")
    assert len(signature) == 7 + 64  # 'sha256=' + 64-char hex

    # Positive verification
    assert verify_webhook_signature(payload, secret, signature) is True

    # Negative verification: Tampered payload
    tampered_payload = '{"event":"candidate.hired","candidate_id":"cand_999","tenant_id":"tenant_acme"}'
    assert verify_webhook_signature(tampered_payload, secret, signature) is False

    # Negative verification: Wrong secret
    assert verify_webhook_signature(payload, "wrong_secret_key", signature) is False

    # Negative verification: Empty or malformed signature
    assert verify_webhook_signature(payload, secret, "") is False


@pytest.mark.asyncio
async def test_webhook_dispatcher_event_routing_and_tenant_isolation():
    """Verify webhook dispatcher filters by tenant and delivers only to subscribed events."""
    secret = "whsec_test_123"

    # Mock in-memory database
    class MockWebhookCollection:
        def __init__(self):
            self.docs = []

        async def insert_one(self, doc):
            self.docs.append(doc)
            return type("Result", (), {"inserted_id": doc.get("id")})()

        def find(self, query):
            filtered = [
                d for d in self.docs
                if (query.get("tenant_id") is None or d.get("tenant_id") == query.get("tenant_id"))
                and (query.get("is_active") is None or d.get("is_active") == query.get("is_active"))
            ]
            class MockCursor:
                def __init__(self, items):
                    self.items = items
                async def to_list(self, length=100):
                    return self.items[:length]
            return MockCursor(filtered)

    mock_db = type("MockDB", (), {
        "webhook_subscriptions": MockWebhookCollection(),
        "webhook_deliveries": MockWebhookCollection(),
    })()

    # Track received HTTP requests
    captured_requests = []

    def mock_handler(request: httpx.Request):
        captured_requests.append(request)
        return httpx.Response(200, json={"status": "received"})

    mock_transport = httpx.MockTransport(mock_handler)
    mock_http_client = httpx.AsyncClient(transport=mock_transport)

    dispatcher = WebhookDispatcher(db=mock_db, http_client=mock_http_client)

    # Register subscription for Tenant A (subscribing to "job.published" only)
    await dispatcher.register_subscription(
        target_url="https://tenant-a.webhook.site/jobs",
        secret_key=secret,
        events=["job.published"],
        tenant_id="tenant_a",
    )

    # Register subscription for Tenant A (wildcard "*")
    await dispatcher.register_subscription(
        target_url="https://tenant-a.webhook.site/all",
        secret_key=secret,
        events=["*"],
        tenant_id="tenant_a",
    )

    # Register subscription for Tenant B (should NOT receive Tenant A events)
    await dispatcher.register_subscription(
        target_url="https://tenant-b.webhook.site/all",
        secret_key=secret,
        events=["*"],
        tenant_id="tenant_b",
    )

    # Dispatch "job.published" for Tenant A
    results = await dispatcher.dispatch_event(
        event_type="job.published",
        data={"job_id": "job_99", "title": "Staff Backend Engineer"},
        tenant_id="tenant_a",
    )

    # Should deliver to 2 subscriptions of Tenant A, 0 of Tenant B
    assert len(results) == 2
    assert all(r.success for r in results)
    assert len(captured_requests) == 2

    # Verify headers on delivered request
    req = captured_requests[0]
    assert "X-CareerShala-Signature" in req.headers
    assert req.headers["X-CareerShala-Event"] == "job.published"
    assert req.headers["X-CareerShala-Tenant"] == "tenant_a"
    assert "X-CareerShala-Delivery" in req.headers

    # Verify signature on delivered payload
    raw_body = req.content
    sig = req.headers["X-CareerShala-Signature"]
    assert verify_webhook_signature(raw_body, secret, sig) is True

    await mock_http_client.aclose()


@pytest.mark.asyncio
async def test_webhook_dispatcher_retry_on_failure():
    """Verify webhook dispatcher executes exponential retries on server errors."""
    attempts = [0]

    def failing_handler(request: httpx.Request):
        attempts[0] += 1
        if attempts[0] < 3:
            return httpx.Response(500, text="Internal Server Error")
        return httpx.Response(200, json={"status": "recovered"})

    mock_transport = httpx.MockTransport(failing_handler)
    mock_http_client = httpx.AsyncClient(transport=mock_transport)

    class MockCollection:
        async def insert_one(self, doc):
            pass
        def find(self, query):
            class MockCursor:
                async def to_list(self, length=100):
                    return [{
                        "id": "sub_retry_test",
                        "tenant_id": "tenant_retry",
                        "target_url": "https://flaky.webhook.site/endpoint",
                        "secret_key": "sec_123",
                        "events": ["*"],
                        "is_active": True,
                    }]
            return MockCursor()

    mock_db = type("MockDB", (), {
        "webhook_subscriptions": MockCollection(),
        "webhook_deliveries": MockCollection(),
    })()

    dispatcher = WebhookDispatcher(db=mock_db, http_client=mock_http_client)

    results = await dispatcher.dispatch_event(
        event_type="candidate.hired",
        data={"candidate_id": "cand_77"},
        tenant_id="tenant_retry",
        max_retries=3,
        base_backoff_sec=0.01,  # Fast for unit tests
    )

    assert len(results) == 1
    assert results[0].success is True
    assert results[0].attempts == 3

    await mock_http_client.aclose()


# --- 2. Job Board Syndication Tests ---

def test_indeed_xml_feed_generation():
    """Verify generation of valid Indeed XML feed containing CDATA and job elements."""
    job = JobModel(
        id="65f2a1b9c8e1d2001f3e8a91",
        title="Senior Python Backend Architect",
        company_name="CareerShala Tech",
        location="Bengaluru, Karnataka",
        jd_text_raw="Looking for high concurrency FastAPI & distributed systems experience.",
        salary_range="₹35 LPA - ₹50 LPA",
        work_mode=WorkMode.REMOTE.value,
        status="open",
        created_by="user_recruiter",
    )

    xml_output = generate_indeed_xml_feed([job], publisher_name="CareerShala Enterprise")

    assert "<?xml version='1.0' encoding='utf-8'?>" in xml_output
    assert "<source>" in xml_output
    assert "<publisher>CareerShala Enterprise</publisher>" in xml_output
    assert "<title>Senior Python Backend Architect</title>" in xml_output
    assert "<company>CareerShala Tech</company>" in xml_output
    assert "<![CDATA[Looking for high concurrency FastAPI & distributed systems experience.]]>" in xml_output
    assert "<remotetype>FULLY_REMOTE</remotetype>" in xml_output
    assert "<salary>₹35 LPA - ₹50 LPA</salary>" in xml_output


def test_linkedin_jobs_json_feed_generation():
    """Verify generation of schema.org/JobPosting JSON-LD for LinkedIn / Google for Jobs."""
    job = JobModel(
        id="job_link_101",
        title="AI Engineer (LLM & RAG)",
        company_name="CareerShala AI Labs",
        location="San Francisco, CA",
        jd_text_raw="Build hybrid RAG copilot with vector reranking.",
        salary_range="$160,000 - $210,000",
        work_mode=WorkMode.HYBRID.value,
        status="open",
        created_by="user_recruiter",
    )

    feed = generate_linkedin_jobs_json_feed([job])
    assert len(feed) == 1
    posting = feed[0]

    assert posting["@context"] == "https://schema.org/"
    assert posting["@type"] == "JobPosting"
    assert posting["title"] == "AI Engineer (LLM & RAG)"
    assert posting["hiringOrganization"]["name"] == "CareerShala AI Labs"
    assert posting["directApply"] is True
    assert posting["baseSalary"]["currency"] == "USD"
    assert posting["baseSalary"]["value"]["value"] == "$160,000 - $210,000"


# --- 3. Calendar Sync Tests ---

def test_rfc5545_ics_calendar_generation():
    """Verify RFC 5545 iCalendar (.ics) syntax formatting for interview invitations."""
    start = datetime(2026, 10, 15, 14, 30, tzinfo=timezone.utc)

    ics_content = generate_interview_ics(
        summary="CareerShala Round 2 Technical: Distributed Systems",
        start_time=start,
        duration_minutes=60,
        description="Interview with Lead Architect.\nPlease join with microphone and camera ready.",
        location="CareerShala Virtual Meeting Room",
        organizer_name="CareerShala Hiring Team",
        organizer_email="hiring@careershala.ai",
        attendee_name="Alex Mercer",
        attendee_email="alex.mercer@example.com",
    )

    assert "BEGIN:VCALENDAR" in ics_content
    assert "VERSION:2.0" in ics_content
    assert "METHOD:REQUEST" in ics_content
    assert "BEGIN:VEVENT" in ics_content
    assert "DTSTART:20261015T143000Z" in ics_content
    assert "DTEND:20261015T153000Z" in ics_content
    assert "SUMMARY:CareerShala Round 2 Technical: Distributed Systems" in ics_content
    assert "ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=Alex Mercer:mailto:alex.mercer@example.com" in ics_content
    assert "END:VEVENT" in ics_content
    assert "END:VCALENDAR" in ics_content


@pytest.mark.asyncio
async def test_calendar_adapters_google_and_outlook():
    """Verify Google and Outlook Calendar sync adapter stubs."""
    gcal = GoogleCalendarAdapter()
    auth_url = gcal.get_authorization_url("https://app.careershala.ai/oauth/callback", "state_123")
    assert "accounts.google.com" in auth_url
    assert "scope=https://www.googleapis.com/auth/calendar.events" in auth_url

    start = datetime(2026, 11, 1, 10, 0, tzinfo=timezone.utc)
    event_res = await gcal.create_event("AI Interview", start, duration_minutes=45)
    assert event_res["success"] is True
    assert event_res["provider"] == "google_calendar"
    assert "meet.google.com" in event_res["conference_url"]

    outlook = OutlookCalendarAdapter()
    ms_auth = outlook.get_authorization_url("https://app.careershala.ai/oauth/callback", "state_456")
    assert "login.microsoftonline.com" in ms_auth

    ms_res = await outlook.create_event("Leadership Interview", start, duration_minutes=30)
    assert ms_res["success"] is True
    assert ms_res["provider"] == "outlook_calendar"
    assert "teams.microsoft.com" in ms_res["teams_url"]


# --- 4. E-Signature Handoff Tests ---

def test_offer_letter_envelope_creation_and_tab_placement():
    """Verify DocuSign-compatible offer letter envelope generation."""
    envelope = build_offer_letter_envelope(
        candidate_name="Jane Doe",
        candidate_email="jane.doe@example.com",
        job_title="Staff ML Engineer",
        company_name="InnovateAI Corp",
        offer_salary="$185,000 / year",
        start_date="2026-11-01",
        tenant_id="tenant_innovate",
    )

    assert envelope["status"] == "sent"
    assert envelope["tenantId"] == "tenant_innovate"
    assert envelope["emailSubject"] == "Offer of Employment: Staff ML Engineer at InnovateAI Corp"

    signer = envelope["recipients"]["signers"][0]
    assert signer["name"] == "Jane Doe"
    assert signer["email"] == "jane.doe@example.com"

    tabs = signer["tabs"]
    assert len(tabs["signHereTabs"]) >= 1
    assert tabs["signHereTabs"][0]["tabLabel"] == "Candidate Signature"
    assert tabs["textTabs"][0]["value"] == "$185,000 / year"


def test_esignature_webhook_status_parsing():
    """Verify parsing of DocuSign and HelloSign webhook callback events."""
    completed_payload = {
        "event": "envelope-completed",
        "envelopeId": "env_991823746",
        "timestamp": "2026-10-15T18:00:00Z",
    }
    res_completed = parse_esignature_webhook_status(completed_payload)
    assert res_completed["normalized_status"] == "completed"
    assert res_completed["is_signed"] is True
    assert res_completed["is_rejected"] is False

    declined_payload = {
        "event": "envelope-declined",
        "envelopeId": "env_991823746",
    }
    res_declined = parse_esignature_webhook_status(declined_payload)
    assert res_declined["normalized_status"] == "declined"
    assert res_declined["is_signed"] is False
    assert res_declined["is_rejected"] is True


# --- 5. Hire Outcome ML Feedback Correlation Tests ---

def test_hire_outcome_correlation_and_report_generation():
    """Verify Point-Biserial correlation calculation, bracket conversions, and recommendation engine."""
    # Synthetic candidate data: High scorers hired, low scorers rejected
    sample_records = [
        {"final_score": 94.0, "hire_outcome": "hired"},
        {"final_score": 91.5, "hire_outcome": "hired"},
        {"final_score": 88.0, "hire_outcome": "hired"},
        {"final_score": 85.0, "hire_outcome": "hired"},
        {"final_score": 82.0, "hire_outcome": "probation_passed"},
        {"final_score": 79.0, "hire_outcome": "rejected"},
        {"final_score": 74.0, "hire_outcome": "hired"},
        {"final_score": 68.0, "hire_outcome": "rejected"},
        {"final_score": 62.0, "hire_outcome": "rejected"},
        {"final_score": 55.0, "hire_outcome": "rejected"},
        {"final_score": 48.0, "hire_outcome": "rejected"},
        {"final_score": 42.0, "hire_outcome": "interview_failed"},
    ]

    report = correlate_hire_outcomes(sample_records)

    assert report["total_evaluated_samples"] == 12
    assert report["hired_count"] == 6
    assert report["rejected_count"] == 6
    assert report["point_biserial_correlation"] > 0.60  # Strong positive correlation
    assert report["hired_score_mean"] > report["rejected_score_mean"]
    assert report["calibration_status"] == "healthy"

    # Verify bracket conversion rates
    top_bracket = report["bracket_conversions"]["90-100"]
    low_bracket = report["bracket_conversions"]["0-59"]
    assert top_bracket["conversion_rate_pct"] == 100.0
    assert low_bracket["conversion_rate_pct"] == 0.0

    # Format text report
    text_report = format_correlation_text_report(report)
    assert "CAREERSHALA ATS - HIRE OUTCOME ML FEEDBACK REPORT" in text_report
    assert "Point-Biserial Correlation" in text_report
    assert "CALIBRATION STATUS: HEALTHY" in text_report
