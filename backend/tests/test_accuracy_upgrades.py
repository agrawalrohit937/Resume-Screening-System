"""
Verification tests for ATS Accuracy Upgrades:
1. Contextual Skill Recency & Evidence Grounding
2. Role Title & Seniority Level Alignment
3. Non-penalized Fresher / Entry-Level Skills List
"""

import numpy as np
import pytest

from services.scoring_engine import score_resume


@pytest.fixture(autouse=True)
def mock_embeddings(monkeypatch):
    """Mock local embedding calls for instantaneous test execution."""
    from services.embedding_service import EmbeddingModelSingleton
    monkeypatch.setattr(EmbeddingModelSingleton, "_ensure_loaded", lambda self: None)
    monkeypatch.setattr(
        EmbeddingModelSingleton,
        "encode",
        lambda self, sentences, *args, **kwargs: np.ones(
            (len(sentences) if not isinstance(sentences, str) else 1, 1024), dtype=np.float32
        ),
    )


def test_recent_vs_ancient_skill_recency():
    """Verifies that recent skills in active work experience receive higher credit than 10-year-old skills."""
    recent_resume = {
        "raw_text": "Backend Engineer with current Python microservices work.",
        "skills": ["Python"],
        "work_experience": [
            {
                "title": "Backend Engineer",
                "company": "Current Tech",
                "start_date": "2023-01-01",
                "end_date": "2024-06-01",
                "description": "Architected Python FastAPI microservices.",
            }
        ],
    }

    ancient_resume = {
        "raw_text": "Sales manager who used Python in 2012.",
        "skills": ["Python"],
        "work_experience": [
            {
                "title": "Sales Lead",
                "company": "Biz Corp",
                "start_date": "2015-01-01",
                "end_date": "2024-01-01",
                "description": "Closed B2B enterprise deals.",
            },
            {
                "title": "Intern",
                "company": "Old Startup",
                "start_date": "2011-01-01",
                "end_date": "2012-01-01",
                "description": "Built simple Python scripts.",
            }
        ],
    }

    jd = {
        "title": "Python Developer",
        "description": "Requires Python expertise in production.",
        "min_years": 2.0,
    }

    recent_res = score_resume(recent_resume, jd, mode="recruiter")
    ancient_res = score_resume(ancient_resume, jd, mode="recruiter")

    # Recent Python candidate must score significantly higher on skills than 12-year-old Python user
    assert recent_res["skills_score"] > ancient_res["skills_score"]
    assert "skill_evidence" in recent_res
    recent_ev = next((e for e in recent_res["skill_evidence"] if e["skill"].lower() == "python"), None)
    ancient_ev = next((e for e in ancient_res["skill_evidence"] if e["skill"].lower() == "python"), None)
    assert recent_ev is not None and ancient_ev is not None
    assert recent_ev["recency_decay"] > ancient_ev["recency_decay"]


def test_seniority_and_title_alignment():
    """Verifies that candidate with aligned title & seniority scores higher on experience than mismatching title."""
    aligned_candidate = {
        "skills": ["Python", "FastAPI", "Docker"],
        "total_experience_years": 5.0,
        "work_experience": [
            {
                "title": "Senior Backend Developer",
                "company": "Apex Corp",
                "start_date": "2019-01-01",
                "end_date": "2024-01-01",
                "description": "Led backend Python and Docker architecture.",
            }
        ],
    }

    mismatched_candidate = {
        "skills": ["Python", "FastAPI", "Docker"],
        "total_experience_years": 5.0,
        "work_experience": [
            {
                "title": "Junior QA Manual Tester",
                "company": "Test Co",
                "start_date": "2019-01-01",
                "end_date": "2024-01-01",
                "description": "Performed manual blackbox testing and wrote simple Python test scripts.",
            }
        ],
    }

    jd = {
        "title": "Senior Backend Developer",
        "description": "Looking for Senior Backend Developer with 5+ years experience in Python and FastAPI.",
        "min_years": 5.0,
    }

    aligned_res = score_resume(aligned_candidate, jd, mode="recruiter")
    mismatched_res = score_resume(mismatched_candidate, jd, mode="recruiter")

    # Aligned senior developer must have higher experience score and total score
    assert aligned_res["experience_score"] > mismatched_res["experience_score"]
    assert aligned_res["final_score"] > mismatched_res["final_score"]

    # Title match details exposed in experience profile
    assert aligned_res["experience_profile"]["title_match"]["family_match"] is True
    assert aligned_res["experience_profile"]["title_match"]["seniority_delta"] == 0
    assert mismatched_res["experience_profile"]["title_match"]["seniority_delta"] < 0


def test_fresher_skills_list_not_penalized():
    """Verifies that students / freshers without work experience are NOT penalized to 0.60 for listing skills."""
    fresher = {
        "raw_text": "Recent CS Graduate. Skills: Python, FastAPI.",
        "skills": ["Python", "FastAPI"],
        "education": [{"degree": "B.Tech Computer Science"}],
        "work_experience": [],
    }

    jd = {
        "title": "Fresher Python Developer",
        "description": "Requires Python and FastAPI.",
        "min_years": 0.0,
    }

    res = score_resume(fresher, jd, mode="candidate")
    assert res["skills_score"] == 100.0
