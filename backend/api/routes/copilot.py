"""
CareerShala AI Copilot API Router
================================
Provides endpoints for conversational assistance:
- Deprecated v1 shim: POST /api/v1/copilot/chat
- Copilot v2 Typed Streaming: POST /api/v1/copilot/v2/chat
- Sessions CRUD & cursor-based pagination
- Session transcript messages
- Feedback submission (thumbs up/down)
- Regenerate last turn
- LocalStorage migration
- Durable memory (learned user facts)
"""

import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from api.deps import (
    get_current_active_user,
    get_db,
    get_resume_repo,
    get_result_repo,
    get_copilot_repo,
)
from models.user_model import UserModel
from models.copilot_model import (
    CopilotSessionModel,
    CopilotMessageModel,
    CopilotMemoryModel,
    CreateSessionPayload,
    UpdateSessionPayload,
    MessageFeedbackPayload,
    CopilotV2ChatPayload,
    MigrateLocalPayload,
)
from repositories.resume_repo import ResumeRepository
from repositories.result_repo import ResultRepository
from repositories.copilot_repo import CopilotRepository
from services.copilot_service import CopilotService

router = APIRouter()
_copilot_svc = CopilotService()


# ─── Deprecated v1 Payloads & Endpoints ────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'bot'")
    text: str = Field(..., description="Content of the message")


class CopilotChatPayload(BaseModel):
    message: str = Field(..., description="Current user query")
    history: List[dict] = Field(default_factory=list, description="Recent conversation history")
    quick_action: Optional[str] = Field(default=None, description="Optional quick action key")
    force_refresh: bool = Field(default=False, description="Bypass cache and load fresh MongoDB data")


@router.post("/chat", deprecated=True)
async def chat_copilot(
    request: Request,
    payload: CopilotChatPayload,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_active_user),
    db=Depends(get_db),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    result_repo: ResultRepository = Depends(get_result_repo),
    copilot_repo: CopilotRepository = Depends(get_copilot_repo),
):
    """
    [DEPRECATED] v1 streaming conversation endpoint.
    Maintained for backward compatibility. Powered entirely by CopilotRouter under the hood.
    """
    tenant_id = getattr(current_user, "tenant_id", "default")
    user_id = str(current_user.id)

    stream_gen = _copilot_svc.chat_copilot_v2_stream(
        request=request,
        tenant_id=tenant_id,
        user_id=user_id,
        user_name=current_user.full_name,
        session_id=None,
        message=payload.message,
        history=payload.history,
        quick_action=payload.quick_action,
        force_refresh=payload.force_refresh,
        copilot_repo=copilot_repo,
        db=db,
        resume_repo=resume_repo,
        result_repo=result_repo,
        background_tasks=background_tasks,
    )

    async def v1_adapter():
        try:
            async for sse_chunk in stream_gen:
                for line in sse_chunk.splitlines():
                    if line.startswith("data: "):
                        try:
                            ev = json.loads(line[6:])
                            ev_type = ev.get("type")
                            if ev_type == "navigate":
                                to_route = ev.get("to")
                                nav_payload = {"navigate": to_route, "response": f"Navigating to {to_route}!"}
                                yield f"data: {json.dumps(nav_payload)}\n\n"
                            elif ev_type == "token":
                                yield f"data: {json.dumps({'text': ev.get('delta')})}\n\n"
                        except Exception:
                            pass
        except Exception as e:
            err_payload = {"text": f"\n[Error: {str(e)}]"}
            yield f"data: {json.dumps(err_payload)}\n\n"

    return StreamingResponse(
        v1_adapter(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


from slowapi import Limiter
from slowapi.util import get_remote_address

def get_copilot_rate_key(request: Request) -> str:
    """Key function: identifies user by ID if authenticated, else auth token or remote IP."""
    user = getattr(request.state, "user", None)
    if user and hasattr(user, "id"):
        return f"copilot_user:{str(user.id)}"
    auth = request.headers.get("Authorization")
    if auth:
        return f"copilot_token:{auth[:32]}"
    return f"copilot_ip:{get_remote_address(request)}"

def get_copilot_rate_limit(request: Optional[Request] = None) -> str:
    """
    Tiered Rate Limiter:
    - 200 requests/hour for Pro / Enterprise users
    - 30 requests/hour for Free users
    """
    if request:
        user = getattr(request.state, "user", None)
        tier = getattr(user, "tier", "free") if user else "free"
        role = getattr(user, "role", "candidate") if user else "candidate"
        if str(tier).lower() in ("pro", "enterprise", "premium") or str(role).lower() in ("recruiter", "admin"):
            return "200/hour"
    return "30/hour"

limiter = Limiter(key_func=get_copilot_rate_key)


# ─── Copilot v2 Typed Streaming Protocol ──────────────────────────────────────

@router.post("/v2/chat")
@limiter.limit(get_copilot_rate_limit)
async def chat_copilot_v2(
    request: Request,
    payload: CopilotV2ChatPayload,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_active_user),
    db=Depends(get_db),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    result_repo: ResultRepository = Depends(get_result_repo),
    copilot_repo: CopilotRepository = Depends(get_copilot_repo),
):
    """
    Production Copilot v2 Typed SSE Stream with SlowAPI Rate Limiting:
    Emits typed events (session, status, token, suggestions, usage, navigate, done),
    handles real client cancellation, keep-alive pings, and persists session history
    asynchronously using FastAPI BackgroundTasks.
    """
    request.state.user = current_user
    tenant_id = getattr(current_user, "tenant_id", "default")
    user_id = str(current_user.id)

    stream_gen = _copilot_svc.chat_copilot_v2_stream(
        request=request,
        tenant_id=tenant_id,
        user_id=user_id,
        user_name=current_user.full_name,
        session_id=payload.session_id,
        message=payload.message,
        history=payload.history,
        quick_action=payload.quick_action,
        force_refresh=payload.force_refresh,
        copilot_repo=copilot_repo,
        db=db,
        resume_repo=resume_repo,
        result_repo=result_repo,
        background_tasks=background_tasks,
    )

    return StreamingResponse(
        stream_gen,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
        background=background_tasks,
    )


# ─── Sessions Management ───────────────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(
    cursor: Optional[str] = Query(None, description="Cursor for pagination (session _id)"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    include_archived: bool = Query(False, description="Include archived threads"),
    current_user: UserModel = Depends(get_current_active_user),
    copilot_repo: CopilotRepository = Depends(get_copilot_repo),
):
    """
    List conversation threads for current user and tenant, with cursor-based pagination.
    Pinned threads appear first, followed by most recently active.
    """
    tenant_id = getattr(current_user, "tenant_id", None) or "default"
    user_id = str(current_user.id)

    return await copilot_repo.list_sessions(
        tenant_id=tenant_id,
        user_id=user_id,
        cursor=cursor,
        limit=limit,
        include_archived=include_archived,
    )


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: CreateSessionPayload,
    current_user: UserModel = Depends(get_current_active_user),
    copilot_repo: CopilotRepository = Depends(get_copilot_repo),
):
    """
    Explicitly create a new conversation session.
    """
    tenant_id = getattr(current_user, "tenant_id", None) or "default"
    user_id = str(current_user.id)

    session = await copilot_repo.create_session(
        tenant_id=tenant_id,
        user_id=user_id,
        title=payload.title,
    )
    return session


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    current_user: UserModel = Depends(get_current_active_user),
    copilot_repo: CopilotRepository = Depends(get_copilot_repo),
):
    """
    Get session metadata by ID (tenant and user scoped).
    """
    tenant_id = getattr(current_user, "tenant_id", None) or "default"
    user_id = str(current_user.id)

    session = await copilot_repo.get_session(tenant_id, user_id, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.patch("/sessions/{session_id}")
async def update_session(
    session_id: str,
    payload: UpdateSessionPayload,
    current_user: UserModel = Depends(get_current_active_user),
    copilot_repo: CopilotRepository = Depends(get_copilot_repo),
):
    """
    Update session details (rename title, pin/unpin, archive/unarchive).
    """
    tenant_id = getattr(current_user, "tenant_id", None) or "default"
    user_id = str(current_user.id)

    updated = await copilot_repo.update_session(
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
        title=payload.title,
        pinned=payload.pinned,
        archived=payload.archived,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Session not found")
    return updated


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: UserModel = Depends(get_current_active_user),
    copilot_repo: CopilotRepository = Depends(get_copilot_repo),
):
    """
    Soft-delete a session thread.
    """
    tenant_id = getattr(current_user, "tenant_id", None) or "default"
    user_id = str(current_user.id)

    ok = await copilot_repo.soft_delete_session(tenant_id, user_id, session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Session not found or already deleted")
    return {"ok": True, "message": "Session deleted"}


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    limit: int = Query(50, ge=1, le=200),
    before_id: Optional[str] = Query(None, description="Cursor for older messages"),
    current_user: UserModel = Depends(get_current_active_user),
    copilot_repo: CopilotRepository = Depends(get_copilot_repo),
):
    """
    Retrieve full transcript of a conversation thread.
    """
    tenant_id = getattr(current_user, "tenant_id", None) or "default"
    user_id = str(current_user.id)

    # Verify session existence and ownership
    session = await copilot_repo.get_session(tenant_id, user_id, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = await copilot_repo.list_messages(
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
        limit=limit,
        before_id=before_id,
    )
    return {"session_id": session_id, "messages": messages}


@router.post("/sessions/{session_id}/regenerate")
async def regenerate_last_turn(
    session_id: str,
    request: Request,
    current_user: UserModel = Depends(get_current_active_user),
    db=Depends(get_db),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    result_repo: ResultRepository = Depends(get_result_repo),
    copilot_repo: CopilotRepository = Depends(get_copilot_repo),
):
    """
    Re-run the last assistant turn in a session.
    """
    tenant_id = getattr(current_user, "tenant_id", None) or "default"
    user_id = str(current_user.id)

    last_user_msg = await copilot_repo.get_last_user_message(tenant_id, user_id, session_id)
    if not last_user_msg:
        raise HTTPException(status_code=400, detail="No user message found to regenerate in this session")

    stream_gen = _copilot_svc.chat_copilot_v2_stream(
        request=request,
        tenant_id=tenant_id,
        user_id=user_id,
        user_name=current_user.full_name,
        session_id=session_id,
        message=last_user_msg.content,
        history=[],
        quick_action=None,
        force_refresh=True,
        copilot_repo=copilot_repo,
        db=db,
        resume_repo=resume_repo,
        result_repo=result_repo,
    )

    return StreamingResponse(
        stream_gen,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ─── Feedback ─────────────────────────────────────────────────────────────────

@router.post("/messages/{message_id}/feedback")
async def record_feedback(
    message_id: str,
    payload: MessageFeedbackPayload,
    current_user: UserModel = Depends(get_current_active_user),
    copilot_repo: CopilotRepository = Depends(get_copilot_repo),
):
    """
    Submit thumbs up or thumbs down feedback on an assistant message.
    """
    tenant_id = getattr(current_user, "tenant_id", None) or "default"
    user_id = str(current_user.id)

    ok = await copilot_repo.update_message_feedback(
        tenant_id=tenant_id,
        user_id=user_id,
        message_id=message_id,
        feedback=payload.feedback,
        note=payload.note,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Message not found or not owned by user")
    return {"ok": True, "feedback": payload.feedback}


# ─── Migration ────────────────────────────────────────────────────────────────

@router.post("/migrate-local")
async def migrate_local_history(
    payload: MigrateLocalPayload,
    current_user: UserModel = Depends(get_current_active_user),
    copilot_repo: CopilotRepository = Depends(get_copilot_repo),
):
    """
    One-shot migration of client-side localStorage history into a server-side session.
    """
    tenant_id = getattr(current_user, "tenant_id", None) or "default"
    user_id = str(current_user.id)

    session_id = await copilot_repo.migrate_local_history(
        tenant_id=tenant_id,
        user_id=user_id,
        messages=payload.messages,
    )
    if not session_id:
        return {"ok": True, "migrated": False, "session_id": None}

    return {"ok": True, "migrated": True, "session_id": session_id}


# ─── Durable Memory (Trust & Transparency) ────────────────────────────────────

@router.get("/memory")
async def get_copilot_memory(
    current_user: UserModel = Depends(get_current_active_user),
    copilot_repo: CopilotRepository = Depends(get_copilot_repo),
):
    """
    View all durable facts and preferences the Copilot has learned about the candidate.
    """
    tenant_id = getattr(current_user, "tenant_id", "default")
    user_id = str(current_user.id)

    facts = await copilot_repo.get_user_memory(tenant_id, user_id)
    return {"memory": facts, "count": len(facts), "max_items": 40}


@router.delete("/memory/{key}")
async def delete_copilot_memory(
    key: str,
    current_user: UserModel = Depends(get_current_active_user),
    copilot_repo: CopilotRepository = Depends(get_copilot_repo),
):
    """
    Allow candidate to delete a learned fact (trust & privacy feature).
    """
    tenant_id = getattr(current_user, "tenant_id", "default")
    user_id = str(current_user.id)

    deleted = await copilot_repo.delete_user_memory(tenant_id, user_id, key)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory key not found")
    return {"ok": True, "deleted_key": key}
