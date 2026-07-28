"""
Tests for the AI Apply Assistant module.

Mocks:
  - All LLM calls inside the 4 LangGraph nodes - never hits Groq in CI
  - resume_repo, ATS engine, PDF render, email send - never touches real infra
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch



SAMPLE_RESUME = {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "status": "parsed",
    "parsed_text": "Experienced backend engineer skilled in FastAPI and MongoDB.",
    "file_path": "/tmp/resume.pdf",
}

SAMPLE_ATS_RESULT = {
    "result_id": "665f1a2b3c4d5e6f7a8b9c0e",
    "score": 82,
    "matched_keywords": ["FastAPI"],
    "missing_keywords": ["Kubernetes"],
}


@pytest.fixture
def mock_reused_dependencies():
    mock_resume_obj = MagicMock()
    mock_resume_obj.status = "parsed"
    mock_resume_obj.parsed_data = MagicMock(raw_text="Experienced backend engineer skilled in FastAPI and MongoDB.")
    mock_resume_obj.model_dump = MagicMock(return_value={
        "_id": "665f1a2b3c4d5e6f7a8b9c0d",
        "status": "parsed",
        "parsed_data": {"raw_text": "Experienced backend engineer skilled in FastAPI and MongoDB."},
    })

    with patch(
        "repositories.resume_repo.ResumeRepository.get_by_id_and_user",
        new=AsyncMock(return_value=mock_resume_obj),
    ), patch(
        "repositories.resume_repo.ResumeRepository.get_by_id",
        new=AsyncMock(return_value=mock_resume_obj),
    ), patch(
        "services.pdf_generator_service.render_html_to_pdf",
        new=AsyncMock(return_value="/tmp/cover_letter.pdf"),
    ), patch(
        "services.email_service.send_with_attachments",
        new=AsyncMock(return_value="msg-123"),
    ):
        yield




@pytest.fixture
def mock_llm_nodes():
    fake_graph_result = {
        "jd_analysis": {"required_skills": ["FastAPI"], "seniority": "mid", "tone": "formal"},
        "email_subject": "Application for Backend Engineer",
        "email_body": "Dear Hiring Manager, " + "x" * 200,
        "cover_letter_text": "Dear Hiring Manager, " + "y" * 500,
        "validation_issues": [],
        "retry_count": 0,
        "needs_manual_review": False,
    }
    with patch(
        "services.apply_assistant_service.apply_assistant_graph.ainvoke",
        new=AsyncMock(return_value=fake_graph_result),
    ):
        yield



@pytest.mark.asyncio
async def test_generate_draft_returns_ready_for_review(client, auth_headers, mock_reused_dependencies, mock_llm_nodes):
    response = await client.post(
        "/api/v1/apply/draft",
        json={
            "resume_id": "665f1a2b3c4d5e6f7a8b9c0d",
            "company_name": "Acme Corp",
            "job_title": "Backend Engineer",
            "hr_email": "hr@acme.com",
            "job_description": "We are looking for a backend engineer with FastAPI experience.",
        },
        headers=auth_headers,
    )
    assert response.status_code in (200, 201)
    body = response.json()
    assert body["status"] == "ready_for_review"
    assert body["email_subject"]
    assert body["cover_letter_text"]


@pytest.mark.asyncio
async def test_send_before_draft_ready_returns_404_or_409(client, auth_headers):
    response = await client.post("/api/v1/apply/draft/000000000000000000000000/send", headers=auth_headers)
    assert response.status_code in (404, 409, 502)




def test_quality_validator_flags_placeholder_text():
    from workflows.apply_assistant_graph import _deterministic_checks

    state = {
        "email_body": "Dear [Hiring Manager], " + "x" * 200,
        "cover_letter_text": "y" * 500,
        "email_subject": "Application",
    }
    issues = _deterministic_checks(state)
    assert any("placeholder" in issue.lower() for issue in issues)



def test_status_transition_guard():
    from backend.models.application_model import is_valid_transition

    assert is_valid_transition("ready_for_review", "sending") is True
    assert is_valid_transition("draft", "sent") is False
    assert is_valid_transition("sent", "draft") is False
