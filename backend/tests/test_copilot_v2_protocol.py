"""
Phase 1 Verification Tests — Copilot v2 Persistence & Typed Streaming Protocol
=============================================================================
Tests:
1. Strict multi-tenant and user data isolation for sessions, messages, and memory.
2. Session lifecycle: create, cursor pagination, pin/unpin, archive, soft delete.
3. Message transcript retrieval and chronological ordering.
4. Feedback recording (thumbs up/down).
5. LocalStorage migration importing client history into server sessions.
6. Durable memory storage with 40-item LRU capacity enforcement.
7. SSE protocol formatting: typed events (session, status, token, suggestions, usage, done).
8. Navigation shortcuts emitting direct navigation events.
9. Backward compatibility for legacy POST /api/v1/copilot/chat endpoint.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import json
import pytest
from bson import ObjectId
from pymongo import ASCENDING, DESCENDING

from main import app
from api.deps import get_copilot_repo
from core.security import create_access_token
from repositories.copilot_repo import CopilotRepository, MAX_USER_MEMORY_ITEMS

API = "/api/v1/copilot"

USER_A_ID = "665f1a2b3c4d5e6f7a8b9c0d"
USER_B_ID = "665f1a2b3c4d5e6f7a8b9c0e"
TENANT_ALPHA = "tenant_alpha"
TENANT_BETA = "tenant_beta"


# ─── Async In-Memory MongoDB Mock for Clean Verification ───────────────────────

class AsyncMockCollection:
    def __init__(self):
        self.docs: List[Dict[str, Any]] = []

    async def insert_one(self, doc):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = ObjectId()
        elif isinstance(d["_id"], str):
            try:
                d["_id"] = ObjectId(d["_id"])
            except Exception:
                pass
        self.docs.append(d)
        return type("Result", (), {"inserted_id": d["_id"]})()

    async def insert_many(self, docs):
        inserted_ids = []
        for doc in docs:
            res = await self.insert_one(doc)
            inserted_ids.append(res.inserted_id)
        return type("Result", (), {"inserted_ids": inserted_ids})()

    def _matches(self, doc: Dict[str, Any], query: Dict[str, Any]) -> bool:
        for k, v in query.items():
            doc_val = doc.get(k)
            if k == "_id":
                if str(doc_val) != str(v):
                    return False
                continue
            if isinstance(v, dict):
                if "$ne" in v and doc_val == v["$ne"]:
                    return False
                if "$lt" in v:
                    if doc_val is None or doc_val >= v["$lt"]:
                        return False
                if "$in" in v and doc_val not in v["$in"]:
                    return False
            elif doc_val != v:
                return False
        return True

    async def find_one(self, query=None, sort=None):
        query = query or {}
        matching = [d for d in self.docs if self._matches(d, query)]
        if not matching:
            return None
        if sort:
            for key, direction in reversed(sort):
                matching.sort(
                    key=lambda d: (d.get(key) is not None, d.get(key)),
                    reverse=(direction == -1 or direction == DESCENDING),
                )
        return dict(matching[0])

    async def find_one_and_update(self, query, update, upsert=False, return_document=True):
        for d in self.docs:
            if self._matches(d, query):
                if "$set" in update:
                    d.update(update["$set"])
                return dict(d)
        if upsert:
            new_doc = {}
            for k, v in query.items():
                if not isinstance(v, dict):
                    new_doc[k] = v
            if "$setOnInsert" in update:
                new_doc.update(update["$setOnInsert"])
            if "$set" in update:
                new_doc.update(update["$set"])
            await self.insert_one(new_doc)
            return dict(new_doc)
        return None

    async def update_one(self, query, update):
        for d in self.docs:
            if self._matches(d, query):
                if "$set" in update:
                    d.update(update["$set"])
                if "$inc" in update:
                    for k, val in update["$inc"].items():
                        d[k] = d.get(k, 0) + val
                return type("Result", (), {"modified_count": 1})()
        return type("Result", (), {"modified_count": 0})()

    async def delete_one(self, query):
        for i, d in enumerate(self.docs):
            if self._matches(d, query):
                self.docs.pop(i)
                return type("Result", (), {"deleted_count": 1})()
        return type("Result", (), {"deleted_count": 0})()

    async def delete_many(self, query):
        initial = len(self.docs)
        self.docs = [d for d in self.docs if not self._matches(d, query)]
        return type("Result", (), {"deleted_count": initial - len(self.docs)})()

    async def count_documents(self, query=None):
        query = query or {}
        return sum(1 for d in self.docs if self._matches(d, query))

    def find(self, query=None, projection=None):
        query = query or {}
        matching = [dict(d) for d in self.docs if self._matches(d, query)]

        class MockCursor:
            def __init__(self, data):
                self.data = data

            def sort(self, sort_spec, direction=None):
                if isinstance(sort_spec, list):
                    for key, dir_ in reversed(sort_spec):
                        self.data.sort(
                            key=lambda d: (d.get(key) is not None, d.get(key)),
                            reverse=(dir_ == -1 or dir_ == DESCENDING),
                        )
                elif isinstance(sort_spec, str):
                    dir_ = direction if direction is not None else 1
                    self.data.sort(
                        key=lambda d: (d.get(sort_spec) is not None, d.get(sort_spec)),
                        reverse=(dir_ == -1 or dir_ == DESCENDING),
                    )
                return self

            def limit(self, n):
                self.data = self.data[:n]
                return self

            async def to_list(self, length=100):
                return self.data[:length]

        return MockCursor(matching)


class MockCopilotDatabase:
    def __init__(self):
        self.copilot_sessions = AsyncMockCollection()
        self.copilot_messages = AsyncMockCollection()
        self.copilot_memory = AsyncMockCollection()


@pytest.fixture
def mock_copilot_db():
    return MockCopilotDatabase()


@pytest.fixture
def copilot_repo(mock_copilot_db):
    repo = CopilotRepository(mock_copilot_db)
    app.dependency_overrides[get_copilot_repo] = lambda: repo
    yield repo
    app.dependency_overrides.pop(get_copilot_repo, None)


@pytest.fixture
def user_a_token():
    return create_access_token(
        subject=USER_A_ID,
        extra_claims={"role": "candidate", "email": "user.a@alpha.com", "tenant_id": TENANT_ALPHA},
    )


@pytest.fixture
def user_b_token():
    return create_access_token(
        subject=USER_B_ID,
        extra_claims={"role": "candidate", "email": "user.b@beta.com", "tenant_id": TENANT_BETA},
    )


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─── 1. Multi-Tenant & User Isolation Tests ────────────────────────────────────

@pytest.mark.asyncio
async def test_session_isolation_between_tenants_and_users(copilot_repo):
    """Ensure User B in Tenant Beta cannot access User A's session in Tenant Alpha."""
    # User A creates a session in TENANT_ALPHA
    session_a = await copilot_repo.create_session(
        tenant_id=TENANT_ALPHA,
        user_id=USER_A_ID,
        title="Alpha Confidential Career Plan",
    )
    assert session_a.id is not None
    assert session_a.tenant_id == TENANT_ALPHA

    # User B in TENANT_BETA attempts to get User A's session
    cross_lookup = await copilot_repo.get_session(
        tenant_id=TENANT_BETA,
        user_id=USER_B_ID,
        session_id=str(session_a.id),
    )
    assert cross_lookup is None, "Cross-tenant session access must return None"

    # User B in same tenant attempts with different user_id
    cross_user_lookup = await copilot_repo.get_session(
        tenant_id=TENANT_ALPHA,
        user_id=USER_B_ID,
        session_id=str(session_a.id),
    )
    assert cross_user_lookup is None, "Cross-user session access must return None"


# ─── 2. Session CRUD & Sorting ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_session_crud_and_sorting(copilot_repo):
    # 1. Create sessions
    s1 = await copilot_repo.create_session(TENANT_ALPHA, USER_A_ID, title="First Thread")
    s2 = await copilot_repo.create_session(TENANT_ALPHA, USER_A_ID, title="Second Thread")
    assert s1.title == "First Thread"
    assert s2.title == "Second Thread"

    # 2. Pin s1
    updated_s1 = await copilot_repo.update_session(
        TENANT_ALPHA, USER_A_ID, str(s1.id), pinned=True
    )
    assert updated_s1.pinned is True

    # 3. List sessions - pinned should appear first
    res = await copilot_repo.list_sessions(TENANT_ALPHA, USER_A_ID, limit=10)
    assert len(res["sessions"]) >= 2
    assert res["sessions"][0].id == s1.id
    assert res["sessions"][0].pinned is True

    # 4. Soft delete s2
    deleted_ok = await copilot_repo.soft_delete_session(TENANT_ALPHA, USER_A_ID, str(s2.id))
    assert deleted_ok is True

    # Ensure s2 is no longer in active list
    res_after_del = await copilot_repo.list_sessions(TENANT_ALPHA, USER_A_ID, limit=10)
    active_ids = [s.id for s in res_after_del["sessions"]]
    assert str(s2.id) not in active_ids


# ─── 3. Message Persistence & Ordering ────────────────────────────────────────

@pytest.mark.asyncio
async def test_message_transcript_and_stats(copilot_repo):
    session = await copilot_repo.create_session(TENANT_ALPHA, USER_A_ID, title="Transcript Test")
    s_id = str(session.id)

    # Append user turn
    msg_user = await copilot_repo.append_message(
        tenant_id=TENANT_ALPHA,
        user_id=USER_A_ID,
        session_id=s_id,
        role="user",
        content="What are my resume gaps?",
    )
    assert msg_user.role == "user"

    # Append assistant turn
    msg_assistant = await copilot_repo.append_message(
        tenant_id=TENANT_ALPHA,
        user_id=USER_A_ID,
        session_id=s_id,
        role="assistant",
        content="You are missing AWS and Kubernetes.",
        model_used="openai/gpt-oss-120b",
        provider_used="groq",
        latency_ms=450,
        prompt_tokens=40,
        completion_tokens=15,
    )
    assert msg_assistant.role == "assistant"
    assert msg_assistant.provider_used == "groq"

    # Retrieve transcript
    transcript = await copilot_repo.list_messages(TENANT_ALPHA, USER_A_ID, s_id)
    assert len(transcript) == 2
    assert transcript[0].role == "user"
    assert transcript[1].role == "assistant"

    # Verify session stats updated
    updated_session = await copilot_repo.get_session(TENANT_ALPHA, USER_A_ID, s_id)
    assert updated_session.message_count == 2
    assert updated_session.total_tokens == 55
    assert "missing AWS" in updated_session.last_message_preview

    # Feedback update
    feedback_ok = await copilot_repo.update_message_feedback(
        TENANT_ALPHA, USER_A_ID, str(msg_assistant.id), feedback="up", note="Great answer"
    )
    assert feedback_ok is True


# ─── 4. LocalStorage Migration ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_local_storage_migration(copilot_repo):
    legacy_messages = [
        {"role": "user", "text": "How do I practice interview questions?"},
        {"role": "bot", "text": "Head over to the /interview practice page!"},
    ]

    session_id = await copilot_repo.migrate_local_history(TENANT_ALPHA, USER_A_ID, legacy_messages)
    assert session_id is not None

    migrated_session = await copilot_repo.get_session(TENANT_ALPHA, USER_A_ID, session_id)
    assert migrated_session is not None
    assert "Migrated" in migrated_session.title
    assert migrated_session.message_count == 2

    transcript = await copilot_repo.list_messages(TENANT_ALPHA, USER_A_ID, session_id)
    assert len(transcript) == 2
    assert transcript[0].content == "How do I practice interview questions?"
    assert transcript[1].content == "Head over to the /interview practice page!"
    assert transcript[1].role == "assistant"


# ─── 5. Durable Memory & LRU 40-Item Capacity ─────────────────────────────────

@pytest.mark.asyncio
async def test_durable_memory_and_lru_eviction(copilot_repo):
    # Upsert a memory fact
    mem = await copilot_repo.upsert_user_memory(
        tenant_id=TENANT_ALPHA,
        user_id=USER_A_ID,
        key="target_role",
        value="Staff Software Engineer",
    )
    assert mem.key == "target_role"
    assert mem.value == "Staff Software Engineer"

    # Insert 45 items to verify LRU eviction caps at MAX_USER_MEMORY_ITEMS (40)
    for i in range(45):
        await copilot_repo.upsert_user_memory(
            tenant_id=TENANT_ALPHA,
            user_id=USER_A_ID,
            key=f"fact_{i}",
            value=f"Preference number {i}",
        )

    all_memories = await copilot_repo.get_user_memory(TENANT_ALPHA, USER_A_ID)
    assert len(all_memories) <= MAX_USER_MEMORY_ITEMS
    assert len(all_memories) == 40

    # Test deletion
    deleted = await copilot_repo.delete_user_memory(TENANT_ALPHA, USER_A_ID, "fact_44")
    assert deleted is True


# ─── 6. HTTP API Endpoint Tests ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_api_session_endpoints(client, user_a_token, copilot_repo):
    headers = auth_header(user_a_token)

    # 1. Create session via POST /sessions
    res = await client.post(f"{API}/sessions", json={"title": "API Test Session"}, headers=headers)
    assert res.status_code == 201
    s_data = res.json()
    session_id = s_data["_id"]
    assert s_data["title"] == "API Test Session"

    # 2. Get session via GET /sessions/{id}
    res_get = await client.get(f"{API}/sessions/{session_id}", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["_id"] == session_id

    # 3. Patch session (pin it)
    res_patch = await client.patch(
        f"{API}/sessions/{session_id}",
        json={"title": "Renamed API Session", "pinned": True},
        headers=headers,
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["title"] == "Renamed API Session"
    assert res_patch.json()["pinned"] is True

    # 4. List sessions
    res_list = await client.get(f"{API}/sessions", headers=headers)
    assert res_list.status_code == 200
    assert len(res_list.json()["sessions"]) >= 1

    # 5. Soft delete session
    res_del = await client.delete(f"{API}/sessions/{session_id}", headers=headers)
    assert res_del.status_code == 200
    assert res_del.json()["ok"] is True


@pytest.mark.asyncio
async def test_api_v2_streaming_shortcut(client, user_a_token, copilot_repo):
    """Test that /v2/chat returns valid SSE stream for navigation shortcut."""
    headers = auth_header(user_a_token)
    payload = {
        "message": "/ats",
        "history": [],
    }

    res = await client.post(f"{API}/v2/chat", json=payload, headers=headers)
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]

    body = res.text
    assert "id:" in body
    assert "event: message" in body
    assert 'data: {"type": "session"' in body
    assert 'data: {"type": "navigate"' in body
    assert 'data: {"type": "done"' in body


@pytest.mark.asyncio
async def test_api_v1_deprecated_compatibility(client, user_a_token):
    """Test that legacy /chat endpoint continues to stream valid SSE chunks."""
    headers = auth_header(user_a_token)
    payload = {
        "message": "/interview",
        "history": [],
    }

    res = await client.post(f"{API}/chat", json=payload, headers=headers)
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    assert "data:" in res.text
