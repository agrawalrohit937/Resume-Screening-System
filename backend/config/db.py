"""
Database Configuration — Motor async MongoDB client with index management
"""

from typing import Optional

import structlog
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, TEXT, IndexModel

from core.config import settings

try:
    import dns.resolver
    dns.resolver.default_resolver = dns.resolver.Resolver(configure=True)
    dns.resolver.default_resolver.nameservers = ["8.8.8.8", "1.1.1.1", "8.8.4.4"]
except Exception:
    pass

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

        # live_interview_sessions
        await db.live_interview_sessions.create_indexes([
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

        # ─── applications ──────────────────────────────────────────────────
        await db.applications.create_indexes([
            IndexModel([("job_id", ASCENDING), ("candidate_id", ASCENDING)], unique=True, name="app_job_candidate_unique"),
            IndexModel([("job_id", ASCENDING)], name="app_job_idx"),
            IndexModel([("candidate_id", ASCENDING)], name="app_candidate_idx"),
            IndexModel([("created_at", DESCENDING)], name="app_created_idx"),
        ])

        await db.jobs.create_indexes([
            IndexModel([("external_job_id", ASCENDING)], unique=True, sparse=True, name="jobs_external_id_unique"),
            IndexModel([("is_external", ASCENDING), ("status", ASCENDING)], name="jobs_external_status_idx"),
        ])

        # ─── copilot v2: sessions, messages, memory ───────────────────────
        await db.copilot_sessions.create_indexes([
            IndexModel([("tenant_id", ASCENDING), ("user_id", ASCENDING), ("created_at", DESCENDING)], name="copilot_session_tenant_user_created_idx"),
            IndexModel([("tenant_id", ASCENDING), ("user_id", ASCENDING), ("pinned", DESCENDING), ("updated_at", DESCENDING)], name="copilot_session_tenant_user_pinned_updated_idx"),
        ])
        await db.copilot_messages.create_indexes([
            IndexModel([("session_id", ASCENDING), ("created_at", ASCENDING)], name="copilot_msg_session_created_idx"),
            IndexModel([("tenant_id", ASCENDING), ("user_id", ASCENDING), ("created_at", DESCENDING)], name="copilot_msg_tenant_user_created_idx"),
            IndexModel([("created_at", ASCENDING)], expireAfterSeconds=180 * 86400, name="copilot_msg_ttl_idx"),
        ])
        await db.copilot_memory.create_indexes([
            IndexModel([("tenant_id", ASCENDING), ("user_id", ASCENDING), ("key", ASCENDING)], unique=True, name="copilot_mem_tenant_user_key_unique"),
            IndexModel([("tenant_id", ASCENDING), ("user_id", ASCENDING), ("updated_at", DESCENDING)], name="copilot_mem_tenant_user_updated_idx"),
        ])

        # ─── copilot v3 RAG: chunks & semantic cache ──────────────────────
        await db.copilot_chunks.create_indexes([
            IndexModel([("tenant_id", ASCENDING), ("user_id", ASCENDING), ("source_type", ASCENDING), ("source_id", ASCENDING)], name="copilot_chunks_tenant_user_source_idx"),
            IndexModel([("tenant_id", ASCENDING), ("source_type", ASCENDING), ("created_at", DESCENDING)], name="copilot_chunks_tenant_source_created_idx"),
            IndexModel([("text", "text"), ("title", "text")], name="copilot_chunks_text_search_idx"),
        ])
        # ─── auth: otps, refresh_tokens, revoked_tokens ──────────────────
        await db.otps.create_indexes([
            IndexModel([("email", ASCENDING), ("purpose", ASCENDING), ("consumed", ASCENDING), ("created_at", DESCENDING)], name="otp_lookup_idx"),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0, name="otp_ttl_idx"),
        ])
        await db.refresh_tokens.create_indexes([
            IndexModel([("token_hash", ASCENDING)], unique=True, name="refresh_token_hash_unique"),
            IndexModel([("user_id", ASCENDING)], name="refresh_token_user_idx"),
            IndexModel([("family_id", ASCENDING)], name="refresh_token_family_idx"),
        ])
        await db.revoked_tokens.create_indexes([
            IndexModel([("jti", ASCENDING)], unique=True, name="revoked_jti_unique"),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0, name="revoked_tokens_ttl_idx"),
        ])

        logger.info("✅ MongoDB indexes ensured")
    except Exception as e:
        logger.warning("MongoDB index creation warning", error=str(e))
