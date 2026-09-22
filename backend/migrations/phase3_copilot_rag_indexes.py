"""
Phase 3 Migration — Create indexes for Copilot RAG (`copilot_chunks` and `copilot_cache`).
"""

import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel
import structlog

logger = structlog.get_logger(__name__)


async def run_migration():
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    db_name = os.getenv("DB_NAME", "resume_screening")

    print(f"Connecting to MongoDB at {mongo_uri} (db: {db_name})...")
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]

    print("Ensuring indexes on copilot_chunks...")
    await db.copilot_chunks.create_indexes([
        IndexModel([("tenant_id", ASCENDING), ("user_id", ASCENDING), ("source_type", ASCENDING), ("source_id", ASCENDING)], name="copilot_chunks_tenant_user_source_idx"),
        IndexModel([("tenant_id", ASCENDING), ("source_type", ASCENDING), ("created_at", DESCENDING)], name="copilot_chunks_tenant_source_created_idx"),
        IndexModel([("text", "text"), ("title", "text")], name="copilot_chunks_text_search_idx"),
    ])

    print("Ensuring indexes on copilot_cache...")
    await db.copilot_cache.create_indexes([
        IndexModel([("tenant_id", ASCENDING), ("user_id", ASCENDING), ("context_version", ASCENDING)], name="copilot_cache_tenant_user_ctx_idx"),
        IndexModel([("created_at", ASCENDING)], expireAfterSeconds=3600, name="copilot_cache_ttl_idx"),
    ])

    print("✅ Phase 3 RAG migration completed successfully.")
    client.close()


if __name__ == "__main__":
    asyncio.run(run_migration())
