"""LLM-driven tool selection (Function Calling) and safe parallel execution for CareerMitra."""

import asyncio
import json
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Tuple

import httpx
import structlog

from core.config import settings
from services.copilot.context import ToolExecutionContext
from services.copilot.registry import BaseTool, ToolResult, tool_registry
import services.copilot.tools  # noqa: F401 - register all tools

logger = structlog.get_logger(__name__)

PER_TOOL_TIMEOUT_SECONDS = 8.0
MAX_TOTAL_TOOL_CALLS = 4

SLASH_NAV_MAP = {
    "/ats": ("/results", "Opening ATS Matcher"),
    "/interview": ("/interview", "Opening Interview Practice"),
    "/upload": ("/upload", "Opening Resume Library"),
    "/enhance": ("/enhance", "Opening Resume Enhancer"),
    "/github": ("/github", "Opening GitHub Analysis"),
    "/fake-detect": ("/fake-detect", "Opening Authenticity Check"),
    "/gamification": ("/gamification", "Opening Rewards Hub"),
    "/billing": ("/billing", "Opening Billing & Premium"),
    "/profile": ("/profile", "Opening Profile settings"),
    "/dashboard": ("/dashboard", "Opening Career Dashboard"),
    "/portfolio": ("/portfolio", "Opening Developer Portfolio"),
    "/certificates": ("/certificates", "Opening Certifications"),
    "/jobs": ("/jobs", "Opening Job Marketplace"),
}

QUICK_ACTION_TOOL_MAP = {
    "review-resume": [("get_resume_summary", {})],
    "improve-ats": [("get_ats_breakdown", {}), ("get_resume_summary", {})],
    "mock-interview": [("get_interview_history", {"limit": 3})],
    "analyze-github": [("get_github_profile", {})],
    "job-suggestions": [("search_jobs", {"query": "software"})],
}


@dataclass
class NormalizedToolCall:
    """Standardized tool call extracted from an LLM provider."""
    id: str
    name: str
    args: Dict[str, Any]


class CopilotRouter:
    """Plans tool calls via native LLM Function Calling and executes them concurrently."""

    def __init__(self):
        self.registry = tool_registry

    def _build_openai_tool_schemas(self) -> List[Dict[str, Any]]:
        return [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": {k: v for k, v in t.get_json_schema().items() if k != "title"},
                },
            }
            for t in self.registry.list_tools()
        ]

    async def _plan_tools_with_llm(
        self, message: str, history: Optional[List[Dict[str, Any]]] = None
    ) -> List[NormalizedToolCall]:
        """Select tools via native LLM Function Calling (Groq -> OpenRouter) with recent chat context."""
        tool_schemas = self._build_openai_tool_schemas()
        if not tool_schemas:
            return []

        messages: List[Dict[str, str]] = [{
            "role": "system",
            "content": (
                "You are the CareerMitra tool planner. Call only the tools strictly needed "
                "to answer the user's request. For greetings or general chat, call no tools."
            ),
        }]
        for turn in (history or [])[-4:]:
            role = turn.get("role", "user")
            content = str(turn.get("content") or "")[:400]
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": message})

        providers = [
            (
                "https://api.groq.com/openai/v1/chat/completions",
                getattr(settings, "GROQ_API_KEY", None),
                getattr(settings, "GROQ_MODEL", "llama-3.3-70b-versatile"),
            ),
            (
                "https://openrouter.ai/api/v1/chat/completions",
                getattr(settings, "OPENROUTER_API_KEY", None),
                "openai/gpt-4o-mini",
            ),
        ]

        for url, api_key, model in providers:
            if not api_key:
                continue
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        url,
                        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                        json={
                            "model": model,
                            "messages": messages,
                            "tools": tool_schemas,
                            "tool_choice": "auto",
                            "temperature": 0.0,
                            "max_tokens": 512,
                        },
                    )
                    resp.raise_for_status()
                    choices = resp.json().get("choices") or []
                    raw_calls = (choices[0].get("message", {}).get("tool_calls") or []) if choices else []
                    parsed: List[NormalizedToolCall] = []
                    for idx, tc in enumerate(raw_calls[:MAX_TOTAL_TOOL_CALLS]):
                        fn = tc.get("function") or {}
                        name = fn.get("name")
                        if not name:
                            continue
                        raw_args = fn.get("arguments") or "{}"
                        try:
                            args = json.loads(raw_args) if isinstance(raw_args, str) else dict(raw_args)
                        except (json.JSONDecodeError, TypeError):
                            args = {}
                        parsed.append(NormalizedToolCall(id=tc.get("id") or f"tc_{idx + 1}", name=name, args=args))
                    return parsed
            except Exception as exc:
                logger.warning("LLM function calling failed", url=url, error=str(exc))

        return []

    async def execute_tool_safe(
        self, tool: BaseTool, ctx: ToolExecutionContext, raw_args: Dict[str, Any]
    ) -> ToolResult:
        """Execute a single tool with an 8-second hard timeout and exception handling."""
        try:
            args_model = tool.args_schema(**raw_args)
            return await asyncio.wait_for(tool.execute(ctx, args_model), timeout=PER_TOOL_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            logger.warning("Tool execution timed out", tool=tool.name, timeout=PER_TOOL_TIMEOUT_SECONDS)
            return ToolResult(ok=False, data=None, summary=f"{tool.name} timed out", reason=f"Exceeded {PER_TOOL_TIMEOUT_SECONDS}s timeout.")
        except Exception as e:
            logger.warning("Tool execution error", tool=tool.name, error=str(e))
            return ToolResult(ok=False, data=None, summary=f"{tool.name} failed", reason=str(e))

    async def plan_and_execute_tools(
        self,
        ctx: ToolExecutionContext,
        message: str,
        quick_action: Optional[str],
        emit_event: Callable[[Dict[str, Any]], Any],
        history: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        """Plan tools via slash command, quick action, or LLM Function Calling, then run concurrently."""
        tools_to_run: List[NormalizedToolCall] = []
        msg_strip = message.strip()

        if msg_strip.startswith("/"):
            slash_cmd = msg_strip.split()[0].lower()
            if slash_cmd in SLASH_NAV_MAP:
                route, reason = SLASH_NAV_MAP[slash_cmd]
                tools_to_run = [NormalizedToolCall(id="tc_nav_1", name="navigate", args={"route": route, "reason": reason})]

        if not tools_to_run and quick_action in QUICK_ACTION_TOOL_MAP:
            tools_to_run = [
                NormalizedToolCall(id=f"tc_qa_{i + 1}", name=name, args=args)
                for i, (name, args) in enumerate(QUICK_ACTION_TOOL_MAP[quick_action])
            ]

        if not tools_to_run and msg_strip:
            tools_to_run = await self._plan_tools_with_llm(msg_strip, history=history)

        if not tools_to_run:
            return []

        tools_to_run = tools_to_run[:MAX_TOTAL_TOOL_CALLS]
        for call in tools_to_run:
            await emit_event({"type": "tool_call", "id": call.id, "tool": call.name, "name": call.name, "args": call.args})

        async def _run_single(call: NormalizedToolCall) -> Tuple[NormalizedToolCall, ToolResult]:
            tool = self.registry.get(call.name)
            res = await self.execute_tool_safe(tool, ctx, call.args) if tool else ToolResult(
                ok=False, data=None, summary="Unknown tool", reason=f"Tool {call.name} not registered"
            )
            return call, res

        results = await asyncio.gather(*[_run_single(c) for c in tools_to_run], return_exceptions=True)

        tool_outputs = []
        for item in results:
            if isinstance(item, Exception):
                logger.error("Unexpected tool gather exception", error=str(item))
                continue
            call, res = item
            await emit_event({
                "type": "tool_result", "id": call.id, "tool": call.name,
                "ok": res.ok, "summary": res.summary, "ui_card": res.ui_card, "citation": res.citation,
            })
            if res.ok and call.name == "navigate" and res.data:
                await emit_event({"type": "navigate", "to": res.data.get("route"), "reason": res.data.get("reason")})
            tool_outputs.append({
                "tool": call.name, "ok": res.ok, "data": res.data, "summary": res.summary,
                "reason": res.reason, "citation": res.citation, "ui_card": res.ui_card,
            })

        return tool_outputs
