"""
Groq Provider Tool Adapter (OpenAI Compatible)
==============================================
Formats tools into OpenAI JSON schema and extracts tool_calls from Groq responses.
"""

import json
from typing import Any, Dict, List
import structlog

from services.copilot.registry import BaseTool
from services.copilot.adapters.base import BaseProviderAdapter, NormalizedToolCall

logger = structlog.get_logger(__name__)


class GroqToolAdapter(BaseProviderAdapter):
    """Adapter for Groq OpenAI-compatible function calling."""

    def format_tools(self, tools: List[BaseTool]) -> List[Dict[str, Any]]:
        formatted = []
        for t in tools:
            schema = t.get_json_schema()
            # Clean schema for OpenAI compatibility
            params = {
                "type": "object",
                "properties": schema.get("properties", {}),
                "required": schema.get("required", []),
            }
            formatted.append({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": params,
                }
            })
        return formatted

    def extract_tool_calls(self, response: Any) -> List[NormalizedToolCall]:
        tool_calls: List[NormalizedToolCall] = []
        try:
            # Handle dictionary or object payload
            raw_calls = None
            if isinstance(response, dict):
                # Standard choices[0].message.tool_calls
                choices = response.get("choices", [])
                if choices:
                    msg = choices[0].get("message", {})
                    raw_calls = msg.get("tool_calls")
            elif hasattr(response, "choices") and response.choices:
                msg = getattr(response.choices[0], "message", None)
                if msg:
                    raw_calls = getattr(msg, "tool_calls", None)

            if raw_calls:
                for idx, rc in enumerate(raw_calls):
                    call_id = rc.get("id") if isinstance(rc, dict) else getattr(rc, "id", f"call_{idx}")
                    func = rc.get("function") if isinstance(rc, dict) else getattr(rc, "function", {})
                    name = func.get("name") if isinstance(func, dict) else getattr(func, "name", "")
                    raw_args = func.get("arguments") if isinstance(func, dict) else getattr(func, "arguments", "{}")

                    parsed_args = {}
                    if isinstance(raw_args, str):
                        try:
                            parsed_args = json.loads(raw_args) if raw_args.strip() else {}
                        except Exception:
                            parsed_args = {}
                    elif isinstance(raw_args, dict):
                        parsed_args = raw_args

                    if name:
                        tool_calls.append(NormalizedToolCall(id=call_id or f"tc_{idx}", name=name, args=parsed_args))
        except Exception as e:
            logger.warning("Failed to extract tool calls from Groq response", error=str(e))

        return tool_calls
