"""
Phase 4 Verification Tests: Skill Extraction, Normalization, Title/Seniority, Fuzzy & Embedding Linking, Negation.
"""

from unittest.mock import MagicMock
import numpy as np
import pytest

from services.nlp_extractor import extract_skills_deterministic
from services.title_normalizer import normalize_title, calculate_title_match
from services.ontology.graph import get_ontology_graph
from services.ontology.loaders import load_taxonomy_csvs
import core.feature_flags as ff
import services.embedding_service as emb_svc


@pytest.fixture(autouse=True)
def mock_embeddings(monkeypatch):
    """Mock local embedding calls to avoid network / heavy model load in unit tests."""
    mock_model = MagicMock()
    def fake_encode(sentences, *args, **kwargs):
        if isinstance(sentences, str):
            return np.ones(1024, dtype=np.float32)
        return np.ones((len(sentences), 1024), dtype=np.float32)
    mock_model.encode.side_effect = fake_encode
    monkeypatch.setattr("services.embedding_service.embedding_model", mock_model)
    monkeypatch.setattr("services.scoring_engine.embedding_model", mock_model)


def test_negation_regression_suite():
    """
    Mandatory regression cases for negation cues and clause splitting:
    1. 'No experience required, Python and SQL' -> Python, SQL extracted
    2. 'Python, Java but no Docker' -> Python, Java extracted; Docker discarded
    3. 'React is not required' -> React discarded
    4. 'Docker is a plus' -> Docker extracted
    5. 'Bonus: Kubernetes' -> Kubernetes extracted
    """
    # 1. "No experience required, Python and SQL"
    skills1 = extract_skills_deterministic("No experience required, Python and SQL")
    assert "Python" in skills1
    assert "SQL" in skills1

    # 2. "Python, Java but no Docker"
    skills2 = extract_skills_deterministic("Python, Java but no Docker")
    assert "Python" in skills2
    assert "Java" in skills2
    assert "Docker" not in skills2

    # 3. "React is not required"
    skills3 = extract_skills_deterministic("React is not required for this role.")
    assert "React" not in skills3

    # 4. "Docker is a plus"
    skills4 = extract_skills_deterministic("Strong backend developer. Docker is a plus.")
    assert "Docker" in skills4

    # 5. "Bonus: Kubernetes"
    skills5 = extract_skills_deterministic("Bonus: Kubernetes experience.")
    assert "Kubernetes" in skills5


def test_spacy_dep_negation_flag(monkeypatch):
    monkeypatch.setattr(ff, "FEATURE_DEP_NEGATION", True)
    skills = extract_skills_deterministic("Seeking engineer with Python, Java, but no Docker.")
    assert "Python" in skills
    assert "Java" in skills
    assert "Docker" not in skills


def test_title_and_seniority_normalization():
    # 1. SDE-2 -> mid, software_engineer
    t1 = normalize_title("SDE-2")
    assert t1["level"] == "mid"
    assert t1["family"] == "software_engineer"
    assert t1["rank"] == 2

    # 2. Backend Engineer II -> mid, backend_engineer
    t2 = normalize_title("Backend Engineer II")
    assert t2["level"] == "mid"
    assert t2["family"] == "backend_engineer"
    assert t2["rank"] == 2

    # 3. Sr. Software Developer -> senior, software_engineer
    t3 = normalize_title("Sr. Software Developer")
    assert t3["level"] == "senior"
    assert t3["family"] == "software_engineer"
    assert t3["rank"] == 3

    # Title Match & Seniority Delta
    match = calculate_title_match(cand_title="Backend Engineer II", jd_title="Senior Backend Engineer")
    assert match["family_match"] is True
    assert match["seniority_delta"] == -1  # Candidate is 1 level below (mid vs senior)
    assert 0.70 <= match["match_score"] <= 0.90


def test_fuzzy_and_embedding_skill_matching():
    graph = get_ontology_graph()

    # 1. Exact match
    res_exact = graph.evaluate_skill_fulfillment("Python", ["Python"])
    assert res_exact.credit == 1.00
    assert res_exact.match_type in ("EXACT", "ALIAS")

    # 2. Fuzzy match for slight typo with length >= 4: "Postgress" -> "PostgreSQL"
    res_fuzzy = graph.evaluate_skill_fulfillment("PostgreSQL", ["Postgress"])
    assert res_fuzzy.match_type == "FUZZY"
    assert res_fuzzy.credit >= 0.80
    assert res_fuzzy.bucket == "matched"

    # 3. Embedding-based link for unseen skills
    res_emb = graph.evaluate_skill_fulfillment("UnseenNeuralTech", ["DeepLearningSpecialist"])
    assert res_emb.match_type in ("EMBEDDING", "TAXONOMY_PARENT", "EXACT", "FUZZY")
    assert res_emb.credit >= 0.60
