"""
Unit Tests for In-Progress / Pursuing Degree Classification and Partial Credit Education Scoring.
"""

import pytest
from services.education_service import (
    resolve_degree_level,
    candidate_highest_education,
    is_degree_in_progress,
    get_education_classification,
)
from services.scoring_engine import (
    _candidate_max_degree_rank,
    _education_score,
    _evaluate_eligibility,
    score_resume,
)


def test_in_progress_degree_date_ranges_and_keywords():
    """Verify that date ranges like 2023-2027 and pursuing keywords are classified as in-progress."""
    test_cases = [
        ({"degree": "Bachelor of Technology in Computer Science (2023-2027)"}, True),
        ({"degree": "B.Tech in CS", "dates": "2023 - 2027"}, True),
        ({"degree": "B.Tech in Computer Science", "year": "2024 to 2028"}, True),
        ({"degree": "B.E. Computer Science", "end_year": 2027}, True),
        ({"degree": "Pursuing B.Sc in Information Technology"}, True),
        ({"degree": "BCA Final Year Student"}, True),
        ({"degree": "Master of Technology (Expected 2027)"}, True),
        ({"degree": "B.Tech in Mechanical Engineering", "dates": "2018-2022", "end_year": 2022}, False),
        ({"degree": "Bachelor of Science", "end_year": 2020}, False),
    ]

    for edu_dict, expected in test_cases:
        in_prog = is_degree_in_progress(edu_dict, current_year=2026)
        assert in_prog == expected, f"is_degree_in_progress failed for {edu_dict}: got {in_prog}, expected {expected}"


def test_candidate_highest_education_in_progress():
    """Verify candidate_highest_education properly identifies level and in-progress status."""
    resume_data = {
        "education": [
            {
                "degree": "Bachelor of Technology in Computer Science (2023-2027)",
                "institution": "National Institute of Technology",
            }
        ]
    }

    rank, isced, in_prog, label, evidence = candidate_highest_education(resume_data, country="IN")
    assert rank == 3  # Bachelor's Level
    assert isced == 6
    assert in_prog is True
    assert "Bachelor of Technology" in label

    info = get_education_classification(resume_data, country="IN")
    assert info["classification"] == "In-Progress / Pursuing"
    assert info["status_label"] == "Degree in Progress"


def test_education_partial_credit_matching_major():
    """
    Verify that an in-progress candidate with a matching major receives 90% partial credit
    instead of 0% or low score / degree mismatch.
    """
    extracted_data_in_prog = {
        "education": [
            {
                "degree": "Bachelor of Technology",
                "field": "Computer Science",
                "dates": "2023-2027",
            }
        ],
        "skills": ["Python", "FastAPI", "React", "SQL"],
    }

    jd_text = "We are seeking a Software Developer. Requires a Bachelor's degree in Computer Science or related field."

    edu_score = _education_score(extracted_data_in_prog, jd_text)
    assert edu_score == 0.90, f"Expected 90% (0.90) partial credit for in-progress major match, got {edu_score}"


def test_eligibility_and_ats_score_for_in_progress_degree():
    """
    Verify end-to-end that an in-progress degree does NOT trigger a degree mismatch knockout
    and outputs 'Degree in Progress' in results.
    """
    resume = {
        "candidate_name": "Rohan Sharma",
        "raw_text": "B.Tech in Computer Science (2023-2027). Strong skills in Python, FastAPI, and Postgres.",
        "skills": ["Python", "FastAPI", "Postgres"],
        "total_experience_years": 0.0,
        "education": [
            {
                "degree": "B.Tech in Computer Science",
                "dates": "2023-2027",
                "field": "Computer Science",
            }
        ],
    }

    jd = {
        "title": "Junior Backend Developer",
        "description": "Looking for Junior Backend Developer. Bachelor's degree in CS required. Skills: Python, FastAPI.",
        "skills": ["Python", "FastAPI"],
        "min_years": 0.0,
    }

    result = score_resume(resume=resume, jd=jd, mode="recruiter")

    assert result["is_knockout"] is False
    assert result["education_label"] == "Degree in Progress"
    assert result["education_status"] == "in_progress"
    assert result["is_in_progress"] is True
    assert result["education_score"] == 90.0

    # Ensure suggestions encourage rather than warn about degree mismatch
    assert any("Degree in Progress" in s for s in result["feedback_suggestions"])
    assert not any("Education requirement differs" in s for s in result["feedback_suggestions"])
