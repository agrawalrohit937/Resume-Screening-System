"""
Phase 4 Verification Tests: Skill Extraction, Normalization, Title/Seniority, Fuzzy & Embedding Linking, Negation.
"""

from unittest.mock import MagicMock
import numpy as np
import pytest

from services.nlp_extractor import extract_skills_deterministic
from services.ontology.graph import get_ontology_graph
import core.feature_flags as ff


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
    assert res_emb.credit >= 0.50
