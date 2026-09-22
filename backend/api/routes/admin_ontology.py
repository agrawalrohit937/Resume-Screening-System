"""
Admin routes for Ontology Human Review Gate.
Allows approving, merging, or rejecting pending unverified skills to keep the graph from rotting.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from services.ontology.graph import get_ontology_graph, ONTOLOGY_VERSION
from services.ontology.models import SkillNode

router = APIRouter(prefix="/api/v1/admin/ontology", tags=["Admin Ontology"])


class PendingSkillReview(BaseModel):
    raw: str
    suggested_canonical: str
    category: Optional[str] = None
    ontology_version: str = ONTOLOGY_VERSION


class ApproveSkillRequest(BaseModel):
    raw: str
    canonical: str
    category: str = "General"
    aliases: List[str] = Field(default_factory=list)


class MergeSkillRequest(BaseModel):
    raw: str
    target_canonical: str


class RejectSkillRequest(BaseModel):
    raw: str
    reason: Optional[str] = "Invalid / Out of Domain"


@router.get("/pending", response_model=List[Dict[str, Any]])
async def list_pending_skills():
    """Returns list of pending unverified skill terms awaiting human review."""
    graph = get_ontology_graph()
    return graph.pending_reviews


@router.post("/approve")
async def approve_pending_skill(payload: ApproveSkillRequest):
    """
    Approves a pending skill into the active ontology graph as a canonical node.
    """
    graph = get_ontology_graph()
    clean_canon = payload.canonical.strip().lower()
    
    # Add new canonical node
    aliases = payload.aliases + [payload.raw]
    node = SkillNode(
        id=f"custom:{clean_canon.replace(' ', '_')}",
        canonical=payload.canonical,
        aliases=aliases,
        category=payload.category,
        source="human_approved",
    )
    graph.canonical_nodes[clean_canon] = node
    graph.exact_canonicals[clean_canon] = payload.canonical
    for a in aliases:
        graph.curated_aliases[a.strip().lower()] = payload.canonical
        
    # Remove from pending reviews
    graph.pending_reviews = [
        p for p in graph.pending_reviews if p.get("raw") != payload.raw and p.get("raw_clean") != payload.raw.strip().lower()
    ]
    return {"status": "approved", "canonical": payload.canonical, "category": payload.category}


@router.post("/merge")
async def merge_pending_skill(payload: MergeSkillRequest):
    """
    Merges a pending raw term as an alias of an existing canonical skill.
    """
    graph = get_ontology_graph()
    target_canon_clean = payload.target_canonical.strip().lower()
    
    # Check if target canonical exists
    canonical = graph.exact_canonicals.get(target_canon_clean, payload.target_canonical)
    graph.curated_aliases[payload.raw.strip().lower()] = canonical
    
    # Remove from pending reviews
    graph.pending_reviews = [
        p for p in graph.pending_reviews if p.get("raw") != payload.raw and p.get("raw_clean") != payload.raw.strip().lower()
    ]
    return {"status": "merged", "alias": payload.raw, "canonical": canonical}


@router.post("/reject")
async def reject_pending_skill(payload: RejectSkillRequest):
    """
    Rejects a pending raw term without adding it to the graph.
    """
    graph = get_ontology_graph()
    graph.pending_reviews = [
        p for p in graph.pending_reviews if p.get("raw") != payload.raw and p.get("raw_clean") != payload.raw.strip().lower()
    ]
    return {"status": "rejected", "raw": payload.raw, "reason": payload.reason}
