"""
Copilot RAG Models — Data structures for hybrid retrieval, chunking, citations, and semantic cache.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class CopilotChunkModel(BaseModel):
    """
    Stored document chunk in MongoDB `copilot_chunks`.
    Scoped strictly by `tenant_id` and `user_id`.
    """
    id: Optional[str] = Field(default=None, alias="_id")
    tenant_id: str = Field(..., description="Multi-tenant boundary identifier")
    user_id: str = Field(..., description="User boundary or 'system' for global documents")
    source_type: Literal["resume", "job_description", "interview_transcript", "help_doc"] = Field(...)
    source_id: str = Field(..., description="Document identifier (e.g. resume_id, job_id)")
    chunk_index: int = Field(default=0, description="Sequential ordering within the source document")
    title: str = Field(..., description="Hierarchical breadcrumb or section title")
    text: str = Field(..., description="Chunk content (~500 tokens max)")
    text_hash: str = Field(..., description="SHA-256 hash for deduplication and cache validation")
    embedding: List[float] = Field(default_factory=list, description="Dense vector embedding")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata like section, role, company, skills")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
    }


class RetrievedChunk(BaseModel):
    """
    Represents a retrieved and reranked document chunk returned to the Copilot.
    """
    chunk_id: str
    source_type: str
    source_id: str
    chunk_index: int
    title: str
    text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    vector_score: Optional[float] = None
    bm25_score: Optional[float] = None
    rrf_score: Optional[float] = None
    rerank_score: Optional[float] = None
    final_score: float = 0.0

    @property
    def citation_label(self) -> str:
        """Formatted human-readable citation label, e.g. 'Resume > Experience'"""
        prefix = self.source_type.replace("_", " ").title()
        section = self.metadata.get("section") or self.title
        return f"{prefix} ({section})"


class CitationEvent(BaseModel):
    """
    Typed SSE payload emitted when Copilot cites retrieved grounding chunks.
    """
    type: Literal["citation"] = "citation"
    chunk_id: str
    source_type: str
    source_id: str
    title: str
    citation_label: str
    snippet: str
    score: float
