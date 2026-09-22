"""
Phase 3 Verification Tests: Contextual Skill Scoring & Evidence Multipliers.
"""

from datetime import date
from unittest.mock import MagicMock
import numpy as np
import pytest

from services.scoring.contextual_skills import (
    build_resume_section_index,
    evaluate_skill_context,
    compute_contextual_skills_breakdown,
)
from services.scoring_engine import score_resume
import core.feature_flags as ff
import services.embedding_service as emb_svc


@pytest.fixture(autouse=True)
def mock_embeddings(monkeypatch):
    """Mock local embedding calls to avoid network / heavy model load in unit tests."""
    mock_model = MagicMock()
    def fake_encode(sentences, *args, **kwargs):
        if isinstance(sentences, str):
            return np.ones(1024, dtype=np.float32)
        return np.ones((len(sentences), 1024), dtype=np.float32)
    mock_model.encode.side_effect = fake_encode
    monkeypatch.setattr("services.embedding_service.embedding_model", mock_model)
    monkeypatch.setattr("services.scoring_engine.embedding_model", mock_model)


def test_evidence_location_multipliers():
    resume_data = {
        "work_experience": [
            {
                "title": "Senior Backend Engineer",
                "description": "Engineered high-throughput Python APIs handling 25k req/s with 99.99% uptime.",
                "start_date": "2023-01-01",
                "end_date": "2024-01-01",
            }
        ],
        "projects": [
            {
                "title": "Fullstack App",
                "description": "Built reactive UI using React and TypeScript.",
                "technologies": ["React", "TypeScript"],
            }
        ],
        "certifications": ["AWS Certified Solutions Architect"],
        "skills": ["Docker", "Kubernetes"],
    }
    raw_text = "Experienced software engineer. Python, React, AWS, Docker."
    section_index = build_resume_section_index(resume_data, raw_text=raw_text, reference_date=date(2024, 1, 1))

    # 1. Python in work experience with metrics -> 1.00 credit
    py_ev = evaluate_skill_context("Python", section_index)
    assert py_ev["where"] == "work_experience_metric"
    assert py_ev["credit"] >= 0.90

    # 2. React in projects -> project multiplier (~0.85)
    react_ev = evaluate_skill_context("React", section_index)
    assert react_ev["where"] == "project"
    assert 0.65 <= react_ev["credit"] <= 0.85

    # 3. AWS in certifications -> cert multiplier (~0.80)
    aws_ev = evaluate_skill_context("AWS", section_index)
    assert aws_ev["where"] == "certification"
    assert 0.55 <= aws_ev["credit"] <= 0.80

    # 4. Docker only in skills list -> list multiplier (~0.60)
    docker_ev = evaluate_skill_context("Docker", section_index)
    assert docker_ev["where"] == "skills_list"
    assert docker_ev["credit"] <= 0.65


def test_recency_decay_for_skills():
    resume_data = {
        "work_experience": [
            {
                "title": "Recent Python Role",
                "description": "Python microservices.",
                "start_date": "2023-01-01",
                "end_date": "2024-01-01",
            },
            {
                "title": "Legacy C++ Role",
                "description": "C++ graphics rendering engine.",
                "start_date": "2010-01-01",
                "end_date": "2014-01-01",  # 10 years ago relative to 2024
            }
        ]
    }
    section_index = build_resume_section_index(resume_data, reference_date=date(2024, 1, 1))

    py_ev = evaluate_skill_context("Python", section_index)
    cpp_ev = evaluate_skill_context("C++", section_index)

    # Recent Python should have high recency decay factor (1.0), whereas ancient C++ (10 years ago, 5y half-life) decays to ~(0.5)^2 = 0.25
    assert py_ev["recency_decay"] >= 0.90
    assert cpp_ev["recency_decay"] <= 0.35
    assert py_ev["credit"] > cpp_ev["credit"]


def test_anti_keyword_stuffing_penalty():
    dense_spam_text = (
        "Skills: Python, Java, C++, Go, Rust, Ruby, PHP, Swift, Kotlin, Perl, Scala, Haskell, "
        "Elixir, Clojure, Dart, Fortran, COBOL, Lua, R, Julia, MATLAB, Assembly, Shell, Bash, PowerShell"
    )
    resume_data = {
        "skills": ["Python", "Java", "C++", "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "Perl", "Scala", "Haskell"],
        "work_experience": [],
    }
    section_index = build_resume_section_index(resume_data, raw_text=dense_spam_text)

    # In dense ungrounded spam, tokens should be flagged as stuffed
    ev = evaluate_skill_context("Perl", section_index)
    assert ev["where"] == "skills_list"
    assert ev["is_stuffed"] is True
    assert ev["credit"] <= 0.40  # Stuffed penalty applied


def test_contextual_skills_flag_in_scoring_engine(monkeypatch):
    monkeypatch.setattr(ff, "FEATURE_CONTEXTUAL_SKILLS", True)

    resume = {
        "raw_text": "Software Engineer with Python experience in production.",
        "skills": ["Python", "React"],
        "work_experience": [
            {
                "title": "Backend Developer",
                "company": "Fast Tech",
                "start_date": "2022-01-01",
                "end_date": "2024-01-01",
                "description": "Engineered Python APIs with 10k users.",
            }
        ]
    }
    jd = {
        "text": "Senior Developer proficient in Python and React.",
        "min_years": 2.0,
    }

    result = score_resume(resume, jd, mode="recruiter")
    assert "skill_evidence" in result
    assert len(result["skill_evidence"]) >= 1
    py_ev = next((e for e in result["skill_evidence"] if e["skill"] == "Python"), None)
    assert py_ev is not None
    assert py_ev["where"] == "work_experience_metric"
