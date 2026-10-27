"""
Base Repository — Common MongoDB Document Normalization and Utilities.
"""

from typing import Any, Dict, Optional


class BaseRepository:
    """Base repository providing standardized MongoDB document serialization and utilities."""

    @property
    def db(self):
        """Returns the database instance from internal reference or collection."""
        if hasattr(self, "_db") and self._db is not None:
            return self._db
        if hasattr(self, "collection") and hasattr(self.collection, "database"):
            return self.collection.database
        return None

    @db.setter
    def db(self, value):
        self._db = value


    def _serialize(self, doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Normalizes MongoDB ObjectId `_id` into a string `_id` for Pydantic model validation.
        Idempotent and safe for None inputs.
        """
        if doc and "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return doc
