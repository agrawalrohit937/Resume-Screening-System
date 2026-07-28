"""
Pytest configuration and shared fixtures for backend tests.
"""

import asyncio
import os
import pytest
from httpx import AsyncClient, ASGITransport

# Set test environment defaults before importing app
os.environ["MONGO_URI"] = os.getenv("MONGO_URI", "mongodb://localhost:27017")
os.environ["MONGO_DB_NAME"] = os.getenv("MONGO_DB_NAME", "ai_career_test")
os.environ["SECRET_KEY"] = os.getenv("SECRET_KEY", "test-secret-key-do-not-use-in-production-12345")
os.environ["DEBUG"] = "true"
os.environ["ENVIRONMENT"] = "development"
os.environ["RAZORPAY_KEY_ID"] = os.getenv("RAZORPAY_KEY_ID", "rzp_test_mockkey123")
os.environ["RAZORPAY_KEY_SECRET"] = os.getenv("RAZORPAY_KEY_SECRET", "mocksecret123456789")
os.environ["GOOGLE_CLIENT_ID"] = os.getenv("GOOGLE_CLIENT_ID", "mock-google-client-id.apps.googleusercontent.com")

from main import app
from unittest.mock import MagicMock, AsyncMock
import config.db
from api.deps import get_db, get_current_user
from models.user_model import UserModel

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

mock_col = MagicMock()
mock_col.find_one = AsyncMock(return_value=sample_doc)

mock_col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="665f1a2b3c4d5e6f7a8b9c0d"))
mock_col.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
mock_col.delete_many = AsyncMock(return_value=None)
mock_col.count_documents = AsyncMock(return_value=0)

mock_db = MagicMock()
mock_db.__getitem__.return_value = mock_col
mock_db.otps = mock_col
mock_db.users = mock_col
mock_db.resumes = mock_col
mock_db.results = mock_col
mock_db.job_descriptions = mock_col
mock_db.applications = mock_col
mock_db.analytics = mock_col
mock_db.interviews = mock_col
mock_db.certificates = mock_col

config.db._db = mock_db


mock_user = UserModel(
    id="665f1a2b3c4d5e6f7a8b9c0d",
    email="test@example.com",
    full_name="Test User",
    role="candidate",
    status="active",
)

app.dependency_overrides[get_db] = lambda: mock_db
app.dependency_overrides[get_current_user] = lambda: mock_user

BASE_URL = "http://test"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as c:
        yield c

@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer mock-access-token-123"}

