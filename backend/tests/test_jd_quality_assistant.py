"""
Tests for JD Parsing Symmetry and Recruiter Quality Assistant.
Verifies exclusionary term detection, impossible tech requirement detection,
structured requirements extraction, and occupation mapping.
"""

import pytest
from services.jd_parser_service import (
    audit_job_description,
    parse_structured_job_requirements,
    map_job_title_to_occupation,
)


def test_structured_jd_requirements_extraction():
    sample_jd = """
    Job Overview:
    We are seeking a Backend Engineer.

    Must Have:
    - 5+ years of experience in Python and FastAPI
    - Strong knowledge of Docker and Kubernetes
    - Mandatory bachelor's degree in computer science

    Nice to Have:
    - Experience with GraphQL
    - Familiarity with AWS
    """

    reqs = parse_structured_job_requirements(sample_jd, title="Backend Engineer")
    assert len(reqs) >= 4

    must_haves = [r for r in reqs if r.is_must_have]
    assert len(must_haves) >= 2

    # Check years extraction
    py_req = next((r for r in reqs if "python" in r.text.lower()), None)
    assert py_req is not None
    assert py_req.years == 5.0
    assert py_req.is_must_have is True

    # Check nice to have
    gql_req = next((r for r in reqs if "graphql" in r.text.lower()), None)
    assert gql_req is not None
    assert gql_req.is_must_have is False
    assert gql_req.criticality == "preferred"


def test_exclusionary_terms_audit():
    biased_jd = """
    We need a rockstar developer with aggressive drive and high stamina.
    Candidate must be a digital native and a native English speaker.
    Work hard play hard environment!
    """

    report = audit_job_description(biased_jd, title="Software Developer")

    assert report.inclusive_language_score < 60.0
    assert report.overall_score < 75.0

    issue_terms = [i.term for i in report.issues]
    assert "rockstar" in issue_terms
    assert "aggressive" in issue_terms
    assert "digital native" in issue_terms
    assert "native english speaker" in issue_terms
    assert len(report.suggestions) > 0


def test_unrealistic_tech_years_audit():
    impossible_jd = """
    Senior Python Developer
    Requirements:
    - 10+ years of experience with FastAPI
    - 15+ years of experience with Kubernetes
    Salary: 25 LPA
    """

    report = audit_job_description(impossible_jd, title="Senior Python Developer")

    assert report.realism_score < 70.0
    impossible_issues = [i for i in report.issues if i.category == "unrealistic_requirement"]
    assert len(impossible_issues) >= 2
    assert any("fastapi" in i.message.lower() for i in impossible_issues)
    assert any("kubernetes" in i.message.lower() for i in impossible_issues)


def test_missing_compensation_audit():
    no_comp_jd = """
    Software Engineer at TechCorp.
    Must have 3 years of React and Node.js.
    """
    report = audit_job_description(no_comp_jd, title="Software Engineer")
    assert report.compensation_score == 50.0
    assert any(i.category == "missing_compensation" for i in report.issues)


def test_occupation_title_mapping():
    code_se = map_job_title_to_occupation("Software Engineer")
    assert code_se is not None
    assert "2512" in code_se or "15-1252" in code_se or "251" in code_se

    code_rn = map_job_title_to_occupation("Registered Nurse")
    assert code_rn is not None
    assert "2221" in code_rn or "29-1141" in code_rn
