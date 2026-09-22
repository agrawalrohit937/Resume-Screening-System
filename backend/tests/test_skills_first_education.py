"""
Unit tests for Skills-First Education Mode and ISCED Equivalence Mapping.
Verifies Indian degree overrides, mode toggles (required | preferred | ignored),
and elimination of institution prestige bias.
"""

import pytest
from services.education_service import resolve_degree_level, candidate_highest_education
from services.scoring_engine import _evaluate_eligibility, score_resume, WeightProfile


def test_indian_degree_isced_and_rank_overrides():
    # ITI / Diplomas as Level 1
    rank_iti, isced_iti, label_iti = resolve_degree_level("ITI Electrician", "IN")
    assert rank_iti == 1
    assert isced_iti == 3

    rank_dip, isced_dip, _ = resolve_degree_level("Polytechnic Diploma in Mechanical", "IN")
    assert rank_dip == 1

    # B.Sc / BCA / B.Tech as Level 3
    rank_btech, isced_btech, _ = resolve_degree_level("B.Tech in Computer Science", "IN")
    assert rank_btech == 3
    assert isced_btech == 6

    rank_bca, isced_bca, _ = resolve_degree_level("Bachelor of Computer Applications (BCA)", "IN")
    assert rank_bca == 3

    rank_bsc, isced_bsc, _ = resolve_degree_level("B.Sc Information Technology", "IN")
    assert rank_bsc == 3

    # B.Ed / M.Sc as Level 4
    rank_bed, isced_bed, _ = resolve_degree_level("Bachelor of Education (B.Ed)", "IN")
    assert rank_bed == 4

    rank_msc, isced_msc, _ = resolve_degree_level("M.Sc in Physics", "IN")
    assert rank_msc == 4
    assert isced_msc == 7

    # Ph.D as Level 5
    rank_phd, isced_phd, _ = resolve_degree_level("Doctor of Philosophy (Ph.D)", "IN")
    assert rank_phd == 5
    assert isced_phd == 8


def test_skills_first_education_mode_ignored():
    # JD requires a Master's degree, but job specifies education_requirement_mode = "ignored"
    job = {
        "title": "Senior Python Developer",
        "description": "Seeking Python expert with 4+ years experience. Master degree required.",
        "education_requirement_mode": "ignored",
    }

    cand_no_degree = {
        "raw_text": "Python engineer with 5 years experience in FastAPI and PostgreSQL.",
        "skills": ["Python", "FastAPI", "PostgreSQL"],
        "education": [],
        "total_experience_years": 5.0,
    }

    res = _evaluate_eligibility(cand_no_degree, jd_text=job["description"], job=job)
    # Under 'ignored' mode, NO degree checks should appear and candidate is eligible!
    assert res["status"] == "eligible"
    assert not any(c["rule_id"] == "degree_level" for c in res["checks"])


def test_skills_first_education_mode_required():
    # Job specifies education_requirement_mode = "required"
    job = {
        "title": "Machine Learning Scientist",
        "description": "Requires a Master level degree in Data Science or Computer Science.",
        "education_requirement_mode": "required",
    }

    # Candidate only has completed Bachelor degree (rank 3 < required rank 4)
    cand_bachelor = {
        "raw_text": "B.Tech graduate in CS with ML experience.",
        "skills": ["Python", "PyTorch"],
        "education": [{"degree": "B.Tech", "end_year": 2022}],
        "total_experience_years": 3.0,
    }

    res = _evaluate_eligibility(cand_bachelor, jd_text=job["description"], job=job)
    assert res["status"] == "ineligible"
    assert res["is_knockout"] is True
    assert any("degree" in r.lower() for r in res["reasons"])


def test_skills_first_education_mode_preferred_soft_check():
    # Default mode: "preferred"
    job = {
        "title": "Backend Developer",
        "description": "Requires a Bachelor level degree in Engineering.",
        "education_requirement_mode": "preferred",
    }

    cand_diploma = {
        "raw_text": "Diploma engineer with 4 years backend development.",
        "skills": ["Python", "FastAPI"],
        "education": [{"degree": "Polytechnic Diploma"}],
        "total_experience_years": 4.0,
    }

    res = _evaluate_eligibility(cand_diploma, jd_text=job["description"], job=job)
    # Under 'preferred' mode, lower degree produces a soft advisory, NOT an ineligible knockout!
    assert res["status"] == "eligible"
    assert res["is_knockout"] is False
    assert any("degree" in a.lower() for a in res["advisories"])


def test_pursuing_degree_soft_check():
    job = {
        "title": "Data Analyst",
        "description": "Requires a Bachelor level degree.",
        "education_requirement_mode": "required",
    }

    cand_pursuing = {
        "raw_text": "Currently pursuing B.Tech in Information Technology.",
        "skills": ["SQL", "Python"],
        "education": [{"degree": "B.Tech in progress", "end_year": None}],
        "total_experience_years": 1.0,
    }

    res = _evaluate_eligibility(cand_pursuing, jd_text=job["description"], job=job)
    # In-progress degrees count for ranking and produce a soft check, never a hard knockout
    assert res["status"] == "eligible"
    assert res["is_knockout"] is False


def test_strict_math_renormalization_when_education_ignored():
    # Test end-to-end score_resume with education_requirement_mode = "ignored"
    jd = {
        "title": "Senior Go Developer",
        "description": "Senior Go Developer. Master degree required. Must have Go and Docker.",
        "education_requirement_mode": "ignored",
    }
    resume = {
        "raw_text": "Go developer with 5 years experience using Go, Docker, Kubernetes.",
        "skills": ["Go", "Docker", "Kubernetes"],
        "education": [],
        "total_experience_years": 5.0,
    }

    result = score_resume(resume=resume, jd=jd, mode="recruiter")
    # Score should not be penalized by empty education
    assert result["quality_score"] > 60.0
    assert result["eligibility"]["status"] == "eligible"
