"""
Unit tests for external job JD extraction and embedding service (jd_extractor.py).
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.jd_extractor import (
    _clean_extracted_text,
    extract_jd_from_url,
    ensure_external_job_jd,
)


def test_clean_extracted_text():
    raw = "  Job Title   \n\n\n\n  Senior Engineer  \r\n\r\n  Requirements:   Python, React  "
    cleaned = _clean_extracted_text(raw)
    assert "Job Title" in cleaned
    assert "Senior Engineer" in cleaned
    assert "Requirements: Python, React" in cleaned
    assert "\n\n\n\n" not in cleaned


@pytest.mark.asyncio
async def test_extract_jd_from_url_with_html():
    sample_html = """
    <!DOCTYPE html>
    <html>
      <head><title>Job Post</title></head>
      <body>
        <nav><a href="/">Home</a></nav>
        <div class="job-description">
          <h2>About the Role</h2>
          <p>We are looking for a Senior Backend Developer proficient in Python, FastAPI, and PostgreSQL.</p>
          <p>Responsibilities include building scalable microservices and managing cloud infrastructure.</p>
        </div>
        <footer>Copyright 2026</footer>
      </body>
    </html>
    """

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = sample_html
        mock_get.return_value = mock_response

        text = await extract_jd_from_url("https://careers.example.com/job/123")
        assert text is not None
        assert "Senior Backend Developer" in text
        assert "FastAPI" in text
        assert "Copyright" not in text


@pytest.mark.asyncio
async def test_ensure_external_job_jd_generates_and_saves():
    from tests.conftest import MockAsyncSession
    from models.tables import Job as JobT

    job_id = "660000000000000000000012"
    job_row = JobT(
        id=job_id,
        title="Data Engineer",
        company_name="Acme Analytics",
        required_skills=["Python", "Spark", "Kafka"],
        min_years=2.0,
        is_external=True,
        external_apply_url="https://careers.example.com/data-eng",
        jd_text_raw="",
    )
    job_doc = {
        "_id": job_id,
        "id": job_id,
        "title": "Data Engineer",
        "company_name": "Acme Analytics",
        "required_skills": ["Python", "Spark", "Kafka"],
        "min_years": 2.0,
        "is_external": True,
        "external_apply_url": "https://careers.example.com/data-eng",
        "jd_text_raw": "",
    }

    with patch("services.jd_extractor.extract_jd_from_url") as mock_extract, \
         patch("services.jd_extractor.get_pg_session_factory") as mock_pg:
        mock_pg.return_value = lambda: MockAsyncSession(items=[job_row])
        mock_extract.return_value = "Join Acme as Data Engineer building real-time pipelines with Spark and Kafka."

        result_text = await ensure_external_job_jd(job_doc)
        assert "Join Acme as Data Engineer" in result_text
        assert job_doc["jd_text_raw"] == result_text
        assert "jd_embedding_bge" in job_doc
        assert len(job_doc["jd_embedding_bge"]) in (384, 768, 1024)
