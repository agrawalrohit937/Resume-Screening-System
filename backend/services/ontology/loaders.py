"""
Loaders for ESCO, O*NET, NCO-2015, and High-Priority Curated Tech Taxonomy.
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import structlog

from services.ontology.models import SkillNode, OccupationNode, SkillEdge, TypedRelation

logger = structlog.get_logger(__name__)

ASSETS_DIR = Path(__file__).resolve().parent.parent.parent / "assets" / "ontology"
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "ontology"


def load_curated_tech_overlay() -> Tuple[List[SkillNode], List[SkillEdge]]:
    """
    Extracts the high-priority curated technology taxonomy from the legacy definition,
    preserving LangGraph, Qdrant, FastAPI, Docker, and other modern skills that ESCO lacks.
    """
    nodes: List[SkillNode] = []
    edges: List[SkillEdge] = []

    try:
        from services.ontology.tech_overlay import SKILL_ALIASES, SKILL_TAXONOMY, CHILD_TO_PARENTS

        # Invert aliases to build canonical nodes with aliases
        canonical_to_aliases: Dict[str, List[str]] = {}
        for alias, canonical in SKILL_ALIASES.items():
            canonical_to_aliases.setdefault(canonical, []).append(alias)

        # Build nodes from taxonomy categories, children, and alias targets
        all_canonicals = set(SKILL_TAXONOMY.keys())
        all_canonicals.update(canonical_to_aliases.keys())
        for cat, data in SKILL_TAXONOMY.items():
            children = data.get("children", [])
            all_canonicals.update(children)
            for child in children:
                # Add child -> parent (part_of / is_a) edge
                edges.append(
                    SkillEdge(
                        source=child,
                        target=cat,
                        relation=TypedRelation.PART_OF.value,
                        weight=0.9,
                        metadata={"source": "curated_tech_overlay"}
                    )
                )

        for canonical in all_canonicals:
            category = None
            for cat, data in SKILL_TAXONOMY.items():
                if canonical in data.get("children", []) or canonical == cat:
                    category = cat
                    break

            aliases = canonical_to_aliases.get(canonical, [])
            nodes.append(
                SkillNode(
                    id=f"tech:{canonical.lower().replace(' ', '_')}",
                    canonical=canonical,
                    aliases=aliases,
                    labels={"en": canonical},
                    category=category or "Software Engineering",
                    source="curated_overlay",
                )
            )

    except Exception as e:
        logger.warning("Failed to load curated tech overlay", error=str(e))

    return nodes, edges


def load_esco_skills(file_path: Path = None) -> List[SkillNode]:
    """Loads ESCO skills from JSON files across assets/ontology and data/ontology."""
    nodes_by_id: Dict[str, SkillNode] = {}
    paths_to_load = [file_path] if file_path else [DATA_DIR / "esco_skills.json", ASSETS_DIR / "esco_skill_taxonomy_v2.json"]
    
    for path in paths_to_load:
        if path and path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data.get("skills", []):
                        node = SkillNode(**item)
                        nodes_by_id[node.id] = node
            except Exception as e:
                logger.error("Error loading ESCO skills", error=str(e), path=str(path))

    return list(nodes_by_id.values())


def load_occupations(file_path: Path = None) -> List[OccupationNode]:
    """Loads occupations mapped across NCO, ESCO, and O*NET from all ontology files."""
    occupations_by_id: Dict[str, OccupationNode] = {}
    paths_to_load = [file_path] if file_path else [DATA_DIR / "occupations.json", ASSETS_DIR / "esco_skill_taxonomy_v2.json"]

    for path in paths_to_load:
        if path and path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data.get("occupations", []):
                        occ = OccupationNode(**item)
                        occupations_by_id[occ.id] = occ
            except Exception as e:
                logger.error("Error loading occupations", error=str(e), path=str(path))

    return list(occupations_by_id.values())


def load_skill_edges(file_path: Path = None) -> List[SkillEdge]:
    """Loads typed multi-relational edges from all ontology files."""
    edges_by_key: Dict[Tuple[str, str, str], SkillEdge] = {}
    paths_to_load = [file_path] if file_path else [DATA_DIR / "skill_edges.json", ASSETS_DIR / "esco_skill_taxonomy_v2.json"]

    for path in paths_to_load:
        if path and path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data.get("edges", []):
                        edge = SkillEdge(**item)
                        edges_by_key[(edge.source, edge.target, edge.relation)] = edge
            except Exception as e:
                logger.error("Error loading skill edges", error=str(e), path=str(path))

    return list(edges_by_key.values())


def load_taxonomy_csvs(data_dir: Optional[Path] = None) -> Tuple[List[SkillNode], List[SkillEdge]]:
    """
    Loads local ESCO / O*NET taxonomy CSV files (e.g. skills.csv, aliases.csv, onet_skills.csv).
    Deterministic local load with zero network requests at runtime.
    """
    import csv
    target_dir = data_dir or DATA_DIR
    nodes: List[SkillNode] = []
    edges: List[SkillEdge] = []

    if not target_dir.exists():
        return nodes, edges

    for csv_file in target_dir.glob("*.csv"):
        try:
            with open(csv_file, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    canon = row.get("preferredLabel") or row.get("canonical") or row.get("skill") or row.get("title") or ""
                    if not canon or not canon.strip():
                        continue
                    canon = canon.strip()
                    alt_labels = row.get("altLabels") or row.get("aliases") or ""
                    aliases = [a.strip() for a in alt_labels.split("|") if a.strip()] if alt_labels else []
                    category = row.get("category") or row.get("domain") or "General"

                    nodes.append(
                        SkillNode(
                            id=f"csv:{canon.lower().replace(' ', '_')}",
                            canonical=canon,
                            aliases=aliases,
                            labels={"en": canon},
                            category=category,
                            source=csv_file.stem,
                        )
                    )
        except Exception as e:
            logger.debug("Failed reading taxonomy CSV", file=str(csv_file), error=str(e))

    return nodes, edges

