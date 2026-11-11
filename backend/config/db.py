"""
Unified Database Configuration — Pure SQLAlchemy 2.0 Async Engine.
High-performance PostgreSQL connection pooling, AsyncSession lifecycle, declarative Base,
and transaction dependencies for FastAPI. 100% Native PostgreSQL.
"""

from __future__ import annotations

from typing import Any, AsyncGenerator, Dict, Optional
import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base

from core.config import settings

logger = structlog.get_logger(__name__)

# ─── Declarative Base for SQLAlchemy Models ────────────────────────────────────
Base = declarative_base()

# ─── Global State ─────────────────────────────────────────────────────────────
_pg_engine: Optional[AsyncEngine] = None
_pg_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


# ─── 1. PostgreSQL Engine & Session Factory ───────────────────────────────────
def get_pg_engine() -> AsyncEngine:
    global _pg_engine
    if _pg_engine is None:
        db_url = settings.async_database_url
        if not db_url:
            raise RuntimeError("DATABASE_URL is not set in configuration or .env")

        connect_args: Dict[str, Any] = {}
        if "pooler" in db_url or "neon.tech" in db_url:
            # Neon / PgBouncer transaction poolers require prepared statement cache disabled
            connect_args["statement_cache_size"] = 0
            connect_args["prepared_statement_cache_size"] = 0

        _pg_engine = create_async_engine(
            db_url,
            echo=settings.DEBUG,
            pool_size=settings.POSTGRES_POOL_SIZE,
            max_overflow=settings.POSTGRES_MAX_OVERFLOW,
            pool_pre_ping=True,
            pool_recycle=300,
            connect_args=connect_args,
        )
    return _pg_engine


def get_pg_session_factory() -> async_sessionmaker[AsyncSession]:
    global _pg_session_factory
    if _pg_session_factory is None:
        engine = get_pg_engine()
        _pg_session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    return _pg_session_factory


async def init_pg_db(create_all: bool = False) -> None:
    """Initialize Postgres engine and optionally create all declared tables."""
    try:
        engine = get_pg_engine()
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT 1;"))
            _ = res.scalar()
        logger.info("PostgreSQL engine connected successfully")

        if create_all:
            import models  # noqa: F401
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("PostgreSQL tables ensured via SQLAlchemy Base.metadata.create_all")
    except Exception as exc:
        logger.error("Failed to initialize PostgreSQL engine", error=str(exc))
        raise exc


async def close_pg_db() -> None:
    """Gracefully dispose the Postgres connection engine pool."""
    global _pg_engine, _pg_session_factory
    if _pg_engine is not None:
        await _pg_engine.dispose()
        logger.info("PostgreSQL engine pool disposed")
        _pg_engine = None
        _pg_session_factory = None


# ─── 2. FastAPI Session Dependency ────────────────────────────────────────────
async def get_pg_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI Dependency yielding transactional AsyncSession per request."""
    factory = get_pg_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Standard FastAPI dependency yielding transactional AsyncSession."""
    async for session in get_pg_db():
        yield session



# ─── 3. Application Lifecycle Connect & Disconnect ────────────────────────────
async def connect_db() -> None:
    """Connect to PostgreSQL primary database engine."""
    try:
        engine = get_pg_engine()
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT 1;"))
            _ = res.scalar()
        logger.info("PostgreSQL primary engine connected successfully")

        # Automatically ensure all tables exist in database (essential for local dev)
        try:
            import models  # noqa: F401
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("PostgreSQL schema verified and tables ensured")
        except Exception as e:
            logger.warning("Auto table creation notice", error=str(e))
    except Exception as exc:
        logger.error("Failed to connect to PostgreSQL engine", error=str(exc))
        raise exc


async def disconnect_db() -> None:
    """Dispose PostgreSQL engine connections."""
    await close_pg_db()
    logger.info("PostgreSQL engine disconnected successfully")
