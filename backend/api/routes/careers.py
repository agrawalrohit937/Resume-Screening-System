import asyncio
import base64
from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
import structlog

from config.db import get_database
from repositories.career_application_repo import CareerApplicationRepository
from services.cloudinary_service import upload_file, FOLDER_ROOT
from services.email_service import EmailService

logger = structlog.get_logger(__name__)

router = APIRouter()

FOLDER_CAREER_RESUMES = f"{FOLDER_ROOT}/career_resumes"


@router.post("/apply", status_code=status.HTTP_201_CREATED)
@router.post("/careers/apply", status_code=status.HTTP_201_CREATED)
async def submit_career_application(
    full_name: str = Form(...),
    email: str = Form(...),
    role: str = Form(...),
    portfolio_url: Optional[str] = Form(None),
    cover_letter: str = Form(...),
    resume_file: Optional[UploadFile] = File(None),
):
    """
    Submit a candidate application with optional PDF resume file upload.
    Now saves to database AND sends email notification to admin.
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
            # Continue without cloud URL — we still save the application

    # ── Save application to database ─────────────────────────────────────────
    db = get_database()
    repo = CareerApplicationRepository(db)

    app_data = {
        "applicant_name": full_name.strip(),
        "email": email.strip(),
        "role_title": role.strip(),
        "portfolio_url": portfolio_url.strip() if portfolio_url else None,
        "cover_letter": cover_letter.strip(),
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

    # ── Send email notification to admin (fire-and-forget) ───────────────────
    email_sent = False
    try:
        email_service = EmailService()
        result = await email_service.send_career_application(
            applicant_name=full_name.strip(),
            applicant_email=email.strip(),
            role_title=role.strip(),
            portfolio_url=portfolio_url.strip() if portfolio_url else None,
            cover_letter=cover_letter.strip(),
            resume_bytes=resume_bytes,
            resume_filename=resume_filename,
        )
        email_sent = bool(result.get("sent"))
        if not email_sent:
            logger.warning("Brevo email dispatch returned warning", error=result.get("error"), detail=result.get("detail"))
    except Exception as exc:
        logger.exception("Failed to send career application email", error=str(exc))
        # Don't fail the request — application is already saved in DB

    # ── Update email_sent status in DB ───────────────────────────────────────
    if email_sent and saved_app.id:
        try:
            await repo.update_status(saved_app.id, "applied")
            await db[repo.collection.name].update_one(
                {"_id": __import__("bson").ObjectId(saved_app.id)},
                {"$set": {"email_sent": True}},
            )
        except Exception:
            pass  # Non-critical

    return {
        "success": True,
        "message": "Application submitted successfully! Our hiring team will review your profile.",
        "application_id": saved_app.id,
        "email_sent": email_sent,
    }
