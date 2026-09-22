"""
Resume Routes — Upload, Parse, List, Delete
"""

import hashlib
import os
import uuid
from datetime import datetime, timezone

import structlog
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import RedirectResponse

from services.tasks import task_manager, execute_resume_parse
from services.tasks.workers import execute_resume_upload_pipeline
from models.task_job_model import JobType

from api.deps import (
    get_current_user, get_resume_repo, get_parser_service, get_user_repo,
    PaginationParams
)
from config.db import get_database
from core.config import settings
from models.resume_model import ResumeModel, ResumeStatus
from models.user_model import UserModel
from repositories.resume_repo import ResumeRepository
from repositories.user_repo import UserRepository
from schemas.resume_schema import (
    ResumeUploadResponse, ResumeDetailResponse,
    ResumeListResponse, ResumeUpdateRequest
)
from services.parser_service import ParserService
from services.cloudinary_service import upload_resume, delete_file as cloudinary_delete
from services.gamification_service import GamificationService
from utils.file_utils import validate_and_save_file, delete_file, sanitize_filename
from utils.validators import validate_object_id


logger = structlog.get_logger(__name__)


def get_gamification_service(db=Depends(get_database)) -> GamificationService:
    return GamificationService(db)


router = APIRouter()


async def _parse_resume_background(
    resume_id: str,
    file_path: str,
    file_type: str,
    resume_repo: ResumeRepository,
    user_repo: UserRepository,
    user_id: str,
    parser: ParserService,
):
    """Background task: parse uploaded resume and save structured data."""
    try:
        await resume_repo.update_status(resume_id, ResumeStatus.PROCESSING)
        parsed_dict = parsed.model_dump()
        await resume_repo.update_parsed_data(resume_id, parsed_dict)
        await user_repo.increment_counter(user_id, "total_resumes")
        logger.info("Resume parsed", resume_id=resume_id)

        # Trigger Copilot RAG chunk ingestion
        try:
            from services.copilot.rag.ingestion import ingest_resume_chunks
            resume_doc = await resume_repo.get_by_id(resume_id)
            tenant_id = resume_doc.get("tenant_id", "default") if resume_doc else "default"
            await ingest_resume_chunks(
                db=resume_repo.db,
                tenant_id=tenant_id,
                user_id=user_id,
                parsed_resume=parsed_dict,
                resume_id=resume_id,
            )
        except Exception as chunk_err:
            logger.warning("Copilot RAG chunk ingestion warning", error=str(chunk_err))

    except Exception as e:
        logger.exception("Resume parse background task failed", resume_id=resume_id, error=str(e))
        err_msg = f"Resume parse failed: {str(e)}"
        await resume_repo.update_status(resume_id, ResumeStatus.FAILED, error=err_msg)
        await resume_repo.collection.update_one(
            {"_id": ObjectId(resume_id)},
            {"$set": {"error_message": err_msg, "parse_error": err_msg}},
        )

    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


@router.post("/upload", response_model=ResumeUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="PDF or DOCX resume file"),
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    parser: ParserService = Depends(get_parser_service),
    gamification: GamificationService = Depends(get_gamification_service),
):
    """Upload a resume (PDF/DOCX) — triggers async parsing."""

    # Save locally for parsing
    storage_path, filename, file_type, file_size = await validate_and_save_file(
        file, str(current_user.id)
    )

    # Upload to Cloudinary
    try:
        with open(storage_path, "rb") as f:
            resume_bytes = f.read()

        cloudinary_url, cloudinary_public_id = await upload_resume(resume_bytes, filename)

        if not cloudinary_url:
            raise HTTPException(status_code=500, detail="Cloudinary upload failed")

        file_url = cloudinary_url

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

    original_filename = sanitize_filename(file.filename or "resume")
    user_id_str = str(current_user.id)

    # Prepare document data
    resume_data = {
        "user_id": user_id_str,
        "filename": filename,
        "original_filename": original_filename,
        "file_type": file_type,
        "file_size_bytes": file_size,
        "storage_path": storage_path,       # for parsing (local temp path)
        "file_url": file_url,               # Cloudinary URL for recruiter view
        "cloudinary_public_id": cloudinary_public_id,
        "status": ResumeStatus.PENDING,
        "tags": [],
        "is_primary": True,
    }

    # Perform atomic primary swap using MongoDB session transaction if supported,
    # with automatic compensating fallback.
    resume = None
    client = resume_repo.collection.database.client
    try:
        async with await client.start_session() as session:
            async with session.start_transaction():
                await resume_repo.collection.update_many(
                    {"user_id": user_id_str},
                    {"$set": {"is_primary": False}},
                    session=session,
                )
                res = await resume_repo.collection.insert_one(resume_data, session=session)
                resume_data["_id"] = str(res.inserted_id)
                resume = ResumeModel(**resume_data)

                await user_repo.collection.update_one(
                    {"_id": ObjectId(user_id_str)},
                    {"$set": {
                        "profile_resume_url": file_url,
                        "profile_resume_name": original_filename,
                        "updated_at": datetime.now(timezone.utc),
                    }},
                    session=session,
                )
    except Exception as tx_err:
        logger.info("Session transaction unavailable or failed, applying compensating fallback", error=str(tx_err))
        await resume_repo.collection.update_many(
            {"user_id": user_id_str},
            {"$set": {"is_primary": False}},
        )
        resume = await resume_repo.create(resume_data)
        await user_repo.collection.update_one(
            {"_id": ObjectId(user_id_str)},
            {"$set": {
                "profile_resume_url": file_url,
                "profile_resume_name": original_filename,
                "updated_at": datetime.now(timezone.utc),
            }},
        )

    # Compensating post-check: ensure user has exactly 1 primary resume
    primary_count = await resume_repo.collection.count_documents({"user_id": user_id_str, "is_primary": True})
    if primary_count == 0 and resume:
        await resume_repo.collection.update_one(
            {"_id": ObjectId(str(resume.id))},
            {"$set": {"is_primary": True}},
        )
    elif primary_count > 1 and resume:
        await resume_repo.collection.update_many(
            {"user_id": user_id_str, "_id": {"$ne": ObjectId(str(resume.id))}},
            {"$set": {"is_primary": False}},
        )

    # Gamification
    await gamification.mark_daily_activity(str(current_user.id))

    # Task 4.1: Compute idempotency key on (resume_id, file_hash)
    file_hash = hashlib.sha256(resume_bytes).hexdigest()
    idempotency_key = task_manager.compute_idempotency_key("parse", str(resume.id), file_hash)

    # Dispatched via TaskManager (Persistent Job Queue with live status tracking)
    tenant_id = getattr(current_user, "tenant_id", None) or "default"
    job_record = await task_manager.enqueue_job(
        job_type=JobType.RESUME_PARSE_EMBED,
        payload={
            "resume_id": str(resume.id),
            "file_path": storage_path,
            "file_type": file_type,
            "user_id": str(current_user.id),
            "file_hash": file_hash,
            "tenant_id": tenant_id,
        },
        task_coro_func=execute_resume_upload_pipeline,
        tenant_id=tenant_id,
        user_id=str(current_user.id),
        idempotency_key=idempotency_key,
    )

    return ResumeUploadResponse(
        resume_id=str(resume.id),
        filename=filename,
        status=ResumeStatus.PENDING,
        message="Resume uploaded. Parsing and embedding pipeline queued.",
        job_id=job_record.job_id if hasattr(job_record, "job_id") else getattr(job_record, "get", lambda k: None)("job_id"),
    )


# ─── GET /resume/ ─────────────────────────────────────────────────────────────
@router.get("", response_model=ResumeListResponse)
@router.get("/", response_model=ResumeListResponse)
async def list_resumes(
    pagination: PaginationParams = Depends(),
    status_filter: ResumeStatus = Query(default=None, alias="status"),
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    """List all resumes for the authenticated user."""
    resumes, total = await resume_repo.get_by_user(
        str(current_user.id),
        skip=pagination.skip,
        limit=pagination.page_size,
        status=status_filter,
    )
    return ResumeListResponse(
        resumes=[_resume_to_response(r) for r in resumes],
        total=total,
    )


# ─── GET /resume/{resume_id} ──────────────────────────────────────────────────
@router.get("/{resume_id}", response_model=ResumeDetailResponse)
async def get_resume(
    resume_id: str,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    """Get a specific resume by ID."""
    validate_object_id(resume_id, "resume_id")
    resume = await resume_repo.get_by_id_and_user(resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
    return _resume_to_response(resume)


# ─── PUT /resume/{resume_id} ──────────────────────────────────────────────────
@router.put("/{resume_id}", response_model=ResumeDetailResponse)
async def update_resume(
    resume_id: str,
    payload: ResumeUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    """Update resume tags or mark as primary."""
    validate_object_id(resume_id, "resume_id")
    resume = await resume_repo.get_by_id_and_user(resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
    update_data = payload.model_dump(exclude_none=True)
    if update_data.get("is_primary") is True:
        await resume_repo.collection.update_many(
            {"user_id": str(current_user.id), "_id": {"$ne": ObjectId(resume_id)}},
            {"$set": {"is_primary": False}},
        )
    updated = await resume_repo.update(resume_id, update_data)
    return _resume_to_response(updated)


# ─── POST /resume/{resume_id}/reparse ─────────────────────────────────────────
@router.post("/{resume_id}/reparse", response_model=ResumeUploadResponse)
async def reparse_resume(
    resume_id: str,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    parser: ParserService = Depends(get_parser_service),
):
    """Re-trigger parsing for an existing resume."""
    validate_object_id(resume_id, "resume_id")
    resume = await resume_repo.get_by_id_and_user(resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")

    idempotency_key = task_manager.compute_idempotency_key("reparse", resume_id)
    await task_manager.enqueue_task(
        task_name="parse_resume",
        payload={
            "resume_id": resume_id,
            "file_path": resume.storage_path,
            "file_type": resume.file_type,
            "user_id": str(current_user.id),
            "resume_repo": resume_repo,
            "user_repo": user_repo,
            "parser": parser,
        },
        task_coro_func=execute_resume_parse,
        idempotency_key=idempotency_key,
    )
    return ResumeUploadResponse(
        resume_id=resume_id,
        filename=resume.filename,
        status=ResumeStatus.PENDING,
        message="Reparsing triggered.",
    )


# ─── DELETE /resume/{resume_id} ───────────────────────────────────────────────
@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    resume_id: str,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    """Delete a resume — removes Cloudinary asset first, then MongoDB document."""
    validate_object_id(resume_id, "resume_id")
    resume = await resume_repo.get_by_id_and_user(resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")

    # Delete from Cloudinary
    cloudinary_public_id = getattr(resume, "cloudinary_public_id", None)
    if cloudinary_public_id:
        await cloudinary_delete(cloudinary_public_id, resource_type="raw")

    # Also delete the local temp file if it still exists
    if resume.storage_path and os.path.exists(resume.storage_path):
        await delete_file(resume.storage_path)

    deleted = await resume_repo.delete(resume_id, str(current_user.id))
    if not deleted:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Delete failed.")


def _resume_to_response(resume: ResumeModel) -> ResumeDetailResponse:
    err = getattr(resume, "error_message", None) or getattr(resume, "parse_error", None)
    return ResumeDetailResponse(
        id=str(resume.id),
        user_id=resume.user_id,
        filename=resume.filename,
        original_filename=resume.original_filename,
        file_type=resume.file_type,
        file_url=resume.file_url,
        file_size_bytes=resume.file_size_bytes,
        status=resume.status,
        parsed_data=resume.parsed_data,
        parse_error=err,
        error_message=err,
        tags=resume.tags,
        is_primary=resume.is_primary,
        version=resume.version,
        created_at=resume.created_at,
        updated_at=resume.updated_at,
    )
