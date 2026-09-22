"""
Structured Logging — structlog + stdlib integration
"""

import contextvars
import logging
import sys
import uuid
from contextlib import contextmanager
from typing import Optional

import structlog
from core.config import settings

_trace_id_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("trace_id", default=None)


def get_trace_id() -> Optional[str]:
    """Retrieve current context trace ID."""
    return _trace_id_ctx.get()


def set_trace_id(trace_id: Optional[str] = None) -> str:
    """Set and bind trace ID into contextvars and structlog."""
    tid = trace_id or uuid.uuid4().hex[:16]
    _trace_id_ctx.set(tid)
    try:
        structlog.contextvars.bind_contextvars(trace_id=tid)
    except Exception:
        pass
    return tid


def clear_trace_id() -> None:
    """Clear trace ID from current context."""
    _trace_id_ctx.set(None)
    try:
        structlog.contextvars.unbind_contextvars("trace_id")
    except Exception:
        pass


@contextmanager
def trace_context(trace_id: Optional[str] = None):
    """Context manager for tracing execution blocks (parse -> embed -> score -> rank)."""
    tid = set_trace_id(trace_id)
    try:
        yield tid
    finally:
        clear_trace_id()


def add_trace_id(logger, method_name, event_dict):
    """Processor ensuring trace_id and span_id are present on all log records."""
    try:
        from opentelemetry import trace
        current_span = trace.get_current_span()
        if current_span:
            span_ctx = current_span.get_span_context()
            if span_ctx and span_ctx.is_valid:
                if "trace_id" not in event_dict:
                    event_dict["trace_id"] = format(span_ctx.trace_id, "032x")
                if "span_id" not in event_dict:
                    event_dict["span_id"] = format(span_ctx.span_id, "016x")
    except Exception:
        pass

    tid = get_trace_id()
    if tid and "trace_id" not in event_dict:
        event_dict["trace_id"] = tid
    return event_dict


def setup_logging(log_level: Optional[str] = None) -> None:
    if sys.platform == "win32":
        try:
            if hasattr(sys.stdout, "reconfigure"):
                sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            if hasattr(sys.stderr, "reconfigure"):
                sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    level = getattr(logging, (log_level or ("DEBUG" if settings.DEBUG else "INFO")).upper())

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        add_trace_id,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if settings.DEBUG:
        renderer = structlog.dev.ConsoleRenderer(colors=True)
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=shared_processors + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=renderer,
        foreign_pre_chain=shared_processors,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(level)

    # Silence noisy third-party loggers
    for noisy in ["uvicorn.access", "motor", "pymongo"]:
        logging.getLogger(noisy).setLevel(logging.WARNING)
