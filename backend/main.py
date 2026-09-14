"""
AI Career Co-Pilot & Smart ATS + Interview Platform
FastAPI Application Entry Point & Production Bootstrap
"""
import asyncio
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.openapi.docs import get_redoc_html
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from pydantic import ValidationError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Windows asyncio subprocess fix: ProactorEventLoop required for Playwright subprocesses
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from config.db import connect_db, disconnect_db
from core.config import settings
from core.logging import setup_logging

from api.routes import (
    admin,
    analytics,
    apply_assistant,
    ats,
    auth,
    careers,
    certificates,
    copilot,
    enhance,
    github,
    gmail_oauth,
    health,
    interview,
    interview_ai,
    live_interview,
    notifications,
    payment,
    pdf_gen,
    portfolio,
    recruiter,
    recruiter_v2,
    resume,
    revenue_recovery,
    support,
    users,
)

setup_logging()
logger = structlog.get_logger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["300/minute"])

SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://*.razorpay.com https://cdn.jsdelivr.net https://unpkg.com https://cdn.redoc.ly https://storage.googleapis.com https://www.googletagmanager.com https://accounts.google.com; "
        "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com; "
        "worker-src 'self' blob:; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob: https: https://fastapi.tiangolo.com https://cdn.redoc.ly; "
        "connect-src 'self' https: ws: wss: https://api.razorpay.com https://lumberjack.razorpay.com https://*.razorpay.com https://cdn.jsdelivr.net https://unpkg.com https://storage.googleapis.com https://raw.githubusercontent.com blob: data:; "
        "object-src 'none'; "
        "base-uri 'self';"
    ),
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}

FAVICON_PATH = Path(__file__).resolve().parent.parent / "frontend" / "public" / "favicon.ico"
if not FAVICON_PATH.is_file():
    _alt_favicon = Path(__file__).resolve().parent.parent / "frontend" / "dist" / "favicon.ico"
    if _alt_favicon.is_file():
        FAVICON_PATH = _alt_favicon
    else:
        _backend_logo = Path(__file__).resolve().parent / "certificates" / "assets" / "skill_icons" / "qr_logo.png"
        if _backend_logo.is_file():
            FAVICON_PATH = _backend_logo


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Career Platform", version=settings.APP_VERSION)
    try:
        await asyncio.wait_for(connect_db(), timeout=15.0)
        FastAPICache.init(InMemoryBackend(), prefix="careershaala-cache")
        logger.info("FastAPICache initialized")
    except Exception as exc:
        logger.error("Startup failed", error=str(exc))
        raise
    yield
    try:
        await disconnect_db()
    except Exception as exc:
        logger.error("Shutdown error disconnecting database", error=str(exc))
    logger.info("Shutdown complete")


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url=None,
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )
    app.state.limiter = limiter

    @app.exception_handler(RateLimitExceeded)
    async def custom_rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
        return _rate_limit_exceeded_handler(request, exc)

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        return JSONResponse(
            status_code=400,
            content={"detail": str(exc)},
        )

    @app.exception_handler(ValidationError)
    async def validation_error_handler(request: Request, exc: ValidationError):
        return JSONResponse(
            status_code=422,
            content={"detail": jsonable_encoder(exc.errors())},
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.exception(
            "Unhandled server exception",
            path=request.url.path,
            method=request.method,
            error=str(exc),
        )
        error_detail = {"detail": "Internal Server Error"}
        if settings.DEBUG:
            error_detail["error"] = str(exc)
        return JSONResponse(status_code=500, content=error_detail)

    # CORS & GZip Middlewares
    cors_kwargs = {
        "allow_origins": settings.ALLOWED_ORIGINS,
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
        "expose_headers": ["*"],
    }
    if settings.CORS_ORIGIN_REGEX:
        cors_kwargs["allow_origin_regex"] = settings.CORS_ORIGIN_REGEX

    app.add_middleware(CORSMiddleware, **cors_kwargs)
    app.add_middleware(GZipMiddleware, minimum_size=500)

    # Security Headers Middleware
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.update(SECURITY_HEADERS)
        return response

    # Request Timing Middleware
    @app.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        if settings.DEBUG:
            logger.debug("http_request", method=request.method, path=request.url.path)
        start_time = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start_time
        response.headers["X-Process-Time"] = f"{duration:.4f}s"
        return response

    # Favicon Endpoint
    @app.get("/favicon.ico", include_in_schema=False)
    async def favicon():
        if FAVICON_PATH.is_file():
            media_type = "image/png" if FAVICON_PATH.suffix == ".png" else "image/x-icon"
            return FileResponse(FAVICON_PATH, media_type=media_type)
        return Response(status_code=204)

    # ReDoc Documentation Endpoint (Uses stable pinned CDN to prevent blank page issues)
    @app.get("/redoc", include_in_schema=False)
    async def redoc_html():
        return get_redoc_html(
            openapi_url=app.openapi_url or "/openapi.json",
            title=f"{app.title} - ReDoc",
            redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@2.1.5/bundles/redoc.standalone.js",
            with_google_fonts=True,
        )

    # API Route Registrations
    p = settings.API_V1_PREFIX

    # Health & System
    app.include_router(health.router, tags=["Health"])

    # Authentication & User Management
    app.include_router(auth.router, prefix=f"{p}/auth", tags=["Auth"])
    app.include_router(gmail_oauth.router, prefix=f"{p}/auth", tags=["Gmail OAuth"])
    app.include_router(users.router, prefix=f"{p}/users", tags=["Users"])

    # Resume & ATS Screening
    app.include_router(resume.router, prefix=f"{p}/resume", tags=["Resume"])
    app.include_router(ats.router, prefix=f"{p}/ats", tags=["ATS"])
    app.include_router(enhance.router, prefix=f"{p}/enhance", tags=["Enhance"])
    app.include_router(pdf_gen.router, prefix=f"{p}/pdf", tags=["PDF"])

    # Recruiter Portal
    app.include_router(recruiter.router, prefix=f"{p}/recruiter", tags=["Recruiter"])
    app.include_router(recruiter_v2.router, prefix=f"{p}/recruiter/v2", tags=["Recruiter V2"])

    # Interview Simulation & Analytics
    app.include_router(interview.router, prefix=f"{p}/interview", tags=["Interview"])
    app.include_router(interview_ai.router, prefix=f"{p}/interview", tags=["AI Interview"])
    app.include_router(live_interview.router, prefix=f"{p}/live-interview", tags=["Live Interview"])

    # AI Assistants & Integrations
    app.include_router(copilot.router, prefix=f"{p}/copilot", tags=["AI Copilot"])
    app.include_router(apply_assistant.router, prefix=f"{p}", tags=["Apply Assistant"])
    app.include_router(github.router, prefix=f"{p}/github", tags=["GitHub"])
    app.include_router(portfolio.router, prefix=f"{p}/portfolio", tags=["Portfolio Generator"])
    app.include_router(certificates.router, prefix=f"{p}/certificates", tags=["Certificates"])

    # Commerce, Billing & Growth
    app.include_router(payment.router, prefix=f"{p}/payment", tags=["Payment"])
    app.include_router(revenue_recovery.router, prefix=f"{p}/revenue-recovery", tags=["Revenue Recovery"])
    app.include_router(revenue_recovery.router, prefix=f"{p}/admin/revenue-recovery", tags=["Revenue Recovery Admin"])

    # Operations & Administration
    app.include_router(analytics.router, prefix=f"{p}/analytics", tags=["Analytics"])
    app.include_router(notifications.router, prefix=f"{p}/notifications", tags=["Notifications"])
    app.include_router(careers.router, prefix=f"{p}/careers", tags=["Careers"])
    app.include_router(support.router, prefix=f"{p}", tags=["Support"])
    app.include_router(admin.router, prefix=f"{p}/admin", tags=["Admin"])

    return app


app = create_application()