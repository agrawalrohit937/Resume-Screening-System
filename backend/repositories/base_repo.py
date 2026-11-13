"""
Base Repository — Common Record Normalization and Relational Utilities (PostgreSQL).
"""

from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from config.db import get_pg_session_factory


class BaseRepository:
    """Base repository providing standardized document serialization, session management, and utilities."""

    def __init__(self, model_cls=None, session_factory=None, db=None, *args, **kwargs):
        self.model_cls = model_cls
        self.session_factory = session_factory or (db if callable(db) else get_pg_session_factory())

    @asynccontextmanager
    async def _get_session(self) -> AsyncIterator[AsyncSession]:
        """Provides an asynchronous database session context manager."""
        factory = self.session_factory or get_pg_session_factory()
        async with factory() as session:
            yield session

    def _serialize(self, doc: Any) -> Optional[Dict[str, Any]]:
        """
        Normalizes record identification across relational and serialized representations.
        Accepts either an ORM model instance or a dict.
        Ensures 'id' is always populated as a string; mirrors '_id' for legacy compatibility.
        """
        if doc is None:
            return None
        if hasattr(doc, "__table__"):
            d = {c.name: getattr(doc, c.name) for c in doc.__table__.columns}
        elif isinstance(doc, dict):
            d = dict(doc)
        else:
            return doc

        record_id = d.get("id") or d.get("_id")
        if record_id is not None:
            d["id"] = str(record_id)
            d["_id"] = str(record_id)
        return d

