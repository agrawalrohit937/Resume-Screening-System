"""Health Check Routes — Pure PostgreSQL Monitoring"""
from datetime import datetime, timezone
from fastapi import APIRouter
from core.config import settings

router = APIRouter()


@router.get("/health", tags=["Health"])
async def health_check():
    pg_status = "ok"
    try:
        from config.db import get_pg_engine
        from sqlalchemy import text
        engine = get_pg_engine()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1;"))
    except Exception:
        pg_status = "degraded"

    overall_status = "ok" if pg_status == "ok" else "degraded"

    return {
        "status": overall_status,
        "version": settings.APP_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": "postgresql",
        "services": {"postgresql": pg_status, "api": "ok"},
    }


@router.get("/", tags=["Health"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
        "database": "postgresql",
        "status": "running",
    }
