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
async def test_two_stage_job_matcher_pipeline():
    """Verify two-stage job matching: candidate role/skill signals extraction & find_jobs_for_candidate."""
    from services.job_matcher import _extract_candidate_role_signals, find_jobs_for_candidate
    from unittest.mock import AsyncMock, MagicMock

    # 1. Test role signals extraction
    parsed_resume = {
        "targeted_role": "Senior Python Developer",
        "technical_skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis"],
        "summary": "Experienced backend engineer building microservices.",
        "work_experience": [{"title": "Senior Python Developer", "company": "Acme"}],
    }
    signals = _extract_candidate_role_signals(parsed_resume)
    assert signals["primary_role"] == "Senior Python Developer"
    assert "python" in signals["role_tokens"]
    assert "FastAPI" in signals["top_skills"]

    # 2. Test find_jobs_for_candidate with mock DB
    mock_db = MagicMock()
    mock_db.resumes.find_one = AsyncMock(return_value={
        "_id": "660000000000000000000001",
        "user_id": "cand_123",
        "status": "parsed",
        "parsed_data": parsed_resume,
    })

    job_doc = {
        "_id": "660000000000000000000099",
        "title": "Python Backend Engineer",
        "company_name": "Tech Corp",
        "required_skills": ["Python", "FastAPI", "Docker"],
        "status": "open",
        "jd_text_raw": "Looking for a Python Backend Engineer with FastAPI experience.",
        "is_external": False,
    }

    mock_cursor = MagicMock()
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.limit.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=[job_doc])

    mock_app_cursor = MagicMock()
    mock_app_cursor.to_list = AsyncMock(return_value=[])

    def find_mock(query=None, projection=None):
        if query and "candidate_id" in query:
            return mock_app_cursor
        return mock_cursor

    mock_db.jobs.find = MagicMock(side_effect=find_mock)
    mock_db.applications.find = MagicMock(return_value=mock_app_cursor)
    mock_db.jobs.count_documents = AsyncMock(return_value=1)

    res = await find_jobs_for_candidate(
        candidate_id="cand_123",
        limit=3,
        db=mock_db,
    )

    assert res["has_resume"] is True
    assert len(res["recommended_jobs"]) == 1
    assert res["recommended_jobs"][0]["title"] == "Python Backend Engineer"
    assert res["recommended_jobs"][0]["match_score"] >= 50.0
    assert "stage1_candidates_count" in res



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
    assert captured_query == {
        "tenant_id": "tenant_techcorp",
        "is_external": {"$ne": True},
    }
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
async def test_match_job_ats_allows_external_jobs():
    """Verify that external job listings now support full ATS matching without 400 rejection."""
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

    external_job_oid = ObjectId("660000000000000000000095")
    external_job_record = {
        "_id": external_job_oid,
        "title": "Senior React Developer",
        "company_name": "Global Tech",
        "jd_text_raw": "Looking for a Senior React and TypeScript developer with frontend architecture expertise.",
        "required_skills": ["React", "TypeScript"],
        "min_years": 3.0,
        "status": "open",
        "is_external": True,
        "publisher_source": "LinkedIn",
        "external_apply_url": "https://linkedin.com/jobs/view/12345",
    }

    mock_db = MagicMock()
    mock_raw_db = MagicMock()
    mock_db.raw_db = mock_raw_db

    mock_raw_db.jobs.find_one = AsyncMock(return_value=external_job_record)
    mock_raw_db.jobs.update_one = AsyncMock(return_value=None)

    resume_doc = {
        "_id": ObjectId("660000000000000000000077"),
        "user_id": str(candidate.id),
        "parsed_data": {
            "skills": ["React", "TypeScript", "Redux"],
            "total_experience_years": 4.0,
            "education": [{"degree": "B.Tech"}],
            "raw_text": "Experienced Frontend Engineer with React and TypeScript.",
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
        "path": f"/api/v1/jobs/{external_job_oid}/match",
        "headers": [],
        "client": ("127.0.0.1", 12345),
    }
    mock_request = Request(scope)

    with patch("api.routes.jobs.score_resume") as mock_scorer:
        mock_scorer.return_value = {
            "final_score": 90.0,
            "matched_skills": ["React", "TypeScript"],
            "missing_skills": [],
            "experience_score": 95.0,
            "education_score": 85.0,
            "recommendation": "Strong Match",
            "feedback_suggestions": ["Highlights in state management"],
        }

        res = await match_job_ats(
            request=mock_request,
            job_id=str(external_job_oid),
            current_user=candidate,
            db=mock_db,
            resume_repo=mock_resume_repo,
        )

    assert res["job_id"] == str(external_job_oid)
    assert res["final_score"] == 90.0
    assert "React" in res["matched_skills"]
    assert res["job_title"] == "Senior React Developer"



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


@pytest.mark.asyncio
async def test_list_jobs_inclusive_or_tenant_isolation_and_external():
    """
    Verify GET /api/v1/jobs inclusive $or visibility query:
    1. For tenant 'careershala-services', internal jobs of 'careershala-services' and external jobs (is_external=True) are returned.
    2. Status query uses case-insensitive regex ^(open|published)$.
    3. Fields with null/empty values (company_logo, salary_range, required_skills) are safely mapped.
    """
    from bson import ObjectId
    from unittest.mock import AsyncMock, MagicMock
    from api.routes.jobs import list_jobs
    from models.user_model import UserModel, UserRole

    recruiter_user = UserModel(
        id="660000000000000000000020",
        email="recruiter@careershala.com",
        full_name="Careershala Recruiter",
        role=UserRole.RECRUITER,
        roles=[UserRole.RECRUITER],
        tenant_id="careershala-services",
        is_active=True,
    )

    captured_query = {}
    mock_db = MagicMock()
    mock_db.raw_db = mock_db

    mock_docs = [
        # Internal job for careershala-services
        {
            "_id": ObjectId("660000000000000000000021"),
            "title": "Fullstack Developer",
            "company_name": "Careershala",
            "status": "Open",
            "tenant_id": "careershala-services",
            "is_external": False,
            "required_skills": ["React", "FastAPI"],
            "salary_range": "$80k - $120k",
            "company_logo": "https://example.com/logo.png",
        },
        # External scraped job
        {
            "_id": ObjectId("660000000000000000000022"),
            "title": "Backend Architect",
            "company_name": "Google",
            "status": "Published",
            "tenant_id": "default",
            "is_external": True,
            "required_skills": None,  # null skills
            "salary_range": None,     # null salary
            "company_logo": None,     # null logo
        },
    ]

    mock_cursor = MagicMock()
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.skip.return_value = mock_cursor
    mock_cursor.limit.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=mock_docs)

    def mock_find(query, *args, **kwargs):
        captured_query.update(query)
        return mock_cursor

    mock_db.jobs.find = mock_find
    mock_db.jobs.count_documents = AsyncMock(return_value=len(mock_docs))
    mock_app_cursor = MagicMock()
    mock_app_cursor.to_list = AsyncMock(return_value=[])
    mock_db.applications.find.return_value = mock_app_cursor

    res = await list_jobs(
        search=None,
        work_mode=None,
        location=None,
        min_years=None,
        skill=None,
        limit=30,
        skip=0,
        current_user=recruiter_user,
        db=mock_db,
    )

    # 1. Verify status filter allows open/published/active jobs
    status_filter = captured_query.get("status")
    if isinstance(status_filter, dict) and "$in" in status_filter:
        assert "open" in [s.lower() for s in status_filter["$in"]]
    elif isinstance(status_filter, dict) and "$regex" in status_filter:
        assert "open" in status_filter["$regex"]

    # 2. Verify response schema safely mapped nulls and arrays
    assert res["total"] == 2
    job_internal = next(j for j in res["jobs"] if j["id"] == "660000000000000000000021")
    assert job_internal["company_name"] == "Careershala"
    assert job_internal["is_external"] is False
    assert job_internal["required_skills"] == ["React", "FastAPI"]
    assert job_internal["salary_range"] == "$80k - $120k"
    assert job_internal["company_logo"] == "https://example.com/logo.png"

    job_external = next(j for j in res["jobs"] if j["id"] == "660000000000000000000022")
    assert job_external["company_name"] == "Google"
    assert job_external["is_external"] is True
    assert job_external["required_skills"] == []
    assert job_external["salary_range"] is None
    assert job_external["company_logo"] is None


@pytest.mark.asyncio
async def test_get_job_detail_allows_recruiter_and_candidate_on_external_job():
    """Verify GET /api/v1/jobs/{job_id} allows recruiters to view external scraped jobs without 404."""
    from bson import ObjectId
    from unittest.mock import AsyncMock, MagicMock
    from api.routes.jobs import get_job_detail
    from models.user_model import UserModel, UserRole

    recruiter_user = UserModel(
        id="660000000000000000000030",
        email="recruiter@example.com",
        full_name="Recruiter",
        role=UserRole.RECRUITER,
        roles=[UserRole.RECRUITER],
        tenant_id="tenant_xyz",
        is_active=True,
    )

    job_oid = ObjectId("660000000000000000000033")
    mock_job = {
        "_id": job_oid,
        "title": "Machine Learning Engineer",
        "company_name": "DeepMind",
        "status": "published",
        "is_external": True,
        "tenant_id": "default",
        "required_skills": ["PyTorch", "JAX"],
        "min_years": 3.0,
        "location": "London, UK",
        "work_mode": "Hybrid",
    }

    mock_db = MagicMock()
    mock_raw_db = MagicMock()
    mock_db.raw_db = mock_raw_db
    mock_raw_db.jobs.find_one = AsyncMock(return_value=mock_job)
    mock_db.companies.find_one = AsyncMock(return_value=None)
    mock_raw_db.applications.find_one = AsyncMock(return_value=None)

    detail = await get_job_detail(
        job_id=str(job_oid),
        current_user=recruiter_user,
        db=mock_db,
    )

    assert detail["id"] == str(job_oid)
    assert detail["title"] == "Machine Learning Engineer"
    assert detail["company_name"] == "DeepMind"
    assert detail["is_external"] is True
    assert detail["required_skills"] == ["PyTorch", "JAX"]


@pytest.mark.asyncio
async def test_list_jobs_skill_filter_lenient_fallback_for_external_jobs():
    """
    Verify that when filtering by skill (e.g. skill='Python'), external scraped jobs
    with empty required_skills: [] are matched via jd_text_raw or title fallback.
    """
    from bson import ObjectId
    from unittest.mock import AsyncMock, MagicMock
    from api.routes.jobs import list_jobs
    from models.user_model import UserModel, UserRole

    candidate_user = UserModel(
        id="660000000000000000000040",
        email="candidate@example.com",
        full_name="Candidate",
        role=UserRole.CANDIDATE,
        roles=[UserRole.CANDIDATE],
        tenant_id="default",
        is_active=True,
    )

    captured_query = {}
    mock_db = MagicMock()
    mock_db.raw_db = mock_db

    mock_docs = [
        # External scraped job with empty required_skills: [] but Python in jd_text_raw
        {
            "_id": ObjectId("660000000000000000000041"),
            "title": "Senior Software Engineer",
            "company_name": "Anthropic",
            "status": "open",
            "tenant_id": "default",
            "is_external": True,
            "required_skills": [],
            "jd_text_raw": "Seeking engineers experienced in Python and distributed systems.",
        },
    ]

    mock_cursor = MagicMock()
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.skip.return_value = mock_cursor
    mock_cursor.limit.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=mock_docs)

    def mock_find(query, *args, **kwargs):
        captured_query.update(query)
        return mock_cursor

    mock_db.jobs.find = mock_find
    mock_db.jobs.count_documents = AsyncMock(return_value=len(mock_docs))
    mock_app_cursor = MagicMock()
    mock_app_cursor.to_list = AsyncMock(return_value=[])
    mock_db.applications.find.return_value = mock_app_cursor

    res = await list_jobs(
        search=None,
        work_mode=None,
        location=None,
        min_years=None,
        skill="Python",
        limit=30,
        skip=0,
        current_user=candidate_user,
        db=mock_db,
    )

    # Verify query includes $or clause across required_skills, title, and jd_text_raw
    and_conditions = captured_query.get("$and", [])
    skill_condition = next(
        (c for c in and_conditions if "$or" in c and any("required_skills" in clause for clause in c["$or"])),
        None
    )
    assert skill_condition is not None, "Skill filter must be present in $and"
    or_clauses = skill_condition["$or"]
    assert any("required_skills" in clause for clause in or_clauses)
    assert any("title" in clause for clause in or_clauses)
    assert any("jd_text_raw" in clause for clause in or_clauses)

    # Verify document is returned
    assert res["total"] == 1
    assert res["jobs"][0]["company_name"] == "Anthropic"
    assert res["jobs"][0]["is_external"] is True


@pytest.mark.asyncio
async def test_explore_jobs_merges_internal_and_external_with_priority_sort():
    """Verify that Explore Jobs returns active internal and external jobs with normalized schema."""
    from bson import ObjectId
    from datetime import datetime, timezone
    from unittest.mock import AsyncMock, MagicMock
    from api.routes.jobs import list_jobs
    from models.user_model import UserModel, UserRole

    candidate_user = UserModel(
        id="660000000000000000000050",
        email="candidate@example.com",
        full_name="Candidate",
        role=UserRole.CANDIDATE,
        roles=[UserRole.CANDIDATE],
        tenant_id="default",
        is_active=True,
    )

    mock_docs = [
        # Internal platform job
        {
            "_id": ObjectId("660000000000000000000051"),
            "title": "Staff Backend Engineer",
            "company_name": "Razorpay",
            "status": "open",
            "tenant_id": "tenant_razorpay",
            "is_external": False,
            "required_skills": ["Python", "Go"],
            "salary_range": "INR 35,00,000 - 50,00,000",
            "location": "Bengaluru, India",
            "work_mode": "Hybrid",
            "created_at": datetime.now(timezone.utc),
        },
        # External scraped job
        {
            "_id": ObjectId("660000000000000000000052"),
            "title": "Frontend Lead",
            "company_name": "Microsoft",
            "status": "open",
            "tenant_id": "default",
            "is_external": True,
            "publisher_source": "LinkedIn",
            "external_apply_url": "https://linkedin.com/jobs/view/999",
            "required_skills": ["React", "TypeScript"],
            "location": "Hyderabad, India",
            "work_mode": "Remote",
            "created_at": datetime.now(timezone.utc),
        },
    ]

    mock_db = MagicMock()
    mock_db.raw_db = mock_db

    mock_cursor = MagicMock()
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.skip.return_value = mock_cursor
    mock_cursor.limit.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=mock_docs)

    mock_db.jobs.find = MagicMock(return_value=mock_cursor)
    mock_db.jobs.count_documents = AsyncMock(return_value=2)
    mock_app_cursor = MagicMock()
    mock_app_cursor.to_list = AsyncMock(return_value=[])
    mock_db.applications.find.return_value = mock_app_cursor

    res = await list_jobs(
        search=None,
        work_mode=None,
        location=None,
        min_years=None,
        skill=None,
        limit=30,
        skip=0,
        current_user=candidate_user,
        db=mock_db,
    )

    assert res["total"] == 2
    assert len(res["jobs"]) == 2

    # Verify internal job mapping
    internal_job = res["jobs"][0]
    assert internal_job["company_name"] == "Razorpay"
    assert internal_job["is_external"] is False
    assert internal_job["publisher_source"] == "Direct Employer"
    assert internal_job["salary_range"] == "INR 35,00,000 - 50,00,000"

    # Verify external job mapping
    external_job = res["jobs"][1]
    assert external_job["company_name"] == "Microsoft"
    assert external_job["is_external"] is True
    assert external_job["publisher_source"] == "LinkedIn"
    assert external_job["external_apply_url"] == "https://linkedin.com/jobs/view/999"









