from pydantic import BaseModel, Field
from typing import List

class JDEvaluation(BaseModel):
    """Schema to force Groq to return strict JD matching evaluation."""
    matched_skills: List[str] = Field(
        default_factory=list, 
        description="List of skills required by the JD that are explicitly or contextually present in the resume."
    )
    missing_skills: List[str] = Field(
        default_factory=list, 
        description="Crucial skills required by the JD that are completely missing from the resume."
    )
    experience_score: float = Field(
        ..., 
        description="A score between 0.0 and 1.0 evaluating how well the candidate's years of experience and roles align with the JD requirements. (e.g., 1.0 for perfect match, 0.5 for partial)."
    )
    education_score: float = Field(
        ..., 
        description="A score between 0.0 and 1.0 evaluating how well the candidate's education (degrees/fields) matches the JD requirements."
    )