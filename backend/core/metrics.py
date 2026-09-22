"""
Prometheus Metrics Instrumentation for CareerShala ATS Platform.

Defines standard collectors and helpers for:
- ATS matching latency & throughput
- Copilot token usage & LLM provider metrics
- Asynchronous task queue durations & job statuses
- HTTP request metrics
"""

from __future__ import annotations

import time
from typing import Any, Callable, Dict, Optional

import prometheus_client
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, REGISTRY
import structlog

logger = structlog.get_logger(__name__)


def _get_or_create_counter(name: str, documentation: str, labelnames: list[str]) -> Counter:
    """Retrieve existing counter from registry or create a new one to avoid duplicate registration."""
    if name in REGISTRY._names_to_collectors:
        collector = REGISTRY._names_to_collectors[name]
        if isinstance(collector, Counter):
            return collector
    return Counter(name, documentation, labelnames)


def _get_or_create_histogram(
    name: str,
    documentation: str,
    labelnames: list[str],
    buckets: tuple[float, ...] = Histogram.DEFAULT_BUCKETS,
) -> Histogram:
    """Retrieve existing histogram from registry or create a new one."""
    if name in REGISTRY._names_to_collectors:
        collector = REGISTRY._names_to_collectors[name]
        if isinstance(collector, Histogram):
            return collector
    return Histogram(name, documentation, labelnames, buckets=buckets)


# --- Metric Definitions ---

ATS_MATCH_DURATION_SECONDS = _get_or_create_histogram(
    "ats_match_duration_seconds",
    "Latency of ATS resume matching and scoring engine in seconds",
    ["tenant_id", "status"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
)

ATS_MATCH_REQUESTS_TOTAL = _get_or_create_counter(
    "ats_match_requests_total",
    "Total ATS resume match evaluation requests",
    ["tenant_id", "status"],
)

COPILOT_TOKENS_TOTAL = _get_or_create_counter(
    "copilot_tokens_total",
    "Total LLM tokens consumed by AI Co-pilot turns",
    ["model", "provider", "token_type"],
)

QUEUE_JOB_DURATION_SECONDS = _get_or_create_histogram(
    "queue_job_duration_seconds",
    "Execution duration of background queue jobs in seconds",
    ["job_type", "status"],
    buckets=(0.1, 0.5, 1.0, 5.0, 15.0, 30.0, 60.0, 120.0, 300.0),
)

QUEUE_JOBS_TOTAL = _get_or_create_counter(
    "queue_jobs_total",
    "Total asynchronous background queue jobs processed",
    ["job_type", "status"],
)

HTTP_REQUEST_DURATION_SECONDS = _get_or_create_histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint", "status_code"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

HTTP_REQUESTS_TOTAL = _get_or_create_counter(
    "http_requests_total",
    "Total HTTP requests received",
    ["method", "endpoint", "status_code"],
)


# --- Helper Functions ---

def record_ats_match_metrics(
    tenant_id: str,
    duration_sec: float,
    status: str = "success",
) -> None:
    """Record ATS scoring duration and request count."""
    try:
        tid = tenant_id or "default"
        ATS_MATCH_DURATION_SECONDS.labels(tenant_id=tid, status=status).observe(max(0.0, duration_sec))
        ATS_MATCH_REQUESTS_TOTAL.labels(tenant_id=tid, status=status).inc()
    except Exception as exc:
        logger.debug("Failed to record ATS match metrics", error=str(exc))


def record_copilot_tokens(
    model: str,
    provider: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
) -> None:
    """Record LLM token consumption metrics."""
    try:
        m = model or "unknown"
        p = provider or "unknown"
        if prompt_tokens > 0:
            COPILOT_TOKENS_TOTAL.labels(model=m, provider=p, token_type="prompt").inc(prompt_tokens)
        if completion_tokens > 0:
            COPILOT_TOKENS_TOTAL.labels(model=m, provider=p, token_type="completion").inc(completion_tokens)
    except Exception as exc:
        logger.debug("Failed to record copilot token metrics", error=str(exc))


def record_queue_job_metrics(
    job_type: str,
    duration_sec: float,
    status: str = "completed",
) -> None:
    """Record async background queue task duration and completion count."""
    try:
        jtype = job_type or "unknown"
        QUEUE_JOB_DURATION_SECONDS.labels(job_type=jtype, status=status).observe(max(0.0, duration_sec))
        QUEUE_JOBS_TOTAL.labels(job_type=jtype, status=status).inc()
    except Exception as exc:
        logger.debug("Failed to record queue job metrics", error=str(exc))


def record_http_request_metrics(
    method: str,
    endpoint: str,
    status_code: int,
    duration_sec: float,
) -> None:
    """Record incoming HTTP request metrics."""
    try:
        code_str = str(status_code)
        ep = endpoint or "/"
        m = method.upper()
        HTTP_REQUEST_DURATION_SECONDS.labels(method=m, endpoint=ep, status_code=code_str).observe(max(0.0, duration_sec))
        HTTP_REQUESTS_TOTAL.labels(method=m, endpoint=ep, status_code=code_str).inc()
    except Exception as exc:
        logger.debug("Failed to record HTTP request metrics", error=str(exc))


def generate_prometheus_metrics() -> bytes:
    """Generate Prometheus metric representation in latest text exposition format."""
    return prometheus_client.generate_latest(REGISTRY)


def get_metrics_content_type() -> str:
    """Get Prometheus exposition format Content-Type."""
    return CONTENT_TYPE_LATEST
