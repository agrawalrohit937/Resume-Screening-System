"""
Unit tests for Real Experience Model (Phase 1.4).
"""

from datetime import date
import pytest

from services.scoring.experience_model import (
    RoleInterval,
    merge_calendar_intervals,
    calculate_effective_experience,
    infer_seniority,
)


def test_concurrent_roles_do_not_double_count():
    # Two overlapping roles in the same 2-year window (2020-01-01 to 2022-01-01)
    intervals = [
        RoleInterval(
            start_date=date(2020, 1, 1),
            end_date=date(2022, 1, 1),
            title="Fullstack Developer",
            company="Company A",
            description="Full-time software engineering",
        ),
        RoleInterval(
            start_date=date(2020, 6, 1),
            end_date=date(2021, 6, 1),
            title="Part-time Consultant",
            company="Company B",
            description="Consulting work",
        ),
    ]

    total_years, gaps = merge_calendar_intervals(intervals)
    # Total merged calendar span is 2.0 years, NOT 3.0 years!
    assert round(total_years, 1) == 2.0
    assert len(gaps) == 0


def test_career_gap_detected_without_penalty():
    # Role 1: 2018 to 2019 (1 yr)
    # Gap: 2019 to 2021 (2 yrs)
    # Role 2: 2021 to 2023 (2 yrs)
    intervals = [
        RoleInterval(
            start_date=date(2018, 1, 1),
            end_date=date(2019, 1, 1),
            title="Junior Developer",
            company="Company A",
            description="Junior dev",
        ),
        RoleInterval(
            start_date=date(2021, 1, 1),
            end_date=date(2023, 1, 1),
            title="Software Engineer",
            company="Company B",
            description="Mid-level dev",
        ),
    ]

    total_years, gaps = merge_calendar_intervals(intervals)
    assert round(total_years, 1) == 3.0
    assert len(gaps) == 1
    # Gap is ~24 months
    assert gaps[0].duration_months >= 23.0


def test_effective_experience_recency_decay():
    # Recent role vs ancient role
    extracted_data = {
        "work_experience": [
            {
                "title": "Lead Backend Engineer",
                "company": "Recent Tech",
                "start_date": "2022-01-01",
                "end_date": "2024-01-01",
                "description": "Python, FastAPI, Kubernetes microservices.",
            },
            {
                "title": "Junior Developer",
                "company": "Past Tech",
                "start_date": "2006-01-01",
                "end_date": "2008-01-01",
                "description": "Legacy system maintenance.",
            },
        ]
    }

    profile = calculate_effective_experience(
        extracted_data=extracted_data,
        target_role_text="Senior Python Backend Engineer with FastAPI and Kubernetes",
        min_years=3.0,
    )

    assert profile.raw_calendar_years >= 3.8
    assert profile.effective_years > 0
    assert profile.experience_score >= 50.0

    # Role breakdown should show that 2006-2008 role experienced significant decay
    recent_role = profile.role_breakdown[0]
    ancient_role = profile.role_breakdown[1]
    assert recent_role["decay"] > ancient_role["decay"]
    assert ancient_role["decay"] < 0.35  # > 16 years ago => (0.5)^2 = 0.25


def test_seniority_inference():
    level, rank = infer_seniority("Staff Software Engineer")
    assert level == "staff"
    assert rank == 4

    level, rank = infer_seniority("Internship Web Developer")
    assert level == "intern"
    assert rank == 0


def test_experience_saturation_normalized_curve():
    from services.scoring.experience_model import compute_experience_saturation

    # 1. Zero experience -> 0.0
    assert compute_experience_saturation(0.0, 3.0, k=1.4) == 0.0

    # 2. Exact parity (x = 1.0) -> 1.0
    assert round(compute_experience_saturation(3.0, 3.0, k=1.4), 6) == 1.0

    # 3. Half experience (x = 0.5) -> strictly in (0.50, 0.75)
    score_half = compute_experience_saturation(1.5, 3.0, k=1.4)
    assert 0.50 < score_half < 0.75
    assert round(score_half, 3) == 0.668

    # 4. Monotonic strictly increasing
    prev = -1.0
    for exp_val in [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0]:
        val = compute_experience_saturation(exp_val, 3.0, k=1.4)
        assert val >= prev
        prev = val

    # 5. Over-experience capped at 1.0
    assert compute_experience_saturation(6.0, 3.0, k=1.4) == 1.0

    # 6. Handled required_years <= 0
    assert compute_experience_saturation(2.0, 0.0, k=1.4) == 1.0
    assert compute_experience_saturation(0.0, 0.0, k=1.4) == 1.0

