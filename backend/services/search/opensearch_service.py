"""
OpenSearch / Elasticsearch Sidecar Service — Distributed Native BM25 & Full-Text Search.
=======================================================================================
Provides production-scale native BM25 sparse search with strict multi-tenant
filtering, custom index analyzers, and document lifecycle operations.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional
import httpx
import structlog
from core.feature_flags import FEATURE_OPENSEARCH_HYBRID

logger = structlog.get_logger(__name__)


class OpenSearchService:
    """
    Async client for OpenSearch / Elasticsearch cluster sidecar.
    """

    CHUNKS_INDEX = "careershala_chunks"
    JOBS_INDEX = "careershala_jobs"

    def __init__(
        self,
        base_url: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        timeout: float = 3.0,
    ):
        self.base_url = (base_url or os.getenv("OPENSEARCH_URL") or os.getenv("ELASTICSEARCH_URL") or "http://localhost:9200").rstrip("/")
        self.username = username or os.getenv("OPENSEARCH_USER") or os.getenv("ELASTICSEARCH_USER")
        self.password = password or os.getenv("OPENSEARCH_PASSWORD") or os.getenv("ELASTICSEARCH_PASSWORD")
        self.timeout = timeout
        self._auth = (self.username, self.password) if (self.username and self.password) else None
        self._is_available: Optional[bool] = None

    async def _get_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.base_url,
            auth=self._auth,
            timeout=self.timeout,
            headers={"Content-Type": "application/json"},
        )

    async def ping(self) -> bool:
        """Checks if OpenSearch cluster is reachable and healthy."""
        try:
            async with await self._get_client() as client:
                res = await client.get("/")
                self._is_available = (res.status_code == 200)
                return self._is_available
        except Exception as e:
            logger.debug("OpenSearch ping failed", error=str(e), url=self.base_url)
            self._is_available = False
            return False

    def is_healthy(self) -> bool:
        from core import feature_flags
        return bool(feature_flags.FEATURE_OPENSEARCH_HYBRID and (self._is_available is not False))

    async def ensure_indices(self) -> None:
        """Initializes index mappings with BM25 similarity (k1=1.5, b=0.75)."""
        chunks_mapping = {
            "settings": {
                "index": {
                    "similarity": {
                        "custom_bm25": {
                            "type": "BM25",
                            "k1": 1.5,
                            "b": 0.75,
                        }
                    }
                }
            },
            "mappings": {
                "properties": {
                    "chunk_id": {"type": "keyword"},
                    "tenant_id": {"type": "keyword"},
                    "user_id": {"type": "keyword"},
                    "resume_id": {"type": "keyword"},
                    "job_id": {"type": "keyword"},
                    "section_type": {"type": "keyword"},
                    "source_type": {"type": "keyword"},
                    "text": {
                        "type": "text",
                        "similarity": "custom_bm25",
                        "analyzer": "standard",
                    },
                    "metadata": {"type": "object", "enabled": True},
                    "created_at": {"type": "date"},
                }
            },
        }

        jobs_mapping = {
            "settings": {
                "index": {
                    "similarity": {
                        "custom_bm25": {
                            "type": "BM25",
                            "k1": 1.5,
                            "b": 0.75,
                        }
                    }
                }
            },
            "mappings": {
                "properties": {
                    "job_id": {"type": "keyword"},
                    "tenant_id": {"type": "keyword"},
                    "title": {"type": "text", "similarity": "custom_bm25"},
                    "description": {"type": "text", "similarity": "custom_bm25"},
                    "department": {"type": "keyword"},
                    "skills": {"type": "keyword"},
                    "status": {"type": "keyword"},
                    "created_at": {"type": "date"},
                }
            },
        }

        try:
            async with await self._get_client() as client:
                for idx_name, mapping in [(self.CHUNKS_INDEX, chunks_mapping), (self.JOBS_INDEX, jobs_mapping)]:
                    res = await client.head(f"/{idx_name}")
                    if res.status_code == 404:
                        create_res = await client.put(f"/{idx_name}", json=mapping)
                        logger.info("Created OpenSearch index", index=idx_name, status=create_res.status_code)
        except Exception as e:
            logger.warning("Failed ensuring OpenSearch indices", error=str(e))

    async def index_chunk(self, chunk_data: Dict[str, Any]) -> bool:
        """Indexes a single section chunk with strict tenant scoping."""
        chunk_id = str(chunk_data.get("chunk_id") or chunk_data.get("_id") or chunk_data.get("id"))
        try:
            async with await self._get_client() as client:
                res = await client.put(
                    f"/{self.CHUNKS_INDEX}/_doc/{chunk_id}",
                    json=chunk_data,
                )
                return res.status_code in (200, 201)
        except Exception as e:
            logger.warning("Failed indexing chunk in OpenSearch", chunk_id=chunk_id, error=str(e))
            return False

    async def bulk_index_chunks(self, chunks: List[Dict[str, Any]]) -> int:
        """Bulk indexes section chunks using the NDJSON bulk endpoint."""
        if not chunks:
            return 0
        lines = []
        for c in chunks:
            cid = str(c.get("chunk_id") or c.get("_id") or c.get("id"))
            lines.append(f'{{"index": {{"_index": "{self.CHUNKS_INDEX}", "_id": "{cid}"}}}}')
            import json
            lines.append(json.dumps(c))
        body = "\n".join(lines) + "\n"

        try:
            async with await self._get_client() as client:
                res = await client.post(
                    "/_bulk",
                    content=body,
                    headers={"Content-Type": "application/x-ndjson"},
                )
                if res.status_code == 200:
                    data = res.json()
                    return len(data.get("items", []))
        except Exception as e:
            logger.warning("OpenSearch bulk index failed", error=str(e), count=len(chunks))
        return 0

    async def search_chunks(
        self,
        query_text: str,
        tenant_id: str,
        user_id: str,
        source_type: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Executes native BM25 search over resume section chunks.
        Strictly enforces tenant_id and user_id ownership via boolean filter context.
        """
        tenant_id = tenant_id or "default"

        filter_clauses: List[Dict[str, Any]] = [
            {"term": {"tenant_id": tenant_id}},
            {
                "bool": {
                    "should": [
                        {"term": {"user_id": user_id}},
                        {"term": {"user_id": "system"}},
                    ],
                    "minimum_should_match": 1,
                }
            },
        ]
        if source_type:
            filter_clauses.append({"term": {"source_type": source_type}})

        search_body = {
            "size": limit,
            "query": {
                "bool": {
                    "must": [
                        {
                            "match": {
                                "text": {
                                    "query": query_text,
                                    "fuzziness": "AUTO",
                                }
                            }
                        }
                    ],
                    "filter": filter_clauses,
                }
            },
        }

        try:
            async with await self._get_client() as client:
                res = await client.post(f"/{self.CHUNKS_INDEX}/_search", json=search_body)
                if res.status_code == 200:
                    hits = res.json().get("hits", {}).get("hits", [])
                    results = []
                    for h in hits:
                        source = h.get("_source", {})
                        source["_id"] = h.get("_id")
                        source["_bm25_score"] = float(h.get("_score") or 0.0)
                        results.append(source)
                    return results
        except Exception as e:
            logger.warning("OpenSearch search_chunks failed, falling back to local search", error=str(e))
        return []

    async def delete_by_resume(self, resume_id: str, tenant_id: str) -> int:
        """Deletes all indexed chunks associated with a deleted resume."""
        body = {
            "query": {
                "bool": {
                    "filter": [
                        {"term": {"tenant_id": tenant_id}},
                        {"term": {"resume_id": resume_id}},
                    ]
                }
            }
        }
        try:
            async with await self._get_client() as client:
                res = await client.post(f"/{self.CHUNKS_INDEX}/_delete_by_query", json=body)
                if res.status_code == 200:
                    return res.json().get("deleted", 0)
        except Exception as e:
            logger.warning("Failed deleting resume chunks in OpenSearch", resume_id=resume_id, error=str(e))
        return 0

    async def delete_by_tenant(self, tenant_id: str) -> int:
        """Offboarding cleanup: purges all chunks and jobs belonging to a tenant."""
        body = {
            "query": {
                "term": {"tenant_id": tenant_id}
            }
        }
        total_deleted = 0
        try:
            async with await self._get_client() as client:
                for idx in [self.CHUNKS_INDEX, self.JOBS_INDEX]:
                    res = await client.post(f"/{idx}/_delete_by_query", json=body)
                    if res.status_code == 200:
                        total_deleted += res.json().get("deleted", 0)
        except Exception as e:
            logger.warning("Failed purging tenant data in OpenSearch", tenant_id=tenant_id, error=str(e))
        return total_deleted


# Global singleton instance
opensearch_service = OpenSearchService()
