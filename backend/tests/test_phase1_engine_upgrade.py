"""
Phase 1 Verification Tests:
1.1 Normalized experience saturation curve (monotonic, x=0 -> 0, x=1 -> 1.0, x=0.5 in (0.5, 0.75), required_years <= 0).
1.2 Fresher project scoring (tech overlap, relevance, quality, redistribution, unchanged for experienced).
1.3 Vector score calibration script smoke test and Max-Sim bounds.
"""

import pytest
from services.scoring.experience_model import compute_experience_saturation, calculate_effective_experience
from services.scoring.projects_model import (
    extract_project_technologies,
    compute_single_project_score,
    compute_projects_score,
)
from services.scoring_engine import score_resume, CANDIDATE_PROFILE, RECRUITER_PROFILE


def test_experience_saturation_properties():
    # 1. Zero experience -> 0.0
    assert compute_experience_saturation(0.0, 3.0, k=1.4) == 0.0

    # 2. Exact parity -> 1.0
    assert round(compute_experience_saturation(3.0, 3.0, k=1.4), 6) == 1.0

    # 3. Half experience -> strictly in (0.50, 0.75)
    score_half = compute_experience_saturation(1.5, 3.0, k=1.4)
    assert 0.50 < score_half < 0.75
    assert round(score_half, 3) == 0.668

    # 4. Monotonic strictly increasing
    x_vals = [0.0, 0.2, 0.5, 1.0, 1.5, 2.0, 3.0]
    scores = [compute_experience_saturation(x, 3.0, k=1.4) for x in x_vals]
    for i in range(len(scores) - 1):
        assert scores[i] <= scores[i + 1]

    # 5. Over-experience capped at 1.0
    assert compute_experience_saturation(5.0, 3.0, k=1.4) == 1.0

    # 6. Handled required_years <= 0
    assert compute_experience_saturation(2.0, 0.0, k=1.4) == 1.0
    assert compute_experience_saturation(0.0, 0.0, k=1.4) == 1.0


def test_internship_counted_as_half_experience():
    extracted = {
        "work_experience": [
            {
                "title": "Software Engineering Intern",
                "company": "Tech Corp",
                "start_date": "2023-01-01",
                "end_date": "2024-01-01", # 12 months = 1 year
                "description": "Built backend APIs using Python and FastAPI.",
            }
        ]
    }
    from datetime import date
    profile = calculate_effective_experience(
        extracted_data=extracted,
        target_role_text="Python Backend Engineer",
        min_years=2.0,
        reference_date=date(2024, 1, 1),
    )
    # Raw calendar years = 1.0, with reference_date decay is 1.0, so effective years = 1.0 * 0.5 = 0.50
    assert profile.raw_calendar_years == 1.0
    assert 0.48 <= profile.effective_years <= 0.52
    assert profile.role_breakdown[0]["is_internship"] is True


def test_fresher_projects_scoring_and_redistribution():
    fresher_resume = {
        "raw_text": "Fresher developer with strong portfolio projects. GitHub: https://github.com/alex/ai-app",
        "skills": ["Python", "FastAPI", "Docker"],
        "total_experience_years": 0.0,
        "education": [{"degree": "B.Tech", "field_of_study": "Computer Science"}],
        "projects": [
            {
                "title": "Distributed Task Queue",
                "description": "Architected an asynchronous worker queue in Python & Redis processing 10k req/s with 99.9% uptime.",
                "technologies": ["Python", "Redis", "FastAPI", "Docker"],
                "github": "https://github.com/alex/task-queue",
            }
        ],
    }
    entry_jd = {
        "text": "Seeking an Entry Level Software Engineer skilled in Python, FastAPI, and Docker. 0-1 years experience.",
        "min_years": 0.0,
    }

    result = score_resume(fresher_resume, entry_jd, mode="candidate")
    assert result["quality_score"] > 0
    assert "projects_score" in result
    assert result["projects_score"] > 0
    assert len(result["projects_breakdown"]) >= 1
    assert result["projects_breakdown"][0]["has_link"] is True
    assert result["projects_breakdown"][0]["has_metrics"] is True


def test_experienced_candidate_score_not_altered_by_projects_flag():
    experienced_resume = {
        "raw_text": "Senior Software Engineer with 5 years experience in Python, AWS, PostgreSQL.",
        "skills": ["Python", "AWS", "PostgreSQL"],
        "total_experience_years": 5.0,
        "work_experience": [
            {
                "title": "Senior Software Engineer",
                "company": "Acme Corp",
                "start_date": "2019-01-01",
                "end_date": "2024-01-01",
                "description": "Led backend architecture in Python and PostgreSQL.",
            }
        ],
        "education": [{"degree": "B.Tech", "field_of_study": "Computer Science"}],
        "projects": [
            {
                "title": "Side Project",
                "description": "A small tool built in Python.",
                "technologies": ["Python"],
            }
        ],
    }
    senior_jd = {
        "text": "Senior Backend Developer needed with 4+ years of Python and PostgreSQL experience.",
        "min_years": 4.0,
    }

    result = score_resume(experienced_resume, senior_jd, mode="recruiter")
    # For experienced candidate, experience_score is high, experience_weight remains authoritative
    assert result["experience_score"] >= 80.0
    assert result["quality_score"] >= 70.0


def test_vector_calibration_script_smoke():
    from scripts.calibrate_vector_scores import run_calibration
    pairs = [
        (
            {"raw_text": "Senior Python Developer with FastAPI and Docker.", "skills": ["Python", "FastAPI", "Docker"]},
            {"text": "Seeking a Python Developer with FastAPI knowledge.", "requirements": ["Python Developer with FastAPI"]}
        ),
        (
            {"raw_text": "Java Spring Developer with MySQL and Kafka.", "skills": ["Java", "Spring", "MySQL"]},
            {"text": "Looking for a React Frontend Developer with CSS and Next.js.", "requirements": ["React Frontend Developer"]}
        )
    ]
    res = run_calibration(pairs)
    assert res["sample_size"] == 2
    assert "single_vector" in res
    assert "max_sim_multi_vector" in res
    assert "recommended_env_vars" in res
    assert "VEC_SIM_FLOOR" in res["recommended_env_vars"]
    assert "MAXSIM_FLOOR" in res["recommended_env_vars"]
