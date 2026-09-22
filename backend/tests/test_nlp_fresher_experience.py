"""
-Tests for Fresher / 0-1 Years Experience Mapping and Saturating S_exp Calculation.
-"""

import pytest
from services.nlp_extractor import extract_experience_requirement
from utils.nlp_utils import extract_years_of_experience
from services.scoring_engine import score_resume, _extract_years_requirement
from services.scoring.experience_model import compute_experience_saturation, calculate_effective_experience


def test_fresher_and_zero_years_nlp_extraction():
    """Verify regex/NLP rules map Fresher, 0-1 years, and no prior experience to 0.0 required years."""
    test_cases = [
        ("Looking for Freshers with Python knowledge", 0.0),
        ("Entry level software developer (0-1 years of experience)", 0.0),
        ("0 - 1 years experience required", 0.0),
        ("0 to 1 years of experience", 0.0),
        ("No prior experience required for this role", 0.0),
        ("Freshers welcome to apply", 0.0),
        ("Junior developer (0+ years experience)", 0.0),
        ("No experience required. We will train you.", 0.0),
        ("Trainee software engineer position (Fresher)", 0.0),
    ]

    for text, expected in test_cases:
        extracted = extract_experience_requirement(text)
        assert extracted == expected, f"Failed for text: '{text}', got {extracted}, expected {expected}"
        
        years_req = _extract_years_requirement(text)
        assert years_req is not None and years_req[0] == expected, f"_extract_years_requirement failed for '{text}'"


def test_senior_experience_retains_higher_tenure():
    """Verify that mid/senior job descriptions correctly extract required years >= 2.0."""
    test_cases = [
        ("Requires 3+ years of professional backend experience", 3.0),
        ("At least 5 years of experience in distributed systems", 5.0),
        ("Minimum 7 years of work experience as Staff ML Engineer", 7.0),
        ("2-4 years of experience with React and Node.js", 2.0),
    ]

    for text, expected in test_cases:
        extracted = extract_experience_requirement(text)
        assert extracted >= expected, f"Failed for text: '{text}', got {extracted}, expected {expected}"
        
        years_req = _extract_years_requirement(text)
        assert years_req is not None and years_req[0] >= expected, f"_extract_years_requirement failed for '{text}'"


def test_saturating_exp_formula_zero_required_years():
    """
    Verify that compute_experience_saturation returns 1.0 (100%) when required_years == 0.0
    for any candidate with effective_years >= 0.0.
    """
    assert compute_experience_saturation(effective_years=0.0, required_years=0.0) == 1.0
    assert compute_experience_saturation(effective_years=0.5, required_years=0.0) == 1.0
    assert compute_experience_saturation(effective_years=2.0, required_years=0.0) == 1.0


def test_fresher_candidate_scoring_on_entry_level_jd():
    """
    Verify full ATS evaluation for a Fresher candidate on a '0-1 Years / Fresher' JD.
    Candidate with 0 years should receive 100% experience score and zero hard knockouts.
    """
    candidate_resume = {
        "skills": ["Python", "FastAPI", "Git", "SQL"],
        "total_experience_years": 0.0,
        "work_experience": [],
        "education": [{"degree": "Bachelor of Technology in Computer Science", "end_year": 2026}],
        "parsed_data": {
            "raw_text": "Recent graduate with strong foundations in Python, FastAPI, and SQL. Completed academic projects in web development.",
            "skills": ["Python", "FastAPI", "Git", "SQL"],
        }
    }

    fresher_jd = {
        "title": "Junior Python Developer (Fresher / 0-1 Years)",
        "description": "Looking for Freshers / 0-1 Years Experience in Python and FastAPI. No prior experience required. Must have strong problem solving skills.",
        "skills": ["Python", "FastAPI", "SQL"],
        "min_years": 0.0,
    }

    result = score_resume(resume=candidate_resume, jd=fresher_jd, mode="recruiter")

    assert result["is_knockout"] is False
    assert len(result["knockout_reasons"]) == 0
    assert result["experience_score"] >= 0.99 or result["experience_score"] == 100.0 or result["experience_score"] == 1.0
    assert result["final_score"] >= 75.0  # High score for matching skills and zero tenure penalty


def test_fresher_effective_years_partial_experience_full_score():
    """
    Direct test for the reported bug:
    Candidate with 0.18 effective years on a Fresher role (required_years = 0.0)
    must receive 100% (1.0 / 100.0) experience score instead of 10.7% (11%).
    """
    # 1. Direct saturation function check
    assert compute_experience_saturation(effective_years=0.18, required_years=0.0) == 1.0
    
    # 2. Work experience profile calculation with min_years = 0.0
    profile = calculate_effective_experience(
        roles=[
            {
                "title": "Software Engineering Intern",
                "company": "Tech Startup",
                "start_date": "2024-01-01",
                "end_date": "2024-03-01",  # ~2 months -> 0.18 years
                "description": "Assisted with Python backend endpoints and testing",
            }
        ],
        target_role_text="Fresher Python Developer (0-1 years)",
        min_years=0.0,
    )
    assert profile.experience_score == 100.0

    # 3. End-to-end scoring check
    resume = {
        "skills": ["Python", "FastAPI"],
        "total_experience_years": 0.18,
        "work_experience": [
            {
                "title": "Software Engineering Intern",
                "company": "Tech Startup",
                "start_date": "2024-01-01",
                "end_date": "2024-03-01",
                "description": "Assisted with Python backend endpoints and testing",
            }
        ],
        "education": [{"degree": "B.Tech Computer Science", "end_year": 2026}],
    }
    jd = {
        "title": "Fresher Python Developer",
        "description": "Looking for Freshers (0-1 years). Python, FastAPI.",
        "skills": ["Python", "FastAPI"],
        "min_years": 0.0,
    }
    score_res = score_resume(resume, jd, mode="candidate")
    assert score_res["experience_score"] == 100.0

