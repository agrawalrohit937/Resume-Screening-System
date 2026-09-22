"""
Phase 7 Verification Tests: Learned-to-Rank (LTR) Training, Inference, and Flag Evaluation.
"""

from unittest.mock import MagicMock
import numpy as np
import pytest

from train_ltr import (
    extract_ltr_feature_vector,
    train_lambdamart_ranker,
    run_training_pipeline,
    LTR_FEATURE_NAMES,
)
from services.ltr_service import ltr_service
from services.scoring_engine import score_resume
import core.feature_flags as ff
import services.embedding_service as emb_svc


@pytest.fixture(autouse=True)
def mock_embeddings(monkeypatch):
    """Mock local embedding calls."""
    mock_model = MagicMock()
    def fake_encode(sentences, *args, **kwargs):
        if isinstance(sentences, str):
            return np.ones(1024, dtype=np.float32)
        return np.ones((len(sentences), 1024), dtype=np.float32)
    mock_model.encode.side_effect = fake_encode
    monkeypatch.setattr("services.embedding_service.embedding_model", mock_model)
    monkeypatch.setattr("services.scoring_engine.embedding_model", mock_model)


def test_ltr_feature_extraction():
    feat_dict = {
        "skills_score": 85.0,
        "experience_score": 90.0,
        "education_score": 100.0,
        "vector_score": 75.0,
        "keyword_score": 80.0,
        "skill_match_ratio": 0.85,
        "effective_years": 4.5,
        "required_years": 3.0,
        "experience_parity_ratio": 1.5,
        "seniority_rank": 3,
        "education_rank": 2,
        "parsing_confidence": 0.95,
    }
    vec = extract_ltr_feature_vector(feat_dict)
    assert len(vec) == len(LTR_FEATURE_NAMES)
    assert vec[0] == 85.0
    assert vec[1] == 90.0


def test_ltr_training_pipeline_and_ndcg():
    res = run_training_pipeline()
    assert res["n_train_samples"] > 0
    assert res["n_val_samples"] > 0
    assert res["validation_ndcg10"] >= 0.80  # High NDCG on training benchmark


def test_ltr_service_prediction():
    # Ensure model is trained
    if ltr_service.booster is None:
        run_training_pipeline()
        ltr_service._load_model()

    feat_dict = {
        "skills_score": 95.0,
        "experience_score": 90.0,
        "education_score": 100.0,
        "vector_score": 88.0,
        "keyword_score": 90.0,
        "skill_match_ratio": 0.90,
        "effective_years": 5.0,
        "required_years": 3.0,
        "experience_parity_ratio": 1.6,
        "seniority_rank": 3,
        "education_rank": 2,
        "parsing_confidence": 1.0,
    }
    score = ltr_service.predict_score(feat_dict)
    assert score is not None
    assert 0.0 <= score <= 100.0


def test_learned_ranker_feature_flag(monkeypatch):
    monkeypatch.setattr(ff, "FEATURE_LEARNED_RANKER", True)

    resume = {
        "raw_text": "Experienced Python Engineer.",
        "skills": ["Python", "FastAPI"],
    }
    jd = {
        "text": "Senior Python Engineer with FastAPI.",
    }

    res = score_resume(resume, jd, mode="recruiter")
    assert "learned_ranker_score" in res
    assert "final_score" in res  # Deterministic score is always preserved for auditability
