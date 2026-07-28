"""
Certificate Storage — Cloudinary (replaces FTP).
"""

import asyncio
from functools import partial

from services.cloudinary_service import upload_certificate, delete_file as cloudinary_delete


class CloudinaryCertificateStorage:
    """Abstraction for certificate uploads using Cloudinary."""

    @staticmethod
    def upload(filename: str, pdf_bytes: bytes) -> str:
        """
        Synchronous wrapper around async Cloudinary upload.
        Returns the secure public URL.
        Called from synchronous rendering contexts.
        """
        cert_id = filename.replace(".pdf", "")
        loop = asyncio.new_event_loop()
        try:
            secure_url, _public_id = loop.run_until_complete(
                upload_certificate(pdf_bytes, cert_id)
            )
        finally:
            loop.close()
        return secure_url

    @staticmethod
    async def async_upload(filename: str, pdf_bytes: bytes) -> tuple:
        """
        Async upload. Returns (secure_url, public_id).
        """
        cert_id = filename.replace(".pdf", "")
        return await upload_certificate(pdf_bytes, cert_id)


# Backward-compat alias used by certificates/service.py
FTPCertificateStorage = CloudinaryCertificateStorage