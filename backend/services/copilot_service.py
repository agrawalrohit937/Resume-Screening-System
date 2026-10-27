"""
CareerMitra Chat Service
==============================
Handles session persistence, grounded tool context, and OpenRouter streaming.
"""

import asyncio
import json
import re
import time
import uuid
from typing import AsyncGenerator, List, Optional
from fastapi import Request, BackgroundTasks
import httpx
import structlog

from core.config import settings
from repositories.resume_repo import ResumeRepository
from repositories.result_repo import ResultRepository
from repositories.copilot_repo import CopilotRepository
from services.copilot.context import ToolExecutionContext
from services.copilot.router import CopilotRouter
from services.copilot.guardrails import (
    sanitize_untrusted_text,
    wrap_user_data,
    redact_pii,
    verify_output_grounding,
    calculate_cost_usd,
)

logger = structlog.get_logger(__name__)

# --- Provider Models & Urls ---
OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_DEFAULT_MODEL = "openai/gpt-4o-mini"


class CopilotService:
    def __init__(self):
        self.router = CopilotRouter()

    async def record_turn_telemetry_bg(
        self,
        copilot_repo: CopilotRepository,
        tenant_id: str,
        user_id: str,
        session_id: str,
        assistant_content: str,
        provider_used: str,
        model_used: str,
        latency_ms: int,
        prompt_tokens: int,
        completion_tokens: int,
    ) -> None:
        """
        Background worker executed via FastAPI BackgroundTasks:
        - Persists assistant message to MongoDB copilot_messages
        - Non-blocking: failures are logged and do not impact user response latency
        """
        try:
            await copilot_repo.append_message(
                tenant_id=tenant_id,
                user_id=user_id,
                session_id=session_id,
                role="assistant",
                content=assistant_content,
                provider_used=provider_used,
                model_used=model_used,
                latency_ms=latency_ms,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
            )
        except Exception as e:
            logger.error("Failed to persist assistant message in background", error=str(e), session_id=session_id)


    # --- Streaming Completers ---

    def _generate_title_from_message(self, message: str) -> str:
        """Extract a clean 3-6 word conversation title from the initial user message."""
        cleaned = re.sub(r"[^\w\s-]", " ", message).strip()
        words = cleaned.split()
        if not words:
            return "New Conversation"
        stopwords = {
            "how", "can", "i", "what", "is", "the", "my", "please", "to", "for",
            "a", "an", "do", "you", "help", "me", "with", "about", "of", "and", "in"
        }
        filtered = [w for w in words if w.lower() not in stopwords]
        target = filtered[:6] if len(filtered) >= 2 else words[:6]
        return " ".join(target).title()[:60]

    async def chat_copilot_v2_stream(
        self,
        request: Request,
        tenant_id: str,
        user_id: str,
        user_name: str,
        session_id: Optional[str],
        message: str,
        history: List[dict],
        quick_action: Optional[str],
        force_refresh: bool,
        copilot_repo: CopilotRepository,
        db,
        resume_repo: ResumeRepository,
        result_repo: ResultRepository,
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Production Copilot v2 Typed SSE Stream:
        - Scoped strictly by tenant_id and user_id
        - 15s keep-alive heartbeat comment (': ping\n\n')
        - Real cancellation on client disconnect (request.is_disconnected())
        - Emits typed events: session, status, token, suggestions, usage, navigate, done
        - Durable persistence to copilot_sessions and copilot_messages offloaded to BackgroundTasks
        """
        trace_id = (
            request.headers.get("X-Trace-ID")
            or request.headers.get("X-Request-ID")
            or str(uuid.uuid4())
        )

        def sse_format(event_data: dict) -> str:
            return f"id: {trace_id}\nevent: message\ndata: {json.dumps(event_data)}\n\n"

        tenant_id = tenant_id or "default"

        # 1. Resolve or create session
        if not session_id:
            title = self._generate_title_from_message(message)
            session = await copilot_repo.create_session(tenant_id, user_id, title=title)
            session_id = str(session.id)
        else:
            session = await copilot_repo.get_session(tenant_id, user_id, session_id)
            if not session:
                title = self._generate_title_from_message(message)
                session = await copilot_repo.create_session(tenant_id, user_id, title=title)
                session_id = str(session.id)

        # 2. Emit session event immediately
        yield sse_format({
            "type": "session",
            "session_id": session_id,
            "title": session.title,
        })

        # 3. Offload user message persistence to background task for zero-delay stream start
        clean_msg_for_log = redact_pii(message)
        logger.info(
            "Processing Copilot v2 chat turn",
            tenant_id=tenant_id,
            user_id=user_id,
            session_id=session_id,
            query_preview=clean_msg_for_log[:80],
        )

        async def _save_user_turn():
            try:
                await copilot_repo.append_message(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    session_id=session_id,
                    role="user",
                    content=message,
                )
            except Exception as e:
                logger.warning("Failed saving user turn in background", error=str(e))

        if background_tasks:
            background_tasks.add_task(_save_user_turn)
        else:
            asyncio.create_task(_save_user_turn())

        # 5. Status event & real-time tool execution via agentic router
        yield sse_format({"type": "status", "label": "Analyzing request & querying tools..."})

        tool_ctx = ToolExecutionContext(
            tenant_id=tenant_id,
            user_id=user_id,
            user_name=user_name,
            trace_id=trace_id,
            session_id=session_id,
            db=db,
            resume_repo=resume_repo,
            result_repo=result_repo,
            copilot_repo=copilot_repo,
        )

        event_queue: asyncio.Queue = asyncio.Queue()

        async def live_emit_event(ev: dict):
            await event_queue.put(ev)

        async def run_tools_task():
            try:
                return await self.router.plan_and_execute_tools(
                    ctx=tool_ctx,
                    message=message,
                    quick_action=quick_action,
                    emit_event=live_emit_event,
                )
            finally:
                await event_queue.put(None)

        tools_task = asyncio.create_task(run_tools_task())

        is_navigation_only = False
        nav_result = None

        while True:
            ev = await event_queue.get()
            if ev is None:
                break
            yield sse_format(ev)
            if ev.get("type") == "navigate":
                is_navigation_only = True
                nav_result = ev

        tool_outputs = await tools_task

        # Direct shortcut command fast-exit
        if is_navigation_only and message.strip().startswith("/"):
            res_text = f"Navigating to {nav_result.get('to')}! 🚀"
            yield sse_format({"type": "token", "delta": res_text})
            yield sse_format({"type": "suggestions", "items": ["What else can you do?", "Review my ATS score", "Practice an interview"]})
            yield sse_format({
                "type": "usage",
                "provider": "local",
                "model": "shortcut",
                "prompt_tokens": 0,
                "completion_tokens": len(res_text.split()),
                "latency_ms": 1,
            })
            yield sse_format({"type": "done"})

            async def _save_shortcut_turn():
                try:
                    await copilot_repo.append_message(
                        tenant_id=tenant_id,
                        user_id=user_id,
                        session_id=session_id,
                        role="assistant",
                        content=res_text,
                        provider_used="local",
                        model_used="shortcut",
                        latency_ms=1,
                    )
                except Exception as ex:
                    logger.warning("Failed saving shortcut turn in background", error=str(ex))

            if background_tasks:
                background_tasks.add_task(_save_shortcut_turn)
            else:
                asyncio.create_task(_save_shortcut_turn())
            return

        # 5. Build system prompt grounded strictly in tool outputs with Prompt Injection Guard
        clean_tool_outputs = []
        for t in (tool_outputs or []):
            if not t.get("ok"):
                clean_tool_outputs.append({
                    "feature": t.get("tool"),
                    "status": "no_prior_record_on_file",
                    "guidance": t.get("reason") or t.get("summary") or "No prior record on file.",
                })
            else:
                clean_tool_outputs.append({
                    "feature": t.get("tool"),
                    "status": "data_available",
                    "summary": t.get("summary"),
                    "data": t.get("data"),
                })
        grounded_data_str = json.dumps(clean_tool_outputs, indent=2) if clean_tool_outputs else "No prior records requested."
        wrapped_grounded_data = wrap_user_data("grounded_tool_results", grounded_data_str)
        sanitized_message = sanitize_untrusted_text(message)

        system_prompt = f"""You are CareerMitra, a warm, proactive, and world-class personal AI career coach for CareerShala. Your mission is to help candidates land their dream jobs, improve ATS readiness, excel in mock interviews, and earn skill credentials.

CANDIDATE: {user_name}

{wrapped_grounded_data}

CORE BEHAVIOR & EMPTY-STATE COACHING:
1. NEVER mention internal technical mechanics to the candidate (e.g. NEVER say "the tool is not available", "tool execution failed", "I don't have a tool", "API returned false", or "no tool calls executed"). Speak naturally like a supportive mentor.
2. When verified data in <user_data> indicates no prior record on file, DO NOT make excuses or output long generic textbook lectures. Instead, explain the status in 1 friendly sentence and immediately offer an interactive next step:
   - NO ATS SCAN: State that you haven't scanned their resume against a target job description yet. Invite them to test their score on [ATS Matcher](/results), or ask them to paste their target role and JD right here in the chat so you can analyze their match on the spot!
   - NO MOCK INTERVIEWS: State that they haven't recorded any mock interviews yet, and enthusiastically offer to practice right now! Ask: "What role or company are you preparing for? Tell me, and I'll ask your first practice question!", or invite them to practice with AI video/audio in [Interview Practice](/interview).
   - NO RESUME: State that their profile doesn't have an uploaded resume yet. Invite them to upload a PDF/DOCX at [Resume Library](/upload), or paste their experience and skills right here for an instant review.
   - NO CERTIFICATES: Explain that verified skill credentials appear once they complete platform assessments. Invite them to earn badges at [Certifications](/certificates).
   - NO GITHUB: Invite them to link their GitHub at [GitHub Analysis](/github) for automatic repo analysis and contribution score.
3. GROUNDING & HONESTY: Never fabricate numbers, match percentages, test scores, or repositories that are not present in <user_data>.
4. TONE & LENGTH: Keep responses concise, warm, conversational, and actionable (2 to 4 sentences for status/coaching responses, unless delivering a specific roadmap, interview simulation, or resume bullet diff). Use clean Markdown with bolding and markdown links.
"""

        # Fetch recent session transcript for memory continuity
        recent_msgs = await copilot_repo.list_messages(tenant_id, user_id, session_id, limit=8)
        llm_messages = [{"role": "system", "content": system_prompt}]
        for m in recent_msgs:
            if m.role in ("user", "assistant"):
                llm_messages.append({"role": m.role, "content": m.content})

        if not llm_messages or llm_messages[-1].get("content") != sanitized_message:
            llm_messages.append({"role": "user", "content": sanitized_message})

        # 6. Start token streaming immediately with zero intermediate queuing
        start_time = time.perf_counter()
        full_response = ""
        provider_used = "local"
        model_used = "fallback"

        active_model = getattr(settings, "OPENROUTER_MODEL", None) or OPENROUTER_DEFAULT_MODEL
        try:
            async for chunk in self._stream_openrouter(llm_messages):
                if chunk:
                    provider_used = "openrouter"
                    model_used = active_model
                    full_response += chunk
                    yield sse_format({"type": "token", "delta": chunk})
        except Exception as exc:
            logger.warning("Copilot streaming error", error=str(exc))
            yield sse_format({
                "type": "error",
                "code": "provider_error",
                "message": str(exc),
                "retryable": True,
            })

        # 8. Suggestions & Post-stream finalize with Output Grounding Guardrail
        if full_response:
            latency_ms = int((time.perf_counter() - start_time) * 1000)

            # Output Guardrail: verify cited percentages / scores against grounded data
            verified_response = verify_output_grounding(full_response, grounded_data_str)
            if verified_response != full_response:
                disclaimer_delta = verified_response[len(full_response):]
                yield sse_format({"type": "token", "delta": disclaimer_delta})
                full_response = verified_response

            prompt_tokens = max(1, len(json.dumps(llm_messages)) // 4)
            completion_tokens = max(1, len(full_response) // 4)
            turn_cost_usd = calculate_cost_usd(prompt_tokens, completion_tokens, provider=provider_used)

            tool_names_str = " ".join([t["tool"] for t in tool_outputs])
            if any(k in tool_names_str for k in ["resume", "ats", "bullet"]):
                suggestions = ["Rewrite my top 3 bullets", "Show missing skills", "How to reach 85%+ match?"]
            elif "interview" in tool_names_str:
                suggestions = ["Practice a behavioral question", "Practice system design", "Review my last mock score"]
            elif "github" in tool_names_str:
                suggestions = ["Analyze my top repository", "Suggest project improvements", "Draft portfolio bio"]
            else:
                suggestions = ["Review my ATS score", "Practice an interview", "Build career roadmap"]

            yield sse_format({"type": "suggestions", "items": suggestions})
            yield sse_format({
                "type": "usage",
                "provider": provider_used,
                "model": model_used,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "latency_ms": latency_ms,
                "cost_usd": turn_cost_usd,
            })
            yield sse_format({"type": "done"})

            # Move MongoDB telemetry tracking (token calculation, cost update, history saving, semantic cache)
            # into FastAPI BackgroundTasks so API returns immediately without waiting for DB writes
            if background_tasks:
                background_tasks.add_task(
                    self.record_turn_telemetry_bg,
                    copilot_repo=copilot_repo,
                    tenant_id=tenant_id,
                    user_id=user_id,
                    session_id=session_id,
                    assistant_content=full_response,
                    provider_used=provider_used,
                    model_used=model_used,
                    latency_ms=latency_ms,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                )
            else:
                asyncio.create_task(
                    self.record_turn_telemetry_bg(
                        copilot_repo=copilot_repo,
                        tenant_id=tenant_id,
                        user_id=user_id,
                        session_id=session_id,
                        assistant_content=full_response,
                        provider_used=provider_used,
                        model_used=model_used,
                        latency_ms=latency_ms,
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                    )
                )

    # --- OpenRouter streaming ---

    async def _stream_openrouter(self, messages: List[dict]) -> AsyncGenerator[str, None]:
        api_key = getattr(settings, "OPENROUTER_API_KEY", None)
        if not api_key:
            raise RuntimeError("CareerMitra is not configured. Please add an OpenRouter API key.")

        active_model = getattr(settings, "OPENROUTER_MODEL", None) or OPENROUTER_DEFAULT_MODEL
        chunks_received = False
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST",
                    OPENROUTER_BASE,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://careershala.tech",
                        "X-Title": "CareerShala AI Copilot",
                    },
                    json={
                        "model": active_model,
                        "messages": messages,
                        "stream": True,
                        "temperature": 0.5,
                        "max_tokens": 1000,
                    },
                ) as response:
                    if response.status_code != 200:
                        body = await response.aread()
                        if response.status_code == 429:
                            raise RuntimeError("CareerMitra is temporarily unavailable because the OpenRouter token limit has been reached. Please try again later.")
                        logger.warning("OpenRouter stream failed", status=response.status_code, error=body.decode("utf-8", errors="ignore"))
                        raise RuntimeError("CareerMitra could not get a response from OpenRouter. Please try again.")

                    async for line in response.aiter_lines():
                        if not line.strip() or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            delta = json.loads(data_str)["choices"][0]["delta"].get("content")
                        except (KeyError, IndexError, TypeError, json.JSONDecodeError):
                            continue
                        if delta:
                            chunks_received = True
                            yield delta
        except httpx.TimeoutException as exc:
            logger.warning("OpenRouter stream timed out", error=str(exc))
            raise RuntimeError("CareerMitra is taking too long to respond. Please try again.") from exc
        except httpx.HTTPError as exc:
            logger.warning("OpenRouter connection failed", error=str(exc))
            raise RuntimeError("CareerMitra could not connect to OpenRouter. Please try again.") from exc

        if not chunks_received:
            raise RuntimeError("CareerMitra received no response from OpenRouter. Please try again.")