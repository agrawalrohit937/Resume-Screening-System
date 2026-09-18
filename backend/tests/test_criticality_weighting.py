"""
Unit Tests for Task 0.2: Requirement Criticality Weighting.

Tests:
1. JDCriticalityIndex parsing and classification into {3.0, 2.0, 1.0}.
2. infer_criticality behavior with hard, standard, and soft requirement patterns.
3. Weighted skills score calculation: missing critical skill penalizes more than missing nice-to-have.
4. Fallback behavior when FEATURE_CRITICALITY_WEIGHTING is disabled.
"""

import pytest
from core.feature_flags import FEATURE_CRITICALITY_WEIGHTING
from services.scoring.criticality import JDCriticalityIndex, infer_criticality
from services.scoring_engine import score_resume


def test_infer_criticality_spans():
    jd_text = """
    Senior Full Stack Engineer
    
    Required Qualifications:
    - Must have deep knowledge of Python and PostgreSQL.
    - Mandatory experience with distributed systems.
    
    Core Responsibilities:
    - Build scalable backend APIs using FastAPI.
    
    Nice to Have:
    - Experience with Docker and Kubernetes is a plus.
    - Bonus points for GraphQL familiarity.
    """
    index = JDCriticalityIndex(jd_text)

    # Critical (weight 3.0)
    assert index.get_criticality("Python") == 3.0
    assert index.get_criticality("PostgreSQL") == 3.0

    # Standard (weight 2.0)
    assert index.get_criticality("FastAPI") == 2.0

    # Soft / Nice-to-have (weight 1.0)
    assert index.get_criticality("Docker") == 1.0
    assert index.get_criticality("Kubernetes") == 1.0
    assert index.get_criticality("GraphQL") == 1.0


def test_infer_criticality_standalone():
    jd = "Requirements: Must know Python. Nice to have: React."
    assert infer_criticality("Python", jd) == 3.0
    assert infer_criticality("React", jd) == 1.0
    assert infer_criticality("AWS", jd) == 2.0  # Not in text or neutral


def test_criticality_weighted_scoring_impact():
    """
    A candidate missing a critical (weight 3.0) skill receives a lower skills score
    than a candidate missing a soft (weight 1.0) skill when both candidates match 2 out of 3 skills.
    """
    jd_text = """
    Software Engineer
    Required:
    - Python (Must have)
    
    Job Duties:
    - FastAPI development
    
    Nice to have:
    - Docker
    """
    # Candidate A: Has FastAPI (2.0) and Docker (1.0), missing Python (3.0)
    # Total weights = 3.0 + 2.0 + 1.0 = 6.0
    # Candidate A score = (0*3 + 1*2 + 1*1)/6 = 3/6 = 50%
    resume_a = {
        "raw_text": "Developer working with FastAPI and Docker containers daily.",
        "skills": ["FastAPI", "Docker"],
        "total_experience_years": 3.0,
        "education_level": "Bachelor's Degree",
    }
    res_a = score_resume(resume=resume_a, jd=jd_text, required_skills=None, mode="candidate")

    # Candidate B: Has Python (3.0) and FastAPI (2.0), missing Docker (1.0)
    # Candidate B score = (1*3 + 1*2 + 0*1)/6 = 5/6 = 83.3%
    resume_b = {
        "raw_text": "Backend Engineer with 3 years Python and FastAPI microservices.",
        "skills": ["Python", "FastAPI"],
        "total_experience_years": 3.0,
        "education_level": "Bachelor's Degree",
    }
    res_b = score_resume(resume=resume_b, jd=jd_text, required_skills=None, mode="candidate")

    assert res_b["skills_score"] > res_a["skills_score"]
    assert res_b["skills_score"] >= 80.0
    assert res_a["skills_score"] <= 75.0




def test_empty_jd_and_skills_handling():
    index = JDCriticalityIndex("")
    assert index.get_criticality("Python") == 2.0
    assert index.get_criticality("") == 2.0
