from __future__ import annotations

"""
Worker Task Implementations for Asynchronous Background Processing.
===================================================================
Provides asynchronous background pipelines for:
1. Resume Upload Pipeline: Parse -> Section-Aware Chunk -> BGE-M3 Embed
2. Batch ATS Scoring Pipeline: Iterative / Vector-matched candidate batch scoring
3. Copilot LRU Memory Compaction: Background eviction of stale memory records
4. Bulk Rescoring Pipeline: Model upgrade rescoring
"""

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import structlog
from sqlalchemy import select, update, delete

from config.db import get_pg_session_factory
from models.tables import Job, CandidateApplication, CopilotMemory
from models.resume_model import ResumeStatus

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

    r_repo = resume_repo or ResumeRepository()
    u_repo = user_repo or UserRepository()
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

    r_repo = ResumeRepository()
    u_repo = UserRepository()
    p_service = ParserService()

    try:
        # Step 1: Parse Document (Fast Path - makes resume immediately usable for ATS matching)
        if repo and job_id:
            await repo.update_progress(job_id, progress=50, stage_message="Extracting document text and metadata", tenant_id=tenant_id)
        await r_repo.update_status(resume_id, ResumeStatus.PROCESSING)
        parsed = await p_service.parse_resume(file_path, file_type)
        parsed_dict = parsed.model_dump()

        # Immediate persist -> resume status becomes 'parsed' immediately!
        await r_repo.update_parsed_data(resume_id, parsed_dict)
        await u_repo.increment_counter(user_id, "total_resumes")

        # Step 2: Section Chunker & BGE-M3 Vector Embeddings (Async Enrichment)
        if repo and job_id:
            await repo.update_progress(job_id, progress=75, stage_message="Generating semantic vectors (BGE-M3)", tenant_id=tenant_id)
        chunks = chunk_resume(parsed_dict, raw_text=parsed.raw_text)

        if chunks:
            chunk_texts = [c["text"] for c in chunks]
            vectors = embedding_model.encode(chunk_texts)
            for idx, c in enumerate(chunks):
                c["embedding"] = vectors[idx] if idx < len(vectors) else None

            parsed_dict["chunks"] = chunks
            await r_repo.update_parsed_data(resume_id, parsed_dict)

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
    from repositories.resume_repo import ResumeRepository
    from repositories.result_repo import ResultRepository
    from services.scoring_engine import score_resume

    r_repo = ResumeRepository()
    res_repo = ResultRepository()

    async with get_pg_session_factory()() as session:
        j_row = (await session.execute(select(Job).where(Job.id == str(job_id_target)))).scalar_one_or_none()
        job_doc = {c.name: getattr(j_row, c.name) for c in Job.__table__.columns} if j_row else None
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

            # Save in ats_results table
            saved_result = await res_repo.save_result(score_data)
            results.append({
                "resume_id": str(resume.id),
                "result_id": str(saved_result.id) if hasattr(saved_result, "id") else str(saved_result.get("_id", "")),
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


    evicted_count = 0
    total_docs = 0
    factory = None
    if db:
        if callable(db):
            factory = db
        elif hasattr(db, "session_factory"):
            factory = db.session_factory
        elif hasattr(db, "execute"):
            class _Ctx:
                async def __aenter__(self):
                    return db
                async def __aexit__(self, *args):
                    pass
            factory = lambda: _Ctx()
    if not factory:
        factory = get_pg_session_factory()

    async with factory() as session:
        stmt = (
            select(CopilotMemory)
            .where(CopilotMemory.tenant_id == tenant_id, CopilotMemory.user_id == user_id)
            .order_by(CopilotMemory.updated_at.asc())
        )
        res = await session.execute(stmt)
        docs = res.scalars().all()
        total_docs = len(docs)
        if total_docs > max_items:
            excess = total_docs - max_items
            to_delete = docs[:excess]
            delete_ids = [d.id for d in to_delete]
            del_stmt = delete(CopilotMemory).where(CopilotMemory.id.in_(delete_ids))
            await session.execute(del_stmt)
            await session.commit()
            evicted_count = len(delete_ids)

    logger.info("Copilot LRU eviction completed", user_id=user_id, evicted_count=evicted_count)
    return {
        "status": "success",
        "user_id": user_id,
        "evicted_count": evicted_count,
        "remaining_count": max(0, total_docs - evicted_count),
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
    from repositories.resume_repo import ResumeRepository
    from services.scoring_engine import score_resume_dual

    r_repo = ResumeRepository()

    async with get_pg_session_factory()() as session:
        j_row = (await session.execute(select(Job).where(Job.id == str(job_id)))).scalar_one_or_none()
        job_doc = {c.name: getattr(j_row, c.name) for c in Job.__table__.columns} if j_row else None
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
            async with get_pg_session_factory()() as session:
                await session.execute(
                    update(CandidateApplication)
                    .where(CandidateApplication.job_id == str(job_id), CandidateApplication.resume_id == str(resume.id))
                    .values(
                        match_score=dual_result.get("recruiter_score"),
                        quality_score=dual_result.get("quality_score"),
                        eligibility=dual_result.get("eligibility"),
                        updated_at=datetime.now(timezone.utc),
                    )
                )
                await session.commit()
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
