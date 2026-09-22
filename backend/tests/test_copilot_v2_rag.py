"""
Tests for Phase 3: Copilot Hybrid RAG Pipeline.
- Section-aware document chunking (resumes, JDs, interviews, help docs)
- Hybrid retrieval: Vector + BM25 + RRF + CrossEncoder
- Multi-tenant data boundary isolation
- Semantic response cache: hit, miss, context version invalidation
- Tool integration: retrieve_context and search_resume with citations
"""

import pytest
import numpy as np
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from models.copilot_rag_model import CopilotChunkModel, RetrievedChunk
from services.copilot.rag.chunker import DocumentChunker
from services.copilot.rag.retriever import CopilotRetriever, _reciprocal_rank_fusion, _cosine_similarity
from services.copilot.rag.semantic_cache import SemanticResponseCache, compute_context_version
from services.copilot.rag.ingestion import ingest_resume_chunks, ingest_job_chunks
from services.copilot.registry import tool_registry
from services.copilot.context import ToolExecutionContext
from services.copilot.tools.read_tools import RetrieveContextArgs, RetrieveContextTool, SearchResumeArgs, SearchResumeTool


class AsyncMockCollection:
    def __init__(self, initial_data=None):
        self.data = initial_data or []

    async def find_one(self, query=None, *args, **kwargs):
        docs = await self._filter(query)
        return dict(docs[0]) if docs else None

    def find(self, query=None, *args, **kwargs):
        async def _generator():
            docs = await self._filter(query)
            for d in docs:
                yield dict(d)

        class Cursor:
            def __init__(self, gen, docs):
                self._gen = gen
                self._docs = docs

            def sort(self, *args, **kwargs):
                return self

            def limit(self, n):
                self._docs = self._docs[:n]
                return self

            def skip(self, n):
                self._docs = self._docs[n:]
                return self

            async def to_list(self, length=None):
                if length is not None:
                    return [dict(d) for d in self._docs[:length]]
                return [dict(d) for d in self._docs]

            def __aiter__(self):
                return self._gen()

        filtered = self._sync_filter(query)
        return Cursor(_generator, filtered)

    def aggregate(self, pipeline):
        class AggCursor:
            def __init__(self, docs):
                self.docs = docs

            async def to_list(self, length=None):
                return self.docs[:length] if length else self.docs

        # In testing mock, return empty to trigger in-memory cosine fallback
        return AggCursor([])

    def _sync_filter(self, query):
        if not query:
            return list(self.data)
        results = []
        for d in self.data:
            match = True
            for k, v in query.items():
                if k == "$or" and isinstance(v, list):
                    or_match = False
                    for condition in v:
                        cond_match = all(d.get(ck) == cv for ck, cv in condition.items())
                        if cond_match:
                            or_match = True
                            break
                    if not or_match:
                        match = False
                        break
                elif k == "$text":
                    continue
                elif d.get(k) != v:
                    match = False
                    break
            if match:
                results.append(d)
        return results

    async def _filter(self, query):
        return self._sync_filter(query)

    async def insert_one(self, doc):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = f"mock_{len(self.data) + 1}"
        self.data.append(d)
        return MagicMock(inserted_id=d["_id"])

    async def insert_many(self, docs):
        ids = []
        for d in docs:
            res = await self.insert_one(d)
            ids.append(res.inserted_id)
        return MagicMock(inserted_ids=ids)

    async def delete_many(self, query):
        initial_len = len(self.data)
        to_keep = []
        for d in self.data:
            matched = True
            for k, v in query.items():
                if d.get(k) != v:
                    matched = False
                    break
            if not matched:
                to_keep.append(d)
        self.data = to_keep
        return MagicMock(deleted_count=initial_len - len(self.data))


# ─── 1. Section-Aware Chunking Tests ──────────────────────────────────────────

def test_section_aware_resume_chunking():
    sample_resume = {
        "summary": "Full-stack engineer with 6+ years building distributed cloud platforms.",
        "skills": ["Python", "FastAPI", "MongoDB", "React", "Docker", "AWS"],
        "experience": [
            {
                "title": "Senior Software Engineer",
                "company": "Tech Corp",
                "dates": "2021 - Present",
                "description": "Led backend architecture for payments processing.",
                "responsibilities": [
                    "Engineered real-time settlement pipeline handling 10k TPS",
                    "Reduced p99 database latency by 45% via Redis caching",
                    "Mentored 4 junior engineers on distributed systems",
                ],
            }
        ],
        "education": [
            {
                "degree": "B.Tech in Computer Science",
                "institution": "State University",
                "year": "2020",
                "gpa": "3.9/4.0",
            }
        ],
        "projects": [
            {
                "name": "AI Agent Router",
                "description": "Multi-provider LLM orchestration framework with tool calling.",
                "technologies": ["Python", "FastAPI", "Groq"],
            }
        ],
    }

    chunks = DocumentChunker.chunk_resume(sample_resume, resume_id="res_123")

    # Assert all semantic sections chunked
    section_types = [c["metadata"]["section"] for c in chunks]
    assert "summary" in section_types
    assert "skills" in section_types
    assert "experience" in section_types
    assert "education" in section_types
    assert "projects" in section_types

    # Assert breadcrumbs injected
    exp_chunk = next(c for c in chunks if c["metadata"]["section"] == "experience")
    assert "[Resume > Experience > Senior Software Engineer at Tech Corp" in exp_chunk["text"]
    assert "10k TPS" in exp_chunk["text"]
    assert "Redis caching" in exp_chunk["text"]

    # Assert skills chunk
    skills_chunk = next(c for c in chunks if c["metadata"]["section"] == "skills")
    assert "[Resume > Technical & Core Skills]" in skills_chunk["text"]
    assert "FastAPI" in skills_chunk["text"]


def test_job_description_chunking():
    job_data = {
        "title": "Senior AI Platform Engineer",
        "company": "InnovateAI",
        "location": "San Francisco, CA",
        "description": "We are seeking an experienced AI Platform Engineer to build scalable agentic pipelines.",
        "requirements": [
            "5+ years of experience with Python and FastAPI",
            "Deep understanding of Vector Databases and Hybrid RAG",
            "Experience deploying LLM applications to production",
        ],
    }

    chunks = DocumentChunker.chunk_job_description(job_data, job_id="job_789")
    assert len(chunks) >= 2

    # Check breadcrumb structure
    assert any("[Job Description > Senior AI Platform Engineer at InnovateAI]" in c["text"] for c in chunks)
    req_chunk = next(c for c in chunks if c["metadata"]["section"] == "requirements")
    assert "Hybrid RAG" in req_chunk["text"]


# ─── 2. Reciprocal Rank Fusion Tests ──────────────────────────────────────────

def test_reciprocal_rank_fusion_scoring():
    vec_docs = [
        {"_id": "doc1", "title": "Doc 1"},
        {"_id": "doc2", "title": "Doc 2"},
        {"_id": "doc3", "title": "Doc 3"},
    ]
    bm25_docs = [
        {"_id": "doc2", "title": "Doc 2"},
        {"_id": "doc4", "title": "Doc 4"},
        {"_id": "doc1", "title": "Doc 1"},
    ]

    fused = _reciprocal_rank_fusion(vec_docs, bm25_docs, k=60)

    # doc2 is #2 in vector (1/62) and #1 in bm25 (1/61) -> total = (1/62 + 1/61) ≈ 0.0325
    # doc1 is #1 in vector (1/61) and #3 in bm25 (1/63) -> total = (1/61 + 1/63) ≈ 0.0322
    assert fused[0]["_id"] == "doc2"
    assert fused[1]["_id"] == "doc1"
    assert "_rrf_score" in fused[0]


# ─── 3. Hybrid Retriever & Isolation Tests ────────────────────────────────────

@pytest.mark.asyncio
async def test_hybrid_retriever_multi_tenant_isolation():
    # Setup mock collection with chunks from two tenants
    mock_chunks = [
        {
            "_id": "c1",
            "tenant_id": "tenant_alpha",
            "user_id": "user_alice",
            "source_type": "resume",
            "source_id": "res_a",
            "chunk_index": 0,
            "title": "Alice Experience",
            "text": "Senior Distributed Systems Engineer working with Apache Kafka and Go.",
            "embedding": [0.1] * 768,
            "metadata": {"section": "experience"},
        },
        {
            "_id": "c2",
            "tenant_id": "tenant_beta",
            "user_id": "user_bob",
            "source_type": "resume",
            "source_id": "res_b",
            "chunk_index": 0,
            "title": "Bob Experience",
            "text": "Frontend Specialist building design systems with React and Tailwind.",
            "embedding": [0.1] * 768,
            "metadata": {"section": "experience"},
        },
        {
            "_id": "c3",
            "tenant_id": "tenant_alpha",
            "user_id": "system",
            "source_type": "help_doc",
            "source_id": "help_1",
            "chunk_index": 0,
            "title": "ATS Match Guide",
            "text": "Guidance on optimizing resume keywords for ATS scoring.",
            "embedding": [0.1] * 768,
            "metadata": {"section": "help"},
        },
    ]

    mock_db = MagicMock()
    mock_db.copilot_chunks = AsyncMockCollection(mock_chunks)

    retriever = CopilotRetriever(mock_db)

    # Search as Alice in Tenant Alpha
    results = await retriever.retrieve(
        query="Distributed Systems Kafka",
        tenant_id="tenant_alpha",
        user_id="user_alice",
        top_k_final=5,
        min_rerank_score=0.0,
    )

    # Assert Alice retrieves her own chunk
    result_ids = [r.chunk_id for r in results]
    assert "c1" in result_ids
    # Assert Bob's chunk from Tenant Beta was NOT leaked
    assert "c2" not in result_ids


# ─── 4. Semantic Response Cache Tests ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_semantic_response_cache_hit_and_miss():
    mock_db = MagicMock()
    mock_db.copilot_cache = AsyncMockCollection([])

    cache = SemanticResponseCache(mock_db)
    tenant_id = "tenant_1"
    user_id = "user_42"
    ctx_ver_1 = "v1_resume_hash"

    # Store response in cache
    await cache.set(
        query="What are my top skills?",
        response_text="Based on your resume, your top skills are Python, FastAPI, and MongoDB.",
        tenant_id=tenant_id,
        user_id=user_id,
        context_version=ctx_ver_1,
        citations=[{"source": "resume", "label": "Resume (Skills)"}],
        suggestions=["Rewrite my bullets", "Practice interview"],
    )

    # 1. Exact or near-identical query -> HIT
    hit_res = await cache.get(
        query="What are my top skills?",
        tenant_id=tenant_id,
        user_id=user_id,
        context_version=ctx_ver_1,
    )
    assert hit_res is not None
    assert hit_res["cache_hit"] is True
    assert "Python, FastAPI" in hit_res["text"]
    assert len(hit_res["citations"]) == 1

    # 2. Completely different query -> MISS
    miss_res = await cache.get(
        query="How do I prepare for a live phone screen?",
        tenant_id=tenant_id,
        user_id=user_id,
        context_version=ctx_ver_1,
    )
    assert miss_res is None

    # 3. Resume updated (context_version changes) -> MISS (automatic invalidation)
    ctx_ver_2 = "v2_new_resume_hash"
    invalidated_res = await cache.get(
        query="What are my top skills?",
        tenant_id=tenant_id,
        user_id=user_id,
        context_version=ctx_ver_2,
    )
    assert invalidated_res is None


# ─── 5. Tool Integration Tests ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_retrieve_context_tool_execution():
    mock_chunks = [
        {
            "_id": "chunk_star_1",
            "tenant_id": "tenant_corp",
            "user_id": "user_dev",
            "source_type": "resume",
            "source_id": "res_dev",
            "chunk_index": 0,
            "title": "Experience: Tech Lead at Stripe",
            "text": "Led migration from monolith to microservices achieving 99.99% uptime.",
            "embedding": [0.2] * 768,
            "metadata": {"section": "experience", "company": "Stripe"},
        }
    ]

    mock_db = MagicMock()
    mock_db.copilot_chunks = AsyncMockCollection(mock_chunks)

    ctx = ToolExecutionContext(
        tenant_id="tenant_corp",
        user_id="user_dev",
        user_name="Dev Candidate",
        trace_id="tr_test",
        session_id="sess_test",
        db=mock_db,
    )

    tool = RetrieveContextTool()
    result = await tool.execute(ctx, RetrieveContextArgs(query="microservices migration Stripe"))

    assert result.ok is True
    assert result.citation is not None
    assert result.citation["source"] == "resume"
    assert "chunk_star_1" in [c["chunk_id"] for c in result.data["chunks"]]


@pytest.mark.asyncio
async def test_search_resume_hybrid_rag_with_citation():
    mock_chunks = [
        {
            "_id": "chunk_res_1",
            "tenant_id": "tenant_test",
            "user_id": "user_test",
            "source_type": "resume",
            "source_id": "res_1",
            "chunk_index": 0,
            "title": "Technical Skills Overview",
            "text": "Core Technical & Professional Skills: Python, LangChain, PyTorch, Kubernetes",
            "embedding": [0.1] * 768,
            "metadata": {"section": "skills"},
        }
    ]

    mock_db = MagicMock()
    mock_db.copilot_chunks = AsyncMockCollection(mock_chunks)

    mock_resume = MagicMock()
    mock_resume.raw_text = "Python, LangChain, PyTorch, Kubernetes"
    mock_resume.skills = ["Python", "LangChain"]
    mock_resume_repo = MagicMock()
    mock_resume_repo.get_latest_by_user = AsyncMock(return_value=mock_resume)

    ctx = ToolExecutionContext(
        tenant_id="tenant_test",
        user_id="user_test",
        user_name="Candidate",
        trace_id="tr_1",
        session_id="s_1",
        db=mock_db,
        resume_repo=mock_resume_repo,
    )

    tool = SearchResumeTool()
    result = await tool.execute(ctx, SearchResumeArgs(query="LangChain PyTorch"))

    assert result.ok is True
    assert result.citation is not None
    assert "Resume" in result.citation["label"]
    assert "chunks" in result.data
