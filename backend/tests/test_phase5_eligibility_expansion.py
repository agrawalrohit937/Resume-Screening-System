"""
Phase 5 Verification Tests: Structured Optional Recruiter Eligibility & Knockout Checks.
"""

from unittest.mock import MagicMock
import numpy as np
import pytest

from services.scoring_engine import score_resume
import services.embedding_service as emb_svc


@pytest.fixture(autouse=True)
def mock_embeddings(monkeypatch):
    """Mock local embedding calls."""
    mock_model = MagicMock()
    def fake_encode(sentences, *args, **kwargs):
        if isinstance(sentences, str):
            return np.ones(1024, dtype=np.float32)
        return np.ones((len(sentences), 1024), dtype=np.float32)
    mock_model.encode.side_effect = fake_encode
    monkeypatch.setattr("services.embedding_service.embedding_model", mock_model)
    monkeypatch.setattr("services.scoring_engine.embedding_model", mock_model)


def test_location_and_remote_policy_eligibility():
    resume = {
        "raw_text": "Software Engineer based in Bengaluru. Python developer.",
        "skills": ["Python"],
        "location": "Bengaluru, India",
    }

    # 1. Matching location -> passed
    jd_onsite_match = {
        "text": "Software Engineer role in Bengaluru.",
        "location": "Bengaluru",
        "remote_policy": "onsite",
    }
    res = score_resume(resume, jd_onsite_match, mode="recruiter")
    loc_check = next((c for c in res["eligibility"]["checks"] if c["rule_id"] == "location_policy"), None)
    assert loc_check is not None
    assert loc_check["passed"] is True

    # 2. Remote policy accommodates candidate anywhere -> passed
    jd_remote = {
        "text": "Remote Python Engineer.",
        "location": "San Francisco",
        "remote_policy": "remote",
    }
    res_remote = score_resume(resume, jd_remote, mode="recruiter")
    loc_check_rem = next((c for c in res_remote["eligibility"]["checks"] if c["rule_id"] == "location_policy"), None)
    assert loc_check_rem is not None
    assert loc_check_rem["passed"] is True

    # 3. Missing candidate location -> unverified (never auto-fails)
    resume_no_loc = {
        "raw_text": "Software Engineer. Python developer.",
        "skills": ["Python"],
    }
    res_no_loc = score_resume(resume_no_loc, jd_onsite_match, mode="recruiter")
    loc_check_unv = next((c for c in res_no_loc["eligibility"]["checks"] if c["rule_id"] == "location_policy"), None)
    assert loc_check_unv is not None
    assert loc_check_unv["passed"] == "unverified"
    assert res_no_loc["eligibility"]["status"] == "unverified"


def test_notice_period_and_salary_checks():
    resume = {
        "raw_text": "Experienced Python Engineer.",
        "skills": ["Python"],
        "notice_period_days": 15,
        "expected_salary": 1800000,
    }
    jd = {
        "text": "Python Engineer.",
        "max_notice_days": 30,
        "max_salary": 2500000,
    }
    res = score_resume(resume, jd, mode="recruiter")
    notice_check = next((c for c in res["eligibility"]["checks"] if c["rule_id"] == "notice_period"), None)
    salary_check = next((c for c in res["eligibility"]["checks"] if c["rule_id"] == "salary_expectation"), None)

    assert notice_check is not None
    assert notice_check["passed"] is True
    assert salary_check is not None
    assert salary_check["passed"] is True


def test_work_auth_and_languages_checks():
    # 1. Candidate with verified work auth & languages
    resume = {
        "raw_text": "Python engineer fluent in English and German.",
        "skills": ["Python"],
        "work_authorization": "Citizen",
        "languages": ["English", "German"],
    }
    jd = {
        "text": "Python Engineer.",
        "require_work_auth": True,
        "work_authorization": "US Citizen / Permanent Resident",
        "required_languages": ["English", "German"],
    }
    res = score_resume(resume, jd, mode="recruiter")
    auth_check = next((c for c in res["eligibility"]["checks"] if c["rule_id"] == "work_authorization"), None)
    lang_check = next((c for c in res["eligibility"]["checks"] if c["rule_id"] == "language_requirements"), None)

    assert auth_check is not None
    assert auth_check["passed"] is True
    assert lang_check is not None
    assert lang_check["passed"] is True

    # 2. Candidate missing work auth -> unverified (never auto-rejected)
    resume_missing = {
        "raw_text": "Python engineer.",
        "skills": ["Python"],
    }
    res_missing = score_resume(resume_missing, jd, mode="recruiter")
    auth_check_m = next((c for c in res_missing["eligibility"]["checks"] if c["rule_id"] == "work_authorization"), None)
    assert auth_check_m is not None
    assert auth_check_m["passed"] == "unverified"
    assert res_missing["eligibility"]["status"] == "unverified"
