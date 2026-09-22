"""
Regression test suite for CareerPilot Production Hardening & Correctness Pass.
Covers P0, P1, and P2 hardening items.
"""

import pytest
from services.scoring_engine import (
    score_resume,
    score_resume_dual,
    build_smart_embedding_text,
    SCORING_ENGINE_VERSION,
    WeightProfile,
)
from workflows.enhancer_graph import mask_pii, unmask_pii


def test_min_years_authoritative_resolution():
    """
    Test that structured min_years takes precedence over regex-extracted numbers in JD text.
    JD mentions 'Requires 2+ years of general experience', but structured min_years is 5.
    Candidate has 3 years of experience -> under structured 5 years (hard tone), this should flag knockout.
    """
    resume = {
        "raw_text": "Software Engineer with 3 years of experience in Python and PostgreSQL.",
        "skills": ["python", "postgresql"],
        "total_experience_years": 3.0,
        "experience": [
            {
                "title": "Software Engineer",
                "company": "Tech Corp",
                "duration_years": 3.0,
                "description": "Developed backend APIs using Python and PostgreSQL.",
            }
        ],
    }

    jd_text = "Requires at least 2+ years of general software development experience. Must have strict compliance."
    
    # 1. With structured min_years=5 (threshold 0.5 -> 2.5 yrs min for knockout, but under 5 yrs)
    result = score_resume(
        resume=resume,
        jd=jd_text,
        required_skills=["python", "postgresql"],
        min_years=5.0,
        mode="recruiter",
    )

    # Years score should reflect candidate's 3.0 years against 5.0 min_years (under 5.0 yrs required, not 2.0)
    assert result["experience_score"] <= 65.0
    assert result["experience_score"] >= 30.0
    assert result["scoring_version"] == SCORING_ENGINE_VERSION


def test_division_by_zero_guard_empty_skills():
    """
    Test that an empty required_skills list does not raise ZeroDivisionError and returns 1.0 skills score.
    """
    resume = {
        "raw_text": "Experienced professional with general project leadership background.",
        "skills": ["leadership", "communication"],
        "total_experience_years": 4.0,
    }

    result = score_resume(
        resume=resume,
        jd="Looking for an energetic team player to coordinate projects.",
        required_skills=[],
        min_years=2.0,
        mode="candidate",
    )

    assert result["final_score"] > 0.0
    assert len(result["missing_skills"]) == 0
    assert result["scoring_version"] == SCORING_ENGINE_VERSION


def test_smart_embedding_input_builder():
    """
    Test build_smart_embedding_text prioritizes skills, education, and chronologically recent experience
    over naive head truncation.
    """
    extracted_data = {
        "skills": ["Kubernetes", "Rust", "Golang", "Distributed Systems"],
        "education": [{"degree": "Master of Science in Computer Science", "institution": "Stanford"}],
        "experience": [
            {"role": "Lead Architect", "company": "Cloud Inc", "duration": "2022-Present", "description": "High scale infra"},
            {"role": "Junior Dev", "company": "Startup Hub", "duration": "2018-2020", "description": "Basic web work"},
        ],
    }
    raw_filler = "Filler paragraph " * 200 + " Secret Page 3 Skill: Quantum Computing"

    smart_text = build_smart_embedding_text(extracted_data, raw_filler, max_chars=1000)

    # Skills and Education should be explicitly present in the smart embedding text
    assert "Kubernetes" in smart_text
    assert "Rust" in smart_text
    assert "Stanford" in smart_text
    assert len(smart_text) <= 1000


def test_scoring_engine_versioning():
    """
    Test that candidate, recruiter, and dual scoring modes all output the authoritative scoring_version.
    """
    resume = {
        "raw_text": "Python backend engineer with FastAPI experience.",
        "skills": ["python", "fastapi"],
        "total_experience_years": 4.0,
    }
    jd = "Backend Developer with Python and FastAPI experience."

    cand_res = score_resume(resume=resume, jd=jd, required_skills=["python", "fastapi"], mode="candidate")
    assert cand_res["scoring_version"] == SCORING_ENGINE_VERSION

    rec_res = score_resume(resume=resume, jd=jd, required_skills=["python", "fastapi"], mode="recruiter")
    assert rec_res["scoring_version"] == SCORING_ENGINE_VERSION

    dual_res = score_resume_dual(resume=resume, jd=jd, required_skills=["python", "fastapi"], min_years=3.0)
    assert dual_res["scoring_version"] == SCORING_ENGINE_VERSION
    assert "recruiter_score" in dual_res
    assert "candidate_score" in dual_res
    assert "knockout" in dual_res


def test_knockout_years_configurable_ratio():
    """
    Test knockout threshold ratio: candidate with 2.0 years against min_years=5.0
    under ratio=0.5 (threshold = 2.5) fails knockout when tone is hard.
    """
    resume = {
        "raw_text": "Junior developer with 2 years experience.",
        "skills": ["python"],
        "total_experience_years": 2.0,
    }
    jd = "Must have at least 5 years experience. Strict minimum required."

    dual_res = score_resume_dual(
        resume=resume,
        jd=jd,
        required_skills=["python"],
        min_years=5.0,
    )

    # Knockout should be triggered because candidate has 2.0 yrs, below 5.0 * 0.5 = 2.5 yrs
    assert dual_res["knockout"]["passed"] is False
    assert any("years of experience" in r.lower() for r in dual_res["knockout"]["reasons"])


def test_pii_masking_round_trip():
    """
    Test that mask_pii removes candidate emails and phone numbers, and unmask_pii deterministically restores them.
    """
    original_text = (
        "Candidate John Doe\n"
        "Email: john.doe.pro@company.com\n"
        "Phone: +1 (555) 234-5678 or 555-876-5432\n"
        "Experienced software engineer with 6 years experience."
    )

    masked_text, pii_map = mask_pii(original_text)

    # Real email and phone must NOT exist in the masked text
    assert "john.doe.pro@company.com" not in masked_text
    assert "555" not in masked_text
    assert "[EMAIL_REDACTED_1]" in masked_text
    assert "[PHONE_REDACTED_1]" in masked_text

    # Verify unmasking on nested structure
    nested_json = {
        "contact": {
            "email": "[EMAIL_REDACTED_1]",
            "phone": "[PHONE_REDACTED_1]",
        },
        "summary": "Contact me at [EMAIL_REDACTED_1] for queries.",
    }

    restored = unmask_pii(nested_json, pii_map)
    assert restored["contact"]["email"] == "john.doe.pro@company.com"
    assert restored["contact"]["phone"] == "+1 (555) 234-5678"
    assert "john.doe.pro@company.com" in restored["summary"]
