"""
Deterministic NLP Extractor Module for ATS Resume Parsing.
Extracts canonical skills, experience years, education level, and contact info
directly from raw resume text using pattern matching and skill ontology cross-referencing.
"""

from typing import Dict, List, Any, Set, Optional
import re
import structlog
from services.skill_ontology import (
    get_all_known_skills,
    normalize_skill,
    expand_skills,
)
from utils.nlp_utils import (
    extract_email,
    extract_phone,
    extract_urls,
    extract_years_of_experience,
)

logger = structlog.get_logger(__name__)


def extract_skills_deterministic(raw_text: str) -> List[str]:
    """
    Scans raw resume text against the ontology knowledge base using boundary-aware regex patterns.
    Normalizes and deduplicates matches into canonical skills.
    """
    if not raw_text or not raw_text.strip():
        return []

    known_skills = get_all_known_skills()
    found_skills_raw = set()

    for skill in known_skills:
        # Ignore single-letter generic characters unless specific like 'c', 'r'
        if len(skill) <= 1 and skill.lower() not in ("c", "r"):
            continue

        # Regex boundary pattern accounting for technical special characters (+, #, ., /, -)
        escaped = re.escape(skill)
        left_boundary = r"(?<![a-zA-Z0-9])"
        if skill.endswith("+") or skill.endswith("#"):
            right_boundary = r"(?![a-zA-Z0-9+#])"
        else:
            right_boundary = r"(?![a-zA-Z0-9])"

        pattern = f"{left_boundary}{escaped}{right_boundary}"

        if re.search(pattern, raw_text, re.IGNORECASE):
            found_skills_raw.add(skill)

    # Normalize all raw matches to canonical skills
    canonical_skills = set()
    for s in found_skills_raw:
        norm = normalize_skill(s)
        if norm:
            canonical_skills.add(norm)

    return sorted(list(canonical_skills))


def extract_education_level(raw_text: str) -> Optional[str]:
    """
    Extracts candidate's highest degree or education field.
    """
    text = raw_text.lower()
    degrees = [
        ("Ph.D / Doctorate", [r"\bph\.?d\b", r"\bdoctorate\b", r"\bdoctor of philosophy\b"]),
        ("Master's Degree", [r"\bmaster'?s?\b", r"\bm\.?s\.?\b", r"\bm\.?tech\b", r"\bmba\b", r"\bm\.?a\.?\b"]),
        ("Bachelor's Degree", [r"\bbachelor'?s?\b", r"\bb\.?s\.?\b", r"\bb\.?tech\b", r"\bb\.?e\.?\b", r"\bb\.?a\.?\b"]),
        ("Diploma / Associate", [r"\bdiploma\b", r"\bassociate'?s?\b"]),
    ]
    for level_name, patterns in degrees:
        for pat in patterns:
            if re.search(pat, text):
                return level_name
    return "Bachelor's Degree"  # Baseline fallback if degree text is missing


def extract_resume_data_deterministic(raw_text: str) -> Dict[str, Any]:
    """
    Main entry point for Node 1: Deterministically parses raw resume text
    without calling any external LLMs.
    """
    skills = extract_skills_deterministic(raw_text)
    expansion = expand_skills(skills)
    total_exp = extract_years_of_experience(raw_text)
    education_level = extract_education_level(raw_text)
    email = extract_email(raw_text)
    phone = extract_phone(raw_text)
    urls = extract_urls(raw_text)

    # Return structured dict for graph state and downstream ATS services
    return {
        "skills": skills,
        "explicit_skills": list(expansion["explicit_skills"]),
        "implicit_concepts": list(expansion["implicit_concepts"]),
        "all_expanded_skills": list(expansion["all_expanded_skills"]),
        "total_experience_years": total_exp,
        "education_level": education_level,
        "contact_info": {
            "email": email,
            "phone": phone,
            "urls": urls,
        },
        "raw_text_length": len(raw_text),
    }
