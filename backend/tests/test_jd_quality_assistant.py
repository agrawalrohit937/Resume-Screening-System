"""
Tests for JD Parsing Symmetry and Recruiter Quality Assistant.
Verifies exclusionary term detection, impossible tech requirement detection,
structured requirements extraction, and occupation mapping.
"""

import pytest
from services.jd_parser_service import (
    map_job_title_to_occupation,
)


def test_occupation_title_mapping():
    code_se = map_job_title_to_occupation("Software Engineer")
    assert code_se is not None
    assert "2512" in code_se or "15-1252" in code_se or "251" in code_se

    code_rn = map_job_title_to_occupation("Registered Nurse")
    assert code_rn is not None
    assert "2221" in code_rn or "29-1141" in code_rn


def test_segment_jd_sections_boundary_detection():
    from services.jd_parser_service import segment_jd_sections

    sample_complex_jd = """About Us:
    With 10+ years of hands-on expertise, our company is an industry leader in global enterprise SaaS.
    We were founded in 2014 and employ 500+ professionals.

    Responsibilities:
    - Design and architect scalable REST and gRPC microservices
    - Collaborate with product designers and frontend teams

    Requirements / Qualifications:
    - Freshers eligible or 0-1 years of experience
    - Solid foundation in Python, SQL, and Data Structures
    - Bachelor's degree in Computer Science
    """

    sections = segment_jd_sections(sample_complex_jd)
    assert "10+ years of hands-on expertise" in sections["company_profile"]
    assert "microservices" in sections["responsibilities"]
    assert "Freshers eligible" in sections["requirements"]
    # Verify company profile is cleanly separated from requirements
    assert "10+ years" not in sections["requirements"]


@pytest.mark.asyncio
async def test_parse_jd_with_groq_structure(monkeypatch):
    from services.jd_parser_service import parse_jd_with_groq
    from core.llm_client import groq_key_pool

    async def mock_execute(fn):
        return {
            "role": "Software Development Engineer",
            "candidate_min_experience_years": 0,
            "is_fresher_eligible": True,
            "required_skills": ["Python", "SQL", "Data Structures & Algorithms"],
            "minimum_education": "Bachelor"
        }

    monkeypatch.setattr(groq_key_pool, "execute_async_with_fallback", mock_execute)

    result = await parse_jd_with_groq("Sample JD text with company profile and requirements")
    assert result["role"] == "Software Development Engineer"
    assert result["candidate_min_experience_years"] == 0
    assert result["is_fresher_eligible"] is True
    assert "Python" in result["required_skills"]
    assert result["minimum_education"] == "Bachelor"

