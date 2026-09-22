"""
Unit tests for Task 4.6: Shadow Scoring Pipeline.
Validates parallel execution, db.shadow_scores recording, delta computation,
and privacy preservation (zero raw resume text stored).
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock

from core.feature_flags import FEATURE_SHADOW_SCORING
from core.logging import trace_context
from services.shadow_scoring import ShadowScoringService


@pytest.mark.asyncio
async def test_execute_shadow_score_success():
    service = ShadowScoringService()
    mock_db = MagicMock()
    mock_db.shadow_scores.insert_one = AsyncMock(return_value=MagicMock(inserted_id="shadow_rec_1"))

    features = {
        "semantic_similarity": 0.82,
        "skill_coverage_ratio": 0.75,
        "feature_schema_version": "1.0.0",
    }

    with trace_context("trace_shadow_test_1"):
        record = await service.execute_shadow_score(
            job_id="job_abc_123",
            candidate_id="cand_xyz_789",
            primary_score=78.5,
            features_dict=features,
            occupation_family="tech",
            db=mock_db,
            shadow_model_version="shadow-v2-exp",
        )

    assert record is not None
    assert record["job_id"] == "job_abc_123"
    assert record["candidate_id"] == "cand_xyz_789"
    assert record["primary_score"] == 78.5
    assert isinstance(record["shadow_score"], float)
    assert "score_delta" in record
    assert record["shadow_model_version"] == "shadow-v2-exp"
    assert record["trace_id"] == "trace_shadow_test_1"
    assert "created_at" in record

    # PRIVACY VALIDATION: Assert strictly no raw resume text in shadow score record
    assert "raw_text" not in record
    assert "resume_text" not in record
    assert "jd_text" not in record

    mock_db.shadow_scores.insert_one.assert_called_once()
    called_doc = mock_db.shadow_scores.insert_one.call_args[0][0]
    assert called_doc["job_id"] == "job_abc_123"
    assert called_doc["primary_score"] == 78.5


@pytest.mark.asyncio
async def test_execute_shadow_score_in_memory_fallback():
    service = ShadowScoringService()
    record = await service.execute_shadow_score(
        job_id="job_standalone",
        candidate_id="cand_standalone",
        primary_score=85.0,
        features_dict={"semantic_similarity": 0.90},
        db=None,
    )
    assert record is not None
    assert len(service._in_memory_records) >= 1
    assert service._in_memory_records[-1]["job_id"] == "job_standalone"


@pytest.mark.asyncio
async def test_shadow_score_disabled_flag(monkeypatch):
    import services.shadow_scoring as ss_mod
    monkeypatch.setattr(ss_mod, "FEATURE_SHADOW_SCORING", False)

    service = ShadowScoringService()
    record = await service.execute_shadow_score(
        job_id="job_disabled",
        candidate_id="cand_disabled",
        primary_score=50.0,
    )
    assert record is None


def test_dispatch_shadow_score_fire_and_forget():
    service = ShadowScoringService()
    # Calling dispatch without a running loop or with running loop should never raise
    service.dispatch_shadow_score(
        job_id="job_fire_forget",
        candidate_id="cand_fire_forget",
        primary_score=65.0,
    )
