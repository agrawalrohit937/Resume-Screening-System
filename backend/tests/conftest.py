"""
Pytest configuration and shared fixtures for backend tests.
"""

import asyncio
import os
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import MagicMock, AsyncMock

# Set test environment defaults before importing app
os.environ["MONGO_URI"] = os.getenv("MONGO_URI", "mongodb://localhost:27017")
os.environ["MONGO_DB_NAME"] = os.getenv("MONGO_DB_NAME", "ai_career_test")
os.environ["SECRET_KEY"] = os.getenv("SECRET_KEY", "test-secret-key-do-not-use-in-production-12345")
os.environ["DEBUG"] = "true"
os.environ["RAZORPAY_KEY_ID"] = os.getenv("RAZORPAY_KEY_ID", "rzp_test_mockkey123")
os.environ["RAZORPAY_KEY_SECRET"] = os.getenv("RAZORPAY_KEY_SECRET", "mocksecret123456789")
os.environ["GOOGLE_CLIENT_ID"] = os.getenv("GOOGLE_CLIENT_ID", "mock-google-client-id.apps.googleusercontent.com")

from main import app
import config.db
from api.deps import get_db
from core.security import hash_password, create_access_token

sample_user_doc = {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "email": "test.candidate@example.com",
    "full_name": "Jane Doe",
    "role": "candidate",
    "status": "active",
    "email_verified": True,
    "hashed_password": hash_password("TestPass123!"),
    "total_resumes": 1,
    "total_ats_checks": 1,
    "trusted_devices": [],
    "auth_methods": ["password"],
    "created_at": "2026-07-27T00:00:00Z",
    "updated_at": "2026-07-27T00:00:00Z",
}

sample_recruiter_doc = {
    "_id": "665f1a2b3c4d5e6f7a8b9c0e",
    "email": "test.recruiter@example.com",
    "full_name": "Recruiter User",
    "role": "recruiter",
    "status": "active",
    "email_verified": True,
    "hashed_password": hash_password("RecruiterPass123!"),
    "total_resumes": 0,
    "total_ats_checks": 0,
    "trusted_devices": [],
    "auth_methods": ["password"],
    "created_at": "2026-07-27T00:00:00Z",
    "updated_at": "2026-07-27T00:00:00Z",
}

sample_admin_doc = {
    "_id": "665f1a2b3c4d5e6f7a8b9c0f",
    "email": "admin@example.com",
    "full_name": "Admin User",
    "role": "admin",
    "status": "active",
    "email_verified": True,
    "hashed_password": hash_password("AdminPass123!"),
    "total_resumes": 0,
    "total_ats_checks": 0,
    "trusted_devices": [],
    "auth_methods": ["password"],
    "created_at": "2026-07-27T00:00:00Z",
    "updated_at": "2026-07-27T00:00:00Z",
}

sample_resume_doc = {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "user_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "filename": "resume.pdf",
    "original_filename": "resume.pdf",
    "file_type": "pdf",
    "file_size_bytes": 1024,
    "storage_path": "uploads/resume.pdf",
    "status": "parsed",
    "created_at": "2026-07-27T00:00:00Z",
    "updated_at": "2026-07-27T00:00:00Z",
}

sample_doc = {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "user_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "status": "ready_for_review",
    "generated_draft": {
        "email_subject": "Application for Backend Engineer",
        "email_body": "Dear Hiring Manager",
        "cover_letter_text": "Dear Hiring Manager",
    },
    "created_at": "2026-07-27T00:00:00Z",
    "updated_at": "2026-07-27T00:00:00Z",
}

def make_mock_cursor(docs=None):
    docs = docs if docs is not None else []
    cursor = MagicMock()
    cursor.to_list = AsyncMock(return_value=docs)
    cursor.sort = MagicMock(return_value=cursor)
    cursor.skip = MagicMock(return_value=cursor)
    cursor.limit = MagicMock(return_value=cursor)

    async def _aiter():
        for d in docs:
            yield d

    cursor.__aiter__ = lambda self: _aiter()
    return cursor

async def mock_user_find_one(query=None, *args, **kwargs):
    query = query or {}
    q_str = str(query).lower()
    if "ghost" in q_str or "new.user" in q_str or "nobody" in q_str:
        return None
    if "recruiter" in q_str or "665f1a2b3c4d5e6f7a8b9c0e" in q_str:
        return sample_recruiter_doc
    if "admin" in q_str or "665f1a2b3c4d5e6f7a8b9c0f" in q_str:
        return sample_admin_doc
    return sample_user_doc

async def mock_user_find_one_and_update(filter_query, update, *args, **kwargs):
    if "$set" in update:
        sample_user_doc.update(update["$set"])
    return dict(sample_user_doc)

mock_user_col = MagicMock()
mock_user_col.find_one = AsyncMock(side_effect=mock_user_find_one)
mock_user_col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="665f1a2b3c4d5e6f7a8b9c0d"))
mock_user_col.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
mock_user_col.update_many = AsyncMock(return_value=MagicMock(modified_count=1))
mock_user_col.find_one_and_update = AsyncMock(side_effect=mock_user_find_one_and_update)
mock_user_col.count_documents = AsyncMock(return_value=1)
mock_user_col.find = MagicMock(side_effect=lambda *args, **kwargs: make_mock_cursor([sample_user_doc]))
mock_user_col.aggregate = MagicMock(side_effect=lambda *args, **kwargs: make_mock_cursor([]))

async def mock_col_find_one(query=None, *args, **kwargs):
    query = query or {}
    q_str = str(query).lower()
    if "000000000000000000000000" in q_str or "notfound" in q_str or "nonexistent" in q_str:
        return None
    if "jti" in q_str or "revoked" in q_str:
        return None
    if "token_hash" in q_str:
        from datetime import datetime, timezone, timedelta
        return {
            "_id": "665f1a2b3c4d5e6f7a8b9c0d",
            "token_hash": query.get("token_hash", "mock_hash"),
            "family_id": "fam_123",
            "user_id": "665f1a2b3c4d5e6f7a8b9c0d",
            "tenant_id": "default",
            "revoked": False,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
        }
    return sample_resume_doc

mock_col = MagicMock()
mock_col.find_one = AsyncMock(side_effect=mock_col_find_one)
mock_col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="665f1a2b3c4d5e6f7a8b9c0d"))
mock_col.insert_many = AsyncMock(return_value=MagicMock(inserted_ids=["665f1a2b3c4d5e6f7a8b9c0d"]))
mock_col.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
mock_col.update_many = AsyncMock(return_value=MagicMock(modified_count=1))
mock_col.find_one_and_update = AsyncMock(return_value=sample_resume_doc)
mock_col.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
mock_col.delete_many = AsyncMock(return_value=MagicMock(deleted_count=1))
mock_col.count_documents = AsyncMock(return_value=0)
mock_col.find = MagicMock(side_effect=lambda *args, **kwargs: make_mock_cursor([]))
mock_col.aggregate = MagicMock(side_effect=lambda *args, **kwargs: make_mock_cursor([]))

async def mock_app_find_one(query=None, *args, **kwargs):
    query = query or {}
    q_str = str(query).lower()
    if "000000000000000000000000" in q_str:
        return None
    return sample_doc

mock_app_col = MagicMock()
mock_app_col.find_one = AsyncMock(side_effect=mock_app_find_one)
mock_app_col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="665f1a2b3c4d5e6f7a8b9c0d"))
mock_app_col.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
mock_app_col.find_one_and_update = AsyncMock(return_value=sample_doc)
mock_app_col.count_documents = AsyncMock(return_value=0)
mock_app_col.find = MagicMock(side_effect=lambda *args, **kwargs: make_mock_cursor([sample_doc]))

def mock_db_getitem(name):
    if name in ("job_applications", "applications"):
        return mock_app_col
    if name == "users":
        return mock_user_col
    return mock_col

mock_db = MagicMock()
mock_db.__getitem__.side_effect = mock_db_getitem
mock_db.otps = mock_col
mock_db.users = mock_user_col
mock_db.resumes = mock_col
mock_db.results = mock_col
mock_db.job_descriptions = mock_col
mock_db.applications = mock_app_col
mock_db.job_applications = mock_app_col
mock_db.analytics = mock_col
mock_db.interviews = mock_col
mock_db.certificates = mock_col
mock_db.copilot_sessions = mock_col
mock_db.copilot_messages = mock_col
mock_db.copilot_memory = mock_col
mock_db.task_jobs = mock_col
mock_db.task_dlq = mock_col

config.db._db = mock_db
app.dependency_overrides[get_db] = lambda: mock_db

BASE_URL = "http://test"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as c:
        yield c

@pytest.fixture
def auth_headers():
    token = create_access_token(
        subject="665f1a2b3c4d5e6f7a8b9c0d",
        extra_claims={"role": "candidate", "email": "test.candidate@example.com"},
    )
    return {"Authorization": f"Bearer {token}"}
