"""
Ontology package for CareerPilot ATS.
Provides multi-domain, multi-relational occupation and skill graphs across ESCO, O*NET, and NCO-2015 taxonomies.
"""

from services.ontology.models import SkillNode, OccupationNode, SkillEdge, TypedRelation
from services.ontology.graph import OccupationSkillGraph, get_ontology_graph, ONTOLOGY_VERSION

__all__ = [
    "SkillNode",
    "OccupationNode",
    "SkillEdge",
    "TypedRelation",
    "OccupationSkillGraph",
    "get_ontology_graph",
    "ONTOLOGY_VERSION",
]
