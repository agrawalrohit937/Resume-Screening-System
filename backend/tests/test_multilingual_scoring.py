"""
Unit tests for Multilingual / BGE Embeddings and Indian Degree Context (Phase 1.1).
"""

import pytest

from services.embedding_service import (
    embedding_model,
    assert_vector_compatibility,
    EMBEDDING_MODEL_VERSION,
    EMBEDDING_DIMENSIONS,
)
from services.scoring_engine import (
    _candidate_max_degree_rank,
    _extract_degree_requirement,
    score_resume,
    _DEGREE_RANK,
)


def test_indian_context_degree_rank_hierarchy():
    # ITI / Diploma => Level 1
    assert _DEGREE_RANK["iti"] == 1
    assert _DEGREE_RANK["diploma"] == 1
    assert _DEGREE_RANK["high school"] == 1

    # Associate => Level 2
    assert _DEGREE_RANK["associate"] == 2

    # B.Sc / BCA / B.Tech => Level 3
    assert _DEGREE_RANK["b.sc"] == 3
    assert _DEGREE_RANK["bsc"] == 3
    assert _DEGREE_RANK["bca"] == 3
    assert _DEGREE_RANK["b.tech"] == 3
    assert _DEGREE_RANK["btech"] == 3
    assert _DEGREE_RANK["bachelor"] == 3

    # B.Ed / M.Sc / Master => Level 4
    assert _DEGREE_RANK["b.ed"] == 4
    assert _DEGREE_RANK["bed"] == 4
    assert _DEGREE_RANK["m.sc"] == 4
    assert _DEGREE_RANK["msc"] == 4
    assert _DEGREE_RANK["master"] == 4
    assert _DEGREE_RANK["m.tech"] == 4

    # Ph.D => Level 5
    assert _DEGREE_RANK["phd"] == 5
    assert _DEGREE_RANK["doctorate"] == 5


def test_candidate_degree_resolution_indian_context():
    cand_diploma = {"education": [{"degree": "Diploma in Mechanical Engineering"}]}
    rank, in_prog = _candidate_max_degree_rank(cand_diploma)
    assert rank == 1

    cand_bca = {"education": [{"degree": "BCA - Bachelor of Computer Applications"}]}
    rank, in_prog = _candidate_max_degree_rank(cand_bca)
    assert rank == 3

    cand_msc = {"education": [{"degree": "M.Sc in Information Technology"}]}
    rank, in_prog = _candidate_max_degree_rank(cand_msc)
    assert rank == 4

    cand_bed = {"education": [{"degree": "B.Ed in Science Education"}]}
    rank, in_prog = _candidate_max_degree_rank(cand_bed)
    assert rank == 4


def test_vector_compatibility_assertion():
    # Identical versions and dimensions pass
    dim = embedding_model.get_embedding_dimension()
    assert_vector_compatibility(
        EMBEDDING_MODEL_VERSION,
        EMBEDDING_MODEL_VERSION,
        dim,
        dim,
    )

    # Incompatible lengths fail
    with pytest.raises(ValueError, match="dimension mismatch"):
        assert_vector_compatibility("v1", "v1", 1024, 768)

    # Incompatible versions fail
    with pytest.raises(ValueError, match="version mismatch"):
        assert_vector_compatibility("v1", "v2", 1024, 1024)


def test_embedding_model_encode_and_dimension():
    sample_texts = [
        "Software Engineer with Python experience",
        "सॉफ्टवेयर इंजीनियर (Software Engineer)",  # Multilingual Hindi
    ]
    vecs = embedding_model.encode(sample_texts)
    assert len(vecs) == 2
    dim = embedding_model.get_embedding_dimension()
    assert len(vecs[0]) == dim
    assert len(vecs[1]) == dim
