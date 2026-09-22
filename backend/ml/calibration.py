"""
Probability Calibration Engine for CareerPilot ATS.
Maps raw multi-factor ATS scores (0-100) to calibrated probabilities of candidate shortlisting:
    P(advance_past_screening | raw_score) ∈ [0.0, 1.0]
using Isotonic Regression (non-parametric) and Platt Scaling (parametric logistic).
"""

from pathlib import Path
import json
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import structlog
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression

logger = structlog.get_logger(__name__)

CALIBRATION_MODEL_PATH = Path(__file__).resolve().parent / "models" / "calibrator.json"


def compute_ece(
    predicted_probs: np.ndarray,
    true_labels: np.ndarray,
    n_bins: int = 10,
) -> float:
    """
    Computes Expected Calibration Error (ECE) across uniform confidence bins.

    Formula:
        ECE = Σ_{b=1}^B (|B_b| / N) * |acc(B_b) - conf(B_b)|

    Complexity:
        Time: O(N_samples)
        Space: O(n_bins)
    """
    if len(predicted_probs) == 0:
        return 0.0

    preds = np.clip(np.array(predicted_probs, dtype=np.float64), 0.0, 1.0)
    trues = np.array(true_labels, dtype=np.float64)
    total_n = len(preds)

    bin_boundaries = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0

    for i in range(n_bins):
        bin_low = bin_boundaries[i]
        bin_high = bin_boundaries[i + 1]

        if i == n_bins - 1:
            mask = (preds >= bin_low) & (preds <= bin_high)
        else:
            mask = (preds >= bin_low) & (preds < bin_high)

        bin_count = np.sum(mask)
        if bin_count > 0:
            bin_acc = np.mean(trues[mask])
            bin_conf = np.mean(preds[mask])
            ece += (bin_count / total_n) * abs(bin_acc - bin_conf)

    return float(round(ece, 4))


class ScoreCalibrator:
    """
    Calibrates raw ATS quality scores to true empirical shortlisting probabilities.

    Complexity:
        Training:
            Isotonic: O(N log N) via Pool Adjacent Violators Algorithm (PAVA).
            Platt Scaling: O(N * D) via Newton-Raphson / L-BFGS.
        Inference:
            O(log N_thresholds) binary search lookup (< 10 μs).
    """

    def __init__(self, method: str = "isotonic"):
        self.method = method.lower()
        self.is_fitted = False
        self.isotonic_model: Optional[IsotonicRegression] = None
        self.platt_model: Optional[LogisticRegression] = None
        self.ece_score: float = 0.0

    def fit(self, raw_scores: List[float], labels: List[int]) -> float:
        """
        Fits calibration model from raw scores (0-100) to binary outcomes (0: rejected, 1: shortlisted).
        Returns the resulting Expected Calibration Error (ECE).
        """
        if len(raw_scores) < 4:
            logger.warning("Too few samples to fit calibrator; using default sigmoid")
            self.is_fitted = False
            return 0.0

        X = np.array(raw_scores, dtype=np.float64)
        y = np.array(labels, dtype=np.float64)

        if self.method == "isotonic":
            # out_of_bounds="clip" prevents extrapolation anomalies
            self.isotonic_model = IsotonicRegression(y_min=0.0, y_max=1.0, out_of_bounds="clip")
            self.isotonic_model.fit(X, y)
            preds = self.isotonic_model.predict(X)
        else:
            # Platt Scaling (logistic regression)
            self.platt_model = LogisticRegression(C=1.0, solver="lbfgs")
            self.platt_model.fit(X.reshape(-1, 1), y)
            preds = self.platt_model.predict_proba(X.reshape(-1, 1))[:, 1]

        self.is_fitted = True
        self.ece_score = compute_ece(preds, y, n_bins=10)
        logger.info("Calibrator fitted successfully", method=self.method, ece=self.ece_score)
        return self.ece_score

    def predict_probability(self, raw_score: float) -> float:
        """
        Maps a single raw ATS score (0.0 - 100.0) to calibrated P(advance).
        """
        score = float(max(0.0, min(100.0, raw_score)))

        if not self.is_fitted:
            # Unfitted graceful fallback: smooth generalized sigmoid centered at 60.0
            return float(round(1.0 / (1.0 + np.exp(-0.08 * (score - 60.0))), 4))

        if self.method == "isotonic" and self.isotonic_model is not None:
            prob = self.isotonic_model.predict([score])[0]
            return float(round(max(0.0, min(1.0, prob)), 4))
        elif self.platt_model is not None:
            prob = self.platt_model.predict_proba([[score]])[0, 1]
            return float(round(max(0.0, min(1.0, prob)), 4))

        return float(round(score / 100.0, 4))

    def candidate_fit_indicator(
        self,
        raw_score: float,
        display_floor: float = 45.0,
    ) -> Dict[str, Any]:
        """
        Generates candidate-facing fit indicator for motivation.
        Guarantees:
          - Keeps floor on display value for candidate encouragement (e.g. 50%)
          - Labels display value honestly as `fit_indicator` (fit percentage)
          - NEVER mutates or floors internal `quality_score` or ranking
        """
        calibrated_prob = self.predict_probability(raw_score)
        # Scaled fit percentage with motivating floor
        fit_percentage = round(display_floor + (calibrated_prob * (100.0 - display_floor)), 1)
        fit_percentage = min(98.0, max(display_floor, fit_percentage))

        return {
            "fit_indicator": fit_percentage,
            "calibrated_probability": calibrated_prob,
            "raw_quality_score": float(raw_score),
            "label": "Strong Fit" if calibrated_prob >= 0.75 else ("Good Fit" if calibrated_prob >= 0.50 else "Developing Fit"),
        }

    def save(self, file_path: Path):
        """Saves fitted calibrator to disk via joblib."""
        import joblib
        file_path.parent.mkdir(parents=True, exist_ok=True)
        meta = {
            "method": self.method,
            "is_fitted": self.is_fitted,
            "ece_score": self.ece_score,
            "model": self.isotonic_model if self.method == "isotonic" else self.platt_model,
        }
        joblib.dump(meta, file_path)

    @classmethod
    def load(cls, file_path: Path) -> "ScoreCalibrator":
        """Loads fitted calibrator from disk via joblib."""
        import joblib
        if not file_path.exists():
            return cls()
        try:
            meta = joblib.load(file_path)
            calibrator = cls(method=meta.get("method", "isotonic"))
            calibrator.is_fitted = meta.get("is_fitted", False)
            calibrator.ece_score = meta.get("ece_score", 0.0)
            if calibrator.method == "isotonic":
                calibrator.isotonic_model = meta.get("model")
            else:
                calibrator.platt_model = meta.get("model")
            return calibrator
        except Exception as e:
            logger.warning("Failed loading calibrator; using default", error=str(e))
            return cls()
        except Exception as e:
            logger.warning("Failed loading calibrator; using default", error=str(e))
            return cls()


# Default singleton instance
global_calibrator = ScoreCalibrator.load(CALIBRATION_MODEL_PATH)
