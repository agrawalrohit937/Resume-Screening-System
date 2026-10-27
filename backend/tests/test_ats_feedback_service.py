import pytest
from services.ats_feedback_service import generate_ats_feedback_with_groq

@pytest.mark.asyncio
async def test_generate_ats_feedback_with_groq():
    scored_mock = {
        "final_score": 65.0,
        "quality_score": 65.0,
        "missing_skills": ["Docker", "Kubernetes", "Redis"],
        "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
        "experience_score": 50.0,
        "education_score": 90.0,
        "education_status": "in_progress",
        "is_in_progress": True,
        "feedback_suggestions": [
            "Missing mandatory skills for this role: Docker, Kubernetes, Redis.",
            "Degree in Progress: Highlight anticipated graduation timeline, relevant technical coursework, and capstone projects.",
        ]
    }

    suggestions = await generate_ats_feedback_with_groq(
        scored_result=scored_mock,
        job_title="Backend Software Engineer",
        job_description="Looking for Backend Engineer with Python, FastAPI, Docker, Kubernetes.",
        resume_data={"skills": ["Python", "FastAPI", "PostgreSQL"], "raw_text": "Backend developer with 2 years of Python experience."},
    )

    assert isinstance(suggestions, list)
    assert len(suggestions) >= 2
    # Verify suggestions contain actionable content
    joined = " ".join(suggestions)
    print("Generated suggestions:", suggestions)
    assert any(term in joined.lower() for term in ["docker", "kubernetes", "skill", "project", "degree", "experience"])
