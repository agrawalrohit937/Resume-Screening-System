import base64
from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
import structlog

from services.email_service import EmailService

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.post("/apply", status_code=status.HTTP_200_OK)
@router.post("/careers/apply", status_code=status.HTTP_200_OK)
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
    Dispatches Brevo transactional email notification with the attached resume PDF to admin.
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

    if resume_file:
        resume_bytes = await resume_file.read()
        resume_filename = resume_file.filename or "resume.pdf"
        logger.info("Attached Resume File", filename=resume_filename, size=len(resume_bytes))

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

        return {
            "success": True,
            "message": "Application submitted successfully! Our hiring team will review your profile.",
            "email_sent": email_sent,
            "email_result": result,
        }
    except Exception as exc:
        logger.exception("Failed to process career application", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while submitting your application: {str(exc)}",
        )
