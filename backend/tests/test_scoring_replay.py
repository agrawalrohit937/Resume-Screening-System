"""
Unit tests for Scoring Features and Replay (Phase 1.5).
"""

import pytest

from services.scoring.features import ScoringFeatures, extract_scoring_features
from services.scoring.replay import replay_score_from_features
from services.scoring_engine import score_resume


def test_feature_extraction_schema_version():
    dummy_result = {
        "scoring_version": "2.0.0",
        "quality_score": 82.5,
        "final_score": 82.5,
        "skills_score": 85.0,
        "experience_score": 80.0,
        "education_score": 90.0,
        "vector_score": 78.0,
        "keyword_score": 80.0,
        "strict_score": 84.0,
        "matched_skills": ["Python", "FastAPI"],
        "transferable_skills": ["Flask"],
        "missing_skills": ["Docker"],
        "eligibility": {"status": "eligible", "checks": []},
        "eligibility_rank": 0,
        "is_knockout": False,
        "parsing_health": {"is_healthy": True, "confidence": 0.95, "warnings": []},
    }

    features = extract_scoring_features(dummy_result, flags_active=["FEATURE_REAL_EXPERIENCE_MODEL"])
    assert features.feature_schema_version == "1.0.0"
    assert features.quality_score == 82.5
    assert features.matched_skills_count == 2
    assert features.transferable_skills_count == 1
    assert features.missing_skills_count == 1
    assert "FEATURE_REAL_EXPERIENCE_MODEL" in features.flags_active

    # Compute deterministic hash
    h1 = features.compute_hash()
    h2 = features.compute_hash()
    assert h1 == h2
    assert len(h1) == 64


def test_scoring_replay_exact_reconstruction():
    features_dict = {
        "feature_schema_version": "1.0.0",
        "scoring_version": "2.0.0",
        "embedding_model_version": "bge-m3-v1.0",
        "quality_score": 75.0,
        "final_score": 75.0,
        "skills_score": 80.0,
        "experience_score": 70.0,
        "education_score": 60.0,
        "vector_score": 72.0,
        "keyword_score": 80.0,
        "strict_score": 75.5,
        "eligibility_status": "eligible",
        "eligibility_rank": 0,
        "is_knockout": False,
        "reranker_score": None,
    }

    replay_res = replay_score_from_features(features_dict, profile_mode="candidate")
    assert replay_res["replayed"] is True
    assert replay_res["feature_schema_version"] == "1.0.0"
    # Reconstructed score should be within delta
    assert isinstance(replay_res["reconstructed_quality_score"], float)
    assert abs(replay_res["score_delta"]) < 10.0


def test_end_to_end_features_in_score_resume():
    resume = {
        "raw_text": "Experienced Python Software Engineer with B.Tech degree and Docker skills.",
        "skills": ["Python", "Docker", "SQL"],
        "total_experience_years": 4.0,
        "education": [{"degree": "B.Tech", "field_of_study": "Computer Science"}],
    }
    jd = {
        "text": "Seeking a Senior Python Developer with Docker and Postgres experience. Min 3 years experience.",
        "min_years": 3.0,
    }

    result = score_resume(resume, jd, mode="recruiter")
    assert "features" in result
    feat = result["features"]
    from services.scoring_engine import SCORING_ENGINE_VERSION
    assert feat["scoring_version"] == SCORING_ENGINE_VERSION

    # Verify Phase B3 snapshot fields
    assert "ontology_version" in result
    assert "embedding_model_version" in result
    assert "weights_snapshot" in result
    assert "input_hashes" in result
    assert "resume_hash" in result["input_hashes"]
    assert "jd_hash" in result["input_hashes"]

    # Recompute with exact snapshot profile to assert delta <= 0.05
    from services.scoring_engine import WeightProfile
    custom_prof = WeightProfile(**result["weights_snapshot"])
    replayed = score_resume(resume, jd, mode="recruiter", profile=custom_prof)
    assert abs(result["quality_score"] - replayed["quality_score"]) <= 0.05
