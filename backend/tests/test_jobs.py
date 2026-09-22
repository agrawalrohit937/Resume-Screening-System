"""
Unit Tests for Phase A: Jobs Foundation — Models, BGE Local Embeddings & Jobs Logic.
"""

import pytest
from models.job import JobModel, JobCreateRequest, JobResponse, WorkMode
from models.application import ApplicationModel, ApplicationStage
from services.embedding_service import embedding_model, EMBEDDING_DIMENSIONS


def test_job_and_application_models():
    """Verify JobModel and ApplicationModel field schema."""
    job = JobModel(
        company_name="Linear",
        title="Frontend Architect",
        jd_text_raw="Building high-performance keyboard-first interfaces with React and WebGL.",
        required_skills=["React", "TypeScript", "WebGL"],
        min_years=3.0,
        location="Remote",
        work_mode=WorkMode.REMOTE.value,
        salary_range="$150k - $190k",
        jd_embedding=[0.1] * 768,
    )

    assert job.company_name == "Linear"
    assert job.title == "Frontend Architect"
    assert len(job.jd_embedding) == 768
    assert job.status == "open"
    assert "React" in job.required_skills

    app = ApplicationModel(
        job_id="660000000000000000000001",
        candidate_id="660000000000000000000002",
        resume_id="660000000000000000000003",
        match_score=88.5,
        stage=ApplicationStage.APPLIED.value,
    )

    assert app.match_score == 88.5
    assert app.stage == "Applied"


def test_local_bge_job_embedding_generation():
    """
    Verify that local SentenceTransformer generates 768-dim normalized embedding
    for a job description without any external API calls.
    """
    jd_sample = (
        "We are seeking a Backend Engineer with experience in Python, FastAPI, "
        "PostgreSQL, Redis, and distributed systems architecture."
    )

    vectors = embedding_model.encode([jd_sample])
    assert len(vectors) == 1
    embedding = vectors[0]

    assert len(embedding) == EMBEDDING_DIMENSIONS
    assert EMBEDDING_DIMENSIONS in (768, 1024)
    assert all(isinstance(val, float) for val in embedding)


def test_job_matcher_cosine_and_calibration():
    """Verify cosine similarity calculation and calibration in job_matcher."""
    from services.job_matcher import _calculate_cosine_similarity, _calibrate_match_score

    vec_a = [0.5, 0.5, 0.5, 0.5]
    vec_b = [0.5, 0.5, 0.5, 0.5]
    sim = _calculate_cosine_similarity(vec_a, vec_b)
    assert round(sim, 2) == 1.0

    # Calibrated match score
    score = _calibrate_match_score(0.70)
    assert 70.0 <= score <= 95.0
    assert _calibrate_match_score(0.0) == 0.0


@pytest.mark.asyncio
async def test_get_jobs_by_company_route():
    """Verify GET /api/v1/jobs/company/{company_name} returns company jobs."""
    import httpx
    from unittest.mock import AsyncMock, MagicMock
    from main import create_application
    from api.deps import get_database

    app = create_application()

    mock_db = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=[
        {
            "_id": "660000000000000000000050",
            "company_name": "Stripe",
            "title": "Software Engineer, Core Payments",
            "jd_text_raw": "Build high throughput financial APIs",
            "required_skills": ["Python", "Go", "Distributed Systems"],
            "min_years": 2.0,
            "location": "San Francisco, CA",
            "work_mode": "Hybrid",
            "salary_range": "$160k - $210k",
            "status": "open",
            "department": "Engineering",
            "applicant_count": 5,
        }
    ])
    mock_db.jobs.find.return_value = mock_cursor
    mock_db.companies.find_one = AsyncMock(return_value=None)
    app.dependency_overrides[get_database] = lambda: mock_db

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/jobs/company/Stripe")
        assert res.status_code == 200
        data = res.json()
        assert data["company_name"] == "Stripe"
        assert len(data["jobs"]) == 1
        assert data["jobs"][0]["title"] == "Software Engineer, Core Payments"


def test_application_model_dual_scoring_and_snapshot_fields():
    """Verify ApplicationModel correctly holds recruiter_score, knockout_status, and resume_snapshot."""
    app = ApplicationModel(
        job_id="660000000000000000000001",
        candidate_id="660000000000000000000002",
        resume_id="660000000000000000000003",
        match_score=85.0,
        recruiter_score=42.0,
        knockout_status={
            "passed": False,
            "reasons": ["Requires 5.0+ years experience, candidate has 1.0 years"],
        },
        resume_snapshot={
            "file_url": "https://res.cloudinary.com/test/resume.pdf",
            "parsed_data": {"skills": ["Python", "FastAPI"], "total_experience": 1.0},
            "filename": "candidate_resume.pdf",
        },
        stage=ApplicationStage.APPLIED.value,
    )

    assert app.match_score == 85.0
    assert app.recruiter_score == 42.0
    assert app.knockout_status["passed"] is False
    assert len(app.knockout_status["reasons"]) == 1
    assert app.resume_snapshot["file_url"] == "https://res.cloudinary.com/test/resume.pdf"
    assert app.resume_snapshot["filename"] == "candidate_resume.pdf"


@pytest.mark.asyncio
async def test_update_job_with_active_applicants_rejects_core_changes():
    """Verify PUT /api/v1/jobs/{job_id} rejects modifications to required_skills, min_years, or jd_text_raw if applicants > 0."""
    import httpx
    from unittest.mock import AsyncMock, MagicMock
    from bson import ObjectId
    from main import create_application
    from api.deps import get_database, get_current_user
    from models.user_model import UserModel, UserRole

    app = create_application()
    mock_db = MagicMock()

    job_oid = ObjectId("660000000000000000000088")
    existing_job = {
        "_id": job_oid,
        "company_name": "Acme Corp",
        "title": "Senior Engineer",
        "jd_text_raw": "Original job description text",
        "required_skills": ["Python", "Docker"],
        "min_years": 4.0,
        "location": "Remote",
        "work_mode": "Remote",
        "salary_range": "$120k",
        "applicant_count": 3,
        "created_by": "recruiter_1",
    }

    mock_db.jobs.find_one = AsyncMock(return_value=existing_job)
    mock_db.applications.count_documents = AsyncMock(return_value=3)

    recruiter_user = UserModel(
        id="recruiter_1",
        email="recruiter@acme.com",
        full_name="Recruiter",
        role=UserRole.RECRUITER,
        is_active=True,
    )

    app.dependency_overrides[get_database] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: recruiter_user

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Attempt to change required_skills on job with applicants -> must be rejected 400
        res_skills = await client.put(
            f"/api/v1/jobs/{str(job_oid)}",
            json={"required_skills": ["Python", "Kubernetes"]},
        )
        assert res_skills.status_code == 400
        assert "This job has active applicants" in res_skills.json()["detail"]

        # 2. Attempt to change min_years on job with applicants -> must be rejected 400
        res_years = await client.put(
            f"/api/v1/jobs/{str(job_oid)}",
            json={"min_years": 2.0},
        )
        assert res_years.status_code == 400
        assert "This job has active applicants" in res_years.json()["detail"]

        # 3. Attempt to change jd_text_raw on job with applicants -> must be rejected 400
        res_jd = await client.put(
            f"/api/v1/jobs/{str(job_oid)}",
            json={"jd_text_raw": "Updated role description"},
        )
        assert res_jd.status_code == 400
        assert "This job has active applicants" in res_jd.json()["detail"]

        # 4. Updating non-scoring fields (salary_range, location) -> must succeed 200
        mock_db.jobs.update_one = AsyncMock()
        res_non_scoring = await client.put(
            f"/api/v1/jobs/{str(job_oid)}",
            json={"salary_range": "$140k - $160k", "location": "New York, NY"},
        )
        assert res_non_scoring.status_code == 200
        assert res_non_scoring.json()["success"] is True


@pytest.mark.asyncio
async def test_recruiter_can_view_all_jobs_in_same_tenant():
    """
    Verify Conflict 3 fix:
    Recruiters view all jobs belonging to their tenant organization (tenant_id),
    not just jobs created by their individual user ID.
    """
    from unittest.mock import AsyncMock, MagicMock, patch
    from api.routes.jobs import get_my_posted_jobs
    from models.user_model import UserModel, UserRole

    recruiter_alice = UserModel(
        id="user_alice_123",
        email="alice@techcorp.com",
        full_name="Alice Recruiter",
        role=UserRole.RECRUITER,
        roles=[UserRole.RECRUITER],
        tenant_id="tenant_techcorp",
    )

    captured_query = {}
    mock_db = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.sort.return_value = mock_cursor
    async def mock_stream(cursor):
        return [
            {
                "_id": "660000000000000000000099",
                "title": "Staff Cloud Engineer",
                "company_name": "TechCorp",
                "jd_text_raw": "AWS, Kubernetes, Terraform",
                "required_skills": ["AWS", "Kubernetes"],
                "min_years": 5.0,
                "location": "Remote",
                "work_mode": "Remote",
                "status": "open",
                "created_by": "user_bob_456",  # Posted by colleague Bob!
                "tenant_id": "tenant_techcorp",
                "applicant_count": 3,
            }
        ]

    def mock_find(query, *args, **kwargs):
        captured_query.update(query)
        return mock_cursor

    mock_db.jobs.find = mock_find

    with patch("api.routes.jobs.stream_cursor", side_effect=mock_stream):
        res = await get_my_posted_jobs(current_user=recruiter_alice, db=mock_db)

    # 1. Query must filter by tenant_id, NOT by created_by: user_alice_123
    assert captured_query == {"tenant_id": "tenant_techcorp"}
    assert "created_by" not in captured_query

    # 2. Result must return the job posted by colleague Bob
    assert res["total"] == 1
    assert res["jobs"][0]["title"] == "Staff Cloud Engineer"


@pytest.mark.asyncio
async def test_match_job_ats_resolves_open_job_cross_tenant():
    """
    Verify ATS Match 404 Bug Fix:
    1. Candidate with tenant_id='default' matches job created under 'tenant_techcorp' with status='open'.
    2. Endpoint queries raw_db cross-tenant and handles ObjectId and string ID.
    """
    from unittest.mock import AsyncMock, MagicMock, patch
    from bson import ObjectId
    from api.routes.jobs import match_job_ats
    from models.user_model import UserModel, UserRole

    candidate = UserModel(
        id="660000000000000000000010",
        email="candidate@example.com",
        full_name="Candidate Charlie",
        role=UserRole.CANDIDATE,
        roles=[UserRole.CANDIDATE],
        tenant_id="default",
    )

    job_oid = ObjectId("660000000000000000000099")
    job_record = {
        "_id": job_oid,
        "title": "Junior Python Developer",
        "company_name": "TechCorp",
        "jd_text_raw": "Python, FastAPI, SQL",
        "required_skills": ["Python", "FastAPI"],
        "min_years": 1.0,
        "status": "open",
        "tenant_id": "tenant_techcorp",
    }

    mock_db = MagicMock()
    mock_raw_db = MagicMock()
    mock_db.raw_db = mock_raw_db

    # raw_db returns job regardless of tenant
    mock_raw_db.jobs.find_one = AsyncMock(return_value=job_record)

    # Candidate has parsed resume
    resume_doc = {
        "_id": ObjectId("660000000000000000000077"),
        "user_id": str(candidate.id),
        "parsed_data": {
            "skills": ["Python", "FastAPI", "Git"],
            "total_experience_years": 1.5,
            "education": [{"degree": "B.Tech Computer Science"}],
        },
    }
    mock_raw_db.resumes.find_one = AsyncMock(return_value=resume_doc)

    mock_resume_repo = MagicMock()
    mock_resume_repo.get_primary_by_user = AsyncMock(return_value=None)
    mock_resume_repo.get_by_user = AsyncMock(return_value=([], 0))
    mock_resume_repo._serialize = lambda d: d

    from starlette.requests import Request
    scope = {
        "type": "http",
        "method": "POST",
        "path": f"/api/v1/jobs/{job_oid}/match",
        "headers": [],
        "client": ("127.0.0.1", 12345),
    }
    mock_request = Request(scope)

    with patch("api.routes.jobs.score_resume") as mock_scorer:
        mock_scorer.return_value = {
            "final_score": 85.0,
            "matched_skills": ["Python", "FastAPI"],
            "missing_skills": [],
            "experience_score": 80.0,
            "education_score": 80.0,
            "recommendation": "Strong Match",
            "feedback_suggestions": ["Add more projects", "Certifications"],
        }

        res = await match_job_ats(
            request=mock_request,
            job_id=str(job_oid),
            current_user=candidate,
            db=mock_db,
            resume_repo=mock_resume_repo,
        )

    assert res["job_id"] == str(job_oid)
    assert res["final_score"] == 85.0
    assert "Python" in res["matched_skills"]


@pytest.mark.asyncio
async def test_list_jobs_strict_has_applied_logic():
    """
    Verify GET /api/v1/jobs strictly calculates has_applied:
    - True ONLY if db.applications contains job_id == job._id AND candidate_id == current_user.id.
    - False if user is creator (created_by) or in same tenant without an application.
    - False if application belongs to another candidate.
    - False if unauthenticated.
    """
    from bson import ObjectId
    from unittest.mock import AsyncMock, MagicMock
    from api.routes.jobs import list_jobs
    from models.user_model import UserModel, UserRole

    candidate_id = "660000000000000000000099"
    current_user = UserModel(
        id=candidate_id,
        email="candidate@example.com",
        full_name="Test Candidate",
        role=UserRole.CANDIDATE,
        roles=[UserRole.CANDIDATE],
        tenant_id="acme_corp",
        is_active=True,
    )

    job1_id = ObjectId("660000000000000000000001")
    job2_id = ObjectId("660000000000000000000002")
    job3_id = ObjectId("660000000000000000000003")
    job4_id = ObjectId("660000000000000000000004")

    mock_docs = [
        # Job 1: Applied by this candidate
        {
            "_id": job1_id,
            "title": "Job 1 (Applied)",
            "company_name": "Company A",
            "status": "open",
            "created_by": "other_user_id",
            "tenant_id": "other_tenant",
        },
        # Job 2: User is creator (created_by), but DID NOT apply
        {
            "_id": job2_id,
            "title": "Job 2 (Created By User)",
            "company_name": "Company B",
            "status": "open",
            "created_by": candidate_id,
            "tenant_id": "other_tenant",
        },
        # Job 3: Same tenant, but DID NOT apply
        {
            "_id": job3_id,
            "title": "Job 3 (Same Tenant)",
            "company_name": "Company C",
            "status": "open",
            "created_by": "other_user_id",
            "tenant_id": "acme_corp",
        },
        # Job 4: Applied by a DIFFERENT candidate
        {
            "_id": job4_id,
            "title": "Job 4 (Other Applicant)",
            "company_name": "Company D",
            "status": "open",
            "created_by": "other_user_id",
            "tenant_id": "other_tenant",
        },
    ]

    mock_db = MagicMock()
    mock_db.raw_db = mock_db
    mock_db.jobs.count_documents = AsyncMock(return_value=len(mock_docs))
    
    mock_cursor = MagicMock()
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.skip.return_value = mock_cursor
    mock_cursor.limit.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=mock_docs)
    mock_db.jobs.find.return_value = mock_cursor

    # Mock applications collection: only Job 1 has an application for this candidate
    mock_app_cursor = MagicMock()
    mock_app_cursor.to_list = AsyncMock(return_value=[
        {"job_id": str(job1_id), "candidate_id": candidate_id}
    ])
    mock_db.applications.find.return_value = mock_app_cursor

    # 1. Authenticated test
    res = await list_jobs(
        search=None,
        work_mode=None,
        location=None,
        min_years=None,
        skill=None,
        limit=30,
        skip=0,
        current_user=current_user,
        db=mock_db,
    )

    jobs_by_id = {j["id"]: j for j in res["jobs"]}
    
    # Job 1 MUST be True
    assert jobs_by_id[str(job1_id)]["has_applied"] is True

    # Job 2 MUST be False (created_by must NOT flag as applied)
    assert jobs_by_id[str(job2_id)]["has_applied"] is False

    # Job 3 MUST be False (same tenant must NOT flag as applied)
    assert jobs_by_id[str(job3_id)]["has_applied"] is False

    # Job 4 MUST be False (different candidate applied)
    assert jobs_by_id[str(job4_id)]["has_applied"] is False

    # 2. Unauthenticated test (current_user=None)
    res_unauth = await list_jobs(
        search=None,
        work_mode=None,
        location=None,
        min_years=None,
        skill=None,
        limit=30,
        skip=0,
        current_user=None,
        db=mock_db,
    )
    for j in res_unauth["jobs"]:
        assert j["has_applied"] is False






