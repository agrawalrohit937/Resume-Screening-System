"""
Phase 6 Verification Tests: ATS Format Checker and Parsing Health Diagnostic Pipeline.
"""

from unittest.mock import MagicMock
import numpy as np
import pytest

from services.ats_format_check import check_ats_formatting
from services.scoring_engine import score_resume
import services.embedding_service as emb_svc


@pytest.fixture(autouse=True)
def mock_embeddings(monkeypatch):
    """Mock local embedding calls."""
    mock_model = MagicMock()
    def fake_encode(sentences, *args, **kwargs):
        if isinstance(sentences, str):
            return np.ones(1024, dtype=np.float32)
        return np.ones((len(sentences), 1024), dtype=np.float32)
    mock_model.encode.side_effect = fake_encode
    monkeypatch.setattr("services.embedding_service.embedding_model", mock_model)
    monkeypatch.setattr("services.scoring_engine.embedding_model", mock_model)


def test_clean_ats_compliant_resume():
    clean_text = """
    Jane Doe
    jane.doe@example.com | (555) 123-4567 | github.com/janedoe

    Summary
    Experienced Full Stack Engineer with 5+ years building scalable Python and React web applications.

    Work Experience
    Senior Software Engineer — TechCorp Inc. (Jan 2021 – Present)
    • Designed and deployed Python FastAPI microservices handling 20k req/s.
    • Improved database indexing in PostgreSQL, reducing query latency by 45%.

    Software Engineer — StartupX (June 2018 – Dec 2020)
    • Built responsive web user interfaces with React, TypeScript, and Redux.

    Education
    Bachelor of Science in Computer Science — University of California (2014 – 2018)

    Technical Skills
    Python, React, TypeScript, FastAPI, PostgreSQL, Docker, AWS, Git

    Projects
    Automated Code Reviewer
    • Built an open-source tool analyzing pull requests with AST parsers.
    """
    extracted_data = {
        "work_experience": [
            {"title": "Senior Software Engineer", "start_date": "2021-01-01", "end_date": "2024-01-01"},
            {"title": "Software Engineer", "start_date": "2018-06-01", "end_date": "2020-12-01"},
        ]
    }
    report = check_ats_formatting(clean_text, extracted_data=extracted_data)
    assert report["is_ats_compliant"] is True
    assert report["compliance_score"] >= 80.0
    assert len(report["format_issues"]) == 0


def test_ats_formatting_issues_detection():
    problematic_text = """
    John Developer
    No email or phone anywhere

    Random Heading
    Did stuff here and there.

    | Column 1 | Column 2 | Column 3 |
    | Row 1    | Row 2    | Row 3    |
    | Row A    | Row B    | Row C    |
    """
    report = check_ats_formatting(problematic_text, layout_meta={"has_tables": True, "has_multi_column": True})
    assert report["is_ats_compliant"] is False
    assert report["compliance_score"] < 70.0

    issue_ids = [i["issue_id"] for i in report["format_issues"]]
    assert "multi_column_layout" in issue_ids
    assert "tables_detected" in issue_ids
    assert "missing_email" in issue_ids
    assert "missing_standard_sections" in issue_ids


def test_scoring_engine_returns_ats_format_report():
    resume = {
        "raw_text": "Alex Dev\nalex@example.com\nExperience\nPython engineer.\nSkills\nPython, Docker.",
        "skills": ["Python", "Docker"],
    }
    jd = {
        "text": "Looking for Python Engineer with Docker knowledge.",
    }
    res = score_resume(resume, jd, mode="candidate")
    assert "format_issues" in res
    assert "ats_format_report" in res
    assert isinstance(res["format_issues"], list)
    assert "compliance_score" in res["ats_format_report"]
