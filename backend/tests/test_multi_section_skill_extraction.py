"""
Unit Tests for Multi-Section Resume Skill Extraction and ATS Matching Pipeline.
Verifies that skills listed in 'Relevant Coursework', 'Projects', 'Work Experience',
and 'Education' sections are properly parsed and credited even if missing from explicit 'skills'.
"""

import pytest
from services.nlp_extractor import extract_skills_from_sections, extract_skills_deterministic
from services.scoring_engine import score_resume


def test_extract_skills_from_relevant_coursework():
    resume_data = {
        "skills": [],
        "relevant_coursework": [
            "Data Structures & Algorithms (DSA)",
            "Database Management Systems (DBMS)",
            "Operating Systems",
            "Computer Networks",
        ],
        "projects": [],
        "work_experience": [],
    }
    extracted = extract_skills_from_sections(resume_data)
    assert any("Data Structures & Algorithms" in s or "DSA" in s for s in extracted)
    assert any("DBMS" in s for s in extracted)
    assert any("Operating Systems" in s for s in extracted)
    assert any("Computer Networks" in s for s in extracted)


def test_extract_skills_from_projects_and_experience():
    resume_data = {
        "skills": ["HTML", "CSS"],
        "projects": [
            {
                "title": "E-Commerce Microservices",
                "description": "Engineered high throughput services using FastAPI and Docker containers.",
                "technologies": ["FastAPI", "Docker", "Redis"],
            }
        ],
        "work_experience": [
            {
                "title": "Backend Intern",
                "company": "Tech Corp",
                "description": "Implemented distributed caching with Redis and PostgreSQL database optimizations.",
                "technologies": ["PostgreSQL", "Redis"],
            }
        ],
    }
    extracted = extract_skills_from_sections(resume_data)
    assert "FastAPI" in extracted
    assert "Docker" in extracted
    assert "Redis" in extracted
    assert "PostgreSQL" in extracted


def test_scoring_engine_multi_section_skill_matching():
    """
    Test that ATS scoring correctly matches DSA, DBMS, and FastAPI even when
    the candidate's explicit 'skills' list only has ['Python'], but DSA & DBMS
    are in coursework and FastAPI is in projects.
    """
    resume_dict = {
        "name": "Alex Candidate",
        "skills": ["Python"],
        "relevant_coursework": [
            "Data Structures and Algorithms",
            "Database Management Systems (DBMS)",
        ],
        "projects": [
            {
                "title": "API Gateway",
                "description": "Built asynchronous endpoints using FastAPI and PostgreSQL",
                "tech_stack": ["FastAPI", "PostgreSQL"],
            }
        ],
        "work_experience": [],
        "education": [
            {
                "degree": "B.Tech in Computer Science",
                "institution": "State University",
                "graduation_year": 2024,
            }
        ],
        "total_experience_years": 0.5,
    }

    jd_text = """
    Job Title: Junior Backend Engineer
    Required Skills: Python, FastAPI, DSA, DBMS, PostgreSQL
    Minimum Experience: 0-1 years (Freshers welcome)
    """

    score_result = score_resume(resume_dict, jd_text, mode="candidate")

    # Verify score output structure
    assert score_result is not None
    matched_skills = score_result.get("matched_skills", [])
    
    # Check that skills from coursework (DSA, DBMS) and projects (FastAPI, PostgreSQL) are matched
    matched_lower = [str(s).lower() for s in matched_skills]
    assert any("python" in m for m in matched_lower)
    assert any("fastapi" in m for m in matched_lower)
    assert any("dsa" in m or "data structures" in m for m in matched_lower)
    assert any("dbms" in m or "database" in m for m in matched_lower)
    assert any("postgres" in m for m in matched_lower)
    
    # Skills score should be high since almost all required skills were fulfilled
    assert score_result["skills_score"] >= 80.0
