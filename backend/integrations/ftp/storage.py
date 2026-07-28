"""
integrations/ftp/storage.py — DEPRECATED. Storage is now on Cloudinary.
This shim is kept so any remaining import paths do not crash.
"""

# All actual uploads/deletes go through services/cloudinary_service.py.
# This file intentionally left as a no-op stub.

def get_public_url(folder: str, filename: str) -> str:
    raise NotImplementedError("FTP storage is removed. Use cloudinary_service instead.")

def upload_and_get_url(folder: str, filename: str, file_bytes: bytes) -> str:
    raise NotImplementedError("FTP storage is removed. Use cloudinary_service instead.")

def delete_by_public_url(folder: str, public_url: str) -> None:
    raise NotImplementedError("FTP storage is removed. Use cloudinary_service instead.")