"""
Phase 1 Migration Script — Copilot v2 Database Indexes
=====================================================
Ensures compound indexes and TTL expiration indexes on MongoDB collections:
- copilot_sessions: (tenant_id, user_id, created_at), (tenant_id, user_id, pinned, updated_at)
- copilot_messages: (session_id, created_at), (tenant_id, user_id, created_at), TTL (180 days)
- copilot_memory: (tenant_id, user_id, key) unique, (tenant_id, user_id, updated_at)

Usage:
    python backend/migrations/phase1_copilot_v2_indexes.py
"""

import asyncio
from pymongo import ASCENDING, DESCENDING, IndexModel
import structlog

from config.db import connect_db, disconnect_db, get_database

logger = structlog.get_logger(__name__)


async def run_migration():
    await connect_db()
    db = get_database()
    print("Ensuring Copilot v2 indexes...")

    # copilot_sessions
    await db.copilot_sessions.create_indexes([
        IndexModel([("tenant_id", ASCENDING), ("user_id", ASCENDING), ("created_at", DESCENDING)], name="copilot_session_tenant_user_created_idx"),
        IndexModel([("tenant_id", ASCENDING), ("user_id", ASCENDING), ("pinned", DESCENDING), ("updated_at", DESCENDING)], name="copilot_session_tenant_user_pinned_updated_idx"),
    ])
    print("  [OK] copilot_sessions indexes created")

    # copilot_messages
    await db.copilot_messages.create_indexes([
        IndexModel([("session_id", ASCENDING), ("created_at", ASCENDING)], name="copilot_msg_session_created_idx"),
        IndexModel([("tenant_id", ASCENDING), ("user_id", ASCENDING), ("created_at", DESCENDING)], name="copilot_msg_tenant_user_created_idx"),
        IndexModel([("created_at", ASCENDING)], expireAfterSeconds=180 * 86400, name="copilot_msg_ttl_idx"),
    ])
    print("  [OK] copilot_messages indexes and 180-day TTL created")

    # copilot_memory
    await db.copilot_memory.create_indexes([
        IndexModel([("tenant_id", ASCENDING), ("user_id", ASCENDING), ("key", ASCENDING)], unique=True, name="copilot_mem_tenant_user_key_unique"),
        IndexModel([("tenant_id", ASCENDING), ("user_id", ASCENDING), ("updated_at", DESCENDING)], name="copilot_mem_tenant_user_updated_idx"),
    ])
    print("  [OK] copilot_memory compound unique and updated_at indexes created")

    await disconnect_db()
    print("Copilot v2 migration complete.")


if __name__ == "__main__":
    asyncio.run(run_migration())
