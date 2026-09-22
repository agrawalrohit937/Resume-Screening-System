"""
Worker Task Implementations for Asynchronous Background Processing.
===================================================================
Provides asynchronous background pipelines for:
1. Resume Upload Pipeline: Parse -> Section-Aware Chunk -> BGE-M3 Embed
2. Batch ATS Scoring Pipeline: Iterative / Vector-matched candidate batch scoring
3. Copilot LRU Memory Compaction: Background eviction of stale memory records
4. Bulk Rescoring Pipeline: Model upgrade rescoring
"""

from __future__ import annotations

import os
import time
from typing import Any, Dict, List, Optional
import structlog
from bson import ObjectId

from models.resume_model import ResumeStatus
from services.tasks.celery_app import celery_app
from services.tasks.task_manager import task_manager

logger = structlog.get_logger(__name__)


async def execute_resume_parse(
    resume_id: str,
    file_path: str,
    file_type: str,
    user_id: str,
    file_hash: Optional[str] = None,
    resume_repo: Any = None,
    user_repo: Any = None,
    parser: Any = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Parses resume document and writes structured extraction to database.
    """
    from repositories.resume_repo import ResumeRepository
    from repositories.user_repo import UserRepository
    from services.parser_service import ParserService
    from config.db import get_database

    db = get_database()
    r_repo = resume_repo or ResumeRepository(db)
    u_repo = user_repo or UserRepository(db)
    p_service = parser or ParserService()

    try:
        await r_repo.update_status(resume_id, ResumeStatus.PROCESSING)
        parsed = await p_service.parse_resume(file_path, file_type)
        await r_repo.update_parsed_data(resume_id, parsed.model_dump())
        await u_repo.increment_counter(user_id, "total_resumes")
        logger.info("Async worker: Resume parsed successfully", resume_id=resume_id)
        return {"status": "success", "resume_id": resume_id}
    except Exception as exc:
        err_msg = f"Resume parse failed: {str(exc)}"
        logger.error("Async worker: Resume parsing failed", resume_id=resume_id, error=str(exc))
        await r_repo.update_status(resume_id, ResumeStatus.FAILED, error=err_msg)
        await r_repo.collection.update_one(
            {"_id": ObjectId(resume_id)},
            {"$set": {"error_message": err_msg, "parse_error": err_msg}},
        )
        raise exc
    finally:
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass


async def execute_resume_upload_pipeline(
    resume_id: str,
    file_path: str,
    file_type: str,
    user_id: str,
    file_hash: Optional[str] = None,
    tenant_id: str = "default",
    job_id: Optional[str] = None,
    repo: Any = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Complete Asynchronous Pipeline:
    1. Parse resume -> 2. Extract structured entities -> 3. Section Chunker -> 4. BGE-M3 Vector Embedding
    """
    from repositories.resume_repo import ResumeRepository
    from repositories.user_repo import UserRepository
    from services.parser_service import ParserService
    from services.chunking_service import chunk_resume
    from services.embedding_service import embedding_model
    from config.db import get_database

    db = get_database()
    r_repo = ResumeRepository(db)
    u_repo = UserRepository(db)
    p_service = ParserService()

    try:
        # Step 1: Parse Document
        if repo and job_id:
            await repo.update_progress(job_id, progress=25, stage_message="Extracting document text and metadata", tenant_id=tenant_id)
        await r_repo.update_status(resume_id, ResumeStatus.PROCESSING)
        parsed = await p_service.parse_resume(file_path, file_type)
        parsed_dict = parsed.model_dump()

        # Step 2: Section Chunker
        if repo and job_id:
            await repo.update_progress(job_id, progress=50, stage_message="Chunking resume into semantic sections", tenant_id=tenant_id)
        chunks = chunk_resume(parsed_dict, raw_text=parsed.raw_text)

        # Step 3: Vector Embeddings (BGE-M3)
        if repo and job_id:
            await repo.update_progress(job_id, progress=75, stage_message="Generating dense vector embeddings (BGE-M3)", tenant_id=tenant_id)
        if chunks:
            chunk_texts = [c["text"] for c in chunks]
            vectors = embedding_model.encode(chunk_texts)
            for idx, c in enumerate(chunks):
                c["embedding"] = vectors[idx] if idx < len(vectors) else None

        parsed_dict["chunks"] = chunks
        await r_repo.update_parsed_data(resume_id, parsed_dict)
        await u_repo.increment_counter(user_id, "total_resumes")

        if repo and job_id:
            await repo.update_progress(job_id, progress=100, stage_message="Resume pipeline completed", tenant_id=tenant_id)

        logger.info("Resume upload pipeline completed", resume_id=resume_id, chunks_count=len(chunks))
        return {
            "status": "success",
            "resume_id": resume_id,
            "chunks_count": len(chunks),
            "skills_extracted": len(parsed.skills),
        }
    except Exception as exc:
        err_msg = f"Resume pipeline failed: {str(exc)}"
        logger.error("Resume upload pipeline failed", resume_id=resume_id, error=str(exc))
        await r_repo.update_status(resume_id, ResumeStatus.FAILED, error=err_msg)
        raise exc
    finally:
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass


async def execute_batch_ats_scoring(
    job_id_target: str,
    resume_ids: List[str],
    mode: str = "recruiter",
    tenant_id: str = "default",
    job_id: Optional[str] = None,
    repo: Any = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Batch ATS Scoring Worker:
    Evaluates candidate resumes against a job description in parallel batches with live progress reporting.
    """
    from config.db import get_database
    from repositories.resume_repo import ResumeRepository
    from repositories.result_repo import ResultRepository
    from services.scoring_engine import score_resume

    db = get_database()
    r_repo = ResumeRepository(db)
    res_repo = ResultRepository(db)

    job_doc = await db.jobs.find_one({"_id": ObjectId(job_id_target)})
    if not job_doc:
        raise ValueError(f"Job {job_id_target} not found for batch scoring")

    resumes = await r_repo.get_multiple_by_ids(resume_ids)
    results = []
    total = max(1, len(resumes))

    for idx, resume in enumerate(resumes):
        if not resume.parsed_data or not resume.parsed_data.raw_text:
            continue

        try:
            score_data = score_resume(
                resume=resume.parsed_data.model_dump(),
                jd=job_doc,
                mode=mode,
            )
            score_data["resume_id"] = str(resume.id)
            score_data["job_id"] = job_id_target
            score_data["tenant_id"] = tenant_id

            # Save in ats_results collection
            saved_result = await res_repo.save_result(score_data)
            results.append({
                "resume_id": str(resume.id),
                "result_id": str(saved_result.id) if hasattr(saved_result, "id") else str(saved_result.get("_id")),
                "final_score": score_data.get("final_score"),
                "math_score": score_data.get("math_score"),
                "vector_score": score_data.get("vector_score"),
            })
        except Exception as e:
            logger.warning("Batch scoring error on candidate", resume_id=str(resume.id), error=str(e))

        # Progress reporting
        if repo and job_id:
            progress = int(((idx + 1) / total) * 90) + 5
            await repo.update_progress(
                job_id,
                progress=progress,
                stage_message=f"Evaluated {idx + 1}/{total} candidate resumes",
                tenant_id=tenant_id,
            )

    logger.info("Batch ATS scoring completed", job_id=job_id_target, total_scored=len(results))
    return {
        "status": "success",
        "job_id": job_id_target,
        "total_scored": len(results),
        "results": results,
    }


async def execute_copilot_lru_eviction(
    user_id: str,
    tenant_id: str = "default",
    max_items: int = 40,
    job_id: Optional[str] = None,
    repo: Any = None,
    db: Any = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Copilot LRU Memory Eviction Worker:
    Enforces maximum capacity (40 items) in background, compacting memory without blocking chat turns.
    """
    from config.db import get_database
    database = db or get_database()

    mem_coll = database.copilot_memory
    docs = await mem_coll.find({
        "tenant_id": tenant_id,
        "user_id": user_id,
    }).sort("last_accessed_at", 1).to_list(length=1000)

    evicted_count = 0
    if len(docs) > max_items:
        excess = len(docs) - max_items
        to_delete = docs[:excess]
        delete_ids = [d["_id"] for d in to_delete]
        res = await mem_coll.delete_many({"_id": {"$in": delete_ids}})
        evicted_count = res.deleted_count

    logger.info("Copilot LRU eviction completed", user_id=user_id, evicted_count=evicted_count)
    return {
        "status": "success",
        "user_id": user_id,
        "evicted_count": evicted_count,
        "remaining_count": max(0, len(docs) - evicted_count),
    }


async def execute_bulk_rescore(
    job_id: str,
    resume_ids: List[str],
    trigger_reason: str = "model_upgrade",
    db: Any = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Re-scores multiple candidate resumes against a job description in background.
    """
    from config.db import get_database
    from repositories.resume_repo import ResumeRepository
    from services.scoring_engine import score_resume_dual

    database = db or get_database()
    r_repo = ResumeRepository(database)

    job_doc = await database.jobs.find_one({"_id": ObjectId(job_id)})
    if not job_doc:
        raise ValueError(f"Job {job_id} not found for bulk rescore")

    resumes = await r_repo.get_multiple_by_ids(resume_ids)
    rescored_count = 0

    for resume in resumes:
        if resume.status != ResumeStatus.PARSED or not resume.parsed_data:
            continue
        try:
            dual_result = score_resume_dual(
                resume=resume.parsed_data.raw_text or "",
                jd=job_doc.get("description", ""),
                required_skills=job_doc.get("skills", []),
                min_years=job_doc.get("min_years"),
            )
            # Update application if exists
            await database.applications.update_many(
                {"job_id": job_id, "resume_id": str(resume.id)},
                {"$set": {
                    "match_score": dual_result["recruiter_score"],
                    "quality_score": dual_result["quality_score"],
                    "eligibility": dual_result["eligibility"],
                    "updated_at_rescore": dual_result["scoring_version"],
                }}
            )
            rescored_count += 1
        except Exception as e:
            logger.warning("Failed rescoring resume in bulk batch", resume_id=str(resume.id), error=str(e))

    logger.info(
        "Bulk re-score completed",
        job_id=job_id,
        candidates_rescored=rescored_count,
        trigger_reason=trigger_reason,
    )
    return {
        "status": "success",
        "job_id": job_id,
        "rescored_count": rescored_count,
    }


# Optional Celery task registrations
if celery_app is not None:
    import asyncio

    @celery_app.task(name="careerpilot.parse_resume", bind=True, max_retries=3)
    def parse_resume_celery(self, payload: Dict[str, Any], idempotency_key: str):
        loop = asyncio.get_event_loop()
        try:
            return loop.run_until_complete(
                execute_resume_upload_pipeline(**payload)
            )
        except Exception as exc:
            countdown = 2 ** self.request.retries
            raise self.retry(exc=exc, countdown=countdown)

    @celery_app.task(name="careerpilot.batch_scoring", bind=True, max_retries=3)
    def batch_scoring_celery(self, payload: Dict[str, Any], idempotency_key: str):
        loop = asyncio.get_event_loop()
        try:
            return loop.run_until_complete(
                execute_batch_ats_scoring(**payload)
            )
        except Exception as exc:
            countdown = 2 ** self.request.retries
            raise self.retry(exc=exc, countdown=countdown)

    @celery_app.task(name="careerpilot.bulk_rescore", bind=True, max_retries=3)
    def bulk_rescore_celery(self, payload: Dict[str, Any], idempotency_key: str):
        loop = asyncio.get_event_loop()
        try:
            return loop.run_until_complete(
                execute_bulk_rescore(**payload)
            )
        except Exception as exc:
            countdown = 2 ** self.request.retries
            raise self.retry(exc=exc, countdown=countdown)
