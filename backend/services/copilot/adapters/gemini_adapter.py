"""
Gemini Provider Tool Adapter (Google GenAI)
===========================================
Formats tools into Google GenAI FunctionDeclaration specifications and extracts FunctionCall parts.
"""

from typing import Any, Dict, List
import structlog

from services.copilot.registry import BaseTool
from services.copilot.adapters.base import BaseProviderAdapter, NormalizedToolCall

logger = structlog.get_logger(__name__)


class GeminiToolAdapter(BaseProviderAdapter):
    """Adapter for Google Gemini Function Calling."""

    def format_tools(self, tools: List[BaseTool]) -> List[Dict[str, Any]]:
        declarations = []
        for t in tools:
            schema = t.get_json_schema()
            declarations.append({
                "name": t.name,
                "description": t.description,
                "parameters": {
                    "type": "OBJECT",
                    "properties": schema.get("properties", {}),
                    "required": schema.get("required", []),
                }
            })
        return [{"function_declarations": declarations}]

    def extract_tool_calls(self, response: Any) -> List[NormalizedToolCall]:
        tool_calls: List[NormalizedToolCall] = []
        try:
            # Check for GenAI response objects with candidates
            candidates = getattr(response, "candidates", None)
            if not candidates and isinstance(response, dict):
                candidates = response.get("candidates", [])

            if candidates:
                candidate = candidates[0]
                content = getattr(candidate, "content", None) or (candidate.get("content") if isinstance(candidate, dict) else None)
                parts = getattr(content, "parts", None) or (content.get("parts") if isinstance(content, dict) else [])

                for idx, part in enumerate(parts or []):
                    fn_call = getattr(part, "function_call", None) or (part.get("function_call") if isinstance(part, dict) else None)
                    if fn_call:
                        name = getattr(fn_call, "name", None) or (fn_call.get("name") if isinstance(fn_call, dict) else "")
                        args = getattr(fn_call, "args", None) or (fn_call.get("args") if isinstance(fn_call, dict) else {})
                        if isinstance(args, str):
                            import json
                            try:
                                args = json.loads(args)
                            except Exception:
                                args = {}

                        if name:
                            tool_calls.append(NormalizedToolCall(
                                id=f"gemini_tc_{idx}",
                                name=name,
                                args=dict(args) if args else {},
                            ))
        except Exception as e:
            logger.warning("Failed to extract tool calls from Gemini response", error=str(e))

        return tool_calls
