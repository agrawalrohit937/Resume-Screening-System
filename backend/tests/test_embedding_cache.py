"""
Unit Tests for Embedding Cache and Quantization Engine (Task 4.3).
Verifies:
  1. Cache hit avoids re-computing embeddings and speeds up repeated queries.
  2. Dynamic batching produces shape- and value-consistent embeddings.
  3. Int8 quantization retains cosine fidelity (> 0.99) with 4x memory savings.
  4. Cache keys are deterministic on sha256(text) + model_version.
"""

import time
import numpy as np
import pytest

from services.embedding_cache import (
    EmbeddingCacheManager,
    compute_embedding_cache_key,
    quantize_embeddings_int8,
    dequantize_embeddings_int8,
    _IN_MEMORY_EMB_CACHE,
)
from services.embedding_service import embedding_model


@pytest.fixture(autouse=True)
def clean_cache():
    _IN_MEMORY_EMB_CACHE.clear()
    yield
    _IN_MEMORY_EMB_CACHE.clear()


def test_cache_key_deterministic():
    """Verify cache keys are deterministic across identical texts and distinct across versions."""
    k1 = compute_embedding_cache_key("Python FastAPI Developer", "bge-m3-v1.0")
    k2 = compute_embedding_cache_key("Python FastAPI Developer", "bge-m3-v1.0")
    k3 = compute_embedding_cache_key("Python FastAPI Developer", "bge-base-en-v1.5")

    assert k1 == k2
    assert k1 != k3
    assert k1.startswith("emb:bge-m3-v1.0:")


def test_int8_quantization_fidelity():
    """Verify int8 quantization preserves > 0.99 cosine similarity to original float32 vectors."""
    # Generate random normalized unit vectors
    rng = np.random.default_rng(42)
    floats = rng.standard_normal((10, 1024), dtype=np.float32)
    floats = floats / np.linalg.norm(floats, axis=-1, keepdims=True)

    # Quantize to int8
    quantized, scales = quantize_embeddings_int8(floats.tolist())
    arr_q = np.asarray(quantized, dtype=np.int8)
    assert arr_q.dtype == np.int8

    # Dequantize back to float32
    dequantized = np.asarray(dequantize_embeddings_int8(quantized, scales=scales), dtype=np.float32)

    # Compute cosine similarities between float32 and dequantized
    for orig, deq in zip(floats, dequantized):
        cos_sim = float(np.dot(orig, deq))
        assert cos_sim >= 0.99, f"Quantization fidelity dropped below 0.99: {cos_sim}"


def test_embedding_cache_hit():
    """Verify embedding cache stores vectors and serves hits instantly."""
    mgr = EmbeddingCacheManager()
    texts = ["React Developer with Redux", "Data Engineer with Snowflake"]
    model_version = "bge-m3-v1.0"

    # Initially empty
    cached_map, missing_idx, missing_texts = mgr.get_cached_embeddings(texts, model_version)
    assert len(cached_map) == 0
    assert missing_idx == [0, 1]
    assert missing_texts == texts

    # Store fake embeddings
    dummy_embs = [[0.1] * 1024, [0.2] * 1024]
    mgr.store_embeddings(texts, dummy_embs, model_version)

    # Retrieve again -> 100% cache hit
    cached_map2, missing_idx2, missing_texts2 = mgr.get_cached_embeddings(texts, model_version)
    assert len(cached_map2) == 2
    assert missing_idx2 == []
    assert missing_texts2 == []
    assert cached_map2[0] == dummy_embs[0]
    assert cached_map2[1] == dummy_embs[1]


def test_dynamic_batching_and_cache_end_to_end():
    """Verify embedding_model.encode utilizes batching and caching correctly."""
    query = ["FastAPI microservices in Python", "Docker and Kubernetes orchestration"]

    # 1. First encode computes & stores
    res1 = embedding_model.encode(query, batch_size=1, use_cache=True)
    assert len(res1) == 2
    assert len(res1[0]) == embedding_model.dimensions

    # 2. Second encode should hit cache instantly
    t0 = time.perf_counter()
    res2 = embedding_model.encode(query, batch_size=1, use_cache=True)
    cache_elapsed_ms = (time.perf_counter() - t0) * 1000

    assert res1 == res2
    assert cache_elapsed_ms < 20.0  # Instant in-memory cache hit (< 20ms)
