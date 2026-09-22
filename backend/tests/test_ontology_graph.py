"""
Unit tests for Real Occupation and Skill Graph (ESCO / O*NET / NCO-2015).
"""

import pytest
from services.ontology.graph import get_ontology_graph, ONTOLOGY_VERSION
from services.ontology.models import TypedRelation, compute_edge_credit


def test_ontology_initialization():
    graph = get_ontology_graph()
    assert graph.version == ONTOLOGY_VERSION
    assert len(graph.canonical_nodes) >= 100
    assert len(graph.occupations_list) >= 10
    assert len(graph.edges) >= 10


def test_esco_skills_and_multilingual_resolution():
    graph = get_ontology_graph()
    
    # German translation -> English canonical
    assert graph.normalize_skill("Krankenpflege") == "Nursing Care"
    
    # Spanish translation -> English canonical
    assert graph.normalize_skill("Cuidados de enfermería") == "Nursing Care"
    
    # Hindi translation -> English canonical
    assert graph.normalize_skill("नर्सिंग देखभाल") == "Nursing Care"
    
    # Aliases
    assert graph.normalize_skill("patient care") == "Nursing Care"
    assert graph.normalize_skill("smaw") == "Shielded Metal Arc Welding"
    assert graph.normalize_skill("tig welding") == "Gas Tungsten Arc Welding"


def test_typed_edge_credit_calculation():
    assert compute_edge_credit("same_as") == 1.00
    assert compute_edge_credit("is_a") == 0.90
    assert compute_edge_credit("broader_than") == 0.90
    assert compute_edge_credit("part_of") == 0.70
    assert compute_edge_credit("substitutable_for", weight=0.80) == 0.80
    assert compute_edge_credit("tool_of", weight=0.80) == 0.40
    assert compute_edge_credit("regulated_by") == 1.00


def test_typed_edge_skill_fulfillment():
    graph = get_ontology_graph()
    
    # Substitutable edge test: PyTorch and TensorFlow
    match = graph.evaluate_skill_fulfillment("TensorFlow", ["PyTorch"])
    assert match.credit >= 0.70
    assert match.match_type in ("SUBSTITUTABLE_FOR", "TAXONOMY_SIBLING")
    
    # Tool of edge test: Figma -> User Experience Design
    match_tool = graph.evaluate_skill_fulfillment("User Experience Design", ["Figma"])
    assert match_tool.credit >= 0.40
    assert "Figma" in match_tool.evidence


def test_occupation_lookup_nco_soc_esco():
    graph = get_ontology_graph()
    
    # Look up by NCO code
    nco_nurse = graph.find_occupation(code="2221.0101")
    assert nco_nurse is not None
    assert nco_nurse.family_code == "healthcare"
    assert nco_nurse.title == "Registered Nurse"
    
    # Look up by SOC code
    soc_welder = graph.find_occupation(code="51-4121.00")
    assert soc_welder is not None
    assert soc_welder.family_code == "skilled_trades"
    
    # Look up by title query (case insensitive, partial)
    ca_occ = graph.find_occupation(query="Chartered Accountant")
    assert ca_occ is not None
    assert ca_occ.family_code == "legal_finance"
    
    # Look up by alt title
    alt_occ = graph.find_occupation(query="UI/UX Designer")
    assert alt_occ is not None
    assert alt_occ.family_code == "creative_design"


def test_human_review_gate_pending_queue():
    graph = get_ontology_graph()
    initial_pending_count = len(graph.pending_reviews)
    
    # An unrecognized skill string
    normalized = graph.normalize_skill("BrandNewQuantumSkillXYZ", record_pending=True)
    assert normalized == "Brandnewquantumskillxyz"
    
    # Check that it entered the pending buffer
    assert len(graph.pending_reviews) >= initial_pending_count + 1
    recent = graph.pending_reviews[-1]
    assert "brandnewquantumskillxyz" in recent["raw_clean"]
    assert recent["status"] == "pending_review"
    assert recent["ontology_version"] == ONTOLOGY_VERSION
