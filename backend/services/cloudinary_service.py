"""
Cloudinary Service — Centralized file upload/delete via Cloudinary.

Folder layout under the 'careerpilot' root:
    careerpilot/profile_pictures/
    careerpilot/resumes/
    careerpilot/ats_resumes/
    careerpilot/certificates/
    careerpilot/company_logos/
    careerpilot/course_images/
    careerpilot/skill_icons/
"""

import asyncio
import io
import os
from functools import partial
from typing import Optional, Tuple
import tempfile
import cloudinary
import cloudinary.uploader
import cloudinary.api
import structlog
import uuid
from core.config import settings

logger = structlog.get_logger(__name__)

# ── Cloudinary folders ────────────────────────────────────────────────────────
FOLDER_ROOT = "careerpilot"

FOLDER_PROFILE_PICTURES = f"{FOLDER_ROOT}/profile_pictures"
FOLDER_RESUMES          = f"{FOLDER_ROOT}/resumes"
FOLDER_ATS_RESUMES      = f"{FOLDER_ROOT}/ats_resumes"
FOLDER_CERTIFICATES     = f"{FOLDER_ROOT}/certificates"
FOLDER_COMPANY_LOGOS    = f"{FOLDER_ROOT}/company_logos"
FOLDER_COURSE_IMAGES    = f"{FOLDER_ROOT}/course_images"
FOLDER_SKILL_ICONS      = f"{FOLDER_ROOT}/skill_icons"

# Allowed MIME types for validation
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
ALLOWED_PDF_TYPES   = {"application/pdf"}
ALLOWED_ALL_TYPES   = ALLOWED_IMAGE_TYPES | ALLOWED_PDF_TYPES


def _init_cloudinary():
    """Configure Cloudinary from settings — called once at import time."""
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


_init_cloudinary()


# ── Core upload / delete ──────────────────────────────────────────────────────

import gc

def _sync_upload(
    file_bytes: bytes,
    folder: str,
    public_id: Optional[str] = None,
    resource_type: str = "auto",
) -> dict:
    """Synchronous Cloudinary upload — called via run_in_executor to stay async-safe."""
    upload_kwargs: dict = {
        "folder": folder,
        "resource_type": resource_type,
        "overwrite": True,
    }
    if public_id:
        upload_kwargs["public_id"] = public_id

    try:
        with io.BytesIO(file_bytes) as bio:
            result = cloudinary.uploader.upload(
                bio,
                **upload_kwargs,
            )
        return result
    finally:
        gc.collect()


def _sync_delete(public_id: str, resource_type: str = "auto") -> dict:
    """Synchronous Cloudinary delete."""
    return cloudinary.uploader.destroy(public_id, resource_type=resource_type)


async def upload_file(
    file_bytes: bytes,
    folder: str,
    public_id: Optional[str] = None,
    resource_type: str = "auto",
) -> Tuple[str, str]:
    """
    Upload bytes to Cloudinary.

    Returns: (secure_url, public_id)
    """
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        None,
        partial(_sync_upload, file_bytes, folder, public_id, resource_type),
    )
    secure_url = result["secure_url"]
    pid = result["public_id"]
    logger.info("Cloudinary upload success", folder=folder, public_id=pid, url=secure_url)
    return secure_url, pid


async def delete_file(public_id: str, resource_type: str = "auto") -> None:
    """
    Delete a Cloudinary asset by public_id. Silently ignores missing assets.
    """
    if not public_id:
        return
    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(
            None,
            partial(_sync_delete, public_id, resource_type),
        )
        if result.get("result") not in ("ok", "not found"):
            logger.warning("Cloudinary delete unexpected result", public_id=public_id, result=result)
        else:
            logger.info("Cloudinary delete success", public_id=public_id)
    except Exception as exc:
        logger.error("Cloudinary delete error", public_id=public_id, error=str(exc))


# ── Convenience upload helpers per asset category ────────────────────────────

async def upload_profile_picture(file_bytes: bytes, user_id: str, ext: str = "jpg") -> Tuple[str, str]:
    """Upload user profile picture. Returns (secure_url, public_id)."""
    import time
    public_id = f"profile_{user_id}_{int(time.time())}"
    return await upload_file(file_bytes, FOLDER_PROFILE_PICTURES, public_id=public_id, resource_type="image")


async def upload_resume(file_bytes: bytes, filename: str) -> Tuple[str, str]:
    """Upload a PDF/DOCX resume. Returns (secure_url, public_id)."""
    
    # 1. Extract the original extension (fallback to .pdf if none exists)
    _, ext = os.path.splitext(filename or "resume.pdf")
    if not ext:
        ext = ".pdf"
        
    # 2. Generate a unique public_id that INCLUDES the extension
    # Example output: resume_a1b2c3d4.pdf
    unique_id = f"resume_{uuid.uuid4().hex[:8]}{ext}"
    
    # 3. Pass the unique_id as the public_id
    return await upload_file(
        file_bytes, 
        FOLDER_RESUMES, 
        public_id=unique_id, 
        resource_type="raw"
    )


async def upload_ats_resume(file_bytes: bytes, filename: str) -> Tuple[str, str]:
    """
    Upload generated ATS resume PDF to Cloudinary.

    - Preserves filename
    - Ensures .pdf extension
    - Avoids Cloudinary treating the upload as 'stream'
    """

    # Normalize filename
    safe_name = os.path.basename(filename or "ats_resume.pdf").strip()

    base, _ = os.path.splitext(safe_name)
    base = base.strip() or "ats_resume"

    # Remove unsafe characters
    base = "".join(
        c if (c.isalnum() or c in ("-", "_")) else "_"
        for c in base
    )

    public_id = base

    loop = asyncio.get_running_loop()

    def _sync_upload_ats():
        # Create a temporary PDF file
        with tempfile.NamedTemporaryFile(
            suffix=".pdf",
            delete=False
        ) as tmp:
            tmp.write(file_bytes)
            temp_path = tmp.name

        try:
            result = cloudinary.uploader.upload(
                temp_path,
                folder=FOLDER_ATS_RESUMES,
                resource_type="raw",
                public_id=public_id,
                overwrite=True,
                use_filename=True,
                unique_filename=False,
            )

            print("========== ATS CLOUDINARY RESULT ==========")
            for k, v in result.items():
                print(k, ":", v)
            print("===========================================")

            return result

        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    result = await loop.run_in_executor(None, _sync_upload_ats)

    secure_url = result["secure_url"]
    pid = result["public_id"]

    logger.info(
        "Cloudinary ATS upload success",
        folder=FOLDER_ATS_RESUMES,
        public_id=pid,
        url=secure_url,
    )

    return secure_url, pid


async def upload_certificate(file_bytes: bytes, cert_id: str):
    loop = asyncio.get_running_loop()
    def _sync_upload_certificate():
        return cloudinary.uploader.upload(
            io.BytesIO(file_bytes),
            folder=FOLDER_CERTIFICATES,
            resource_type="raw",
            public_id=f"cert_{cert_id}",
            overwrite=True,
            use_filename=True,
            unique_filename=False,
            filename=f"cert_{cert_id}.pdf",
        )
    result = await loop.run_in_executor(None, _sync_upload_certificate)
    return result["secure_url"], result["public_id"]

async def upload_company_logo(file_bytes: bytes, company_id: str) -> Tuple[str, str]:
    """Upload company logo. Returns (secure_url, public_id)."""
    return await upload_file(file_bytes, FOLDER_COMPANY_LOGOS, resource_type="image")


async def upload_course_image(file_bytes: bytes) -> Tuple[str, str]:
    """Upload course image. Returns (secure_url, public_id)."""
    return await upload_file(file_bytes, FOLDER_COURSE_IMAGES, resource_type="image")


async def upload_skill_icon(file_bytes: bytes, skill_name: str) -> Tuple[str, str]:
    """Upload skill icon. Returns (secure_url, public_id)."""
    return await upload_file(file_bytes, FOLDER_SKILL_ICONS, resource_type="image")


# ── Validation helpers ────────────────────────────────────────────────────────

def validate_image_type(content_type: str) -> bool:
    return (content_type or "").lower() in ALLOWED_IMAGE_TYPES


def validate_pdf_type(content_type: str) -> bool:
    return (content_type or "").lower() in ALLOWED_PDF_TYPES


def validate_file_type(content_type: str) -> bool:
    return (content_type or "").lower() in ALLOWED_ALL_TYPES
