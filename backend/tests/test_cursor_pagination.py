"""
Unit tests for Task 4.4: Cursor Pagination & Large Dataset Optimization.
Validates stream_cursor and paginate_by_cursor across various cursor interfaces.
"""

from __future__ import annotations

import pytest
from bson import ObjectId
from utils.pagination import stream_cursor, paginate_by_cursor


class MockAsyncCursor:
    def __init__(self, items: list):
        self.items = items
        self.index = 0

    def __aiter__(self):
        self.index = 0
        return self

    async def __anext__(self):
        if self.index >= len(self.items):
            raise StopAsyncIteration
        item = self.items[self.index]
        self.index += 1
        return item


class MockMotorCursor:
    def __init__(self, items: list):
        self.items = items
        self.skip_val = 0
        self.limit_val = len(items)

    def skip(self, n: int):
        self.skip_val = n
        return self

    def limit(self, n: int):
        self.limit_val = n
        return self

    def sort(self, key, direction=None):
        return self

    async def to_list(self, length=None):
        sub = self.items[self.skip_val:]
        if length is not None:
            sub = sub[:length]
        return sub


class MockCollection:
    def __init__(self, documents: list):
        self.docs = sorted(documents, key=lambda d: d["_id"], reverse=True)

    def find(self, filter_dict=None, projection=None):
        filter_dict = filter_dict or {}
        matching = []
        for doc in self.docs:
            match = True
            if "$and" in filter_dict:
                for sub in filter_dict["$and"]:
                    if "_id" in sub and isinstance(sub["_id"], dict):
                        op = sub["_id"]
                        if "$lt" in op and not (doc["_id"] < op["$lt"]):
                            match = False
                        if "$gt" in op and not (doc["_id"] > op["$gt"]):
                            match = False
            elif "_id" in filter_dict and isinstance(filter_dict["_id"], dict):
                op = filter_dict["_id"]
                if "$lt" in op and not (doc["_id"] < op["$lt"]):
                    match = False
                if "$gt" in op and not (doc["_id"] > op["$gt"]):
                    match = False
            if match:
                matching.append(doc)
        return MockMotorCursor(matching)


@pytest.mark.asyncio
async def test_stream_cursor_async_iterator():
    items = [{"_id": ObjectId(), "name": f"item_{i}"} for i in range(15)]
    cursor = MockAsyncCursor(items)
    results = await stream_cursor(cursor)
    assert len(results) == 15
    assert results[0]["name"] == "item_0"
    assert results[-1]["name"] == "item_14"


@pytest.mark.asyncio
async def test_stream_cursor_motor_cursor():
    items = [{"_id": ObjectId(), "name": f"item_{i}"} for i in range(25)]
    cursor = MockMotorCursor(items)
    results = await stream_cursor(cursor, batch_size=10)
    assert len(results) == 25


@pytest.mark.asyncio
async def test_stream_cursor_plain_iterable():
    items = [{"id": 1}, {"id": 2}, {"id": 3}]
    results = await stream_cursor(items)
    assert results == items


@pytest.mark.asyncio
async def test_paginate_by_cursor():
    sample_ids = [ObjectId() for _ in range(50)]
    # Ensure sorted descending
    sample_ids = sorted(sample_ids, reverse=True)
    docs = [{"_id": oid, "val": i} for i, oid in enumerate(sample_ids)]
    coll = MockCollection(docs)

    # Page 1: limit 10
    page1 = await paginate_by_cursor(coll, filter_query={}, limit=10)
    assert len(page1["items"]) == 10
    assert page1["has_more"] is True
    assert page1["next_cursor"] is not None
    assert page1["next_cursor"] == str(page1["items"][-1]["_id"])

    # Page 2: with cursor from page 1
    cursor_id = page1["next_cursor"]
    page2 = await paginate_by_cursor(coll, filter_query={}, limit=10, cursor=cursor_id)
    assert len(page2["items"]) == 10
    assert page2["items"][0]["_id"] < ObjectId(cursor_id)
    assert page2["has_more"] is True

    # Traverse all pages until has_more is False
    all_collected = list(page1["items"]) + list(page2["items"])
    cur = page2["next_cursor"]
    while cur:
        next_page = await paginate_by_cursor(coll, filter_query={}, limit=10, cursor=cur)
        all_collected.extend(next_page["items"])
        cur = next_page["next_cursor"]

    assert len(all_collected) == 50
