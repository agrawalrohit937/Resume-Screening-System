"""
Base Provider Tool Adapter Protocol
===================================
Normalizes tool definitions and tool-call extraction across Groq, Gemini, and Mistral.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List
from pydantic import BaseModel

from services.copilot.registry import BaseTool


@dataclass
class NormalizedToolCall:
    """Standardized tool call extracted from any LLM provider."""
    id: str
    name: str
    args: Dict[str, Any]


class BaseProviderAdapter(ABC):
    """Abstract interface for provider-specific tool conversions."""

    @abstractmethod
    def format_tools(self, tools: List[BaseTool]) -> Any:
        """Transforms BaseTool instances into provider-native tool schemas."""
        pass

    @abstractmethod
    def extract_tool_calls(self, response: Any) -> List[NormalizedToolCall]:
        """Extracts normalized tool calls from provider completion/delta response."""
        pass
