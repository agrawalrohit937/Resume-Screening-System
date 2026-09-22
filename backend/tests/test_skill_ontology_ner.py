"""
Workstream 4 Verification Tests — Skill Ontology & Adversarial NER Suite.
========================================================================
Tests:
1. Versioned JSON taxonomy loading (assets/ontology/esco_skill_taxonomy_v2.json).
2. 30+ adversarial sentence benchmarks across contextual negation, nice-to-have,
   clause boundary splitting, and multi-word tech skill disambiguation.
3. Indian educational hierarchy resolution & qualification matching.
"""

import pytest
from services.nlp_extractor import extract_skills_deterministic, extract_education_level
from services.ontology.graph import get_ontology_graph, reset_ontology_graph
from services.ontology.loaders import load_esco_skills, load_occupations, load_skill_edges


def test_versioned_taxonomy_asset_loader():
    """Verify esco_skill_taxonomy_v2.json loads cleanly with all skills, occupations, and edges."""
    skills = load_esco_skills()
    assert len(skills) >= 20
    canonical_names = {s.canonical for s in skills}
    assert "Python" in canonical_names
    assert "FastAPI" in canonical_names
    assert "Kubernetes" in canonical_names
    assert "MongoDB" in canonical_names

    occupations = load_occupations()
    assert len(occupations) >= 3
    occ_names = {o.title for o in occupations}
    assert "Software Engineer" in occ_names

    edges = load_skill_edges()
    assert len(edges) >= 4

    # Graph initialization smoke test
    reset_ontology_graph()
    graph = get_ontology_graph()
    assert len(graph.canonical_nodes) >= 20


@pytest.mark.parametrize(
    "sentence,expected_present,expected_absent",
    [
        # Direct negations
        ("No experience in Docker, but proficient in Python", ["Python"], ["Docker"]),
        ("Not familiar with React, strong background in Vue.js", [], ["React"]),
        ("Candidate has zero knowledge of Kubernetes, but knows Docker well", ["Docker"], ["Kubernetes"]),
        ("Never worked with GraphQL, built REST APIs with FastAPI", ["FastAPI"], ["GraphQL"]),
        ("Without any AWS experience, deployed on GCP", ["GCP"], ["AWS"]),
        ("No prior Java experience required for this role", [], ["Java"]),
        ("Neither React nor Angular experience, pure backend engineer in Go", ["Go"], ["React", "Angular"]),
        ("None of our services use PHP; we use Node.js and TypeScript", ["Node.js", "TypeScript"], ["PHP"]),
        ("Docker experience is unnecessary for this frontend position", [], ["Docker"]),
        ("React is not required for this backend role", [], ["React"]),

        # Contractions
        ("Didn't use Django on this project, used Flask instead", ["Flask"], ["Django"]),
        ("Haven't touched PyTorch yet, extensive experience with TensorFlow", ["TensorFlow"], ["PyTorch"]),
        ("Don't know Rust, but senior in C++", ["C++"], ["Rust"]),
        ("Hasn't worked with PostgreSQL, used MongoDB daily", ["MongoDB"], ["PostgreSQL"]),
        ("Won't need Kubernetes for this internship, basic Docker is fine", ["Docker"], ["Kubernetes"]),
        ("Wouldn't recommend PHP; we specialize in Python", ["Python"], ["PHP"]),
        ("Couldn't adopt GraphQL due to legacy constraints, used REST APIs", [], ["GraphQL"]),

        # Excluding / Lack / Non
        ("Excluding AWS, candidate knows all major tools", [], ["AWS"]),
        ("Lacks experience in PyTorch, but has deep math background", [], ["PyTorch"]),
        ("Lack of Kubernetes skills is a blocker", [], ["Kubernetes"]),
        ("Except for Rust, skilled in systems programming in C++", ["C++"], ["Rust"]),

        # Nice-to-have / Preferred / Bonus (Must BE extracted)
        ("Bonus: Kubernetes and Helm knowledge", ["Kubernetes"], []),
        ("Docker is a plus for this team", ["Docker"], []),
        ("Preferred: Experience with GraphQL and TypeScript", ["GraphQL", "TypeScript"], []),
        ("Nice to have: Experience with Qdrant vector database", ["Qdrant"], []),
        ("Good to have: Familiarity with LangChain and LangGraph", ["LangChain"], []),
        ("Ideally experienced in PostgreSQL and Redis", ["PostgreSQL"], []),
        ("Desirable: Background in Machine Learning and PyTorch", ["PyTorch"], []),

        # Complex multi-clause combinations
        ("Proficient in Python, FastAPI, and SQL; however no Docker or Kubernetes", ["Python", "FastAPI", "SQL"], ["Docker", "Kubernetes"]),
        ("Strong frontend lead in React and TypeScript, although no backend Node.js", ["React", "TypeScript"], ["Node.js"]),
        ("Built distributed systems in Go and MongoDB, while avoiding Redis and Kafka", ["Go", "MongoDB"], ["Redis", "Kafka"]),
        ("Expertise in Java and Spring Boot, though never touched AWS", ["Java"], ["AWS"]),
        ("Knowledge of frontend frameworks (like React) or other backend languages is not required and will not be evaluated.", [], ["React"]),
    ]
)
def test_adversarial_skill_ner_sentences(sentence, expected_present, expected_absent):
    """30+ adversarial sentence NER benchmarks for precision, negation, and nice-to-have extraction."""
    extracted = extract_skills_deterministic(sentence)
    for skill in expected_present:
        assert skill in extracted, f"Expected '{skill}' to be present in extracted skills from: '{sentence}', got: {extracted}"
    for skill in expected_absent:
        assert skill not in extracted, f"Expected '{skill}' to be ABSENT from extracted skills from: '{sentence}', got: {extracted}"


def test_forward_contextual_negation_complex_clause():
    """Specific regression test for forward contextual negation across multi-word parenthetical clauses."""
    jd_phrase = "Knowledge of frontend frameworks (like React) or other backend languages is not required and will not be evaluated."
    extracted = extract_skills_deterministic(jd_phrase)
    assert "React" not in extracted, f"React must not be extracted from: '{jd_phrase}', got: {extracted}"



def test_education_level_edge_cases():
    """Verify Indian education context and false positive rejection."""
    assert extract_education_level("Completed B.Tech in Computer Science from IIT Delhi") == "Bachelor's Degree"
    assert extract_education_level("Graduated with B.E. in Information Technology") == "Bachelor's Degree"
    assert extract_education_level("Holds an MCA degree from NIT Trichy") == "Master's Degree"
    assert extract_education_level("M.Tech in Artificial Intelligence") == "Master's Degree"
    assert extract_education_level("Ph.D. in Computer Science & Machine Learning") == "Ph.D / Doctorate"
    # False positive guards
    assert extract_education_level("Expert in MS Excel and Word") is None
    assert extract_education_level("Must be willing to relocate") is None
