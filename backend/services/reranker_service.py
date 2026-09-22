"""
Cross-Encoder Reranker Service.

Phase 1.3:
- Provides thread-safe Singleton for local CrossEncoder (`BAAI/bge-reranker-v2-m3`).
- Applies token-level bidirectional cross-attention on top-50 items after first-stage vector retrieval.
- Input pairs are formatted deterministically as (requirement_digest, candidate_evidence_digest) capped at 512 tokens.
- Guarded behind FEATURE_CROSS_ENCODER_RERANK feature flag.
- Batch size 16 on CPU with latency monitoring (auto-throttles to top-25 if > 400ms).
"""

from __future__ import annotations

import os
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import structlog

from core.feature_flags import FEATURE_CROSS_ENCODER_RERANK

logger = structlog.get_logger(__name__)

RERANKER_MODEL_NAME = os.getenv("LOCAL_RERANKER_MODEL", "BAAI/bge-reranker-v2-m3")
FALLBACK_RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"
DEFAULT_DEVICE = os.getenv("RERANKER_DEVICE", "cpu")
MAX_TOKEN_LENGTH = 512
MAX_RERANK_CANDIDATES = 50
FALLBACK_RERANK_CANDIDATES = 25
LATENCY_BUDGET_MS = 400


class RerankerServiceSingleton:
    """
    Thread-Safe Singleton for Cross-Encoder model.
    Lazy loads upon first rerank call.
    """

    _instance: Optional[RerankerServiceSingleton] = None
    _lock: threading.Lock = threading.Lock()

    def __new__(cls, *args, **kwargs) -> RerankerServiceSingleton:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(RerankerServiceSingleton, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(
        self,
        model_name: str = RERANKER_MODEL_NAME,
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
            self._loaded = False
            self._max_candidates = MAX_RERANK_CANDIDATES
            self._initialized = True

    def _ensure_loaded(self) -> None:
        if self._loaded:
            return

        with self._lock:
            if self._loaded:
                return

            logger.info("Loading cross-encoder reranker model", model_name=self.model_name, device=self.device)
            t0 = time.perf_counter()

            try:
                from sentence_transformers import CrossEncoder

                try:
                    self.model = CrossEncoder(
                        self.model_name,
                        max_length=MAX_TOKEN_LENGTH,
                        device=self.device,
                    )
                except Exception as load_err:
                    if self.model_name != FALLBACK_RERANKER_MODEL:
                        logger.warning(
                            "Primary reranker model failed to load; attempting fallback model",
                            primary=self.model_name,
                            fallback=FALLBACK_RERANKER_MODEL,
                            error=str(load_err),
                        )
                        self.model = CrossEncoder(
                            FALLBACK_RERANKER_MODEL,
                            max_length=MAX_TOKEN_LENGTH,
                            device=self.device,
                        )
                        self.model_name = FALLBACK_RERANKER_MODEL
                    else:
                        raise load_err

                load_ms = int((time.perf_counter() - t0) * 1000)
                logger.info("Cross-encoder reranker model loaded successfully", model_name=self.model_name, load_time_ms=load_ms)

            except ImportError:
                logger.warning("sentence_transformers CrossEncoder not available. Running in pass-through mode.")
                self.model = None
            except Exception as e:
                logger.error("Failed to load cross-encoder reranker", error=str(e))
                self.model = None
            finally:
                self._loaded = True

    def rerank_pairs(self, pairs: List[Tuple[str, str]]) -> List[float]:
        """
        Computes relevance scores for a list of (query, document) pairs.
        Returns raw float logits / scores normalized to [0.0, 1.0].
        """
        if not pairs:
            return []

        self._ensure_loaded()

        if self.model is None:
            return [0.5] * len(pairs)

        t0 = time.perf_counter()
        try:
            scores = self.model.predict(
                pairs,
                batch_size=16,
                show_progress_bar=False,
            )
            elapsed_ms = int((time.perf_counter() - t0) * 1000)

            # Auto-throttle candidates if latency exceeds budget
            if elapsed_ms > LATENCY_BUDGET_MS:
                logger.warning(
                    "Cross-encoder latency exceeded budget, reducing top candidate count",
                    elapsed_ms=elapsed_ms,
                    current_max=self._max_candidates,
                    new_max=FALLBACK_RERANK_CANDIDATES,
                )
                self._max_candidates = FALLBACK_RERANK_CANDIDATES

            # Convert numpy array / floats to normalized list
            res: List[float] = []
            for s in scores:
                val = float(s)
                # Apply sigmoid if model outputs logits (e.g. range [-10, 10])
                if val < 0.0 or val > 1.0:
                    val = 1.0 / (1.0 + float(2.718281828459045 ** (-val)))
                res.append(round(min(1.0, max(0.0, val)), 4))
            return res

        except Exception as e:
            logger.error("Cross-encoder predict failed, returning neutral scores", error=str(e))
            return [0.5] * len(pairs)

    def rerank_candidate_jobs(
        self,
        candidate_summary: str,
        jobs: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Reranks top candidate jobs using cross-attention if FEATURE_CROSS_ENCODER_RERANK is enabled.
        """
        if not jobs:
            return []

        if not FEATURE_CROSS_ENCODER_RERANK:
            return jobs

        top_candidates = jobs[:self._max_candidates]
        tail_candidates = jobs[self._max_candidates:]

        pairs = [
            (
                str(job.get("jd_text_raw") or job.get("title") or "")[:512],
                candidate_summary[:512],
            )
            for job in top_candidates
        ]

        scores = self.rerank_pairs(pairs)

        for job, rerank_score in zip(top_candidates, scores):
            job["reranker_score"] = round(rerank_score * 100.0, 1)
            # Blend 70% base match score + 30% reranker score
            base_score = float(job.get("match_score", 50.0))
            blended = round(base_score * 0.70 + (rerank_score * 100.0) * 0.30, 1)
            job["match_score"] = blended

        top_candidates.sort(key=lambda j: j.get("match_score", 0.0), reverse=True)
        return top_candidates + tail_candidates


def get_reranker_service() -> RerankerServiceSingleton:
    return RerankerServiceSingleton()


reranker_service = get_reranker_service()
