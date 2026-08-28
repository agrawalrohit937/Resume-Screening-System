"""
Portfolio Models — Pydantic models for user portfolio documents, categorized skills, projects, and analytics
"""

from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field


# ─── Shared Sub-Models (New for Premium Template) ─────────────────────────────
class MetricModel(BaseModel):
    value: str = Field(..., description="e.g., '20+', 'Python', 'XAI'")
    label: str = Field(..., description="e.g., 'ML & Analytics Projects', 'Primary Stack'")

class ProjectHighlight(BaseModel):
    value: str = Field(..., description="e.g., '86.5%', 'XAI'")
    label: str = Field(..., description="e.g., 'Accuracy', 'SHAP · LIME'")


# ─── Categorized Skills ────────────────────────────────────────────────────────
class SkillCategoryModel(BaseModel):
    machine_learning: List[str] = Field(default_factory=list)
    data_science: List[str] = Field(default_factory=list)
    backend: List[str] = Field(default_factory=list)
    frontend: List[str] = Field(default_factory=list)
    database: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    other: List[str] = Field(default_factory=list)


# ─── Project ──────────────────────────────────────────────────────────────────
class PortfolioProject(BaseModel):
    id: Optional[str] = None
    title: str
    description: str
    technologies: List[str] = Field(default_factory=list)
    live_url: Optional[str] = None
    github_url: Optional[str] = None
    image_url: Optional[str] = None
    featured: bool = False
    
    # Fields for Case Study Mockups
    category: Optional[str] = Field(None, description="e.g., HEALTHCARE AI · XAI")
    year: Optional[str] = Field(None, description="e.g., 2026")
    highlights: List[ProjectHighlight] = Field(default_factory=list)
    notes_url: Optional[str] = Field(None, description="Link to Medium article or research notes")


# ─── Experience & Education ───────────────────────────────────────────────────
class PortfolioExperience(BaseModel):
    company: str
    role: str
    start_date: Optional[str] = None
    end_date: Optional[str] = "Present"
    location: Optional[str] = None
    description: Optional[str] = None


class PortfolioEducation(BaseModel):
    institution: str
    degree: str
    field_of_study: Optional[str] = None
    graduation_year: Optional[str] = None
    grade: Optional[str] = None


# ─── User Profile Document ────────────────────────────────────────────────────
class PortfolioProfileModel(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    user_id: str = Field(..., description="ID of the user who owns this portfolio")
    username: str = Field(..., description="Unique slug for public portfolio URL (e.g. /portfolio/username)")
    full_name: str
    headline: Optional[str] = "Software Developer"
    bio: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    location: Optional[str] = None
    avatar_url: Optional[str] = None
    resume_file_url: Optional[str] = None
    
    # New fields for Premium Hero Section
    hero_badge: Optional[str] = Field("Open to Opportunities", description="Top badge text, e.g., 'Open to Internships'")
    typing_roles: List[str] = Field(default_factory=list, description="Roles for the JS typing effect")
    hero_metrics: List[MetricModel] = Field(default_factory=list, description="Stats shown below hero desc")
    
    social_links: Dict[str, str] = Field(default_factory=lambda: {
        "github": "", "linkedin": "", "twitter": "", "website": "", "medium": ""
    })
    skills: Dict[str, List[str]] = Field(default_factory=dict, description="Dynamic domain-agnostic skills categorized by 3-5 custom buckets")
    projects: List[PortfolioProject] = Field(default_factory=list)
    experience: List[PortfolioExperience] = Field(default_factory=list)
    education: List[PortfolioEducation] = Field(default_factory=list)
    theme_id: Optional[str] = Field("glassmorphic_pro", description="Selected UI theme ID")
    is_published: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


# ─── Analytics Document ───────────────────────────────────────────────────────
class PortfolioAnalyticsModel(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    username: str = Field(..., description="Unique portfolio username slug")
    total_views: int = 0
    resume_downloads: int = 0
    contact_clicks: int = 0
    messages_received: int = 0
    last_visited: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


# ─── Contact Form Message ─────────────────────────────────────────────────────
class ContactMessageSchema(BaseModel):
    sender_name: str = Field(..., min_length=2, max_length=100)
    sender_email: EmailStr
    subject: str = Field(..., min_length=2, max_length=150)
    message: str = Field(..., min_length=5, max_length=2000)