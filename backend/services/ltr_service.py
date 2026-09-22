"""
Learned-to-Rank (LTR) Serving Service (Phase 7).
Loads trained LambdaMART model and generates calibrated candidate match predictions in [0.0, 100.0].
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
import structlog

from train_ltr import MODEL_PATH, extract_ltr_feature_vector

logger = structlog.get_logger(__name__)


class LTRService:
    """Singleton service for LTR model inference and score calibration."""

    def __init__(self, model_path: Optional[Path] = None):
        self.model_path = model_path or MODEL_PATH
        self.booster = None
        self._load_model()

    def _load_model(self):
        if self.model_path.exists():
            try:
                import lightgbm as lgb
                self.booster = lgb.Booster(model_file=str(self.model_path))
                logger.info("LTR Booster loaded successfully", model_path=str(self.model_path))
            except Exception as e:
                logger.warning("Failed to load LTR Booster", error=str(e))
                self.booster = None

    def predict_score(self, features_dict: Dict[str, Any]) -> Optional[float]:
        """
        Generates calibrated match score in [0.0, 100.0] from feature dict.
        Returns None if model is unavailable.
        """
        if self.booster is None:
            self._load_model()
            if self.booster is None:
                return None

        try:
            vec = extract_ltr_feature_vector(features_dict)
            X = np.array([vec], dtype=np.float32)
            raw_pred = float(self.booster.predict(X)[0])
            # Calibrate raw LambdaMART score to 0-100 range via sigmoid/min-max
            calibrated = 100.0 / (1.0 + np.exp(-raw_pred))
            return round(float(np.clip(calibrated, 0.0, 100.0)), 1)
        except Exception as e:
            logger.debug("LTR prediction failed", error=str(e))
            return None


ltr_service = LTRService()
