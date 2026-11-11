"""
Pytest configuration and shared fixtures for backend tests.
"""

import asyncio
import os
import pytest
from httpx import AsyncClient, ASGITransport
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, AsyncMock

# Set test environment defaults before importing app
os.environ["SECRET_KEY"] = os.getenv("SECRET_KEY", "test-secret-key-do-not-use-in-production-12345")
os.environ["DEBUG"] = "true"
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["DATABASE_URL"] = ""
os.environ["RAZORPAY_KEY_ID"] = os.getenv("RAZORPAY_KEY_ID", "rzp_test_mockkey123")
os.environ["RAZORPAY_KEY_SECRET"] = os.getenv("RAZORPAY_KEY_SECRET", "mocksecret123456789")
os.environ["GOOGLE_CLIENT_ID"] = os.getenv("GOOGLE_CLIENT_ID", "mock-google-client-id.apps.googleusercontent.com")

import config.db

async def _noop_connect(*args, **kwargs):
    pass
config.db.connect_db = _noop_connect
config.db.disconnect_db = _noop_connect
config.db.init_pg_db = _noop_connect
config.db.close_pg_db = _noop_connect

class MockResult:
    def __init__(self, items=None, rowcount=None):
        self._items = items if items is not None else []
        self.rowcount = rowcount if rowcount is not None else len(self._items)
    def scalars(self):
        return self
    def scalar(self):
        return self._items[0] if self._items else None
    def scalar_one_or_none(self):
        return self._items[0] if self._items else None
    def scalar_one(self):
        return self._items[0] if self._items else None
    def first(self):
        return self._items[0] if self._items else None
    def fetchone(self):
        return self._items[0] if self._items else None
    def fetchall(self):
        return list(self._items)
    def all(self):
        return list(self._items)
    def __iter__(self):
        return iter(self._items)

class MockAsyncSession:
    """Mock SQLAlchemy AsyncSession for unit testing routes and services."""
    _shared_store = []
    def __init__(self, items=None):
        self._items = items if items is not None else self._shared_store
    async def execute(self, stmt, *args, **kwargs):
        import re
        s_str = str(stmt).lower()

        if s_str.startswith("update"):
            params = stmt.compile().params if hasattr(stmt, "compile") else {}
            matched_obj = None
            if "copilot_sessions" in s_str:
                from models import CopilotSession
                s_id = None
                for k, v in params.items():
                    if "id" in k:
                        s_id = str(v)
                        break
                candidates = [it for it in self._items if isinstance(it, CopilotSession) and (s_id is None or str(it.id) == s_id)]
                if candidates:
                    matched_obj = candidates[0]
            elif "copilot_messages" in s_str:
                from models import CopilotMessage
                m_id = None
                for k, v in params.items():
                    if "id" in k:
                        m_id = str(v)
                        break
                candidates = [it for it in self._items if isinstance(it, CopilotMessage) and (m_id is None or str(it.id) == m_id)]
                if candidates:
                    matched_obj = candidates[0]
            elif "copilot_memory" in s_str:
                from models import CopilotMemory
                key = None
                for k, v in params.items():
                    if "key" in k:
                        key = str(v)
                        break
                candidates = [it for it in self._items if isinstance(it, CopilotMemory) and (key is None or str(it.key) == key)]
                if candidates:
                    matched_obj = candidates[0]
            elif "task_jobs" in s_str:
                from models import TaskJob
                j_id = None
                for k, v in params.items():
                    if "job_id" in k or ("id" in k and "tenant" not in k):
                        j_id = str(v)
                        break
                candidates = [it for it in self._items if isinstance(it, TaskJob) and (j_id is None or str(it.job_id) == j_id or str(it.id) == j_id)]
                if candidates:
                    matched_obj = candidates[0]
            elif "users" in s_str:
                from models.tables import User as UserT
                u_id = None
                for k, v in params.items():
                    if "id" in k and "tenant" not in k:
                        u_id = str(v)
                        break
                candidates = [it for it in self._items if (isinstance(it, UserT) or getattr(it, "__tablename__", "") == "users") and (u_id is None or str(getattr(it, "id", "")) == u_id)]
                if candidates:
                    matched_obj = candidates[0]
            else:
                for it in self._items:
                    tname = getattr(it, "__tablename__", "")
                    if tname and tname in s_str:
                        matched_obj = it
                        break

            if matched_obj:
                for k, v in params.items():
                    clean_k = re.sub(r'_\d+$', '', k)
                    if hasattr(matched_obj, clean_k):
                        if clean_k in ("message_count", "total_tokens", "total_cost_usd") and k.endswith("_1"):
                            cur = getattr(matched_obj, clean_k) or 0
                            setattr(matched_obj, clean_k, cur + v)
                        else:
                            setattr(matched_obj, clean_k, v)
                return MockResult([matched_obj], rowcount=1)
            return MockResult([], rowcount=0)

        if s_str.startswith("delete"):
            params = stmt.compile().params if hasattr(stmt, "compile") else {}
            deleted = 0
            if "copilot_memory" in s_str:
                from models import CopilotMemory
                key = params.get("key_1") or params.get("key")
                uid = params.get("user_id_1") or params.get("user_id")
                tid = params.get("tenant_id_1") or params.get("tenant_id")
                del_ids = {str(v) for k, v in params.items() if "id" in k and "tenant" not in k and "user" not in k}
                to_remove = []
                for it in self._items:
                    if isinstance(it, CopilotMemory):
                        if del_ids and str(it.id) in del_ids:
                            to_remove.append(it)
                        elif not del_ids and (not key or it.key == str(key)) and (not uid or it.user_id == str(uid)) and (not tid or it.tenant_id == str(tid)):
                            to_remove.append(it)
                for it in to_remove:
                    self._items.remove(it)
                    deleted += 1
            return MockResult([], rowcount=deleted)

        if "from task_jobs" in s_str or " task_jobs " in s_str:
            from models import TaskJob
            params = stmt.compile().params if hasattr(stmt, "compile") else {}
            matches = [it for it in self._items if isinstance(it, TaskJob)]
            for k, v in params.items():
                clean_k = re.sub(r'_\d+$', '', k)
                if clean_k == "job_id":
                    matches = [it for it in matches if str(it.job_id) == str(v)]
                elif clean_k == "tenant_id":
                    matches = [it for it in matches if str(it.tenant_id) == str(v)]
                elif clean_k == "user_id":
                    matches = [it for it in matches if str(it.user_id) == str(v)]
            return MockResult(matches)

        if "from copilot_sessions" in s_str or " copilot_sessions " in s_str:
            from models import CopilotSession
            params = stmt.compile().params if hasattr(stmt, "compile") else {}
            matches = [it for it in self._items if isinstance(it, CopilotSession)]
            for k, v in params.items():
                clean_k = re.sub(r'_\d+$', '', k)
                if clean_k == "id":
                    matches = [it for it in matches if str(it.id) == str(v)]
                elif clean_k == "tenant_id":
                    matches = [it for it in matches if str(it.tenant_id) == str(v)]
                elif clean_k == "user_id":
                    matches = [it for it in matches if str(it.user_id) == str(v)]
                elif clean_k == "archived":
                    matches = [it for it in matches if bool(it.archived) == bool(v)]
            if "deleted_at is null" in s_str or "deleted_at is %" in s_str or "deleted_at is :" in s_str:
                matches = [it for it in matches if it.deleted_at is None]
            matches.sort(key=lambda x: (not getattr(x, "pinned", False), -(getattr(x, "updated_at").timestamp() if getattr(x, "updated_at", None) else 0)))
            limit = getattr(stmt, "_limit", None)
            if limit:
                matches = matches[:limit]
            return MockResult(matches)

        if "from copilot_messages" in s_str or " copilot_messages " in s_str:
            from models import CopilotMessage
            params = stmt.compile().params if hasattr(stmt, "compile") else {}
            matches = [it for it in self._items if isinstance(it, CopilotMessage)]
            for k, v in params.items():
                clean_k = re.sub(r'_\d+$', '', k)
                if clean_k == "session_id":
                    matches = [it for it in matches if str(it.session_id) == str(v)]
                elif clean_k == "tenant_id":
                    matches = [it for it in matches if str(it.tenant_id) == str(v)]
                elif clean_k == "user_id":
                    matches = [it for it in matches if str(it.user_id) == str(v)]
                elif clean_k == "role":
                    matches = [it for it in matches if str(it.role) == str(v)]
            is_desc = "desc" in s_str
            matches.sort(
                key=lambda x: getattr(x, "created_at").timestamp() if getattr(x, "created_at", None) else 0,
                reverse=is_desc
            )
            limit = getattr(stmt, "_limit", None)
            if limit:
                matches = matches[:limit]
            return MockResult(matches)

        if "from copilot_memory" in s_str or " copilot_memory " in s_str:
            from models import CopilotMemory
            params = stmt.compile().params if hasattr(stmt, "compile") else {}
            matches = [it for it in self._items if isinstance(it, CopilotMemory)]
            for k, v in params.items():
                clean_k = re.sub(r'_\d+$', '', k)
                if clean_k == "key":
                    matches = [it for it in matches if str(it.key) == str(v)]
                elif clean_k == "tenant_id":
                    matches = [it for it in matches if str(it.tenant_id) == str(v)]
                elif clean_k == "user_id":
                    matches = [it for it in matches if str(it.user_id) == str(v)]
            matches.sort(
                key=lambda x: getattr(x, "updated_at").timestamp() if getattr(x, "updated_at", None) else 0,
                reverse=True
            )
            limit = getattr(stmt, "_limit", None)
            if limit is not None:
                matches = matches[:limit]
            return MockResult(matches)
        if "revoked_tokens" in s_str or "revokedtoken" in s_str:
            from models.tables import RevokedToken as RevT
            revoked_matches = [it for it in self._items if isinstance(it, RevT) or getattr(it, "__tablename__", "") == "revoked_tokens"]
            return MockResult(revoked_matches)
        if "from refresh_tokens" in s_str or " refresh_tokens " in s_str or "refresh_tokens." in s_str:
            from models.tables import RefreshToken as RT
            rt_matches = [it for it in self._items if isinstance(it, RT) or getattr(it, "__tablename__", "") == "refresh_tokens" or getattr(it, "token_hash", None)]
            if rt_matches:
                return MockResult(rt_matches)
            mock_rt = RT(
                id="ref_tok_1",
                token_hash="mock",
                user_id="665f1a2b3c4d5e6f7a8b9c0d",
                family_id="fam_1",
                jti="jti_1",
                used=False,
                revoked=False,
            )
            return MockResult([mock_rt])
        if "from users" in s_str or " users " in s_str or "users." in s_str:
            from models.tables import User as UserT
            user_matches = [it for it in self._items if isinstance(it, UserT) or getattr(it, "__tablename__", "") == "users"]
            params = stmt.compile().params if hasattr(stmt, "compile") else {}
            for k, v in params.items():
                if "email" in k:
                    user_matches = [it for it in user_matches if getattr(it, "email", "") == str(v)]
                elif "id" in k and "tenant" not in k:
                    user_matches = [it for it in user_matches if str(getattr(it, "id", "")) == str(v)]
            if user_matches:
                return MockResult(user_matches)
            if not any("email" in k or "id" in k for k in params):
                mock_user = UserT(
                    id="665f1a2b3c4d5e6f7a8b9c0d",
                    email="test.candidate@example.com",
                    full_name="Jane Doe",
                    role="candidate",
                    roles=["candidate"],
                    status="active",
                )
                return MockResult([mock_user])
            return MockResult([])
        if "from jobs" in s_str or " jobs " in s_str or "jobs." in s_str:
            from models.tables import Job as JobT
            job_matches = [it for it in self._items if isinstance(it, JobT) or getattr(it, "__tablename__", "") == "jobs"]
            return MockResult(job_matches)
        if "from team_invites" in s_str or " team_invites " in s_str or "team_invites." in s_str:
            from models.tables import TeamInvite as TIT
            invite_matches = [it for it in self._items if isinstance(it, TIT) or getattr(it, "__tablename__", "") == "team_invites"]
            return MockResult(invite_matches)
        if "from audit_logs" in s_str or " audit_logs " in s_str or "audit_logs." in s_str:
            from models.tables import AuditLog as ALT
            audit_matches = [it for it in self._items if isinstance(it, ALT) or getattr(it, "__tablename__", "") == "audit_logs"]
            params = stmt.compile().params if hasattr(stmt, "compile") else {}
            for k, v in params.items():
                val = getattr(v, "value", v)
                if "tenant" in k:
                    audit_matches = [it for it in audit_matches if str(getattr(it, "tenant_id", "")) == str(val)]
                elif "action" in k:
                    audit_matches = [it for it in audit_matches if str(getattr(it, "action", "")) == str(val)]
                elif "actor" in k:
                    audit_matches = [it for it in audit_matches if str(getattr(it, "actor_id", "")) == str(val)]
                elif "start" in k or "created_at" in k:
                    audit_matches = [it for it in audit_matches if getattr(it, "created_at", None) and it.created_at >= v]
            if "count" in s_str:
                return MockResult([len(audit_matches)], rowcount=len(audit_matches))
            return MockResult(audit_matches)
        if "from candidate_applications" in s_str or " candidate_applications " in s_str or "candidate_applications." in s_str:
            from models.tables import CandidateApplication as CAT
            app_matches = [it for it in self._items if isinstance(it, CAT) or getattr(it, "__tablename__", "") == "candidate_applications"]
            params = stmt.compile().params if hasattr(stmt, "compile") else {}
            for k, v in params.items():
                if "tenant" in k:
                    app_matches = [it for it in app_matches if str(getattr(it, "tenant_id", "")) == str(v)]
                elif "stage" in k:
                    app_matches = [it for it in app_matches if str(getattr(it, "stage", "")) == str(v)]
                elif "id" in k:
                    app_matches = [it for it in app_matches if str(getattr(it, "id", "")) == str(v)]
            return MockResult(app_matches)
        if "from talent_pool_profiles" in s_str or " talent_pool_profiles " in s_str:
            from models.tables import TalentPoolProfile as TPP
            pool_matches = [it for it in self._items if isinstance(it, TPP) or getattr(it, "__tablename__", "") == "talent_pool_profiles"]
            return MockResult(pool_matches)
        # Match any added model instances by table name
        matching = [it for it in self._items if getattr(it, "__tablename__", "") and (getattr(it, "__tablename__", "") in s_str or getattr(it, "__tablename__", "").rstrip("s") in s_str)]
        if matching:
            try:
                params = stmt.compile().params if hasattr(stmt, "compile") else {}
                mapping = {
                    "application": "application_id",
                    "candidate": "candidate_id",
                    "interviewer": "interviewer_id",
                    "tenant": "tenant_id",
                    "job": "job_id",
                    "user": "user_id",
                    "stage": "stage_name",
                    "id": "id",
                }
                for k, v in params.items():
                    base_k = k.split("_")[0] if "_" in k else k
                    if base_k in mapping:
                        attr_name = mapping[base_k]
                        if base_k == "stage":
                            matching = [it for it in matching if str(getattr(it, "stage", getattr(it, "stage_name", ""))) == str(v)]
                        else:
                            matching = [it for it in matching if str(getattr(it, attr_name, "")) == str(v)]
            except Exception:
                pass
            return MockResult(matching)

        return MockResult([])
    async def commit(self):
        pass
    async def rollback(self):
        pass
    async def flush(self):
        pass
    async def refresh(self, instance, *args, **kwargs):
        pass
    def add(self, instance):
        self._items.append(instance)
    def add_all(self, instances):
        self._items.extend(instances)
    async def delete(self, instance):
        if instance in self._items:
            self._items.remove(instance)
    async def close(self):
        pass
    def begin(self):
        class _Tx:
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
        return _Tx()
    async def __aenter__(self):
        return self
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

_mock_engine = MagicMock()
config.db.get_pg_engine = lambda: _mock_engine
config.db.get_pg_session_factory = lambda: (lambda: MockAsyncSession())

from main import app
from api.deps import get_db
from core.security import hash_password, create_access_token


# End of MockResult
# End of MockAsyncSession

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
    "id": "665f1a2b3c4d5e6f7a8b9c0d",
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
    "id": "665f1a2b3c4d5e6f7a8b9c0d",
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

async def _override_get_db():
    yield MockAsyncSession()

app.dependency_overrides[get_db] = _override_get_db

from api.deps import get_user_repo
from schemas.user_schema import UserModel

class MockUserRepo:
    async def create(self, user_data: dict):
        d = dict(user_data)
        d["_id"] = str(d.pop("id", d.get("_id", "665f1a2b3c4d5e6f7a8b9c0d")))
        return UserModel(**d)

    async def get_by_id(self, user_id: str):
        if not user_id:
            return None
        u_str = str(user_id).lower()
        if "ghost" in u_str or "nobody" in u_str or "nonexistent" in u_str:
            return None
        if "recruiter" in u_str or "665f1a2b3c4d5e6f7a8b9c0e" in u_str:
            return UserModel(**sample_recruiter_doc)
        if "admin" in u_str or "665f1a2b3c4d5e6f7a8b9c0f" in u_str:
            return UserModel(**sample_admin_doc)
        return UserModel(**sample_user_doc)

    async def get_by_email(self, email: str):
        if not email:
            return None
        e_str = str(email).lower()
        if "ghost" in e_str or "nobody" in e_str or "new.user" in e_str:
            return None
        if "recruiter" in e_str:
            return UserModel(**sample_recruiter_doc)
        if "admin" in e_str:
            return UserModel(**sample_admin_doc)
        return UserModel(**sample_user_doc)

    async def update(self, user_id: str, updates: dict):
        user = await self.get_by_id(user_id)
        if not user:
            return None
        d = user.model_dump()
        d.update(updates)
        return UserModel(**d)

    async def update_last_login(self, user_id: str):
        pass

    async def update_last_login_method(self, user_id: str, method: str):
        pass

    async def add_auth_method(self, user_id: str, method: str):
        pass

from api.deps import get_resume_repo, get_result_repo

class MockResumeRepo:
    async def get_by_id(self, resume_id: str, *args, **kwargs):
        return None
    async def get_by_id_and_user(self, resume_id: str, user_id: str):
        return None
    async def get_by_user(self, user_id: str, skip: int = 0, limit: int = 20, status=None):
        return [], 0
    async def get_primary_by_user(self, user_id: str):
        return None
    async def create(self, resume_data: dict):
        return resume_data
    async def count_by_user(self, user_id: str, tenant_id=None):
        return 0

class MockResultRepo:
    async def get_by_id(self, result_id: str, *args, **kwargs):
        return None
    async def get_by_user(self, user_id: str, skip: int = 0, limit: int = 20):
        return [], 0
    async def get_results_by_user(self, user_id: str, *args, **kwargs):
        return [], 0
    async def create(self, result_data: dict):
        return result_data
    async def get_analytics_summary(self, user_id: Optional[str] = None):
        return {
            "total_checks": 0,
            "avg_score": 0.0,
            "max_score": 0.0,
            "min_score": 0.0,
            "strong_matches": 0,
            "good_matches": 0,
            "poor_matches": 0,
            "match_rate": 0.0,
        }

app.dependency_overrides[get_user_repo] = lambda: MockUserRepo()
app.dependency_overrides[get_resume_repo] = lambda: MockResumeRepo()
app.dependency_overrides[get_result_repo] = lambda: MockResultRepo()

BASE_URL = "http://test"

# event_loop managed by pytest-asyncio

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


@pytest.fixture
def db_session():
    """Provides a fresh isolated MockAsyncSession instance for a test."""
    session = MockAsyncSession(items=[])
    yield session


@pytest.fixture
def test_user_model():
    from models.tables import User
    return User(
        id="665f1a2b3c4d5e6f7a8b9c0d",
        email="test.candidate@example.com",
        full_name="Jane Doe",
        role="candidate",
        roles=["candidate"],
        status="active",
        job_alerts_enabled=True,
    )


@pytest.fixture
def test_job_model():
    from models.tables import Job
    return Job(
        id="660000000000000000000099",
        title="Senior Python Engineer",
        company_name="TechCorp",
        jd_text_raw="Python, FastAPI, PostgreSQL",
        required_skills=["Python", "FastAPI", "PostgreSQL"],
        min_years=3.0,
        location="Remote",
        work_mode="Remote",
        status="open",
        created_by="recruiter_1",
        tenant_id="tenant_techcorp",
        is_external=False,
        applicant_count=0,
    )
