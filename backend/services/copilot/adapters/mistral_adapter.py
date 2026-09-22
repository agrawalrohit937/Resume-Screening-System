"""
Mistral Provider Tool Adapter
=============================
Formats tools into Mistral function calling specifications.
"""

from typing import Any, Dict, List
import structlog

from services.copilot.registry import BaseTool
from services.copilot.adapters.base import BaseProviderAdapter, NormalizedToolCall
from services.copilot.adapters.groq_adapter import GroqToolAdapter

logger = structlog.get_logger(__name__)


class MistralToolAdapter(BaseProviderAdapter):
    """Adapter for Mistral Function Calling (OpenAI-compatible schema)."""

    def __init__(self):
        self._delegate = GroqToolAdapter()

    def format_tools(self, tools: List[BaseTool]) -> List[Dict[str, Any]]:
        return self._delegate.format_tools(tools)

    def extract_tool_calls(self, response: Any) -> List[NormalizedToolCall]:
        return self._delegate.extract_tool_calls(response)
