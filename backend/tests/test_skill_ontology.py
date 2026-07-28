"""
Unit tests for Skill Ontology & Knowledge Graph Service.
"""

import pytest
from services.skill_ontology import (
    normalize_skill,
    expand_skills,
    get_all_known_skills,
    evaluate_skill_fulfillment,
    SKILL_TAXONOMY,
    SKILL_ALIASES
)


def test_normalize_skill_aliases():
    assert normalize_skill("nodejs") == "Node.js"
    assert normalize_skill("reactjs") == "React"
    assert normalize_skill("react.js") == "React"
    assert normalize_skill("amazon web services") == "AWS"
    assert normalize_skill("k8s") == "Kubernetes"
    assert normalize_skill("postgres") == "PostgreSQL"
    assert normalize_skill("py") == "Python"
    assert normalize_skill("golang") == "Go"


def test_normalize_skill_casing_and_unknown():
    assert normalize_skill("pinecone") == "Pinecone"
    assert normalize_skill("chromadb") == "ChromaDB"
    assert normalize_skill("fastapi") == "FastAPI"
    assert normalize_skill("custom rare skill") == "Custom Rare Skill"


def test_expand_skills():
    raw_skills = ["React", "Pinecone", "nodejs"]
    expansion = expand_skills(raw_skills)
    
    explicit = expansion["explicit_skills"]
    implicit = expansion["implicit_concepts"]
    all_expanded = expansion["all_expanded_skills"]
    
    # Check explicit normalized skills
    assert "React" in explicit
    assert "Pinecone" in explicit
    assert "Node.js" in explicit
    
    # Check implicit categories
    assert "Frontend Development" in implicit
    assert "Backend Development" in implicit
    assert "Vector Databases" in implicit
    assert "AI & Machine Learning" in implicit
    assert "Web Development" in implicit
    
    # Check total expanded set
    assert explicit.issubset(all_expanded)
    assert implicit.issubset(all_expanded)


def test_evaluate_skill_fulfillment_exact():
    cand_skills = ["Python", "FastAPI", "React"]
    fulfilled, match_type = evaluate_skill_fulfillment("Python", cand_skills)
    assert fulfilled is True
    assert match_type == "EXACT"

    # Alias match
    fulfilled, match_type = evaluate_skill_fulfillment("nodejs", ["Node.js"])
    assert fulfilled is True
    assert match_type == "EXACT"


def test_evaluate_skill_fulfillment_taxonomy_parent():
    # Job requires broader category "Vector Databases", Candidate has specific tool "Pinecone"
    cand_skills = ["Pinecone", "Python"]
    fulfilled, match_type = evaluate_skill_fulfillment("Vector Databases", cand_skills)
    assert fulfilled is True
    assert match_type == "TAXONOMY_PARENT"


def test_evaluate_skill_fulfillment_taxonomy_equivalent():
    # Job requires "Pinecone", Candidate has sibling vector DB "ChromaDB"
    cand_skills = ["ChromaDB", "Python"]
    fulfilled, match_type = evaluate_skill_fulfillment("Pinecone", cand_skills)
    assert fulfilled is True
    assert match_type == "TAXONOMY_EQUIVALENT"


def test_evaluate_skill_fulfillment_none():
    cand_skills = ["HTML", "CSS"]
    fulfilled, match_type = evaluate_skill_fulfillment("Kubernetes", cand_skills)
    assert fulfilled is False
    assert match_type == "NONE"


def test_get_all_known_skills():
    known = get_all_known_skills()
    assert "nodejs" in known
    assert "pinecone" in known
    assert "vector databases" in known
    assert len(known) > 50
