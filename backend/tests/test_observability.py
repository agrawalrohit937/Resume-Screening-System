"""
Tests for Observability Infrastructure:
- OpenTelemetry distributed tracing & span enrichment
- Structured logging trace_id/span_id injection
- Prometheus metrics collectors & /metrics endpoint
"""

import asyncio
import pytest
from httpx import ASGITransport, AsyncClient
from opentelemetry import trace
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExporter, SpanExportResult

from core.logging import add_trace_id, clear_trace_id, set_trace_id, trace_context
from core.metrics import (
    ATS_MATCH_REQUESTS_TOTAL,
    COPILOT_TOKENS_TOTAL,
    HTTP_REQUESTS_TOTAL,
    QUEUE_JOBS_TOTAL,
    generate_prometheus_metrics,
    get_metrics_content_type,
    record_ats_match_metrics,
    record_copilot_tokens,
    record_http_request_metrics,
    record_queue_job_metrics,
)
from core.telemetry import (
    clear_actor_id,
    get_actor_id,
    get_current_trace_and_span_id,
    init_telemetry,
    set_actor_id,
    trace_span,
)
from services.multi_tenancy.tenant_context import set_current_tenant_id, tenant_context


class InMemorySpanExporter(SpanExporter):
    """Test helper span exporter storing spans in memory."""
    def __init__(self):
        self.spans = []

    def export(self, spans):
        self.spans.extend(spans)
        return SpanExportResult.SUCCESS

    def shutdown(self):
        self.spans.clear()

    def clear(self):
        self.spans.clear()


@pytest.fixture
def memory_exporter():
    exporter = InMemorySpanExporter()
    init_telemetry(service_name="test-careershala", exporter=exporter, use_simple_processor=True, force_reset=True)
    yield exporter
    exporter.clear()


def test_telemetry_span_creation_and_attributes(memory_exporter):
    """Verify trace_span creates valid OpenTelemetry spans enriched with tenant, actor, and request context."""
    with tenant_context("tenant_acme_corp"):
        set_actor_id("actor_recruiter_42")
        set_trace_id("req_abc_123")

        with trace_span("evaluate_candidate_resume", attributes={"candidate_id": "cand_99", "score_mode": "recruiter"}):
            tid, sid = get_current_trace_and_span_id()
            assert tid is not None
            assert len(tid) == 32  # 128-bit hex trace ID
            assert sid is not None
            assert len(sid) == 16  # 64-bit hex span ID

    spans = memory_exporter.spans
    assert len(spans) == 1
    span = spans[0]
    assert span.name == "evaluate_candidate_resume"
    assert span.attributes["tenant.id"] == "tenant_acme_corp"
    assert span.attributes["actor.id"] == "actor_recruiter_42"
    assert span.attributes["request.id"] == "req_abc_123"
    assert span.attributes["candidate_id"] == "cand_99"
    assert span.attributes["score_mode"] == "recruiter"


def test_telemetry_nested_spans(memory_exporter):
    """Verify nested spans inherit trace context correctly."""
    with tenant_context("tenant_gamma"):
        with trace_span("parent_job_pipeline") as parent:
            with trace_span("child_chunking_step") as child:
                pass

    spans = memory_exporter.spans
    assert len(spans) == 2
    child_span = spans[0]
    parent_span = spans[1]

    assert child_span.name == "child_chunking_step"
    assert parent_span.name == "parent_job_pipeline"
    # Child must share parent's trace_id
    assert child_span.context.trace_id == parent_span.context.trace_id
    assert child_span.parent.span_id == parent_span.context.span_id


def test_telemetry_span_records_exception(memory_exporter):
    """Verify exceptions inside trace_span are recorded on the span status without silencing them."""
    with pytest.raises(ValueError, match="Mock parser failure"):
        with trace_span("failing_parse_operation"):
            raise ValueError("Mock parser failure")

    spans = memory_exporter.spans
    assert len(spans) == 1
    span = spans[0]
    assert span.status.status_code == trace.StatusCode.ERROR
    assert "Mock parser failure" in span.status.description


def test_logging_processor_injects_otel_trace_and_span_id(memory_exporter):
    """Verify structlog add_trace_id extracts trace_id and span_id from active OpenTelemetry context."""
    event_dict = {"event": "Processing resume"}

    with trace_span("logging_test_span"):
        enriched = add_trace_id(None, "info", event_dict.copy())
        assert "trace_id" in enriched
        assert "span_id" in enriched
        assert len(enriched["trace_id"]) == 32
        assert len(enriched["span_id"]) == 16


def test_logging_processor_falls_back_to_contextvars():
    """Verify add_trace_id falls back to contextvars trace_id if no OTEL span is active."""
    clear_trace_id()
    with trace_context("custom_trace_id_999"):
        enriched = add_trace_id(None, "info", {"event": "Standalone event"})
        assert enriched.get("trace_id") == "custom_trace_id_999"


def test_prometheus_ats_match_metrics():
    """Verify ATS match metrics record latency and counter increments."""
    record_ats_match_metrics(tenant_id="tenant_beta", duration_sec=0.145, status="success")
    record_ats_match_metrics(tenant_id="tenant_beta", duration_sec=0.512, status="success")

    output = generate_prometheus_metrics().decode("utf-8")
    assert "ats_match_requests_total" in output
    assert 'tenant_id="tenant_beta"' in output
    assert 'status="success"' in output
    assert "ats_match_duration_seconds" in output


def test_prometheus_copilot_token_metrics():
    """Verify copilot token metrics record prompt and completion token counts."""
    record_copilot_tokens(
        model="llama-3.3-70b-versatile",
        provider="groq",
        prompt_tokens=150,
        completion_tokens=85,
    )

    output = generate_prometheus_metrics().decode("utf-8")
    assert "copilot_tokens_total" in output
    assert 'model="llama-3.3-70b-versatile"' in output
    assert 'provider="groq"' in output
    assert 'token_type="prompt"' in output
    assert 'token_type="completion"' in output


def test_prometheus_queue_job_metrics():
    """Verify background queue job metrics record execution durations and totals."""
    record_queue_job_metrics(job_type="bulk_rescore", duration_sec=2.4, status="completed")

    output = generate_prometheus_metrics().decode("utf-8")
    assert "queue_jobs_total" in output
    assert 'job_type="bulk_rescore"' in output
    assert 'status="completed"' in output
    assert "queue_job_duration_seconds" in output


def test_prometheus_http_request_metrics():
    """Verify HTTP request duration and count metrics."""
    record_http_request_metrics(method="POST", endpoint="/api/v1/ats/evaluate", status_code=200, duration_sec=0.082)

    output = generate_prometheus_metrics().decode("utf-8")
    assert "http_requests_total" in output
    assert 'method="POST"' in output
    assert 'endpoint="/api/v1/ats/evaluate"' in output
    assert 'status_code="200"' in output


@pytest.mark.asyncio
async def test_metrics_endpoint_returns_prometheus_format():
    """Verify GET /metrics HTTP endpoint exposes Prometheus metrics with correct Content-Type."""
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/metrics")
        assert response.status_code == 200
        assert "text/plain" in response.headers.get("content-type", "") or "version=0.0.4" in response.headers.get("content-type", "")
        body = response.text
        assert "ats_match_requests_total" in body
        assert "copilot_tokens_total" in body
        assert "queue_jobs_total" in body
