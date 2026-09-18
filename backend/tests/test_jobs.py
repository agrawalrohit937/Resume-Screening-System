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
    assert EMBEDDING_DIMENSIONS == 768
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



