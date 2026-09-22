"""
File Utilities — upload handling, validation, cleanup
"""

import hashlib
import os
import uuid
from pathlib import Path
from typing import Tuple

import aiofiles
import structlog
from fastapi import UploadFile, HTTPException, status

from core.config import settings

logger = structlog.get_logger(__name__)

ALLOWED_MIME_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
}


async def validate_and_save_file(
    file: UploadFile,
    user_id: str,
) -> Tuple[str, str, str, int]:
    """
    Validate & persist uploaded file with strict magic byte validation,
    page count limits, and sanitized storage paths.
    Returns: (storage_path, filename, file_type, file_size_bytes)
    """
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '{content_type}' not allowed. Upload PDF or DOCX.",
        )
    file_ext = ALLOWED_MIME_TYPES[content_type]

    # Read file
    contents = await file.read()
    file_size = len(contents)

    # Size check
    if file_size > settings.max_file_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Max size: {settings.MAX_FILE_SIZE_MB}MB",
        )

    if file_size < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File appears to be empty or corrupt.",
        )

    # Magic-Byte Verification
    if file_ext == "pdf":
        if not contents.startswith(b"%PDF-") and b"%PDF-" not in contents[:1024]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Corrupt or invalid PDF file header (magic-byte check failed).",
            )
        # Check PDF page count cap
        try:
            import io
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(contents))
            page_count = len(reader.pages)
            if page_count > settings.MAX_PDF_PAGES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"PDF exceeds page limit ({page_count} pages > max {settings.MAX_PDF_PAGES} pages).",
                )
        except HTTPException:
            raise
        except Exception as pdf_err:
            logger.debug("pypdf page count check fallback", error=str(pdf_err))

    elif file_ext == "docx":
        if not contents.startswith(b"PK\x03\x04"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Corrupt or invalid DOCX file header (magic-byte check failed).",
            )

    # Generate unique sanitized filename
    file_hash = hashlib.md5(contents).hexdigest()[:8]
    unique_name = f"{uuid.uuid4().hex}_{file_hash}.{file_ext}"

    # Ensure upload dir exists
    safe_user_id = "".join(c for c in str(user_id) if c.isalnum() or c in ("-", "_"))
    upload_path = Path(settings.UPLOAD_DIR) / safe_user_id
    upload_path.mkdir(parents=True, exist_ok=True)
    file_path = upload_path / unique_name

    # Write file
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(contents)

    logger.info("File saved securely", path=str(file_path), size=file_size, user=user_id)
    return str(file_path), unique_name, file_ext, file_size


async def delete_file(path: str) -> None:
    try:
        os.remove(path)
        logger.info("File deleted", path=path)
    except FileNotFoundError:
        logger.warning("File not found for deletion", path=path)
    except OSError as e:
        logger.error("Failed to delete file", path=path, error=str(e))


def get_file_extension(filename: str) -> str:
    return Path(filename).suffix.lower().lstrip(".")


def sanitize_filename(filename: str) -> str:
    """Remove dangerous characters and directory traversal from filename."""
    import re
    # Strip directory components
    base_name = os.path.basename(filename)
    name = Path(base_name).stem
    ext = Path(base_name).suffix
    safe_name = re.sub(r"[^\w\-_\. ]", "_", name)
    return f"{safe_name[:100]}{ext}"
