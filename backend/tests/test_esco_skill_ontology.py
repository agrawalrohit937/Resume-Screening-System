"""
Tests for ESCO-based Skill Ontology and Directional Fulfillment.
Verifies exact matches, aliases, version variants, directional hierarchy,
substitutable relationships, false positive protections, and multi-domain ESCO integration.
"""

import pytest
from services.skill_ontology import (
    normalize_skill,
    evaluate_skill_fulfillment,
)
from services.ontology.graph import get_ontology_graph, reset_ontology_graph


@pytest.fixture(autouse=True)
def setup_ontology():
    reset_ontology_graph()
    yield


class TestDirectionalSkillFulfillment:
    def test_exact_and_alias_matches(self):
        # Exact match
        m1 = evaluate_skill_fulfillment("Python", ["Python", "FastAPI"])
        assert m1.credit == 1.00
        assert m1.match_type == "EXACT"
        assert m1.bucket == "matched"

        # Alias match via curated overlay
        m2 = evaluate_skill_fulfillment("React", ["react.js"])
        assert m2.credit == 1.00
        assert m2.match_type in ("EXACT", "ALIAS")
        assert m2.bucket == "matched"

    def test_version_variant_matching(self):
        # Version variant: React 18 satisfies React requirement
        m = evaluate_skill_fulfillment("React 18", ["React"])
        assert m.credit == 1.00
        assert m.match_type in ("EXACT", "ALIAS", "VERSION_VARIANT")
        assert m.bucket == "matched"

    def test_safe_version_identifier_protection(self):
        # S3, EC2, iOS must not be corrupted by version stripping
        m_s3 = evaluate_skill_fulfillment("S3", ["S3"])
        assert m_s3.credit == 1.00
        assert m_s3.match_type == "EXACT"

        m_ios = evaluate_skill_fulfillment("iOS", ["iOS"])
        assert m_ios.credit == 1.00

    def test_child_satisfies_parent_directional(self):
        # Specific child skill satisfies broad parent category
        m = evaluate_skill_fulfillment("Vector Databases", ["Pinecone", "Python"])
        assert m.credit == 0.90
        assert m.match_type == "TAXONOMY_PARENT"
        assert m.bucket == "matched"
        assert "Pinecone" in m.evidence

    def test_parent_does_not_satisfy_child_directional(self):
        # Broad parent category CANNOT satisfy a specific required child tool
        m = evaluate_skill_fulfillment("Pinecone", ["Vector Databases"])
        assert m.credit < 0.85
        assert m.match_type != "TAXONOMY_PARENT"
        assert m.bucket != "matched"

    def test_distinct_skills_do_not_match(self):
        # React Native != React
        m_rn = evaluate_skill_fulfillment("React", ["React Native"])
        assert m_rn.credit < 0.90
        assert m_rn.match_type != "EXACT"

        # Python != Rust
        m_pr = evaluate_skill_fulfillment("Python", ["Rust"])
        assert m_pr.credit < 0.85
        assert m_pr.match_type != "EXACT"

    def test_docker_and_kubernetes_relationship(self):
        # Sibling or edge relationship under DevOps / Containerization
        m = evaluate_skill_fulfillment("Docker", ["Kubernetes"])
        # Either taxonomy sibling or direct edge credit
        assert m.credit > 0.0
        assert m.bucket in ("transferable", "matched")

    def test_unknown_skill_preserves_raw_string(self):
        # Unknown skill should not be force-mutated into invented title case
        norm = normalize_skill("customUnknownSkill-v1")
        assert "customUnknownSkill" in norm


class TestESCOIntegration:
    def test_esco_skill_scale_and_coverage(self):
        g = get_ontology_graph()
        assert len(g.canonical_nodes) >= 13000
        assert len(g.esco_aliases) >= 80000

    def test_esco_healthcare_and_clinical_skills(self):
        g = get_ontology_graph()
        # Verify clinical skills are resolvable
        triage_match = g.evaluate_skill_fulfillment("Triage", ["Triage", "Patient Care"])
        assert triage_match.credit == 1.00
        assert triage_match.bucket == "matched"

    def test_no_occupation_titles_as_skills(self):
        g = get_ontology_graph()
        # "software developer" or "registered nurse" are occupation titles, not skill concept types
        for occ in g.occupations_list:
            occ_title_clean = occ.title.strip().lower()
            # Occupation titles should not be listed as canonical skill nodes
            if occ_title_clean in ("software engineer", "devops engineer", "registered nurse"):
                assert occ_title_clean not in g.canonical_nodes
