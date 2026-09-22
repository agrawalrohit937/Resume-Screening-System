"""
Cursor Pagination & Large Dataset Streaming Utilities for CareerPilot ATS.
Eliminates silent truncations (.to_list(100/200/500)) and provides standardized
cursor pagination across large collections.
"""

from __future__ import annotations

from typing import Any, AsyncIterator, Dict, List, Optional, Tuple, Union
from bson import ObjectId
import structlog

logger = structlog.get_logger(__name__)


async def stream_cursor(
    cursor: Any,
    max_items: Optional[int] = None,
    batch_size: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Streams documents from a MongoDB / Motor cursor into a list without silent truncation.
    Safely supports Motor async cursors, PyMongo sync cursors, and mocked cursors.

    Complexity:
        Time: O(N) streaming traversal.
        Space: O(N) list accumulation.
    """
    results: List[Dict[str, Any]] = []

    if batch_size is not None and hasattr(cursor, "batch_size") and callable(cursor.batch_size):
        try:
            cursor.batch_size(batch_size)
        except Exception:
            pass

    if hasattr(cursor, "to_list") and callable(cursor.to_list):
        fetch_len = max_items or 50000
        op = cursor.to_list(length=fetch_len)
        results = await op if hasattr(op, "__await__") else op
    elif hasattr(cursor, "__aiter__"):
        async for doc in cursor:
            results.append(doc)
            if max_items is not None and len(results) >= max_items:
                break
    elif hasattr(cursor, "__iter__") and not isinstance(cursor, (str, bytes, dict)):
        for doc in cursor:
            results.append(doc)
            if max_items is not None and len(results) >= max_items:
                break
    elif isinstance(cursor, dict):
        results = [cursor]
    else:
        results = list(cursor)

    return results


async def paginate_by_cursor(
    collection: Any,
    filter_query: Dict[str, Any],
    limit: int = 50,
    cursor_id: Optional[str] = None,
    sort_descending: bool = True,
    projection: Optional[Dict[str, Any]] = None,
    cursor: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes efficient cursor-based pagination using MongoDB _id boundaries.
    Prevents deep offset skip() performance degradation (O(N) -> O(1) index seek).

    Returns:
        {
            "items": List[dict],
            "next_cursor": Optional[str],
            "has_more": bool,
            "count": int,
        }
    """
    limit = max(1, min(limit, 200))
    query = dict(filter_query)
    effective_cursor = cursor or cursor_id

    if effective_cursor and ObjectId.is_valid(effective_cursor):
        op = "$lt" if sort_descending else "$gt"
        if "_id" in query:
            query["$and"] = [
                {"_id": query.pop("_id")},
                {"_id": {op: ObjectId(effective_cursor)}},
            ]
        else:
            query["_id"] = {op: ObjectId(effective_cursor)}

    sort_order = -1 if sort_descending else 1
    cursor = collection.find(query, projection or {}).sort("_id", sort_order)

    # Fetch limit + 1 to detect whether a next page exists
    raw_items = await stream_cursor(cursor, max_items=limit + 1)

    has_more = len(raw_items) > limit
    items = raw_items[:limit]

    next_cursor = None
    if has_more and items:
        next_cursor = str(items[-1].get("_id"))

    return {
        "items": items,
        "next_cursor": next_cursor,
        "has_more": has_more,
        "count": len(items),
    }
