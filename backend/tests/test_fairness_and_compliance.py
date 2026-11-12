"""
Tests for Fairness, PII Blinding, and Regulatory Compliance (Task 3.5).
Verifies:
  1. Indian Context PII blinding (Caste, Category, Religion, Marital Status, DOB, Graduation Year).
  2. Blind scoring stability (score delta < 2.0 points).
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from services.security.pii_redactor import mask_pii_extended
from services.scoring_engine import score_resume
from core import feature_flags


def test_pii_masking_indian_context():
    """Validates masking of Indian context protected attributes."""
    sample_text = (
        "Name: Rohit Sharma\n"
        "Email: rohit.sharma@example.com\n"
        "Phone: +91 9876543210\n"
        "Date of Birth: 15/08/1995 (Age: 29 years)\n"
        "Marital Status: Married\n"
        "Religion: Hindu\n"
        "Category: OBC / Non-Creamy Layer\n"
        "Caste: Brahmin\n"
        "B.Tech Computer Science, Graduated in 2017\n"
        "Proficient in Python, FastApi, Docker, and PostgreSQL."
    )

    masked, _ = mask_pii_extended(sample_text, candidate_name="Rohit Sharma")

    # Demographics and PII should be masked
    assert "Rohit Sharma" not in masked
    assert "rohit.sharma@example.com" not in masked
    assert "9876543210" not in masked
    assert "Married" not in masked
    assert "Hindu" not in masked
    assert "OBC" not in masked
    assert "Brahmin" not in masked
    assert "15/08/1995" not in masked
    assert "2017" not in masked  # Graduation year masked

    # Core technical skills must remain untouched
    assert "Python" in masked
    assert "FastApi" in masked
    assert "Docker" in masked
    assert "PostgreSQL" in masked


def test_blind_scoring_stability():
    """Validates that blinding PII does not destabilize technical scoring (delta < 2.0)."""
    jd = {
        "title": "Senior Python Backend Engineer",
        "description": "Looking for Senior Python Developer with FastAPI, PostgreSQL, Docker, and Redis experience. 4+ years required.",
        "min_years": 4.0,
    }

    resume_unmasked = (
        "Rohit Sharma, DOB: 12/04/1992, Hindu, Brahmin, Married.\n"
        "Senior Backend Developer with 5 years experience in Python, FastAPI, PostgreSQL, Docker, Redis.\n"
        "Built microservices and scalable cloud pipelines."
    )

    # 1. Score without blind scoring flag
    feature_flags.FEATURE_BLIND_SCORING = False
    res_raw = score_resume(resume_unmasked, jd)

    # 2. Score with blind scoring flag enabled
    feature_flags.FEATURE_BLIND_SCORING = True
    res_blind = score_resume(resume_unmasked, jd)

    # Reset flag
    feature_flags.FEATURE_BLIND_SCORING = False

    # Difference in quality score should be minimal (< 2.0 points)
    delta = abs(res_raw["quality_score"] - res_blind["quality_score"])
    assert delta <= 2.0, f"Score delta too high ({delta}) after PII blinding"
