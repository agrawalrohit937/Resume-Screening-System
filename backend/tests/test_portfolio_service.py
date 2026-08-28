import pytest
from services.portfolio_service import (
    sanitize_portfolio_skills,
    categorize_skills,
)
from models.portfolio_model import PortfolioProfileModel, PortfolioProject, MetricModel
from models.user_model import UserModel

def test_sanitize_portfolio_skills_no_other():
    """Verify that 'other', 'others', etc. are completely eradicated and mapped to domains."""
    raw = {
        "Machine Learning": ["PyTorch", "TensorFlow", "Scikit-Learn"],
        "other": ["FastAPI", "Docker", "PostgreSQL"],
        "frontend": ["React", "TailwindCSS"]
    }
    cleaned = sanitize_portfolio_skills(raw)
    assert "other" not in cleaned
    assert "others" not in cleaned
    assert "miscellaneous" not in cleaned
    # Check that orphans from 'other' were redistributed
    all_skills = [s for lst in cleaned.values() for s in lst]
    assert "FastAPI" in all_skills
    assert "Docker" in all_skills
    assert "PostgreSQL" in all_skills

def test_portfolio_profile_model_creation():
    """Verify PortfolioProfileModel validation with slug and projects."""
    profile = PortfolioProfileModel(
        user_id="user_123",
        username="rohit-agrawal",
        full_name="Rohit Agrawal",
        email="rohit@example.com",
        headline="AI & Full-Stack Architect",
        skills={"Generative AI & LLMs": ["LangChain", "LlamaIndex", "GPT-4"]},
        projects=[
            PortfolioProject(
                title="AI Copilot",
                description="Intelligent career platform",
                technologies=["FastAPI", "React", "MongoDB"],
                category="AI / ML",
                year="2026"
            )
        ],
        hero_metrics=[
            MetricModel(value="15+", label="Production Systems")
        ]
    )
    assert profile.username == "rohit-agrawal"
    assert profile.projects[0].title == "AI Copilot"
    assert profile.hero_metrics[0].value == "15+"

def test_user_model_has_portfolio_fields():
    """Verify UserModel stores portfolio_slug and portfolio_url."""
    user = UserModel(
        email="rohit@example.com",
        full_name="Rohit Agrawal",
        portfolio_slug="rohit-agrawal",
        portfolio_url="/portfolio/rohit-agrawal",
        is_portfolio_published=True
    )
    assert user.portfolio_slug == "rohit-agrawal"
    assert user.portfolio_url == "/portfolio/rohit-agrawal"
    assert user.is_portfolio_published is True
