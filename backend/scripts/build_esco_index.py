"""
Builds a deterministic, production-grade ESCO skill index and relations graph
from the 6 verified ESCO CSV files in backend/data/esco_raw/.

Outputs:
  - backend/data/ontology/esco_skills.json: Contains indexed canonical skills,
    aliases, digital/transversal flags, parents, and related skills.
  - backend/data/ontology/skill_edges.json: Contains directed typed edges
    (broader_than, essential_for, optional_for, etc.) for fulfillment scoring.
"""

import csv
import json
import logging
from pathlib import Path
from typing import Dict, List, Set, Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("build_esco_index")

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "esco_raw"
OUTPUT_DIR = BASE_DIR / "data" / "ontology"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SKILLS_CSV = RAW_DIR / "skills_en.csv"
DIGITAL_CSV = RAW_DIR / "digitalSkillsCollection_en.csv"
TRANSVERSAL_CSV = RAW_DIR / "transversalSkillsCollection_en.csv"
BROADER_CSV = RAW_DIR / "broaderRelationsSkillPillar_en.csv"
HIERARCHY_CSV = RAW_DIR / "skillsHierarchy_en.csv"
RELATIONS_CSV = RAW_DIR / "skillSkillRelations_en.csv"


def verify_files_exist():
    required = [SKILLS_CSV, DIGITAL_CSV, TRANSVERSAL_CSV, BROADER_CSV, HIERARCHY_CSV, RELATIONS_CSV]
    for p in required:
        if not p.exists():
            raise FileNotFoundError(f"Required ESCO CSV missing: {p}")
    logger.info("All 6 ESCO CSV files verified present in %s", RAW_DIR)


def parse_alt_labels(raw_alt: str) -> List[str]:
    """Parse newline-separated or pipe-separated alternative labels cleanly."""
    if not raw_alt:
        return []
    # ESCO encodes altLabels separated by newline '\n'
    raw_lines = raw_alt.replace("\r", "\n").split("\n")
    aliases: List[str] = []
    seen = set()
    for line in raw_lines:
        for item in line.split("|"):
            cleaned = item.strip()
            if cleaned and cleaned.lower() not in seen:
                seen.add(cleaned.lower())
                aliases.append(cleaned)
    return aliases


def build_index() -> Dict[str, Any]:
    verify_files_exist()

    # 1. Load Digital & Transversal Collections
    digital_uris: Set[str] = set()
    with open(DIGITAL_CSV, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            uri = row.get("conceptUri")
            if uri:
                digital_uris.add(uri.strip())
    logger.info("Loaded %d digital skill URIs", len(digital_uris))

    transversal_uris: Set[str] = set()
    with open(TRANSVERSAL_CSV, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            uri = row.get("conceptUri")
            if uri:
                transversal_uris.add(uri.strip())
    logger.info("Loaded %d transversal skill URIs", len(transversal_uris))

    # 2. Load Skills from skills_en.csv
    skills_by_uri: Dict[str, Dict[str, Any]] = {}
    total_aliases = 0
    invalid_rows = 0

    with open(SKILLS_CSV, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=2):
            uri = row.get("conceptUri", "").strip()
            pref_label = row.get("preferredLabel", "").strip()
            concept_type = row.get("conceptType", "").strip()

            if not uri or not pref_label:
                logger.warning("Row %d missing conceptUri or preferredLabel; skipping", row_num)
                invalid_rows += 1
                continue

            # Ensure we only index skills, not occupations
            if concept_type and concept_type != "KnowledgeSkillCompetence":
                continue

            aliases = parse_alt_labels(row.get("altLabels", ""))
            total_aliases += len(aliases)

            skills_by_uri[uri] = {
                "id": f"esco:{uri.split('/')[-1]}",
                "conceptUri": uri,
                "preferredLabel": pref_label,
                "canonical": pref_label,
                "skillType": row.get("skillType", "skill/competence"),
                "reuseLevel": row.get("reuseLevel", ""),
                "is_digital": uri in digital_uris,
                "is_transversal": uri in transversal_uris,
                "aliases": aliases,
                "parents": [],
                "essential_skills": [],
                "optional_skills": [],
                "source": "esco",
            }

    logger.info("Indexed %d base skills with %d aliases from skills_en.csv (invalid rows: %d)",
                len(skills_by_uri), total_aliases, invalid_rows)

    # 3. Process Broader Relations (Hierarchy / Parent-Child)
    edges: List[Dict[str, Any]] = []
    parent_child_count = 0

    with open(BROADER_CSV, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            concept_uri = row.get("conceptUri", "").strip()
            broader_uri = row.get("broaderUri", "").strip()
            broader_label = row.get("broaderLabel", "").strip()

            if concept_uri in skills_by_uri and broader_label:
                skill_entry = skills_by_uri[concept_uri]
                if broader_label not in skill_entry["parents"]:
                    skill_entry["parents"].append(broader_label)

                # If broader is also a known skill, add directed edge
                target_label = broader_label
                edges.append({
                    "source": skill_entry["preferredLabel"],
                    "target": target_label,
                    "relation": "part_of" if row.get("broaderType") == "SkillGroup" else "is_a",
                    "weight": 0.90,
                    "metadata": {"source": "esco_broader", "broaderUri": broader_uri}
                })
                parent_child_count += 1

    logger.info("Linked %d broader parent relationships", parent_child_count)

    # 4. Process Skill-Skill Relations (Essential / Optional / Substitutable)
    relations_count = 0
    with open(RELATIONS_CSV, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            orig_uri = row.get("originalSkillUri", "").strip()
            rel_type = row.get("relationType", "").strip().lower()
            rel_uri = row.get("relatedSkillUri", "").strip()

            if orig_uri in skills_by_uri and rel_uri in skills_by_uri:
                orig_skill = skills_by_uri[orig_uri]
                related_skill = skills_by_uri[rel_uri]

                if rel_type == "essential":
                    orig_skill["essential_skills"].append(related_skill["preferredLabel"])
                    edges.append({
                        "source": orig_skill["preferredLabel"],
                        "target": related_skill["preferredLabel"],
                        "relation": "essential_for",
                        "weight": 0.95,
                        "metadata": {"source": "esco_relations"}
                    })
                    relations_count += 1
                elif rel_type == "optional":
                    orig_skill["optional_skills"].append(related_skill["preferredLabel"])
                    edges.append({
                        "source": orig_skill["preferredLabel"],
                        "target": related_skill["preferredLabel"],
                        "relation": "substitutable_for",
                        "weight": 0.75,
                        "metadata": {"source": "esco_relations"}
                    })
                    relations_count += 1

    logger.info("Processed %d skill-to-skill relations from skillSkillRelations_en.csv", relations_count)

    # Convert to structured output
    skills_list = list(skills_by_uri.values())
    output_skills_file = OUTPUT_DIR / "esco_skills.json"
    with open(output_skills_file, "w", encoding="utf-8") as f:
        json.dump({"skills": skills_list}, f, indent=2, ensure_ascii=False)
    logger.info("Saved %d ESCO skills to %s (%d bytes)", len(skills_list), output_skills_file, output_skills_file.stat().st_size)

    # Save edges
    output_edges_file = OUTPUT_DIR / "skill_edges.json"
    with open(output_edges_file, "w", encoding="utf-8") as f:
        json.dump({"edges": edges}, f, indent=2, ensure_ascii=False)
    logger.info("Saved %d skill edges to %s", len(edges), output_edges_file)

    return {
        "total_skills": len(skills_list),
        "total_aliases": total_aliases,
        "total_edges": len(edges),
        "digital_skills": len(digital_uris),
        "transversal_skills": len(transversal_uris),
    }


if __name__ == "__main__":
    stats = build_index()
    print("ESCO Index Building Complete!")
    print(json.dumps(stats, indent=2))
