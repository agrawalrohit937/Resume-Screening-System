import asyncio
import base64
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile, status
import structlog

from config.db import get_database
from repositories.career_application_repo import CareerApplicationRepository
from services.cloudinary_service import upload_file, FOLDER_ROOT
from services.email_service import EmailService

logger = structlog.get_logger(__name__)

router = APIRouter()

FOLDER_CAREER_RESUMES = f"{FOLDER_ROOT}/career_resumes"


async def _background_send_email(db, repo_coll_name, app_id, full_name, email, role, linkedin_url, github_url, portfolio_url, cover_letter, resume_bytes, resume_filename):
    try:
        email_service = EmailService()
        result = await email_service.send_career_application(
            applicant_name=full_name,
            applicant_email=email,
            role_title=role,
            linkedin_url=linkedin_url,
            github_url=github_url,
            portfolio_url=portfolio_url,
            cover_letter=cover_letter,
            resume_bytes=resume_bytes,
            resume_filename=resume_filename,
        )
        if result.get("sent") and app_id:
            from bson import ObjectId
            await db[repo_coll_name].update_one(
                {"_id": ObjectId(app_id)},
                {"$set": {"email_sent": True}},
            )
    except Exception as exc:
        logger.exception("Failed to send career application email in background", error=str(exc))


@router.post("/apply", status_code=status.HTTP_201_CREATED)
async def submit_career_application(
    background_tasks: BackgroundTasks,
    full_name: str = Form(...),
    email: str = Form(...),
    role: str = Form(...),
    linkedin_url: Optional[str] = Form(None),
    github_url: Optional[str] = Form(None),
    portfolio_url: Optional[str] = Form(None),
    cover_letter: Optional[str] = Form(None),
    resume_file: Optional[UploadFile] = File(None),
):
    """
    Submit a candidate application with required PDF resume file upload.
    Saves to database and queues email notification in the background.
    """
    logger.info(
        "Received Job Application via Form",
        name=full_name,
        email=email,
        role=role,
        has_file=bool(resume_file),
    )

    resume_bytes = None
    resume_filename = None
    resume_url = None
    resume_public_id = None

    # ── Upload resume to Cloudinary ──────────────────────────────────────────
    if resume_file:
        resume_bytes = await resume_file.read()
        resume_filename = resume_file.filename or "resume.pdf"
        logger.info("Attached Resume File", filename=resume_filename, size=len(resume_bytes))

        try:
            resume_url, resume_public_id = await upload_file(
                resume_bytes,
                folder=FOLDER_CAREER_RESUMES,
                resource_type="raw",
            )
            logger.info("Resume uploaded to Cloudinary", url=resume_url, public_id=resume_public_id)
        except Exception as e:
            logger.error("Failed to upload resume to Cloudinary", error=str(e))

    # ── Save application to database ─────────────────────────────────────────
    db = get_database()
    repo = CareerApplicationRepository(db)

    clean_name = full_name.strip()
    clean_email = email.strip()
    clean_role = role.strip()
    clean_linkedin = linkedin_url.strip() if linkedin_url else None
    clean_github = github_url.strip() if github_url else None
    clean_portfolio = portfolio_url.strip() if portfolio_url else None
    clean_cover = cover_letter.strip() if cover_letter else ""

    app_data = {
        "applicant_name": clean_name,
        "email": clean_email,
        "role_title": clean_role,
        "linkedin_url": clean_linkedin,
        "github_url": clean_github,
        "portfolio_url": clean_portfolio,
        "cover_letter": clean_cover,
        "resume_url": resume_url,
        "resume_filename": resume_filename,
        "resume_public_id": resume_public_id,
        "status": "applied",
        "email_sent": False,
    }

    try:
        saved_app = await repo.create(app_data)
        logger.info("Career application saved to DB", app_id=saved_app.id)
    except Exception as exc:
        logger.exception("Failed to save career application to DB", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save your application. Please try again.",
        )

    # ── Send email notification in background task ───────────────────────────
    background_tasks.add_task(
        _background_send_email,
        db=db,
        repo_coll_name=repo.collection.name,
        app_id=saved_app.id,
        full_name=clean_name,
        email=clean_email,
        role=clean_role,
        linkedin_url=clean_linkedin,
        github_url=clean_github,
        portfolio_url=clean_portfolio,
        cover_letter=clean_cover,
        resume_bytes=resume_bytes,
        resume_filename=resume_filename,
    )

    return {
        "success": True,
        "message": "Application submitted successfully! Our hiring team will review your profile.",
        "application_id": saved_app.id,
        "email_sent": True,
    }
