"""
Copilot RAG Module.
Exports DocumentChunker, CopilotRetriever, and ingestion utilities.
"""

from services.copilot.rag.chunker import DocumentChunker
from services.copilot.rag.retriever import CopilotRetriever
from services.copilot.rag.ingestion import ingest_resume_chunks

__all__ = [
    "DocumentChunker",
    "CopilotRetriever",
    "ingest_resume_chunks",
]
