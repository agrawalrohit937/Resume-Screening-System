"""
Base Repository — Common MongoDB Document Normalization and Utilities.
"""

from typing import Any, Dict, Optional


class BaseRepository:
    """Base repository providing standardized MongoDB document serialization and utilities."""

    def _serialize(self, doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Normalizes MongoDB ObjectId `_id` into a string `_id` for Pydantic model validation.
        Idempotent and safe for None inputs.
        """
        if doc and "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return doc
