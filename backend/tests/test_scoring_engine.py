"""
Unit tests for Dual-Stage Mathematical & Vector Scoring Engine (Phase 3).
"""

import pytest
from services.strict_ats_service import (
    compute_vector_similarity,
    evaluate_knockout_math,
    run_strict_ats_check,
)


def test_compute_vector_similarity():
    resume_text = "Experienced Senior Python Engineer specializing in FastAPI, React, Docker, and PostgreSQL microservices."
    jd_text = "Looking for a Python Developer with FastAPI, PostgreSQL, and Docker experience."
    
    score = compute_vector_similarity(resume_text, jd_text)
    assert isinstance(score, float)
    assert score > 50.0  # High similarity expected


def test_compute_vector_similarity_low_match():
    resume_text = "Nurse Practitioner with 10 years of clinical patient care and hospital administration."
    jd_text = "Senior Software Architect with Kubernetes, Go, Rust, and distributed systems."
    
    score = compute_vector_similarity(resume_text, jd_text)
    assert isinstance(score, float)
    assert score < 40.0  # Low similarity expected


def test_evaluate_knockout_math():
    extracted_data = {
        "skills": ["Python", "FastAPI", "Docker", "Pinecone"],
        "total_experience_years": 4.0,
        "education_level": "Bachelor's Degree",
        "education": [{"degree": "Bachelor of Technology"}]
    }
    jd_text = "Requires 3+ years of experience in Python, FastAPI, Docker, and Vector Databases with a Bachelor degree."
    
    result = evaluate_knockout_math(extracted_data, jd_text)
    
    assert "Python" in result["matched_skills"]
    assert "FastAPI" in result["matched_skills"]
    assert "Docker" in result["matched_skills"]
    # Vector Databases is matched because Pinecone is in ontology subcategory!
    assert "Vector Databases" in result["matched_skills"]
    assert result["experience_score"] == 100.0
    assert result["education_score"] == 100.0
    assert result["knockout_math_score"] == 100.0


def test_run_strict_ats_check_dual_stage():
    extracted_data = {
        "skills": ["React", "TypeScript", "Node.js"],
        "total_experience_years": 2.0,
        "education_level": "Bachelor's Degree",
    }
    raw_text = "Frontend engineer proficient in React, TypeScript, and Node.js with 2 years experience."
    jd_text = "Looking for Frontend Engineer with React, TypeScript, and 3+ years experience."
    
    result = run_strict_ats_check(
        raw_text=raw_text,
        extracted_data=extracted_data,
        jd_text=jd_text,
        skill_universe=["React", "TypeScript", "Node.js"]
    )
    
    assert "math_result" in result
    assert "vector_score" in result
    assert "final_score" in result
    assert result["final_score"] > 0


def test_flexible_pattern_multiline_wrapping():
    from services.strict_ats_service import evaluate_strict_keyword_match
    
    multiline_text = """
    Experience with Large\nLanguage Models and Retrieval-\nAugmented Generation.
    Also used Node.\njs in backend projects.
    """
    
    skills = ["Large Language Models", "Retrieval-Augmented Generation", "Node.js"]
    res = evaluate_strict_keyword_match(multiline_text, skills)
    
    assert "Large Language Models" in res.matched_exact
    assert "Retrieval-Augmented Generation" in res.matched_exact
    assert "Node.js" in res.matched_exact
    assert len(res.missing_exact) == 0

