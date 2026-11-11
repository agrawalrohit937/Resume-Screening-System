"""
Base Repository — Common Record Normalization and Relational Utilities (PostgreSQL).
"""

from typing import Any, Dict, Optional


class BaseRepository:
    """Base repository providing standardized document serialization and utilities."""

    def __init__(self, *args, **kwargs):
        pass

    def _serialize(self, doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Normalizes record identification across relational and serialized representations.
        Ensures 'id' is always populated as a string; mirrors '_id' for legacy compatibility.
        """
        if not doc:
            return None
        record_id = doc.get("id") or doc.get("_id")
        if record_id is not None:
            doc["id"] = str(record_id)
            doc["_id"] = str(record_id)
        return doc
