"""
Database Configuration — Motor async MongoDB client with index management
"""

from typing import Optional

import structlog
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, TEXT, IndexModel

from core.config import settings

logger = structlog.get_logger(__name__)

# ─── Global State ─────────────────────────────────────────────────────────────
_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def connect_db() -> None:
    global _client, _db
    _client = AsyncIOMotorClient(
        settings.MONGO_URI,
        maxPoolSize=settings.MONGO_MAX_CONNECTIONS,
        minPoolSize=settings.MONGO_MIN_CONNECTIONS,
        serverSelectionTimeoutMS=5000,
    )
    _db = _client[settings.MONGO_DB_NAME]
    await _ensure_indexes()
    logger.info("MongoDB connected", db=settings.MONGO_DB_NAME)



async def disconnect_db() -> None:
    global _client
    if _client:
        _client.close()
        logger.info("MongoDB disconnected")


def get_database() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _db


# ─── Index Definitions ────────────────────────────────────────────────────────
async def _ensure_indexes() -> None:
    try:
        db = get_database()

        # users
        await db.users.create_indexes([
            IndexModel([("email", ASCENDING)], unique=True, name="email_unique"),
            IndexModel([("role", ASCENDING)], name="role_idx"),
            IndexModel([("created_at", DESCENDING)], name="created_at_idx"),
            IndexModel([("portfolio_slug", ASCENDING)], name="user_portfolio_slug_idx", sparse=True),
        ])

        # resumes
        await db.resumes.create_indexes([
            IndexModel([("user_id", ASCENDING)], name="resume_user_idx"),
            IndexModel([("created_at", DESCENDING)], name="resume_created_idx"),
            IndexModel([("filename", TEXT)], name="resume_text_idx"),
            IndexModel([("status", ASCENDING)], name="resume_status_idx"),
        ])

        # job_descriptions
        await db.job_descriptions.create_indexes([
            IndexModel([("user_id", ASCENDING)], name="jd_user_idx"),
            IndexModel([("title", TEXT), ("description", TEXT)], name="jd_text_idx"),
            IndexModel([("created_at", DESCENDING)], name="jd_created_idx"),
        ])

        # results (ATS scores)
        await db.results.create_indexes([
            IndexModel([("resume_id", ASCENDING)], name="result_resume_idx"),
            IndexModel([("user_id", ASCENDING)], name="result_user_idx"),
            IndexModel([("final_score", DESCENDING)], name="result_score_idx"),
            IndexModel([("created_at", DESCENDING)], name="result_created_idx"),
            IndexModel(
                [("resume_id", ASCENDING), ("job_description_id", ASCENDING)],
                unique=True,
                name="result_pair_unique",
            ),
        ])

        # analytics
        await db.analytics.create_indexes([
            IndexModel([("event_type", ASCENDING)], name="analytics_event_idx"),
            IndexModel([("user_id", ASCENDING)], name="analytics_user_idx"),
            IndexModel([("created_at", DESCENDING)], name="analytics_created_idx"),
        ])

        # interviews
        await db.interviews.create_indexes([
            IndexModel([("user_id", ASCENDING)], name="interview_user_idx"),
            IndexModel([("resume_id", ASCENDING)], name="interview_resume_idx"),
            IndexModel([("created_at", DESCENDING)], name="interview_created_idx"),
        ])

        # github_profiles
        await db.github_profiles.create_indexes([
            IndexModel([("username", ASCENDING)], unique=True, name="github_username_unique"),
            IndexModel([("user_id", ASCENDING)], name="github_user_idx"),
        ])

        # ─── certificates ─────────────────────────────────────────────────
        await db.certificates.create_indexes([
            IndexModel([("user_id", ASCENDING)], name="cert_user_idx"),
            IndexModel([("status", ASCENDING)], name="cert_status_idx"),
            IndexModel([("issued_at", DESCENDING)], name="cert_issued_idx"),
            IndexModel(
                [("user_id", ASCENDING), ("certificate_type", ASCENDING),
                 ("snapshot.assessment_slug", ASCENDING)],
                name="cert_user_type_slug_idx",
            ),
        ])

        # ─── user_profiles & portfolio_analytics ──────────────────────────
        await db.user_profiles.create_indexes([
            IndexModel([("username", ASCENDING)], unique=True, name="portfolio_username_unique"),
            IndexModel([("user_id", ASCENDING)], name="portfolio_user_idx"),
        ])
        # ─── recovery_cases ────────────────────────────────────────────────
        await db.recovery_cases.create_indexes([
            IndexModel([("case_id", ASCENDING)], unique=True, name="case_id_unique"),
            IndexModel([("user_id", ASCENDING)], name="recovery_user_idx"),
            IndexModel([("status", ASCENDING)], name="recovery_status_idx"),
            IndexModel([("risk_level", ASCENDING)], name="recovery_risk_idx"),
            IndexModel([("created_at", DESCENDING)], name="recovery_created_idx"),
            IndexModel([("updated_at", DESCENDING)], name="recovery_updated_idx"),
        ])

        logger.info("✅ MongoDB indexes ensured")
    except Exception as e:
        logger.warning("MongoDB index creation warning", error=str(e))