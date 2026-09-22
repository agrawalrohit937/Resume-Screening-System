"""
Standalone Backfill Script — Population of `copilot_chunks` collection from existing resumes and jobs.
Usage:
    python scripts/backfill_copilot_chunks.py [--tenant-id TENANT_ID] [--batch-size 50]
"""

import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
import structlog

from services.copilot.rag.ingestion import ingest_resume_chunks, ingest_job_chunks

logger = structlog.get_logger(__name__)


async def backfill_all(tenant_id: str = "default"):
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    db_name = os.getenv("DB_NAME", "resume_screening")

    print(f"Connecting to MongoDB at {mongo_uri} (db: {db_name})...")
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]

    print(f"Backfilling resumes for tenant: {tenant_id}...")
    resume_cursor = db.resumes.find({})
    total_resumes = 0
    total_chunks = 0

    async for resume_doc in resume_cursor:
        doc_tenant = resume_doc.get("tenant_id") or tenant_id
        user_id = resume_doc.get("user_id") or resume_doc.get("candidate_id") or str(resume_doc.get("_id"))
        parsed = resume_doc.get("parsed_data") or resume_doc
        raw_text = resume_doc.get("raw_text") or ""
        resume_id = str(resume_doc.get("_id"))

        count = await ingest_resume_chunks(
            db=db,
            tenant_id=doc_tenant,
            user_id=user_id,
            parsed_resume=parsed,
            raw_text=raw_text,
            resume_id=resume_id,
        )
        total_resumes += 1
        total_chunks += count
        if total_resumes % 10 == 0:
            print(f"  Processed {total_resumes} resumes ({total_chunks} chunks)...")

    print(f"✅ Completed resume backfill: {total_resumes} resumes, {total_chunks} total chunks.")

    print(f"Backfilling jobs for tenant: {tenant_id}...")
    job_cursor = db.jobs.find({})
    total_jobs = 0
    total_job_chunks = 0

    async for job_doc in job_cursor:
        doc_tenant = job_doc.get("tenant_id") or tenant_id
        job_id = str(job_doc.get("_id"))
        count = await ingest_job_chunks(
            db=db,
            tenant_id=doc_tenant,
            job_id=job_id,
            job_data=job_doc,
        )
        total_jobs += 1
        total_job_chunks += count

    print(f"✅ Completed job backfill: {total_jobs} jobs, {total_job_chunks} total chunks.")
    client.close()


if __name__ == "__main__":
    asyncio.run(backfill_all())
