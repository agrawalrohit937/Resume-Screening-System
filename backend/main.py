"""
AI Career Co-Pilot & Smart ATS + Interview Platform
Entry Point — FastAPI Application Bootstrap
"""
import os
import sys
import time
import asyncio
import traceback # Added for debugging
import structlog

# ── Windows asyncio subprocess fix ───────────────────────────────────────────
# On Windows, uvicorn defaults to SelectorEventLoop which cannot spawn
# subprocesses.  Playwright needs subprocess transport to launch Chromium.
# ProactorEventLoop supports subprocesses and must be set BEFORE the loop
# is created by uvicorn.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
# ─────────────────────────────────────────────────────────────────────────────
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
# --- Existing imports ---
from api.routes import (
    auth, resume, ats, explain, enhance,
    interview, pdf_gen, recruiter, recruiter_v2, analytics, health,
    github, payment
)
from api.routes.users import router as users_routes
from api.routes.recruiter_v2 import router as recruiter_v2_router
from api.routes.fake_detect import router as fake_detect_router
from api.routes.interview_ai import router as interview_ai_router
from api.routes.interview_analytics import router as interview_analytics_router
from api.routes.live_interview import router as live_interview_router
from api.routes.certificates import router as certificates_router
from api.routes.copilot import router as copilot_router
from api.routes.apply_assistant import router as apply_assistant_router
from api.routes.support import router as support_router
from api.routes.gmail_oauth import router as gmail_oauth_router
from api.routes.notifications import router as notifications_router
from api.routes.careers import router as careers_router
from api.routes.admin import router as admin_router
from config.db import connect_db, disconnect_db
from core.config import settings
from core.logging import setup_logging

# Load and Setup
load_dotenv()
setup_logging()
logger = structlog.get_logger(__name__)
print("SERVER IS ALIVE AND WORKING!")
# Prometheus Metrics
REQUEST_COUNT = Counter("http_requests_total", "Total requests", ["method", "endpoint", "status"])
REQUEST_LATENCY = Histogram("http_request_duration_seconds", "Latency", ["method", "endpoint"])

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Career Platform", version=settings.APP_VERSION)
    try:
        await asyncio.wait_for(connect_db(), timeout=15.0)
        logger.info("MongoDB connected")
    except Exception as exc:
        logger.error("Startup failed", error=str(exc))
        raise
    yield
    await disconnect_db()
    logger.info("Shutdown complete")

def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url="/docs",
        lifespan=lifespan,
    )
    # Create profile upload directory if it doesn't exist
    os.makedirs("uploads/profile", exist_ok=True)

    # CORS Middleware — must be added BEFORE static mount so images get CORS headers
    raw_origins = settings.ALLOWED_ORIGINS if isinstance(settings.ALLOWED_ORIGINS, list) else [str(settings.ALLOWED_ORIGINS)]
    cors_origins = list(set(raw_origins) | {
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "https://resume-screening-system-lyart.vercel.app",
        "https://careershala.tech",
        "https://www.careershala.tech",
    })

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_origin_regex=r"https://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=500)

    # Serve uploaded profile photos — mounted AFTER CORS middleware so images
    # served from /static/uploads carry Access-Control-Allow-Origin headers.
    app.mount(
        "/static/uploads",
        StaticFiles(directory="uploads"),
        name="uploads"
    )

    # Security Headers Middleware — strict headers for Lighthouse / OWASP security standards
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdn.jsdelivr.net https://unpkg.com https://storage.googleapis.com https://www.googletagmanager.com https://accounts.google.com; "
            "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com; "
            "worker-src 'self' blob:; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' data: blob: https:; "
            "connect-src 'self' https: ws: wss: https://api.razorpay.com https://lumberjack.razorpay.com https://cdn.jsdelivr.net https://unpkg.com https://storage.googleapis.com https://raw.githubusercontent.com blob: data:; "
            "object-src 'none'; "
            "base-uri 'self';"
        )
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    # Debugging Middleware: Prints every request to the terminal
    @app.middleware("http")
    async def request_debug_middleware(request: Request, call_next):
        print(f"DEBUG: Received {request.method} request to {request.url.path}")
        t = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - t
        REQUEST_COUNT.labels(request.method, request.url.path, response.status_code).inc()
        REQUEST_LATENCY.labels(request.method, request.url.path).observe(duration)
        response.headers["X-Process-Time"] = f"{duration:.4f}s"
        return response

    # GLOBAL EXCEPTION HANDLER: This will catch the 500 errors and print the trace
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        print("!"*60)
        print(f"CRITICAL ERROR DETECTED at {request.url.path}")
        traceback.print_exc() # Prints full error to your terminal
        print("!"*60, flush=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error", "error": str(exc)}
        )

    p = settings.API_V1_PREFIX

    # Routes
    app.include_router(health.router, tags=["Health"])
    app.include_router(certificates_router, prefix=f"{p}/certificates", tags=["Certificates"])
    app.include_router(auth.router, prefix=f"{p}/auth", tags=["Auth"])
    app.include_router(users_routes, prefix=f"{p}/users", tags=["Users"])
    app.include_router(resume.router, prefix=f"{p}/resume", tags=["Resume"])
    app.include_router(ats.router, prefix=f"{p}/ats", tags=["ATS"])
    app.include_router(explain.router, prefix=f"{p}/explain", tags=["Explain"])
    app.include_router(enhance.router, prefix=f"{p}/enhance", tags=["Enhance"])
    app.include_router(pdf_gen.router, prefix=f"{p}/pdf", tags=["PDF"])
    app.include_router(recruiter.router, prefix=f"{p}/recruiter", tags=["Recruiter"])
    app.include_router(recruiter_v2_router, prefix=f"{p}/recruiter/v2", tags=["Recruiter V2"])
    app.include_router(analytics.router, prefix=f"{p}/analytics", tags=["Analytics"])
    app.include_router(fake_detect_router, prefix=f"{p}/fake-detect", tags=["Fake Detect"])
    app.include_router(github.router, prefix=f"{p}/github", tags=["GitHub"])
    app.include_router(interview.router, prefix=f"{p}/interview", tags=["Interview"])
    app.include_router(interview_ai_router, prefix=f"{p}/interview", tags=["AI Interview"])
    app.include_router(live_interview_router, prefix=f"{p}/live-interview", tags=["Live Interview"])
    app.include_router(interview_analytics_router, prefix=f"{p}/interview-analytics", tags=["Interview Analytics"])
    app.include_router(payment.router, prefix=f"{p}/payment", tags=["Payment"])
    app.include_router(copilot_router, prefix=f"{p}/copilot", tags=["AI Copilot"])
    app.include_router(apply_assistant_router, prefix=f"{p}", tags=["Apply Assistant"])
    app.include_router(apply_assistant_router, prefix="/api", tags=["Apply Assistant Direct"])
    app.include_router(support_router, prefix=f"{p}", tags=["Support"])
    app.include_router(gmail_oauth_router, prefix=f"{p}/auth", tags=["Gmail OAuth"])
    app.include_router(notifications_router, prefix=f"{p}/notifications", tags=["Notifications"])
    app.include_router(careers_router, prefix=f"{p}/careers", tags=["Careers"])
    app.include_router(careers_router, prefix="/api", tags=["Careers Direct"])
    app.include_router(admin_router, prefix=f"{p}/admin", tags=["Admin"])

    return app
app = create_application()