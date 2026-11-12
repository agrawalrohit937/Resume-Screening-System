"""Unit and Integration Tests for Ecosystem Integrations (Task 5.4).
CareerShala ATS v2.0.0.
"""

import pytest
from xml.etree import ElementTree as ET

from services.integrations.webhooks import WebhookService, compute_webhook_signature
from services.integrations.syndication import generate_indeed_xml_feed, generate_google_job_posting_ld_json
from schemas.job_schema import JobModel, WorkMode
from services.multi_tenancy.tenant_context import tenant_context


@pytest.mark.asyncio
async def test_webhook_lifecycle_and_hmac_verification():
    webhook_service = WebhookService()

    with tenant_context("tenant_acme"):
        # 1. Register subscription
        secret = "super_secret_enterprise_token_123"
        sub = await webhook_service.register_subscription(
            target_url="https://api.acme.corp/webhooks/careerpilot",
            secret_key=secret,
            events=["candidate.scored", "application.status_changed"]
        )
        assert sub.id is not None
        assert sub.tenant_id == "tenant_acme"

        # 2. Dispatch subscribed event
        deliveries = await webhook_service.dispatch_event(
            event_type="candidate.scored",
            data={"application_id": "app_123", "candidate_id": "cand_456", "score": 92.4}
        )
        assert len(deliveries) == 1
        delivery = deliveries[0]
        assert delivery.success is True
        assert delivery.status_code == 200
        assert delivery.signature_header.startswith("sha256=")

        # 3. Verify HMAC signature computation determinism
        sig = compute_webhook_signature('{"test": 1}', secret)
        assert sig.startswith("sha256=")
        assert sig == compute_webhook_signature('{"test": 1}', secret)

        # 4. Dispatch un-subscribed event (should not deliver to this sub)
        unsub_deliveries = await webhook_service.dispatch_event(
            event_type="billing.invoice_paid",
            data={"amount": 500}
        )
        assert len(unsub_deliveries) == 0


def test_job_syndication_indeed_xml_and_google_schema():
    job1 = JobModel(
        _id="job_sync_1",
        company_name="CloudScale AI",
        title="Senior Distributed Systems Engineer",
        jd_text_raw="We are seeking an expert in distributed streaming, Raft consensus, and Rust.",
        required_skills=["Rust", "Distributed Systems", "Raft"],
        min_years=5.0,
        location="Austin, TX",
        work_mode=WorkMode.REMOTE.value,
        salary_range="$160,000 - $210,000",
        status="open",
        company_website="https://cloudscale.ai"
    )
    job1.id = "job_sync_1"

    job2_closed = JobModel(
        _id="job_sync_2",
        company_name="CloudScale AI",
        title="Closed Position",
        jd_text_raw="Closed job description",
        status="closed"
    )
    job2_closed.id = "job_sync_2"

    # 1. Test Indeed XML Feed
    xml_feed = generate_indeed_xml_feed([job1, job2_closed], publisher_name="CloudScale ATS")
    assert "<?xml" in xml_feed
    assert "<publisher>CloudScale ATS</publisher>" in xml_feed
    assert "<title>Senior Distributed Systems Engineer</title>" in xml_feed
    assert "<company>CloudScale AI</company>" in xml_feed
    assert "<referencenumber>job_sync_1</referencenumber>" in xml_feed
    assert "<remotetype>FULLY_REMOTE</remotetype>" in xml_feed
    assert "Closed Position" not in xml_feed  # Closed job filtered out

    # Verify XML parses without syntax errors
    root = ET.fromstring(xml_feed.encode("utf-8"))
    assert root.tag == "source"
    assert len(root.findall("job")) == 1

    # 2. Test Google for Jobs Schema.org JSON-LD
    ld_json = generate_google_job_posting_ld_json(job1)
    assert ld_json["@context"] == "https://schema.org/"
    assert ld_json["@type"] == "JobPosting"
    assert ld_json["title"] == "Senior Distributed Systems Engineer"
    assert ld_json["hiringOrganization"]["name"] == "CloudScale AI"
    assert ld_json["jobLocationType"] == "TELECOMMUTE"
    assert ld_json["directApply"] is True
    assert ld_json["baseSalary"]["value"]["value"] == "$160,000 - $210,000"
