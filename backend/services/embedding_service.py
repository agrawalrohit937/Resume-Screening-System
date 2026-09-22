"""
Embedding Service — Local Multilingual BGE Embeddings & Vector Operations.

Provides thread-safe Singleton local embedding model: `BAAI/bge-m3` (or configurable model) via `sentence-transformers`.
- Multilingual CPU execution with zero external API dependencies.
- Configurable model name, dimensions (e.g., 1024 for bge-m3, 768 for bge-base-en-v1.5), and versioning.
- Model version stamping and compatibility assertion preventing cross-version vector dot products.
- Lazy model loading so module import never blocks application startup.
"""

from __future__ import annotations

import os
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

import structlog

logger = structlog.get_logger(__name__)

# Configurable embedding parameters (Phase 1.1)
EMBEDDING_MODEL_NAME = os.getenv("LOCAL_EMBEDDING_MODEL", "BAAI/bge-m3")
FALLBACK_MODEL_NAME = "BAAI/bge-base-en-v1.5"
DEFAULT_DEVICE = os.getenv("EMBEDDING_DEVICE", "cpu")
DEFAULT_DIMENSIONS = int(os.getenv("EMBEDDING_DIMENSIONS", "1024" if "bge-m3" in EMBEDDING_MODEL_NAME else "768"))
EMBEDDING_MODEL_VERSION = os.getenv("EMBEDDING_MODEL_VERSION", "bge-m3-v1.0" if "bge-m3" in EMBEDDING_MODEL_NAME else "bge-base-en-v1.5")
EMBEDDING_DIMENSIONS = DEFAULT_DIMENSIONS


def assert_vector_compatibility(
    version_a: Optional[str] = None,
    version_b: Optional[str] = None,
    len_a: Optional[int] = None,
    len_b: Optional[int] = None,
) -> None:
    """
    Asserts that two embedding vectors originate from compatible model versions and dimensions.
    Raises ValueError on mismatch to prevent corrupt similarity calculations.
    """
    if len_a is not None and len_b is not None and len_a != len_b:
        raise ValueError(
            f"Embedding dimension mismatch: vector A ({len_a} dims) vs vector B ({len_b} dims). Cross-dimension calculation is invalid."
        )
    if version_a and version_b and version_a != version_b:
        raise ValueError(
            f"Embedding model version mismatch: '{version_a}' vs '{version_b}'. Never compare vectors across model versions."
        )


# ══════════════════════════════════════════════════════════════════════════
# 1. LOCAL EMBEDDING MODEL SINGLETON (LAZY LOADING)
# ══════════════════════════════════════════════════════════════════════════

class EmbeddingModelSingleton:
    """
    Thread-Safe Singleton for the Local SentenceTransformer Embedding Model.
    Uses lazy loading on first access so imports remain instant.
    """

    _instance: Optional[EmbeddingModelSingleton] = None
    _lock: threading.Lock = threading.Lock()

    def __new__(cls, *args, **kwargs) -> EmbeddingModelSingleton:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(EmbeddingModelSingleton, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(
        self,
        model_name: str = EMBEDDING_MODEL_NAME,
        device: str = DEFAULT_DEVICE,
    ):
        if getattr(self, "_initialized", False):
            return

        with self._lock:
            if getattr(self, "_initialized", False):
                return

            self.model_name = model_name
            self.device = device
            self.model = None
            self.dimensions = EMBEDDING_DIMENSIONS
            self.model_version = EMBEDDING_MODEL_VERSION
            self._loaded = False
            self._initialized = True

    def _ensure_loaded(self) -> None:
        """Lazy loads the model on CPU upon first encode call."""
        if self._loaded:
            return

        with self._lock:
            if self._loaded:
                return

            logger.info(
                "Loading local embedding model",
                model_name=self.model_name,
                device=self.device,
            )
            t0 = time.perf_counter()

            try:
                from sentence_transformers import SentenceTransformer

                try:
                    self.model = SentenceTransformer(self.model_name, device=self.device)
                except Exception as primary_err:
                    if self.model_name != FALLBACK_MODEL_NAME:
                        logger.warning(
                            "Primary embedding model failed to load; attempting local fallback model",
                            primary_model=self.model_name,
                            fallback_model=FALLBACK_MODEL_NAME,
                            error=str(primary_err),
                        )
                        self.model = SentenceTransformer(FALLBACK_MODEL_NAME, device=self.device)
                        self.model_name = FALLBACK_MODEL_NAME
                        self.model_version = "bge-base-en-v1.5"
                    else:
                        raise primary_err

                load_ms = int((time.perf_counter() - t0) * 1000)

                # Dynamically set dimensions from loaded model
                try:
                    self.dimensions = self.model.get_sentence_embedding_dimension()
                except Exception:
                    self.dimensions = DEFAULT_DIMENSIONS

                # Warmup call with dummy text
                tw0 = time.perf_counter()
                _ = self.model.encode(
                    ["warmup query for multilingual embedding initialization"],
                    normalize_embeddings=True,
                )
                warmup_ms = int((time.perf_counter() - tw0) * 1000)

                logger.info(
                    "Local embedding model loaded and warmed up successfully",
                    model_name=self.model_name,
                    model_version=self.model_version,
                    dimensions=self.dimensions,
                    load_time_ms=load_ms,
                    warmup_time_ms=warmup_ms,
                )

            except ImportError:
                logger.warning(
                    "sentence_transformers library not installed. Embedding model in fallback mode."
                )
                self.model = None
            except Exception as e:
                logger.error("Failed to load local embedding model", error=str(e))
                self.model = None
            finally:
                self._loaded = True

    def encode(
        self,
        texts: List[str],
        batch_size: int = 32,
        use_cache: bool = True,
    ) -> List[List[float]]:
        """
        Generates normalized embeddings for a batch of strings with dynamic batching and caching.
        Returns list of float arrays per text.

        Complexity:
            Time: O(N_uncached * D) embedding compute; O(1) per cached text.
            Space: O(N * D) embedding matrix.
        """
        if not texts:
            return []

        self._ensure_loaded()

        from services.embedding_cache import embedding_cache

        # 1. Caching lookup
        if use_cache:
            cached_map, missing_indices, missing_texts = embedding_cache.get_cached_embeddings(
                texts, self.model_version
            )
            if not missing_texts:
                return [cached_map[i] for i in range(len(texts))]
        else:
            cached_map = {}
            missing_indices = list(range(len(texts)))
            missing_texts = texts

        newly_computed: List[List[float]] = []

        if self.model is not None:
            try:
                # 2. Dynamic batching to prevent CPU thread saturation during spikes
                for b_start in range(0, len(missing_texts), batch_size):
                    chunk = missing_texts[b_start : b_start + batch_size]
                    chunk_embs = self.model.encode(
                        chunk,
                        normalize_embeddings=True,
                        show_progress_bar=False,
                    )
                    newly_computed.extend(chunk_embs.tolist())

                # 3. Store newly computed in cache (30-day TTL)
                if use_cache and newly_computed:
                    embedding_cache.store_embeddings(missing_texts, newly_computed, self.model_version)

                # 4. Assemble final embeddings in original order
                for idx, emb in zip(missing_indices, newly_computed):
                    cached_map[idx] = emb

                return [cached_map[i] for i in range(len(texts))]

            except Exception as e:
                logger.error("Local embedding encoding failed", error=str(e))

        # Fallback zero-vectors
        logger.warning(
            "Generating fallback zero-vectors",
            dimensions=self.dimensions,
            model_version=self.model_version,
        )
        for idx in missing_indices:
            cached_map[idx] = [0.0] * self.dimensions
        return [cached_map[i] for i in range(len(texts))]

    def get_embedding_dimension(self) -> int:
        """Returns the embedding vector dimension."""
        self._ensure_loaded()
        return self.dimensions

    def get_sentence_embedding_dimension(self) -> int:
        """Alias for get_embedding_dimension."""
        return self.get_embedding_dimension()


def get_embedding_model() -> EmbeddingModelSingleton:
    """Returns the thread-safe EmbeddingModelSingleton instance."""
    return EmbeddingModelSingleton()


# Global singleton access
embedding_model = get_embedding_model()


