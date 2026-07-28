"""
CareerShala AI Copilot API Router
================================
Exposes the streaming endpoint for conversational assistance,
supporting context aggregation, caching, and local command shortcuts.
"""

import json
from typing import List, Optional
from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from api.deps import get_current_active_user, get_db, get_resume_repo, get_result_repo
from models.user_model import UserModel
from repositories.resume_repo import ResumeRepository
from repositories.result_repo import ResultRepository
from services.copilot_service import CopilotService

router = APIRouter()
_copilot_svc = CopilotService()


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'bot'")
    text: str = Field(..., description="Content of the message")


class CopilotChatPayload(BaseModel):
    message: str = Field(..., description="Current user query")
    history: List[dict] = Field(default_factory=list, description="Recent conversation history")
    quick_action: Optional[str] = Field(default=None, description="Optional quick action key")
    force_refresh: bool = Field(default=False, description="Bypass cache and load fresh MongoDB data")


@router.post("/chat")
async def chat_copilot(
    payload: CopilotChatPayload,
    current_user: UserModel = Depends(get_current_active_user),
    db = Depends(get_db),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    result_repo: ResultRepository = Depends(get_result_repo),
):
    """
    Streaming conversation endpoint for Candidate Career assistance.
    Detects local navigation commands to bypass LLM, caches context,
    and returns token chunks via Server-Sent Events (SSE).
    """
    # 1. Check navigation shortcuts first
    nav_match = _copilot_svc.check_navigation_shortcut(payload.message)
    
    async def sse_generator():
        try:
            if nav_match:
                # Direct route shortcut - stream single event containing navigation details
                yield f"data: {json.dumps(nav_match)}\n\n"
                return

            # 2. Dynamic intent parsing
            intents = _copilot_svc.parse_intents(payload.message, payload.quick_action)
            
            # 3. Compile context dynamically based on parsed intents
            context = await _copilot_svc.compile_context(
                user_id=str(current_user.id),
                intents=intents,
                db=db,
                resume_repo=resume_repo,
                result_repo=result_repo,
                force_refresh=payload.force_refresh
            )
            
            # 4. Stream response chunks
            async for chunk in _copilot_svc.chat_copilot_stream(
                user_name=current_user.full_name,
                user_context=context,
                message=payload.message,
                history=payload.history
            ):
                chunk_data = {"text": chunk}
                yield f"data: {json.dumps(chunk_data)}\n\n"
                
        except Exception as e:
            err_data = {"text": f"\n[Backend Error: {str(e)}]"}
            yield f"data: {json.dumps(err_data)}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")
