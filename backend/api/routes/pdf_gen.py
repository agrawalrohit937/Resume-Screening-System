"""
PDF Generator Routes — Generate ATS-friendly resume PDF
"""

import os
import uuid
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse

from api.deps import get_current_user, get_resume_repo, get_pdf_service
from core.config import settings
from models.resume_model import ResumeStatus
from models.user_model import UserModel
from repositories.resume_repo import ResumeRepository
from services.pdf_generator_service import PDFGeneratorService
from utils.validators import validate_object_id

router = APIRouter()


def _temp_storage_dir() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "temp_storage"))


class GeneratePDFRequest(BaseModel):
    resume_id: str
    template: str = Field(default="modern", pattern="^(modern|classic|minimal)$")


@router.post("/generate")
async def generate_resume_pdf(
    payload: GeneratePDFRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    pdf_service: PDFGeneratorService = Depends(get_pdf_service),
):
    """
    Generate an ATS-friendly resume PDF from parsed resume data.
    Uploads the PDF to Cloudinary and returns the public URL.
    """
    validate_object_id(payload.resume_id, "resume_id")
    resume = await resume_repo.get_by_id_and_user(payload.resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
    if resume.status != ResumeStatus.PARSED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Resume must be parsed before PDF generation.",
        )

    output_filename = f"resume_{uuid.uuid4().hex[:8]}.pdf"
    output_path = os.path.join(_temp_storage_dir(), output_filename)

    # generate_resume_pdf now uploads to Cloudinary and returns secure_url
    pdf_url = await pdf_service.generate_resume_pdf(
        resume, output_path, template=payload.template
    )

    # Save Cloudinary URL in DB
    await resume_repo.update(
        payload.resume_id,
        {"file_url": pdf_url}
    )

    return {
        "success": True,
        "resume_id": payload.resume_id,
        "pdf_url": pdf_url,
        "message": "PDF generated successfully.",
    }


@router.get("/download/{filename}")
async def download_pdf(filename: str):
    """
    This endpoint is no longer needed since PDFs are served directly from Cloudinary.
    Returns a 410 Gone to inform clients to use the Cloudinary URL instead.
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Local PDF downloads are disabled. Use the Cloudinary URL returned by /pdf/generate.",
    )
