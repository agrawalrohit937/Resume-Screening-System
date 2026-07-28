"""
Resume Routes — Upload, Parse, List, Delete
"""

import os
import uuid
from datetime import datetime, timezone

import structlog
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import RedirectResponse

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
        parsed = await parser.parse_resume(file_path, file_type)
        await resume_repo.update_parsed_data(resume_id, parsed.model_dump())
        await user_repo.increment_counter(user_id, "total_resumes")
        logger.info("Resume parsed", resume_id=resume_id)

    except Exception as e:
        logger.error("Resume parse failed", resume_id=resume_id, error=str(e))
        await resume_repo.update_status(resume_id, ResumeStatus.FAILED, error=str(e))

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

    # Delete old resumes for this user from Cloudinary and MongoDB
    old_resumes = await resume_repo.collection.find(
        {"user_id": str(current_user.id)}
    ).to_list(length=None)

    for old_resume in old_resumes:
        old_pid = old_resume.get("cloudinary_public_id")
        if old_pid:
            await cloudinary_delete(old_pid, resource_type="raw")

    await resume_repo.collection.delete_many({"user_id": str(current_user.id)})

    # Save in DB
    resume_data = {
        "user_id": str(current_user.id),
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

    # ── Save as primary profile resume on the User document ───────────────
    await user_repo.collection.update_one(
        {"_id": ObjectId(str(current_user.id))},
        {"$set": {
            "profile_resume_url": file_url,
            "profile_resume_name": original_filename,
            "updated_at": datetime.now(timezone.utc),
        }}
    )

    resume = await resume_repo.create(resume_data)

    # Gamification
    await gamification.mark_daily_activity(str(current_user.id))

    # Background parsing
    background_tasks.add_task(
        _parse_resume_background,
        str(resume.id), storage_path, file_type,
        resume_repo, user_repo, str(current_user.id), parser,
    )

    return ResumeUploadResponse(
        resume_id=str(resume.id),
        filename=filename,
        status=ResumeStatus.PENDING,
        message="Resume uploaded. Parsing in progress — check status in a few seconds.",
    )


# ─── GET /resume/ ─────────────────────────────────────────────────────────────
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

    background_tasks.add_task(
        _parse_resume_background,
        resume_id, resume.storage_path, resume.file_type,
        resume_repo, user_repo, str(current_user.id), parser,
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
        tags=resume.tags,
        is_primary=resume.is_primary,
        version=resume.version,
        created_at=resume.created_at,
        updated_at=resume.updated_at,
    )
