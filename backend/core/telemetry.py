"""
OpenTelemetry Tracing & Telemetry Integration for CareerShala ATS Platform.

Provides:
- Distributed tracing with TracerProvider and span processors.
- Context-enriched span creation (tenant_id, actor_id, request_id).
- Helpers for retrieving active trace_id and span_id across sync/async boundaries.
"""

from __future__ import annotations

import contextvars
from contextlib import contextmanager
from typing import Any, Dict, Generator, Optional, Tuple

import structlog
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    ConsoleSpanExporter,
    SimpleSpanProcessor,
    SpanExporter,
)
from opentelemetry.trace.status import Status, StatusCode

from core.config import settings
from core.logging import get_trace_id, set_trace_id
from services.multi_tenancy.tenant_context import get_current_tenant_id

logger = structlog.get_logger(__name__)

# Context variable for actor/user context
_actor_id_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "actor_id", default=None
)

_tracer_provider: Optional[TracerProvider] = None


def get_actor_id() -> Optional[str]:
    """Retrieve current context actor/user ID."""
    return _actor_id_ctx.get()


def set_actor_id(actor_id: Optional[str]) -> Optional[str]:
    """Set actor ID in current context."""
    _actor_id_ctx.set(actor_id)
    return actor_id


def clear_actor_id() -> None:
    """Clear actor ID from current context."""
    _actor_id_ctx.set(None)


def init_telemetry(
    service_name: Optional[str] = None,
    service_version: Optional[str] = None,
    exporter: Optional[SpanExporter] = None,
    use_simple_processor: bool = False,
    force_reset: bool = False,
) -> TracerProvider:
    """
    Initialize and register global OpenTelemetry TracerProvider.
    """
    global _tracer_provider

    name = service_name or getattr(settings, "APP_NAME", "careershala-ats")
    version = service_version or getattr(settings, "APP_VERSION", "2.1.0")

    resource = Resource.create(
        {
            "service.name": name,
            "service.version": version,
            "deployment.environment": "development" if getattr(settings, "DEBUG", False) else "production",
        }
    )

    provider = TracerProvider(resource=resource)

    if exporter is not None:
        processor = SimpleSpanProcessor(exporter) if use_simple_processor else BatchSpanProcessor(exporter)
        provider.add_span_processor(processor)
    elif getattr(settings, "DEBUG", False) and getattr(settings, "OTEL_CONSOLE_EXPORTER", False):
        provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))

    try:
        if force_reset or _tracer_provider is not None:
            trace._TRACER_PROVIDER = provider
            if hasattr(trace, "_TRACER_PROVIDER_SET_ONCE"):
                trace._TRACER_PROVIDER_SET_ONCE._done = False
        trace.set_tracer_provider(provider)
    except Exception:
        trace._TRACER_PROVIDER = provider

    _tracer_provider = provider
    return provider


def get_tracer(name: str = "careershala") -> trace.Tracer:
    """Get or create a named OpenTelemetry tracer."""
    return trace.get_tracer(name)


def get_current_trace_and_span_id() -> Tuple[Optional[str], Optional[str]]:
    """
    Extract hex-formatted (trace_id, span_id) from active OpenTelemetry span,
    falling back to contextvar trace_id if no active OTEL span context exists.
    """
    current_span = trace.get_current_span()
    if current_span:
        span_ctx = current_span.get_span_context()
        if span_ctx and span_ctx.is_valid:
            trace_id = format(span_ctx.trace_id, "032x")
            span_id = format(span_ctx.span_id, "016x")
            return trace_id, span_id

    # Fallback to contextvar trace_id
    fallback_tid = get_trace_id()
    return fallback_tid, None


@contextmanager
def trace_span(
    name: str,
    attributes: Optional[Dict[str, Any]] = None,
    tracer_name: str = "careershala",
) -> Generator[trace.Span, None, None]:
    """
    Context manager for creating an OpenTelemetry span enriched with
    tenant_id, actor_id, and request_id attributes.
    """
    tracer = get_tracer(tracer_name)
    attrs = dict(attributes or {})

    # Auto-inject tenant context
    if "tenant.id" not in attrs:
        attrs["tenant.id"] = get_current_tenant_id()

    # Auto-inject actor context
    actor_id = attrs.get("actor.id") or get_actor_id()
    if actor_id:
        attrs["actor.id"] = actor_id

    # Auto-inject request/trace context
    req_id = attrs.get("request.id") or get_trace_id()
    if req_id:
        attrs["request.id"] = req_id

    with tracer.start_as_current_span(name, attributes=attrs) as span:
        # Sync structlog / contextvars trace_id if not already set
        span_ctx = span.get_span_context()
        if span_ctx and span_ctx.is_valid and not get_trace_id():
            set_trace_id(format(span_ctx.trace_id, "032x"))

        try:
            yield span
        except Exception as exc:
            span.record_exception(exc)
            span.set_status(Status(StatusCode.ERROR, str(exc)))
            raise
