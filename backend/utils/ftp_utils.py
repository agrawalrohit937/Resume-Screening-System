"""
ftp_utils.py — DEPRECATED. All file storage now goes through Cloudinary.

This module is kept as a compatibility shim so that any remaining imports
do not crash. All functions forward to cloudinary_service.
"""

# No active FTP logic — kept only so old import paths don't break during
# the migration rollout. Remove this file once all callers are updated.

from services.cloudinary_service import (  # noqa: F401
    upload_file as _upload_file,
    delete_file as _delete_file,
)