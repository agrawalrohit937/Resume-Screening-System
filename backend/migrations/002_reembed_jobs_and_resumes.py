#!/usr/bin/env python3
"""
Migration Script 002: Re-embed Jobs and Resumes for Multilingual Model.
Batched, resumable, idempotent migration to generate and persist updated embeddings.

Targets:
- Collection 'jobs': Embeds 'jd_text_raw' into 'jd_embedding_v2', verifies, and atomically sets 'jd_embedding_bge'
  with 'embedding_model_version'.
- Collection 'resumes': Embeds parsed text/summary into 'resume_embedding_v2' with 'embedding_model_version'.

Usage:
    # Dry-run mode (scans and reports counts without updating MongoDB)
    python backend/migrations/002_reembed_jobs_and_resumes.py --dry-run

    # Execute migration
    python backend/migrations/002_reembed_jobs_and_resumes.py --batch-size 50
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List

from pymongo import MongoClient
from pymongo.errors import PyMongoError
from dotenv import load_dotenv
import structlog

load_dotenv()
logger = structlog.get_logger(__name__)

def run_reembed_migration(
    dry_run: bool = False,
    batch_size: int = 50,
    mongodb_url: str | None = None,
    database_name: str | None = None,
) -> int:
    uri = mongodb_url or os.getenv("MONGO_URI") or "mongodb://localhost:27017"
    db_name = database_name or os.getenv("MONGO_DB_NAME", "careerpilot")

    logger.info("Connecting to MongoDB for reembed migration", host=uri.split("@")[-1], db=db_name)
    client: MongoClient = MongoClient(uri, serverSelectionTimeoutMS=5000)

    try:
        db = client[db_name]

        from services.embedding_service import embedding_model, EMBEDDING_MODEL_VERSION, EMBEDDING_DIMENSIONS

        target_version = EMBEDDING_MODEL_VERSION
        target_dims = EMBEDDING_DIMENSIONS

        logger.info(
            "Target Embedding Model Config",
            model=embedding_model.model_name,
            version=target_version,
            dimensions=target_dims,
        )

        # 1. Query documents needing re-embedding
        jobs_query = {
            "$or": [
                {"embedding_model_version": {"$ne": target_version}},
                {"embedding_model_version": {"$exists": False}},
                {"jd_embedding_bge": {"$exists": False}},
            ]
        }
        resumes_query = {
            "$or": [
                {"embedding_model_version": {"$ne": target_version}},
                {"embedding_model_version": {"$exists": False}},
            ],
            "status": "parsed",
        }

        try:
            pending_jobs = db.jobs.count_documents(jobs_query)
            total_jobs = db.jobs.count_documents({})
        except Exception:
            pending_jobs = 0
            total_jobs = 0

        try:
            pending_resumes = db.resumes.count_documents(resumes_query)
            total_resumes = db.resumes.count_documents({})
        except Exception:
            pending_resumes = 0
            total_resumes = 0

        summary = {
            "target_model": embedding_model.model_name,
            "target_version": target_version,
            "target_dimensions": target_dims,
            "jobs": {
                "total": total_jobs,
                "pending_reembed": pending_jobs,
            },
            "resumes": {
                "total": total_resumes,
                "pending_reembed": pending_resumes,
            },
        }

        if dry_run:
            logger.info("DRY RUN Migration Assessment Summary", summary=summary)
            return 0

        logger.info("Starting re-embedding migration", pending_jobs=pending_jobs, pending_resumes=pending_resumes)

        # 2. Process Jobs
        if pending_jobs > 0:
            logger.info("Processing jobs in batches", batch_size=batch_size)
            cursor = db.jobs.find(jobs_query, {"_id": 1, "jd_text_raw": 1, "title": 1})
            job_batch = []
            for doc in cursor:
                job_batch.append(doc)
                if len(job_batch) >= batch_size:
                    _process_job_batch(db, job_batch, embedding_model, target_version, target_dims)
                    job_batch = []
            if job_batch:
                _process_job_batch(db, job_batch, embedding_model, target_version, target_dims)

        # 3. Process Resumes
        if pending_resumes > 0:
            logger.info("Processing resumes in batches", batch_size=batch_size)
            cursor = db.resumes.find(resumes_query, {"_id": 1, "raw_text": 1, "parsed_data": 1})
            resume_batch = []
            for doc in cursor:
                resume_batch.append(doc)
                if len(resume_batch) >= batch_size:
                    _process_resume_batch(db, resume_batch, embedding_model, target_version, target_dims)
                    resume_batch = []
            if resume_batch:
                _process_resume_batch(db, resume_batch, embedding_model, target_version, target_dims)

        logger.info("Re-embedding migration completed successfully")
        return 0

    except PyMongoError as pe:
        logger.error("MongoDB Error during migration", error=str(pe))
        return 1
    finally:
        client.close()


def _process_job_batch(db: Any, batch: List[Dict[str, Any]], model: Any, version: str, dims: int) -> None:
    texts = [str(doc.get("jd_text_raw") or doc.get("title") or "") for doc in batch]
    vectors = model.encode(texts)
    now = datetime.now(timezone.utc)

    for doc, vec in zip(batch, vectors):
        if len(vec) == dims:
            # Atomic two-step: set v2, then promote to primary
            db.jobs.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "jd_embedding_v2": vec,
                        "jd_embedding_bge": vec,
                        "jd_embedding": vec,
                        "embedding_model_version": version,
                        "embedding_updated_at": now,
                    }
                },
            )


def _process_resume_batch(db: Any, batch: List[Dict[str, Any]], model: Any, version: str, dims: int) -> None:
    texts = []
    for doc in batch:
        parsed = doc.get("parsed_data") or {}
        summary = parsed.get("summary") or ""
        skills = ", ".join(parsed.get("skills", [])[:20])
        raw = doc.get("raw_text") or ""
        texts.append(f"Skills: {skills}. Summary: {summary}. Highlights: {raw[:1000]}")

    vectors = model.encode(texts)
    now = datetime.now(timezone.utc)

    for doc, vec in zip(batch, vectors):
        if len(vec) == dims:
            db.resumes.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "resume_embedding_v2": vec,
                        "embedding_model_version": version,
                        "embedding_updated_at": now,
                    }
                },
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Re-embed jobs and resumes for CareerPilot multilingual upgrade")
    parser.add_argument("--dry-run", action="store_true", help="Report pending document counts without modifying database")
    parser.add_argument("--batch-size", type=int, default=50, help="Batch size for embedding calculation and updates")
    parser.add_argument("--url", default=None, help="MongoDB connection URI")
    parser.add_argument("--db", default=None, help="Database name")
    args = parser.parse_args()

    sys.exit(run_reembed_migration(
        dry_run=args.dry_run,
        batch_size=args.batch_size,
        mongodb_url=args.url,
        database_name=args.db,
    ))


if __name__ == "__main__":
    main()
