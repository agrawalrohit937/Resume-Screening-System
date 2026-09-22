"""
Data models for the Multi-Domain Occupation and Skill Graph.
"""

from typing import Dict, List, Optional, Any, Set
from pydantic import BaseModel, Field
from enum import Enum


class TypedRelation(str, Enum):
    IS_A = "is_a"
    PART_OF = "part_of"
    PREREQUISITE_OF = "prerequisite_of"
    SUBSTITUTABLE_FOR = "substitutable_for"
    TOOL_OF = "tool_of"
    REGULATED_BY = "regulated_by"
    BROADER_THAN = "broader_than"
    SAME_AS = "same_as"


class SkillNode(BaseModel):
    """Represents a canonical skill in the knowledge graph."""
    id: str
    canonical: str
    aliases: List[str] = Field(default_factory=list)
    labels: Dict[str, str] = Field(default_factory=dict)  # e.g. {"en": "...", "hi": "...", "de": "..."}
    category: Optional[str] = None
    source: str = "curated_overlay"  # curated_overlay | esco | onet | nco | lightcast
    embedding: Optional[List[float]] = None

    class Config:
        frozen = False


class OccupationNode(BaseModel):
    """Represents an occupation node connecting job titles, codes, and domain families."""
    id: str
    code: str
    soc_code: Optional[str] = None
    esco_code: Optional[str] = None
    title: str
    family_code: str  # software_engineering | healthcare | legal_finance | skilled_trades | ...
    source: str = "nco_esco_onet"
    alt_titles: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    essential_skills: List[str] = Field(default_factory=list)
    optional_skills: List[str] = Field(default_factory=list)


class SkillEdge(BaseModel):
    """Represents a directed, typed, weighted relationship between skills or entities."""
    source: str
    target: str
    relation: str  # TypedRelation or str
    weight: float = 1.0
    metadata: Dict[str, Any] = Field(default_factory=dict)


def compute_edge_credit(relation: str, weight: float = 1.0) -> float:
    """
    Computes graded skill credit derived from edge relationship type and weight.
    """
    rel = relation.lower()
    if rel == TypedRelation.SAME_AS.value:
        return 1.00
    elif rel in (TypedRelation.IS_A.value, TypedRelation.BROADER_THAN.value):
        return 0.90
    elif rel == TypedRelation.PART_OF.value:
        return 0.70
    elif rel == TypedRelation.SUBSTITUTABLE_FOR.value:
        return max(0.10, min(1.00, weight if weight > 0 else 0.60))
    elif rel == TypedRelation.TOOL_OF.value:
        return max(0.10, min(1.00, 0.50 * (weight if weight > 0 else 1.0)))
    elif rel == TypedRelation.PREREQUISITE_OF.value:
        return max(0.10, min(1.00, 0.40 * (weight if weight > 0 else 1.0)))
    elif rel == TypedRelation.REGULATED_BY.value:
        return 1.00
    return 0.40 * weight
