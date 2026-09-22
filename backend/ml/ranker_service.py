"""
LTR Ranker Inference Service and Shadow Mode Runner.
Dispatches prediction to per-occupation-family XGBoost rankers, computes feature vectors,
and logs shadow rankings without disrupting production user scores.
"""

from pathlib import Path
import threading
from typing import Any, Dict, List, Optional
import numpy as np
import structlog

from ml.train_ranker import LTR_FEATURE_NAMES
from core.feature_flags import FEATURE_LTR_RANKER

logger = structlog.get_logger(__name__)

MODELS_DIR = Path(__file__).resolve().parent / "models"


class LTRRankerService:
    """
    Inference service for Learning-to-Rank models.

    Complexity:
        Time: O(N_trees * depth) per inference (typically < 2ms on CPU).
        Space: O(1) in-memory model cache.
    """

    def __init__(self):
        self._models: Dict[str, Any] = {}
        self._lock = threading.Lock()

    def _get_model(self, family_code: str) -> Optional[Any]:
        fam = (family_code or "generic").strip().lower()
        if fam in self._models:
            return self._models[fam]

        with self._lock:
            if fam in self._models:
                return self._models[fam]

            model_path = MODELS_DIR / f"{fam}_ranker.json"
            if not model_path.exists():
                model_path = MODELS_DIR / "global_ranker.json"

            if not model_path.exists():
                return None

            try:
                import xgboost as xgb
                ranker = xgb.XGBRanker()
                ranker.load_model(str(model_path))
                self._models[fam] = ranker
                logger.info("Loaded LTR model", family=fam, path=str(model_path))
                return ranker
            except Exception as e:
                logger.warning("Failed loading LTR model", family=fam, error=str(e))
                return None

    def predict_rank_score(
        self,
        features_dict: Dict[str, Any],
        occupation_family: str = "generic",
    ) -> Optional[float]:
        """
        Predicts an ordinal ranking score from a ScoringFeatures dictionary.
        Returns None if no trained model exists (falls back to deterministic engine).
        """
        model = self._get_model(occupation_family)
        if model is None:
            return None

        # Build feature vector
        row = []
        for fname in LTR_FEATURE_NAMES:
            val = features_dict.get(fname, 0.0)
            if isinstance(val, bool):
                row.append(1.0 if val else 0.0)
            elif isinstance(val, (int, float)):
                row.append(float(val))
            else:
                row.append(0.0)

        vec = np.array([row], dtype=np.float32)
        try:
            preds = model.predict(vec)
            return float(preds[0])
        except Exception as e:
            logger.debug("Prediction failed in LTR ranker", error=str(e))
            return None

    async def log_shadow_ranking(
        self,
        job_id: str,
        candidate_id: str,
        deterministic_quality_score: float,
        features_dict: Dict[str, Any],
        occupation_family: str = "generic",
        db: Any = None,
    ):
        """
        Executes shadow mode when FEATURE_LTR_RANKER is active.
        Computes LTR score in parallel and writes to db.shadow_scores for offline audit.
        Zero user-visible effect.
        """
        if not FEATURE_LTR_RANKER:
            return

        ltr_score = self.predict_rank_score(features_dict, occupation_family)
        if ltr_score is None:
            return

        shadow_record = {
            "job_id": str(job_id),
            "candidate_id": str(candidate_id),
            "deterministic_quality_score": float(deterministic_quality_score),
            "shadow_ltr_score": float(ltr_score),
            "occupation_family": occupation_family,
            "feature_schema_version": features_dict.get("feature_schema_version", "1.0.0"),
        }

        if db is not None:
            try:
                await db.shadow_scores.insert_one(shadow_record)
            except Exception as e:
                logger.debug("Failed logging shadow score", error=str(e))


# Global singleton service
ltr_ranker_service = LTRRankerService()
