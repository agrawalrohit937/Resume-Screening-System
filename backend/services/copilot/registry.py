"""
Copilot Tool Registry & Base Specifications
===========================================
Defines BaseTool interface, ToolResult payload, and centralized ToolRegistry.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Type
from pydantic import BaseModel, Field
import structlog

from services.copilot.context import ToolExecutionContext

logger = structlog.get_logger(__name__)


class ToolResult(BaseModel):
    """
    Standardized payload returned by every tool execution.
    """
    ok: bool = Field(..., description="Whether the tool execution succeeded")
    data: Any = Field(default=None, description="Raw structured data for LLM consumption")
    summary: str = Field(..., description="1-line human readable summary for UI tool_result event")
    ui_card: Optional[Dict[str, Any]] = Field(default=None, description="Optional generative UI card directive")
    citation: Optional[Dict[str, Any]] = Field(default=None, description="Optional grounded citation")
    reason: Optional[str] = Field(default=None, description="Explanation if execution failed or data not found")


class BaseTool(ABC):
    """
    Abstract Base Class for all Copilot v2 Read and Action tools.
    """
    name: str
    description: str
    args_schema: Type[BaseModel]
    side_effect: bool = False
    requires: List[str] = []

    @abstractmethod
    async def execute(self, ctx: ToolExecutionContext, args: BaseModel) -> ToolResult:
        """
        Execute tool with provided context and validated arguments.
        Must never raise uncaught exceptions; return ToolResult(ok=False, reason=...) on failure.
        """
        pass

    def get_json_schema(self) -> Dict[str, Any]:
        """Returns JSON schema for args_schema."""
        return self.args_schema.model_json_schema()


class ToolRegistry:
    """
    Thread-safe registry of all available Copilot tools.
    """
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}

    def register(self, tool: BaseTool) -> BaseTool:
        self._tools[tool.name] = tool
        logger.debug("Registered copilot tool", name=tool.name, side_effect=tool.side_effect)
        return tool

    def get(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name)

    def list_tools(self) -> List[BaseTool]:
        return list(self._tools.values())

    def get_definitions(self, side_effects_only: Optional[bool] = None) -> List[Dict[str, Any]]:
        tools = self.list_tools()
        if side_effects_only is not None:
            tools = [t for t in tools if t.side_effect == side_effects_only]
        return [
            {
                "name": t.name,
                "description": t.description,
                "parameters": t.get_json_schema(),
                "side_effect": t.side_effect,
                "requires": t.requires,
            }
            for t in tools
        ]


# Global singleton tool registry
tool_registry = ToolRegistry()
