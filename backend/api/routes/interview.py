"""
Interview Routes — Quick MCQ Practice Generation
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from api.deps import get_current_user, get_interview_service
from models.user_model import UserModel
from services.ai_interview_service import AIInterviewService 

router = APIRouter()


# ─── SCHEMAS ───────────────────────────────────────────────────────────

class QuickPracticeRequest(BaseModel):
    topic: str
    difficulty: str = "medium"
    num_questions: int = 5


# ─── ROUTES ───────────────────────────────────────────────────────────

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
        result = await interview_service.generate_quick_practice_mcqs(
            topic=payload.topic,
            difficulty=payload.difficulty,
            num_questions=payload.num_questions
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to generate practice questions: {str(e)}"
        )