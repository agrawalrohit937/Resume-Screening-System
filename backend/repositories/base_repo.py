"""
Base Repository — Common Document Normalization and Utilities (PostgreSQL).
"""

from typing import Any, Dict, List, Optional, Tuple, Union


class BaseRepository:
    """Base repository providing standardized document serialization and utilities."""

    def __init__(self, *args, **kwargs):
        pass

    def _serialize(self, doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Normalizes document `_id` into a string `_id` for Pydantic model validation.
        Idempotent and safe for None inputs.
        """
        if doc and "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return doc
