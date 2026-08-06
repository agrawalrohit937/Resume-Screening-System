"""
Interview Routes — Mock interview generation
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from api.deps import get_current_user, get_resume_repo, get_interview_service
from models.resume_model import ResumeStatus
from models.user_model import UserModel
from repositories.resume_repo import ResumeRepository
from schemas.resume_schema import InterviewRequest, InterviewResponse
from services.ai_interview_service import AIInterviewService 
from utils.validators import validate_object_id

router = APIRouter()

# ─── SCHEMAS (Can be moved to schemas/resume_schema.py) ───────────────

class QuickPracticeRequest(BaseModel):
    topic: str
    difficulty: str = "medium"
    num_questions: int = 5


# ─── ROUTES ───────────────────────────────────────────────────────────

@router.post("/generate", response_model=InterviewResponse)
async def generate_interview(
    payload: InterviewRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    interview_service: AIInterviewService = Depends(get_interview_service),
):

    """
    Generate a personalized mock interview:
    - Technical questions based on skills
    - Behavioral questions (STAR format)
    - Situational problem-solving scenarios
    - Preparation tips
    """
    validate_object_id(payload.resume_id, "resume_id")
    resume = await resume_repo.get_by_id_and_user(payload.resume_id, str(current_user.id))
    
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
        
    if resume.status != ResumeStatus.PARSED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Resume must be parsed before generating an interview.",
        )
        
    try:
        return await interview_service.generate_interview(
            resume=resume,
            job_description=payload.job_description,
            job_title=payload.job_title,
            difficulty=payload.difficulty,
            interview_type=payload.interview_type,
            num_questions=payload.num_questions,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate interview: {str(e)}",
        )


@router.post("/quick-practice")
async def generate_quick_practice(
    payload: QuickPracticeRequest,
    current_user: UserModel = Depends(get_current_user),
    interview_service: AIInterviewService = Depends(get_interview_service),
):

    """
    Generate instant AI-powered Multiple Choice Questions (MCQs)
    for quick concept practice. No resume required.
    """
    if not payload.topic or not payload.topic.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Topic cannot be empty."
        )
        
    try:
        # Calls the new method we added to AIInterviewService
        result = await interview_service.generate_quick_practice_mcqs(
            topic=payload.topic,
            difficulty=payload.difficulty,
            num_questions=payload.num_questions
        )
        return result
    except Exception as e:
        # Log the actual error in production, return generic 500
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to generate practice questions: {str(e)}"
        )