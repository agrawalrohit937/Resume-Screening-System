"""
Copilot RAG Module.
Exports DocumentChunker, CopilotRetriever, SemanticResponseCache, and ingestion utilities.
"""

from services.copilot.rag.chunker import DocumentChunker
from services.copilot.rag.retriever import CopilotRetriever
from services.copilot.rag.semantic_cache import SemanticResponseCache, compute_context_version
from services.copilot.rag.ingestion import ingest_resume_chunks, ingest_job_chunks, ingest_help_docs

__all__ = [
    "DocumentChunker",
    "CopilotRetriever",
    "SemanticResponseCache",
    "compute_context_version",
    "ingest_resume_chunks",
    "ingest_job_chunks",
    "ingest_help_docs",
]
