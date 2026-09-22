"""
In-Memory Real Occupation and Skill Graph.
Provides high-performance typed graph traversals, ESCO/O*NET/NCO multi-domain support,
multilingual alias resolution, and edge-credit skill fulfillment evaluation.
"""

import re
import threading
from typing import Dict, List, Set, Tuple, Optional, Any
import structlog

from services.ontology.models import (
    SkillNode,
    OccupationNode,
    SkillEdge,
    TypedRelation,
    compute_edge_credit,
)
from services.ontology.loaders import (
    load_curated_tech_overlay,
    load_esco_skills,
    load_occupations,
    load_skill_edges,
    load_taxonomy_csvs,
)
from services.scoring.constants import SkillMatch, get_skill_credit_table

logger = structlog.get_logger(__name__)

ONTOLOGY_VERSION: str = "2.0.0"

_GRAPH_SINGLETON: Optional["OccupationSkillGraph"] = None
_GRAPH_LOCK = threading.Lock()


def _clean_term(term: str) -> str:
    if not term or not isinstance(term, str):
        return ""
    return re.sub(r"\s+", " ", term.strip().lower())


def _strip_version(text: str) -> str:
    """Removes trailing version digits (e.g. 'React 18' -> 'React', 'Python 3.10' -> 'Python')."""
    return re.sub(r"[\s\-_]*v?\d+(\.\d+)*\b", "", text, flags=re.IGNORECASE).strip()


class OccupationSkillGraph:
    """
    Cached in-memory graph representing occupations, skills, and multi-relational edges.
    """

    def __init__(self):
        self.version = ONTOLOGY_VERSION
        # Node indices
        self.canonical_nodes: Dict[str, SkillNode] = {}          # canonical.lower() -> SkillNode
        self.exact_canonicals: Dict[str, str] = {}              # canonical.lower() -> canonical exact casing
        self.curated_aliases: Dict[str, str] = {}               # alias.lower() -> canonical
        self.esco_aliases: Dict[str, str] = {}                  # alias.lower() -> canonical
        self.multilingual_labels: Dict[str, str] = {}           # label.lower() -> canonical

        # Edge indices
        self.edges: Dict[Tuple[str, str], SkillEdge] = {}       # (source.lower(), target.lower()) -> SkillEdge
        self.outgoing_edges: Dict[str, List[SkillEdge]] = {}    # source.lower() -> List[SkillEdge]
        self.incoming_edges: Dict[str, List[SkillEdge]] = {}    # target.lower() -> List[SkillEdge]
        self.child_to_parents: Dict[str, Set[str]] = {}         # child.lower() -> Set[parent_canonical]

        # Occupations
        self.occupations_by_code: Dict[str, OccupationNode] = {}   # code -> OccupationNode
        self.occupations_by_title: Dict[str, OccupationNode] = {}  # clean_title -> OccupationNode
        self.occupations_list: List[OccupationNode] = []

        # Pending review buffer for unknown strings (human review gate)
        self.pending_reviews: List[Dict[str, Any]] = []

        # Excluded bridging categories (same rule as legacy to avoid false sibling matches)
        self.excluded_bridging_parents: Set[str] = {
            "programming languages",
            "technologies",
            "general skills",
            "frameworks",
            "libraries",
            "tools",
        }

        self._load_all()

    def _load_all(self):
        """Loads all taxonomies into memory and builds indices."""
        logger.info("Initializing OccupationSkillGraph", version=self.version)

        # 1. Curated Tech Overlay (Highest Priority)
        tech_nodes, tech_edges = load_curated_tech_overlay()
        for node in tech_nodes:
            canon_lower = _clean_term(node.canonical)
            self.canonical_nodes[canon_lower] = node
            self.exact_canonicals[canon_lower] = node.canonical
            for alias in node.aliases:
                self.curated_aliases[_clean_term(alias)] = node.canonical

        for edge in tech_edges:
            self._add_edge(edge)

        # 2. ESCO Skills
        esco_nodes = load_esco_skills()
        for node in esco_nodes:
            canon_lower = _clean_term(node.canonical)
            # Only add if not already covered by curated overlay
            if canon_lower not in self.canonical_nodes:
                self.canonical_nodes[canon_lower] = node
                self.exact_canonicals[canon_lower] = node.canonical

            for alias in node.aliases:
                clean_al = _clean_term(alias)
                if clean_al not in self.curated_aliases:
                    self.esco_aliases[clean_al] = node.canonical

            for lang, label in node.labels.items():
                clean_lbl = _clean_term(label)
                if clean_lbl not in self.curated_aliases and clean_lbl not in self.esco_aliases:
                    self.multilingual_labels[clean_lbl] = node.canonical

        # 2b. Local CSV Taxonomies (ESCO/O*NET)
        csv_nodes, csv_edges = load_taxonomy_csvs()
        for node in csv_nodes:
            canon_lower = _clean_term(node.canonical)
            if canon_lower not in self.canonical_nodes:
                self.canonical_nodes[canon_lower] = node
                self.exact_canonicals[canon_lower] = node.canonical
            for alias in node.aliases:
                clean_al = _clean_term(alias)
                if clean_al not in self.curated_aliases and clean_al not in self.esco_aliases:
                    self.esco_aliases[clean_al] = node.canonical
        for edge in csv_edges:
            self._add_edge(edge)

        # 3. Explicit Skill Edges
        explicit_edges = load_skill_edges()
        for edge in explicit_edges:
            self._add_edge(edge)

        # 4. Occupations (NCO / ESCO / O*NET)
        occupations = load_occupations()
        self.occupations_list = occupations
        for occ in occupations:
            if occ.code:
                self.occupations_by_code[occ.code] = occ
            if occ.soc_code:
                self.occupations_by_code[occ.soc_code] = occ
            if occ.esco_code:
                self.occupations_by_code[occ.esco_code] = occ

            clean_t = _clean_term(occ.title)
            self.occupations_by_title[clean_t] = occ
            for alt in occ.alt_titles:
                self.occupations_by_title[_clean_term(alt)] = occ

        logger.info(
            "OccupationSkillGraph initialized successfully",
            total_skills=len(self.canonical_nodes),
            total_aliases=len(self.curated_aliases) + len(self.esco_aliases),
            total_occupations=len(self.occupations_list),
            total_edges=len(self.edges),
        )

    def _add_edge(self, edge: SkillEdge):
        s_low = _clean_term(edge.source)
        t_low = _clean_term(edge.target)
        self.edges[(s_low, t_low)] = edge
        self.outgoing_edges.setdefault(s_low, []).append(edge)
        self.incoming_edges.setdefault(t_low, []).append(edge)

        # Track child -> parent relationships for taxonomy traversal
        if edge.relation in (TypedRelation.PART_OF.value, TypedRelation.IS_A.value, TypedRelation.BROADER_THAN.value):
            target_canonical = self.exact_canonicals.get(t_low, edge.target)
            self.child_to_parents.setdefault(s_low, set()).add(t_low)
            self.child_to_parents.setdefault(s_low, set()).add(_clean_term(target_canonical))

    def normalize_skill(self, raw_skill: str, record_pending: bool = True) -> str:
        """
        Deterministic, layered skill normalization:
        1. Curated Alias
        2. Overlay Canonical
        3. ESCO / Lightcast exact
        4. ESCO multilingual label
        5. Embedding kNN (if pre-indexed / configured)
        6. Unknown: Title-cased fallback, recorded into db.skills_pending_review buffer
        """
        if not raw_skill or not isinstance(raw_skill, str):
            return ""

        clean = _clean_term(raw_skill)
        if not clean:
            return ""

        # 1. Curated Alias
        if clean in self.curated_aliases:
            return self.curated_aliases[clean]

        # 2. Overlay / Canonical exact match
        if clean in self.exact_canonicals:
            return self.exact_canonicals[clean]

        # 3. ESCO Alias
        if clean in self.esco_aliases:
            return self.esco_aliases[clean]

        # 4. Multilingual label match
        if clean in self.multilingual_labels:
            return self.multilingual_labels[clean]

        # 6. Unknown: Title-case and record for human review gate
        title_cased = raw_skill.strip().title()
        if record_pending and len(clean) > 2:
            self._queue_pending_review(raw_skill, title_cased)

        return title_cased

    def _queue_pending_review(self, raw: str, suggested: str):
        """Queues an unknown skill string for human review gate without modifying active graph."""
        clean = _clean_term(raw)
        if any(p.get("raw_clean") == clean for p in self.pending_reviews):
            return
        self.pending_reviews.append({
            "raw": raw,
            "raw_clean": clean,
            "suggested_canonical": suggested,
            "status": "pending_review",
            "ontology_version": self.version,
        })

    def evaluate_skill_fulfillment(
        self, required_skill: str, candidate_skills: List[str]
    ) -> SkillMatch:
        """
        Evaluates candidate skills against a required skill using the typed graph edges and credit hierarchy.
        """
        credit_table = get_skill_credit_table()
        if not required_skill or not isinstance(required_skill, str):
            none_info = credit_table.get("NONE", {"credit": 0.0, "bucket": "missing"})
            return SkillMatch(
                required="",
                credit=none_info["credit"],
                match_type="NONE",
                evidence=[],
                bucket=none_info["bucket"],
            )

        req_canonical = self.normalize_skill(required_skill, record_pending=False)
        req_clean = _clean_term(req_canonical)
        raw_req_clean = _clean_term(required_skill)

        # Normalize all candidate skills
        cand_map: Dict[str, str] = {}  # clean_canonical -> original candidate skill text
        cand_canonicals: Set[str] = set()
        for c in candidate_skills:
            if not c or not isinstance(c, str):
                continue
            norm = self.normalize_skill(c, record_pending=False)
            norm_clean = _clean_term(norm)
            cand_map[norm_clean] = c
            cand_canonicals.add(norm_clean)

        # 1. Exact or Alias match
        if req_clean in cand_canonicals:
            is_alias = (raw_req_clean in self.curated_aliases or raw_req_clean in self.esco_aliases)
            match_type = "ALIAS" if (is_alias and raw_req_clean != req_clean) else "EXACT"
            info = credit_table.get(match_type, {"credit": 1.00, "bucket": "matched"})
            return SkillMatch(
                required=req_canonical,
                credit=info["credit"],
                match_type=match_type,
                evidence=[cand_map[req_clean]],
                bucket=info["bucket"],
            )

        # 2. Version Variant match (e.g. React 17 vs React, Python 3.10 vs Python)
        req_stripped = _strip_version(required_skill).lower()
        for c_norm_clean, original_text in cand_map.items():
            c_clean = _clean_term(original_text)
            c_stripped = _strip_version(c_clean).lower()
            c_canonical_stripped = _strip_version(c_norm_clean).lower()
            if (
                (req_stripped and req_stripped == c_stripped)
                or (req_stripped and req_stripped == c_norm_clean)
                or (c_canonical_stripped and req_clean == c_canonical_stripped)
                or (_strip_version(req_clean).lower() == c_canonical_stripped)
            ):
                info = credit_table.get("VERSION_VARIANT", {"credit": 1.00, "bucket": "matched"})
                return SkillMatch(
                    required=req_canonical,
                    credit=info["credit"],
                    match_type="VERSION_VARIANT",
                    evidence=[original_text],
                    bucket=info["bucket"],
                )

        # 3. Check if Candidate has a child belonging to required Category / Parent concept (TAXONOMY_PARENT)
        # e.g., Req: "Vector Databases", Candidate has "Pinecone"
        matching_children = [
            cand_map[c_norm_clean]
            for c_norm_clean in cand_map.keys()
            if req_clean in self.child_to_parents.get(c_norm_clean, set())
        ]
        if matching_children:
            info = credit_table.get("TAXONOMY_PARENT", {"credit": 0.90, "bucket": "matched"})
            return SkillMatch(
                required=req_canonical,
                credit=info["credit"],
                match_type="TAXONOMY_PARENT",
                evidence=matching_children,
                bucket=info["bucket"],
            )

        # 4. Direct Edge Relationship in Graph
        best_edge_match: Optional[Tuple[float, str, str, str]] = None  # credit, match_type, evidence, bucket

        for c_norm_clean, original_text in cand_map.items():
            # Check candidate -> required edge (e.g. candidate is part_of / is_a required)
            if (c_norm_clean, req_clean) in self.edges:
                edge = self.edges[(c_norm_clean, req_clean)]
                credit = compute_edge_credit(edge.relation, edge.weight)
                m_type = "TAXONOMY_PARENT" if edge.relation in (TypedRelation.IS_A.value, TypedRelation.BROADER_THAN.value) else edge.relation.upper()
                bucket = "matched" if credit >= 0.85 else "transferable"
                if not best_edge_match or credit > best_edge_match[0]:
                    best_edge_match = (credit, m_type, original_text, bucket)

            # Check required -> candidate edge (e.g. required is substitutable_for candidate)
            if (req_clean, c_norm_clean) in self.edges:
                edge = self.edges[(req_clean, c_norm_clean)]
                credit = compute_edge_credit(edge.relation, edge.weight)
                m_type = edge.relation.upper()
                bucket = "matched" if credit >= 0.85 else "transferable"
                if not best_edge_match or credit > best_edge_match[0]:
                    best_edge_match = (credit, m_type, original_text, bucket)

        if best_edge_match and best_edge_match[0] > 0.0:
            return SkillMatch(
                required=req_canonical,
                credit=best_edge_match[0],
                match_type=best_edge_match[1],
                evidence=[best_edge_match[2]],
                bucket=best_edge_match[3],
            )

        # 5. Shared Parent / Category (Taxonomy Sibling)
        req_parents = self.child_to_parents.get(req_clean, set())
        eligible_parents = {
            p for p in req_parents if _clean_term(p) not in self.excluded_bridging_parents
        }
        if eligible_parents:
            for c_norm_clean, original_text in cand_map.items():
                c_parents = self.child_to_parents.get(c_norm_clean, set())
                common = eligible_parents.intersection(c_parents)
                if common:
                    info = credit_table.get("TAXONOMY_SIBLING", {"credit": 0.40, "bucket": "transferable"})
                    return SkillMatch(
                        required=req_canonical,
                        credit=info["credit"],
                        match_type="TAXONOMY_SIBLING",
                        evidence=[original_text],
                        bucket=info["bucket"],
                    )

        # 6. Fuzzy Matching (RapidFuzz) with token-length guard (len >= 4)
        if len(req_clean) >= 4:
            try:
                from rapidfuzz import fuzz
                best_fuzzy_match = None
                best_fuzzy_score = 0.0
                for c_norm_clean, original_text in cand_map.items():
                    c_clean = _clean_term(original_text)
                    if len(c_clean) >= 4:
                        ratio = float(fuzz.ratio(req_clean, c_clean))
                        token_ratio = float(fuzz.token_sort_ratio(req_clean, c_clean))
                        partial = float(fuzz.partial_ratio(req_clean, c_clean)) if min(len(req_clean), len(c_clean)) >= 6 else 0.0
                        score = max(ratio, token_ratio, partial)
                        if score >= 80.0 and score > best_fuzzy_score:
                            best_fuzzy_score = score
                            best_fuzzy_match = original_text

                if best_fuzzy_match:
                    info = credit_table.get("FUZZY", {"credit": 0.85, "bucket": "matched"})
                    return SkillMatch(
                        required=req_canonical,
                        credit=info["credit"],
                        match_type="FUZZY",
                        evidence=[best_fuzzy_match],
                        bucket=info["bucket"],
                    )
            except Exception as e:
                logger.debug("Fuzzy skill matching failed", error=str(e))

        # 7. Embedding-Based Skill Linking for Unseen Skills (Credit: 0.60, match_type="EMBEDDING")
        try:
            from services.embedding_service import embedding_model
            if candidate_skills:
                req_emb = embedding_model.encode([req_canonical])
                cand_embs = embedding_model.encode(candidate_skills)
                if len(req_emb) == 1 and len(cand_embs) > 0:
                    import numpy as np
                    r_vec = np.asarray(req_emb[0], dtype=np.float32)
                    r_norm = float(np.linalg.norm(r_vec)) or 1.0
                    c_vecs = np.asarray(cand_embs, dtype=np.float32)
                    c_norms = np.linalg.norm(c_vecs, axis=1, keepdims=True)
                    c_norms[c_norms == 0] = 1.0
                    sims = (c_vecs @ r_vec) / (c_norms.flatten() * r_norm)
                    best_idx = int(np.argmax(sims))
                    best_sim = float(sims[best_idx])
                    if best_sim >= 0.72:
                        info = credit_table.get("EMBEDDING", {"credit": 0.60, "bucket": "transferable"})
                        return SkillMatch(
                            required=req_canonical,
                            credit=info["credit"],
                            match_type="EMBEDDING",
                            evidence=[candidate_skills[best_idx]],
                            bucket=info["bucket"],
                        )
        except Exception as e:
            logger.debug("Embedding skill linking failed", error=str(e))

        # 8. Default None
        none_info = credit_table.get("NONE", {"credit": 0.0, "bucket": "missing"})
        return SkillMatch(
            required=req_canonical,
            credit=none_info["credit"],
            match_type="NONE",
            evidence=[],
            bucket=none_info["bucket"],
        )


    def find_occupation(
        self, query: str = "", code: Optional[str] = None
    ) -> Optional[OccupationNode]:
        """Finds an occupation node by code or title query."""
        if code and code in self.occupations_by_code:
            return self.occupations_by_code[code]

        if query:
            clean = _clean_term(query)
            if clean in self.occupations_by_title:
                return self.occupations_by_title[clean]

            # Substring matching on title and alt_titles
            for occ in self.occupations_list:
                if clean in _clean_term(occ.title) or _clean_term(occ.title) in clean:
                    return occ
                for alt in occ.alt_titles:
                    if clean in _clean_term(alt) or _clean_term(alt) in clean:
                        return occ

        return None


def get_ontology_graph() -> OccupationSkillGraph:
    """Returns the thread-safe singleton OccupationSkillGraph instance."""
    global _GRAPH_SINGLETON
    if _GRAPH_SINGLETON is None:
        with _GRAPH_LOCK:
            if _GRAPH_SINGLETON is None:
                _GRAPH_SINGLETON = OccupationSkillGraph()
    return _GRAPH_SINGLETON


def reset_ontology_graph() -> None:
    """Resets the singleton OccupationSkillGraph instance."""
    global _GRAPH_SINGLETON
    with _GRAPH_LOCK:
        _GRAPH_SINGLETON = None

