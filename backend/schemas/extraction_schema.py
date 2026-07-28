"""
Structured LLM Output Schemas — Resume Extraction Layer.

ARCHITECTURE NOTE [DUP-002]:
- `ResumeExtraction` is the Pydantic schema passed to LangGraph / Groq `with_structured_output()`.
- For MongoDB persistence and stored resume records, see `models/resume_model.py` (`ResumeModel` / `ParsedResumeData`).
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Union


class ContactInfo(BaseModel):
    email: Optional[str] = Field(None, description="Email address of the candidate")
    phone: Optional[str] = Field(None, description="Contact phone number")
    linkedin: Optional[str] = Field(None, description="LinkedIn profile URL")
    github: Optional[str] = Field(None, description="GitHub profile URL")
    portfolio: Optional[str] = Field(None, description="Personal website or portfolio URL")

class Education(BaseModel):
    degree: str = Field(..., description="Full name of the degree (e.g., B.Tech in Computer Science, M.Sc.)")
    institution: str = Field(..., description="Name of the university or college")
    year: Optional[str] = Field(None, description="Passing year or duration (e.g., 2024 or 2020-2024)")
    score: Optional[str] = Field(None, description="GPA, CGPA, or percentage if mentioned")

class Experience(BaseModel):
    role: str = Field(..., description="Job title or position held (e.g., Backend Developer Intern)")
    company: str = Field(..., description="Name of the company or organization")
    location: Optional[str] = Field(None, description="City, Country, or Remote")
    duration: str = Field(..., description="Time period worked (e.g., Jan 2023 - Present)")
    # IMPORTANT: Changed to List of strings for better bullet points in PDF
    highlights: List[str] = Field(default_factory=list, description="List of bullet points describing responsibilities, achievements, and impact")

class Project(BaseModel):
    name: str = Field(..., description="Name of the project")
    technologies: List[str] = Field(default_factory=list, description="List of tools and technologies used")
    link: Optional[str] = Field(None, description="URL to the live project or GitHub repository")
    # IMPORTANT: Changed to List of strings for better bullet points in PDF
    highlights: List[str] = Field(default_factory=list, description="List of bullet points detailing the project features and user's contribution")

class Achievement(BaseModel):
    title: str = Field(..., description="Name of the award, certification, publication, or honorable mention")
    issuer: Optional[str] = Field(None, description="Organization that issued the award or certification")
    year: Optional[Union[str, int]] = Field(None, description="Year it was achieved or issued")

class ResumeExtraction(BaseModel):
    """This is the main root schema that Groq LLM will return."""
    full_name: Optional[str] = Field(None, description="Full name of the candidate")
    contact: ContactInfo = Field(default_factory=ContactInfo, description="Candidate's contact information and links")
    summary: Optional[str] = Field(None, description="Professional summary or objective statement at the top of the resume")
    
    skills: List[str] = Field(default_factory=list, description="A flat list of all technical, soft, and domain skills found in the resume")
    
    education: List[Education] = Field(default_factory=list, description="List of all educational qualifications")
    experience: List[Experience] = Field(default_factory=list, description="List of all professional work experience")
    projects: List[Project] = Field(default_factory=list, description="List of academic or professional projects")
    achievements: List[Achievement] = Field(default_factory=list, description="List of all certifications, awards, test scores, or publications")
    
    total_experience_years: float = Field(0.0, description="Calculate the total years of professional experience as a float (e.g., 2.5). Do not count projects.")