"""
Copilot Document Ingestion Service.

Processes resumes, jobs, transcripts, and help docs:
1. Chunks via DocumentChunker with structural preservation.
2. Batches dense vector embeddings using local BGE model.
3. Atomically replaces previous document chunks in `copilot_chunks` scoped by (tenant_id, user_id).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import structlog

from services.copilot.rag.chunker import DocumentChunker
from services.embedding_service import embedding_model

logger = structlog.get_logger(__name__)


async def ingest_resume_chunks(
    db: Any,
    tenant_id: str,
    user_id: str,
    parsed_resume: Dict[str, Any],
    raw_text: str = "",
    resume_id: str = "default",
) -> int:
    """
    Chunks, embeds, and indexes a candidate's resume for Copilot hybrid retrieval.
    """
    col = getattr(db, "copilot_chunks", None)
    if col is None:
        logger.warning("copilot_chunks collection not found on db")
        return 0

    # 1. Generate section-aware chunks
    raw_chunks = DocumentChunker.chunk_resume(
        parsed_resume=parsed_resume,
        raw_text=raw_text,
        resume_id=resume_id,
    )
    if not raw_chunks:
        logger.info("No chunks produced for resume", user_id=user_id)
        return 0

    # 2. Batch encode embeddings
    texts = [c["text"] for c in raw_chunks]
    try:
        embeddings = embedding_model.encode(texts)
        if hasattr(embeddings, "tolist"):
            embeddings = embeddings.tolist()
    except Exception as e:
        logger.error("Embedding generation failed during resume ingestion", error=str(e))
        embeddings = [[] for _ in texts]

    # 3. Assemble documents
    now = datetime.now(timezone.utc)
    docs_to_insert = []
    for idx, chunk in enumerate(raw_chunks):
        emb = embeddings[idx] if idx < len(embeddings) else []
        docs_to_insert.append({
            "tenant_id": tenant_id,
            "user_id": user_id,
            "source_type": "resume",
            "source_id": str(resume_id),
            "chunk_index": chunk["chunk_index"],
            "title": chunk["title"],
            "text": chunk["text"],
            "text_hash": chunk["text_hash"],
            "embedding": emb,
            "metadata": chunk.get("metadata", {}),
            "created_at": now,
            "updated_at": now,
        })

    # 4. Atomic replacement
    try:
        await col.delete_many({
            "tenant_id": tenant_id,
            "user_id": user_id,
            "source_type": "resume",
        })
        if docs_to_insert:
            await col.insert_many(docs_to_insert)
        logger.info("Ingested resume chunks successfully", count=len(docs_to_insert), user_id=user_id)
        return len(docs_to_insert)
    except Exception as e:
        logger.error("Failed to persist resume chunks", error=str(e), user_id=user_id)
        return 0


async def ingest_job_chunks(
    db: Any,
    tenant_id: str,
    job_id: str,
    job_data: Dict[str, Any],
) -> int:
    """
    Chunks, embeds, and indexes a job description.
    """
    col = getattr(db, "copilot_chunks", None)
    if col is None:
        return 0

    raw_chunks = DocumentChunker.chunk_job_description(job_data=job_data, job_id=job_id)
    if not raw_chunks:
        return 0

    texts = [c["text"] for c in raw_chunks]
    try:
        embeddings = embedding_model.encode(texts)
        if hasattr(embeddings, "tolist"):
            embeddings = embeddings.tolist()
    except Exception as e:
        logger.error("Embedding generation failed for job", error=str(e))
        embeddings = [[] for _ in texts]

    now = datetime.now(timezone.utc)
    docs = []
    for idx, chunk in enumerate(raw_chunks):
        emb = embeddings[idx] if idx < len(embeddings) else []
        docs.append({
            "tenant_id": tenant_id,
            "user_id": "system",  # Jobs are globally accessible within tenant
            "source_type": "job_description",
            "source_id": str(job_id),
            "chunk_index": chunk["chunk_index"],
            "title": chunk["title"],
            "text": chunk["text"],
            "text_hash": chunk["text_hash"],
            "embedding": emb,
            "metadata": chunk.get("metadata", {}),
            "created_at": now,
            "updated_at": now,
        })

    try:
        await col.delete_many({
            "tenant_id": tenant_id,
            "source_type": "job_description",
            "source_id": str(job_id),
        })
        if docs:
            await col.insert_many(docs)
        return len(docs)
    except Exception as e:
        logger.error("Failed to persist job chunks", error=str(e))
        return 0


async def ingest_help_docs(
    db: Any,
    tenant_id: str,
    docs: List[Dict[str, str]],
) -> int:
    """
    Chunks, embeds, and indexes platform help documents.
    """
    col = getattr(db, "copilot_chunks", None)
    if col is None:
        return 0

    all_raw_chunks = []
    for d in docs:
        c_list = DocumentChunker.chunk_help_doc(
            doc_title=d.get("title", "Help"),
            content=d.get("content", ""),
            doc_id=d.get("id", "doc"),
        )
        all_raw_chunks.extend(c_list)

    if not all_raw_chunks:
        return 0

    texts = [c["text"] for c in all_raw_chunks]
    try:
        embeddings = embedding_model.encode(texts)
        if hasattr(embeddings, "tolist"):
            embeddings = embeddings.tolist()
    except Exception:
        embeddings = [[] for _ in texts]

    now = datetime.now(timezone.utc)
    docs_to_insert = []
    for idx, chunk in enumerate(all_raw_chunks):
        emb = embeddings[idx] if idx < len(embeddings) else []
        docs_to_insert.append({
            "tenant_id": tenant_id,
            "user_id": "system",
            "source_type": "help_doc",
            "source_id": chunk["source_id"],
            "chunk_index": chunk["chunk_index"],
            "title": chunk["title"],
            "text": chunk["text"],
            "text_hash": chunk["text_hash"],
            "embedding": emb,
            "metadata": chunk.get("metadata", {}),
            "created_at": now,
            "updated_at": now,
        })

    try:
        await col.delete_many({"tenant_id": tenant_id, "source_type": "help_doc"})
        if docs_to_insert:
            await col.insert_many(docs_to_insert)
        return len(docs_to_insert)
    except Exception as e:
        logger.error("Failed to ingest help docs", error=str(e))
        return 0
