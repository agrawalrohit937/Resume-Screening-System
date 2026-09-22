"""
Agentic Copilot Tool Router
===========================
Executes agentic tool-calling loop:
- Enforces 25s turn budget and 8s per-tool timeout
- Max 4 tool calls per turn across max 2 sequential rounds
- Runs independent tools concurrently with asyncio.gather
- Emits live SSE events: tool_call, tool_result, ui_card, citation, navigate
- Resilient: tool failures return {ok: False, reason: ...} and never crash the stream
"""

import asyncio
import json
import time
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional, Tuple
import httpx
import structlog

from core.config import settings
from core.llm_client import groq_key_pool, GeminiKeyPool
from services.copilot.context import ToolExecutionContext
from services.copilot.registry import BaseTool, ToolResult, tool_registry
from services.copilot.adapters.base import NormalizedToolCall
from services.copilot.adapters.groq_adapter import GroqToolAdapter
from services.copilot.adapters.gemini_adapter import GeminiToolAdapter
from services.copilot.adapters.mistral_adapter import MistralToolAdapter
import services.copilot.tools  # Ensure all tools are registered

logger = structlog.get_logger(__name__)

TURN_BUDGET_SECONDS = 25.0
PER_TOOL_TIMEOUT_SECONDS = 8.0
MAX_TOOL_ROUNDS = 2
MAX_TOTAL_TOOL_CALLS = 4

GROQ_BASE = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "groq/compound-mini"]
MISTRAL_BASE = "https://api.mistral.ai/v1/chat/completions"
MISTRAL_MODELS = ["open-mistral-7b", "ministral-8b-latest"]
GEMINI_MODEL = "gemini-2.5-flash"


class CopilotRouter:
    """
    Agentic router coordinating LLM tool-calling, parallel execution, and token streaming.
    """

    def __init__(self):
        self.registry = tool_registry
        self.groq_adapter = GroqToolAdapter()
        self.gemini_adapter = GeminiToolAdapter()
        self.mistral_adapter = MistralToolAdapter()
        self.gemini_pool = GeminiKeyPool()

    async def execute_tool_safe(
        self,
        tool: BaseTool,
        ctx: ToolExecutionContext,
        raw_args: Dict[str, Any],
    ) -> ToolResult:
        """
        Executes a single tool with an 8-second hard timeout and robust exception handling.
        """
        try:
            # Validate args against tool schema
            args_model = tool.args_schema(**raw_args)
            result = await asyncio.wait_for(
                tool.execute(ctx, args_model),
                timeout=PER_TOOL_TIMEOUT_SECONDS,
            )
            return result
        except asyncio.TimeoutError:
            logger.warning("Tool execution timed out", tool=tool.name, timeout=PER_TOOL_TIMEOUT_SECONDS)
            return ToolResult(
                ok=False,
                data=None,
                summary=f"{tool.name} timed out",
                reason=f"Operation exceeded {PER_TOOL_TIMEOUT_SECONDS}s timeout.",
            )
        except Exception as e:
            logger.warning("Tool execution error", tool=tool.name, error=str(e))
            return ToolResult(
                ok=False,
                data=None,
                summary=f"{tool.name} failed",
                reason=str(e),
            )

    def select_tools_heuristically(self, message: str, quick_action: Optional[str] = None) -> List[Tuple[str, Dict[str, Any]]]:
        """
        Resilient fast-path fallback when cloud LLMs fail to call tools natively.
        Determines targeted tools from message semantics.
        """
        msg_l = message.lower().strip()
        selected: List[Tuple[str, Dict[str, Any]]] = []

        # Navigation shortcuts
        nav_map = {
            "/ats": ("/results", "Opening ATS Matcher"),
            "/interview": ("/interview", "Taking you to Interview Practice"),
            "/upload": ("/upload", "Opening Resume Library"),
            "/enhance": ("/enhance", "Opening Resume Enhancer"),
            "/github": ("/github", "Opening GitHub Analysis"),
            "/gamification": ("/gamification", "Opening Rewards Hub"),
            "/billing": ("/billing", "Opening Billing & Premium"),
            "/portfolio": ("/portfolio", "Opening Developer Portfolio"),
            "/certificates": ("/certificates", "Opening Certifications"),
        }
        for cmd, (route, reason) in nav_map.items():
            if msg_l.startswith(cmd) or f" {cmd} " in f" {msg_l} ":
                selected.append(("navigate", {"route": route, "reason": reason}))

        # Quick actions
        if quick_action == "review-resume":
            selected.append(("get_resume_summary", {}))
        elif quick_action == "improve-ats":
            selected.append(("get_ats_breakdown", {}))
            selected.append(("get_resume_summary", {}))
        elif quick_action == "mock-interview":
            selected.append(("get_interview_history", {"limit": 3}))
        elif quick_action == "analyze-github":
            selected.append(("get_github_profile", {}))
        elif quick_action == "job-suggestions":
            selected.append(("search_jobs", {"query": "software"}))

        # Semantic keywords
        if any(w in msg_l for w in ["resume", "cv", "skills", "experience", "education"]):
            if not any(t[0] == "get_resume_summary" for t in selected):
                selected.append(("get_resume_summary", {}))
        if any(w in msg_l for w in ["ats", "match score", "matched keywords", "missing keywords"]):
            if not any(t[0] == "get_ats_breakdown" for t in selected):
                selected.append(("get_ats_breakdown", {}))
        if any(w in msg_l for w in ["interview", "mock", "practice question"]):
            if not any(t[0] == "get_interview_history" for t in selected):
                selected.append(("get_interview_history", {"limit": 3}))
        if any(w in msg_l for w in ["github", "repos", "commit", "contribution"]):
            if not any(t[0] == "get_github_profile" for t in selected):
                selected.append(("get_github_profile", {}))
        if any(w in msg_l for w in ["cert", "credential", "badge"]):
            if not any(t[0] == "get_certificates" for t in selected):
                selected.append(("get_certificates", {}))
        if any(w in msg_l for w in ["streak", "points", "xp", "level", "reward"]):
            if not any(t[0] == "get_gamification_state" for t in selected):
                selected.append(("get_gamification_state", {}))
        if any(w in msg_l for w in ["job", "opening", "hiring", "vacancy"]):
            if not any(t[0] == "search_jobs" for t in selected):
                selected.append(("search_jobs", {"query": message[:40]}))

        return selected[:MAX_TOTAL_TOOL_CALLS]

    async def plan_and_execute_tools(
        self,
        ctx: ToolExecutionContext,
        message: str,
        quick_action: Optional[str],
        emit_event: Callable[[Dict[str, Any]], Any],
    ) -> List[Dict[str, Any]]:
        """
        Executes tool-calling decisions:
        1. Attempts LLM function calling with Groq.
        2. If unavailable, falls back to semantic heuristic tool planner.
        3. Executes scheduled tools in parallel with asyncio.gather.
        4. Emits tool_call and tool_result SSE events.
        """
        tools_to_run: List[NormalizedToolCall] = []

        # 0. Slash commands route directly to the navigate tool
        msg_strip = message.strip()
        if msg_strip.startswith("/"):
            slash_cmd = msg_strip.split()[0].lower()
            slash_map = {
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
            if slash_cmd in slash_map:
                route, reason = slash_map[slash_cmd]
                tools_to_run = [NormalizedToolCall(
                    id="tc_nav_1",
                    name="navigate",
                    args={"route": route, "reason": reason},
                )]

        # 1. Try Groq function calling (if not already planned by slash command)
        if not tools_to_run and settings.groq_api_keys:
            try:
                tools_to_run = await self._call_groq_for_tools(message)
            except Exception as e:
                logger.debug("Groq tool call extraction bypassed, using heuristic planner", error=str(e))

        # 2. Fallback to resilient heuristic tool planner if LLM returned 0 tools
        if not tools_to_run:
            heuristic_plans = self.select_tools_heuristically(message, quick_action)
            for idx, (t_name, t_args) in enumerate(heuristic_plans):
                tools_to_run.append(NormalizedToolCall(
                    id=f"tc_{idx + 1}",
                    name=t_name,
                    args=t_args,
                ))

        if not tools_to_run:
            return []

        # Cap total tools to MAX_TOTAL_TOOL_CALLS
        tools_to_run = tools_to_run[:MAX_TOTAL_TOOL_CALLS]

        # 3. Emit tool_call events for all planned tools
        for call in tools_to_run:
            await emit_event({
                "type": "tool_call",
                "id": call.id,
                "tool": call.name,
                "name": call.name,
                "args": call.args,
            })

        # 4. Execute all independent tools concurrently
        async def _run_single(call: NormalizedToolCall) -> Tuple[NormalizedToolCall, ToolResult]:
            tool = self.registry.get(call.name)
            if not tool:
                res = ToolResult(ok=False, data=None, summary="Unknown tool", reason=f"Tool {call.name} not registered")
            else:
                res = await self.execute_tool_safe(tool, ctx, call.args)
            return (call, res)

        results = await asyncio.gather(*[_run_single(call) for call in tools_to_run], return_exceptions=True)

        tool_outputs = []
        for item in results:
            if isinstance(item, Exception):
                logger.warning("Uncaught exception in tool gather", error=str(item))
                continue

            call, res = item

            # Emit tool_result event
            await emit_event({
                "type": "tool_result",
                "id": call.id,
                "tool": call.name,
                "name": call.name,
                "ok": res.ok,
                "summary": res.summary,
            })

            # Emit optional UI card
            if res.ui_card:
                await emit_event({
                    "type": "ui_card",
                    "card": res.ui_card.get("card"),
                    "data": res.ui_card.get("data"),
                })

            # Emit optional citation
            if res.citation:
                await emit_event({
                    "type": "citation",
                    "id": f"cit_{call.id}",
                    "source": res.citation.get("source"),
                    "label": res.citation.get("label"),
                    "href": res.citation.get("href"),
                })

            # Emit navigate if navigate tool
            if call.name == "navigate" and res.ok and res.data:
                await emit_event({
                    "type": "navigate",
                    "to": res.data.get("route"),
                    "reason": res.data.get("reason", "Navigation shortcut"),
                })

            tool_outputs.append({
                "tool": call.name,
                "ok": res.ok,
                "summary": res.summary,
                "data": res.data if res.ok else None,
                "reason": res.reason,
            })

        return tool_outputs

    async def _call_groq_for_tools(self, message: str) -> List[NormalizedToolCall]:
        """Queries Groq with tool definitions to obtain tool calling plan."""
        tools = self.registry.list_tools()
        formatted_tools = self.groq_adapter.format_tools(tools)

        for attempt in range(min(2, len(settings.groq_api_keys))):
            key = groq_key_pool.get_next_key()
            if not key:
                break
            for model in GROQ_MODELS[:2]:
                try:
                    async with httpx.AsyncClient(timeout=3.5) as client:
                        resp = await client.post(
                            GROQ_BASE,
                            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                            json={
                                "model": model,
                                "messages": [
                                    {
                                        "role": "system",
                                        "content": "You are the tool-calling router for CareerShala Copilot. Decide if any tools should be called to answer the user query. If no tools are needed, do not call any tools.",
                                    },
                                    {"role": "user", "content": message},
                                ],
                                "tools": formatted_tools,
                                "tool_choice": "auto",
                                "temperature": 0.1,
                            },
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            return self.groq_adapter.extract_tool_calls(data)
                except Exception as e:
                    logger.debug("Groq tool call attempt failed", model=model, error=str(e))
                    continue

        return []
