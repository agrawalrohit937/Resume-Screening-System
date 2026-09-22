"""
Unit tests for Unified Scoring Engine (Phase 1 & Phase 5).
"""

import pytest
from services.scoring_engine import (
    score_resume,
    score_resume_dual,
    WeightProfile,
    CANDIDATE_PROFILE,
    RECRUITER_PROFILE,
)


def test_unified_scoring_engine_candidate_mode():
    extracted_data = {
        "raw_text": "Experienced Python Engineer proficient in FastAPI, Docker, and Pinecone with 4 years of experience and a Bachelor degree in Technology.",
        "skills": ["Python", "FastAPI", "Docker", "Pinecone"],
        "total_experience_years": 4.0,
        "education_level": "Bachelor's Degree",
        "education": [{"degree": "Bachelor of Technology"}]
    }
    jd_text = "Requires 3+ years of experience in Python, FastAPI, Docker, and Pinecone with a Bachelor degree."
    
    result = score_resume(
        resume=extracted_data,
        jd=jd_text,
        mode="candidate",
    )
    
    assert "Python" in result["matched_skills"]
    assert "FastAPI" in result["matched_skills"]
    assert "Docker" in result["matched_skills"]
    assert result["experience_score"] == 100.0
    assert result["education_score"] == 100.0
    assert result["final_score"] >= 60.0
    assert result["is_knockout"] is False


def test_unified_scoring_engine_recruiter_mode():
    extracted_data = {
        "raw_text": "High school graduate with 1 year of introductory Python scripting.",
        "skills": ["Python", "FastAPI"],
        "total_experience_years": 1.0,
        "education_level": "High School",
        "education": []
    }
    jd_text = "Must have 5+ years of experience and a Bachelor degree in Computer Science."
    
    result = score_resume(
        resume=extracted_data,
        jd=jd_text,
        mode="recruiter",
    )
    
    assert result["is_knockout"] is True
    assert len(result["knockout_reasons"]) > 0
    # In Phase 1.5: quality_score, recruiter_score, and final_score are uncapped; knockout is exposed via eligibility
    assert result["quality_score"] == result["final_score"]
    assert result["recruiter_score"] == result["final_score"]
    assert result["eligibility"]["status"] == "ineligible"
    assert result["eligibility_rank"] == 2



def test_candidate_profile_fresher_weights():
    assert CANDIDATE_PROFILE.strict_weight == 0.80
    assert CANDIDATE_PROFILE.semantic_weight == 0.20
    assert CANDIDATE_PROFILE.skills_weight == 0.70
    assert CANDIDATE_PROFILE.experience_weight == 0.15
    assert CANDIDATE_PROFILE.education_weight == 0.15
    assert CANDIDATE_PROFILE.enforce_hard_knockout is False

    assert RECRUITER_PROFILE.strict_weight == 0.60
    assert RECRUITER_PROFILE.semantic_weight == 0.40
    assert RECRUITER_PROFILE.skills_weight == 0.50
    assert RECRUITER_PROFILE.experience_weight == 0.30
    assert RECRUITER_PROFILE.education_weight == 0.20
    assert RECRUITER_PROFILE.enforce_hard_knockout is True

    # Fresher with 100% skill match, 0 professional years, ongoing degree
    extracted_data = {
        "raw_text": "Recent graduate proficient in Python, FastAPI, Docker, and Pinecone.",
        "skills": ["Python", "FastAPI", "Docker", "Pinecone"],
        "total_experience_years": 0.0,
        "education_level": "Bachelor's Degree",
        "education": [{"degree": "Bachelor of Technology"}]
    }
    jd_text = "Requires 3+ years of experience in Python, FastAPI, Docker, and Pinecone with a Bachelor degree."

    result = score_resume(
        resume=extracted_data,
        jd=jd_text,
        mode="candidate",
    )
    # Fresher with full skill match should now achieve a high score (>70%) instead of a demotivating ~60-65%
    assert result["skills_score"] == 100.0
    assert result["final_score"] >= 70.0


def test_score_resume_dual_and_knockout():
    # Candidate with 1 year experience against a hard 5+ year requirement
    extracted_data = {
        "raw_text": "Python engineer with 1 year experience in FastAPI and PostgreSQL.",
        "skills": ["Python", "FastAPI", "PostgreSQL"],
        "total_experience_years": 1.0,
        "education_level": "Bachelor's Degree",
        "education": [{"degree": "Bachelor of Engineering"}]
    }
    jd_text = "Requires at least 5+ years of experience as a Python Engineer with FastAPI and PostgreSQL."

    dual = score_resume_dual(
        resume=extracted_data,
        jd=jd_text,
    )

    assert "candidate_score" in dual
    assert "recruiter_score" in dual
    assert "quality_score" in dual
    assert "eligibility" in dual
    assert "knockout" in dual

    # Candidate score uses lenient weights (70/15/15) while recruiter score weights experience higher (50/30/20)
    assert dual["candidate_score"] > dual["recruiter_score"]
    assert dual["quality_score"] == dual["recruiter_score"]
    assert dual["eligibility"]["status"] == "ineligible"
    assert dual["eligibility_rank"] == 2
    assert dual["knockout"]["passed"] is False
    assert len(dual["knockout"]["reasons"]) > 0
    assert any("5+ years" in r for r in dual["knockout"]["reasons"])


def test_fresher_dynamic_weight_shifting():
    """
    Test dynamic weight shifting for 0-experience fresher with 100% skill match.
    Experience weight is redistributed to skills & education without 0.0 dragging penalty.
    """
    fresher_resume = {
        "raw_text": "Recent college graduate skilled in Python, FastAPI, and PostgreSQL.",
        "skills": ["Python", "FastAPI", "PostgreSQL"],
        "total_experience_years": 0.0,
        "education_level": "Bachelor's Degree",
        "education": [{"degree": "B.Tech Computer Science"}],
    }
    # Entry-level JD
    entry_jd = "Entry-level Software Engineer: Looking for fresh graduates skilled in Python, FastAPI, and PostgreSQL."

    res = score_resume(
        resume=fresher_resume,
        jd=entry_jd,
        mode="candidate",
    )
    assert res["skills_score"] == 100.0
    assert res["education_score"] == 100.0
    # With dynamic weight redistribution, math score should be 100.0
    assert res["math_score"] == 100.0
    assert res["final_score"] >= 90.0



