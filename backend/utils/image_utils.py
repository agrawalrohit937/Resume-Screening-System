"""
Profile Image Utils — Cloudinary storage

Validates, compresses/resizes the uploaded image (using Pillow), then
uploads the bytes to Cloudinary via cloudinary_service.py.

The stored value in MongoDB is the Cloudinary secure_url, and
profile_picture_public_id holds the Cloudinary public_id for deletion.
"""

import io
import uuid
from typing import Tuple

import structlog
from fastapi import HTTPException, UploadFile, status
from PIL import Image

from core.config import settings
from services.cloudinary_service import upload_profile_picture, delete_file as cloudinary_delete

logger = structlog.get_logger(__name__)

EXT_BY_CONTENT_TYPE = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


async def validate_and_save_profile_image(file: UploadFile, user_id: str) -> Tuple[str, str, int]:
    """
    Validates type/size, compresses/resizes if needed, then uploads to Cloudinary.

    Returns (secure_url, file_size_bytes).
    Raises HTTPException on validation failure.
    """
    content_type = (file.content_type or "").lower()
    if content_type not in settings.PROFILE_ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPG, JPEG, PNG, or WEBP images are allowed.",
        )

    raw = await file.read()
    if len(raw) > settings.profile_max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image too large. Max size is {settings.PROFILE_MAX_SIZE_MB}MB.",
        )

    try:
        image = Image.open(io.BytesIO(raw))
        image.verify()  # catches corrupted/non-image files pretending to be images
        image = Image.open(io.BytesIO(raw))  # re-open after verify() invalidates the object
    except Exception:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.")

    ext = EXT_BY_CONTENT_TYPE.get(content_type, "jpg")

    # Convert to RGB for JPEG (no alpha channel support), keep transparency for PNG/WEBP
    if ext == "jpg" and image.mode in ("RGBA", "P"):
        image = image.convert("RGB")

    # Resize if larger than max dimension (keeps aspect ratio)
    max_dim = settings.PROFILE_IMAGE_MAX_DIMENSION
    if max(image.size) > max_dim:
        image.thumbnail((max_dim, max_dim), Image.LANCZOS)

    # Compress to bytes buffer
    buf = io.BytesIO()
    save_kwargs: dict = {}
    if ext == "jpg":
        save_kwargs = {"quality": 85, "optimize": True}
    elif ext == "webp":
        save_kwargs = {"quality": 85}
    elif ext == "png":
        save_kwargs = {"optimize": True}

    image.save(buf, format={"jpg": "JPEG", "png": "PNG", "webp": "WEBP"}[ext], **save_kwargs)
    compressed_bytes = buf.getvalue()
    file_size = len(compressed_bytes)

    # Upload to Cloudinary with fallback to Base64 Data URI if network/DNS fails
    try:
        secure_url, public_id = await upload_profile_picture(compressed_bytes, user_id, ext)
        logger.info("Profile image uploaded to Cloudinary", user_id=user_id, url=secure_url, size=file_size)
        return secure_url, public_id, file_size
    except Exception as err:
        logger.warning("Cloudinary upload unavailable, using Base64 Data URI fallback", error=str(err))
        import base64
        b64_str = base64.b64encode(compressed_bytes).decode("utf-8")
        mime = f"image/{ext if ext != 'jpg' else 'jpeg'}"
        data_uri = f"data:{mime};base64,{b64_str}"
        return data_uri, f"fallback_b64_{uuid.uuid4().hex[:8]}", file_size


async def delete_profile_image(old_public_id: str) -> None:
    """
    Deletes a previously-uploaded custom image from Cloudinary.
    Silently no-ops for None/empty values.

    `old_public_id` is the Cloudinary public_id stored in MongoDB.
    Legacy HTTP URLs are skipped gracefully.
    """
    if not old_public_id:
        return
    # Skip if it looks like an HTTP URL (legacy data that was stored as a URL)
    if old_public_id.startswith("http"):
        logger.info("Skipping legacy HTTP URL for profile image deletion", value=old_public_id)
        return
    await cloudinary_delete(old_public_id, resource_type="image")
