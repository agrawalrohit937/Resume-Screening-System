"""
Enhancement Schema — Pydantic model for Groq LLM structured output
"""
from pydantic import BaseModel, Field
from typing import Dict, List, Optional


class ContactInfo(BaseModel):
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    github: str = ""
    portfolio: str = ""


class ExperienceItem(BaseModel):
    company: str = ""
    role: str = Field(default="", description="Candidate job title.")
    duration: str = ""        # e.g. "Jan 2022 – Dec 2023"
    location: str = ""        # e.g. "Bangalore, India"
    highlights: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)


class ProjectItem(BaseModel):
    name: str = ""
    description: str = ""
    link: str = "#"
    technologies: List[str] = Field(default_factory=list)
    highlights: List[str] = Field(default_factory=list)


class EducationItem(BaseModel):
    degree: str = ""
    institution: str = ""
    year: str = ""            # e.g. "2019 – 2023"
    score: str = ""           # e.g. "GPA: 8.5" or "85%"


class EnhancedResumeSection(BaseModel):
    """
    Full enhanced resume — matches what the PDF renderer expects.
    Groq LLM populates ALL fields using ONLY the candidate's own resume JSON.

    IMPORTANT: `skills` is now a Dict[str, List[str]] where each key is a
    logical category (e.g. 'Languages', 'Generative AI', 'Backend', 'DevOps')
    and the value is a list of skill strings within that category.
    Skills the JD wants but the candidate doesn't have go into
    `recommended_skills`, NOT `skills`.
    """
    full_name: str = ""
    target_role: str = Field(
        default="",
        description=(
            "A truthful professional headline for under the candidate's name "
            "(e.g. 'Python Backend Developer | AI/ML Enthusiast'), built from "
            "the candidate's ACTUAL experience/projects and phrased to match "
            "the JD's title where honestly applicable. Never a title the "
            "candidate has no basis to claim."
        ),
    )
    contact: ContactInfo = Field(default_factory=ContactInfo)
    summary: str = Field(default="", description="ATS optimized professional summary based only on the candidate's real background.")
    experience: List[ExperienceItem] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    skills: Dict[str, List[str]] = Field(
        default_factory=dict,
        description=(
            "Categorised skills dictionary. Keys are logical category names "
            "(e.g. 'Languages', 'Backend', 'Generative AI', 'DevOps', 'Databases'). "
            "Values are lists of skill strings the candidate actually has evidence for. "
            "Never include a skill the candidate has no evidence of."
        ),
    )
    recommended_skills: List[str] = Field(
        default_factory=list,
        description=(
            "JD-critical skills/tools the candidate does NOT currently have "
            "evidence for. This is a growth checklist surfaced in-app to the "
            "candidate — it must never be merged into `skills` or printed on "
            "the resume itself."
        ),
    )
    certifications: List[str] = Field(default_factory=list)
    ats_match_estimate: float = Field(
        default=0.0,
        description=(
            "Honest estimated ATS keyword-match percentage against the JD, "
            "based only on the truthful, enhanced content. Not a guarantee — "
            "a best-effort estimate."
        ),
    )
    missing_critical_info: List[str] = Field(
        default_factory=list,
        description="List of missing metrics or details the user should fill in themselves.",
    )