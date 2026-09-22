"""
Tests for Fairness, Bias Monitoring, PII Blinding, and Regulatory Compliance (Task 3.5).
Verifies:
  1. Indian Context PII blinding (Caste, Category, Religion, Marital Status, DOB, Graduation Year).
  2. Four-Fifths rule impact monitoring (EEOC / NYC LL144).
  3. Immutable decision logging contract.
  4. Blind scoring stability (score delta < 2.0 points).
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from services.security.pii_redactor import mask_pii_extended
from services.fairness.impact_monitor import compute_impact_ratios, check_selection_rate_equity
from services.fairness.decision_logger import log_scoring_decision
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


def test_impact_monitor_four_fifths_rule():
    """Validates EEOC 4/5ths rule (0.80 threshold) calculation."""
    # Benchmark group: 100 applied, 60 selected -> 60%
    # Group A: 50 applied, 20 selected -> 40% (Ratio: 40/60 = 0.667 -> Adverse impact)
    # Group B: 40 applied, 22 selected -> 55% (Ratio: 55/60 = 0.917 -> Compliant)
    selections = {
        "benchmark_group": {"total": 100, "selected": 60},
        "group_a": {"total": 50, "selected": 20},
        "group_b": {"total": 40, "selected": 22},
    }

    report = compute_impact_ratios(selections, benchmark_group="benchmark_group")

    assert report["benchmark_group"]["selection_rate"] == 0.6
    assert report["group_a"]["selection_rate"] == 0.4
    assert report["group_a"]["adverse_impact"] is True
    assert report["group_a"]["impact_ratio"] == pytest.approx(0.667, abs=0.01)

    assert report["group_b"]["adverse_impact"] is False
    assert report["group_b"]["impact_ratio"] == pytest.approx(0.917, abs=0.01)

    equity_check = check_selection_rate_equity(selections, benchmark_group="benchmark_group")
    assert equity_check["has_adverse_impact"] is True
    assert "group_a" in equity_check["flagged_groups"]
    assert "group_b" not in equity_check["flagged_groups"]


@pytest.mark.asyncio
async def test_decision_log_immutability():
    """Validates that log_scoring_decision constructs full audit trail with immutable schema."""
    mock_db = MagicMock()
    mock_db.decision_log.insert_one = AsyncMock(return_value=MagicMock(inserted_id="doc_123"))

    scoring_result = {
        "quality_score": 88.5,
        "eligibility": {
            "status": "eligible",
            "checks": [
                {"name": "work_authorization", "status": "pass"},
                {"name": "minimum_years", "status": "pass"},
            ],
        },
        "eligibility_rank": 0,
    }

    record = await log_scoring_decision(
        job_id="job_456",
        candidate_id="cand_789",
        scoring_result=scoring_result,
        model_versions={"scoring_engine": "2.0.0"},
        override_info=None,
        features_hash="hash_abc123",
        db=mock_db,
    )

    assert record["job_id"] == "job_456"
    assert record["candidate_id"] == "cand_789"
    assert record["quality_score"] == 88.5
    assert record["eligibility_status"] == "eligible"
    assert len(record["checks_evaluated"]) == 2
    assert record["feature_vector_hash"] == "hash_abc123"
    assert "recorded_at_iso" in record

    mock_db.decision_log.insert_one.assert_called_once_with(record)


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
