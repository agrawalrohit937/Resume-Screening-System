"""
Cultural Name Handling and Identity Service for Universal ATS.
Provides robust support for mononyms, patronymics, non-Latin scripts,
and multi-part surnames without imposing Western naming biases.
CRITICAL INVARIANT: NEVER infers gender, caste, religion, or ethnicity from names.
"""

import re
import unicodedata
from typing import Optional, List, Dict
from pydantic import BaseModel, Field
import structlog

logger = structlog.get_logger(__name__)

# Surname particles that should remain lowercase in compound last names
NAME_PARTICLES = {
    "van", "von", "de", "der", "del", "della", "da", "di", "du", "la", "le",
    "al", "el", "bin", "ibn", "bint", "af", "av", "ter", "ten"
}

# Patronymic prefixes/abbreviations common in South Asia / Middle East
PATRONYMIC_TOKENS = {"s/o", "d/o", "w/o", "so", "do", "wo", "bin", "bte", "binti", "ibn"}


class IdentityRecord(BaseModel):
    """Structured name and identity entity."""
    raw: str
    full_name: str
    display_name: str
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    patronymic: Optional[str] = None
    is_mononym: bool = False
    script_type: str = "latin"  # latin, devanagari, cjk, arabic, cyrillic, mixed


def detect_script_type(text: str) -> str:
    """Detects predominant writing script in a name."""
    scripts = set()
    for ch in text:
        if not ch.isalpha():
            continue
        name = unicodedata.name(ch, "")
        if "DEVANAGARI" in name:
            scripts.add("devanagari")
        elif "CJK" in name or "HIRAGANA" in name or "KATAKANA" in name or "HANGUL" in name:
            scripts.add("cjk")
        elif "ARABIC" in name:
            scripts.add("arabic")
        elif "CYRILLIC" in name:
            scripts.add("cyrillic")
        elif "LATIN" in name:
            scripts.add("latin")

    if not scripts:
        return "latin"
    if len(scripts) == 1:
        return next(iter(scripts))
    if "latin" in scripts and len(scripts) > 1:
        return "mixed"
    return next(iter(scripts))


def parse_cultural_name(raw_name: str) -> IdentityRecord:
    """
    Parses a name into an IdentityRecord while preserving cultural integrity.
    Supports:
    - Mononyms: "Kavitha", "Sukarno"
    - South Asian patronymics: "Kavitha S/O Ramanathan", "A. P. J. Abdul Kalam"
    - Middle Eastern / Arabic lineage: "Mohamed bin Rashid Al Maktoum"
    - European particles: "Guido van Rossum", "Leonardo da Vinci"
    - Non-Latin scripts: "रोहित अग्रवाल", "李雷", "Владимир"
    """
    if not raw_name or not isinstance(raw_name, str):
        return IdentityRecord(
            raw="",
            full_name="Candidate",
            display_name="Candidate",
            is_mononym=False,
            script_type="latin"
        )

    clean = raw_name.strip()
    script = detect_script_type(clean)

    # Mononym check: single word without spaces
    tokens = clean.split()
    if len(tokens) == 1:
        return IdentityRecord(
            raw=clean,
            full_name=clean,
            display_name=clean,
            given_name=clean,
            family_name=None,
            is_mononym=True,
            script_type=script
        )

    # Patronymic handling (e.g. "Kavitha s/o Ramanathan")
    lower_tokens = [t.lower() for t in tokens]
    for i, tok in enumerate(lower_tokens):
        if tok in PATRONYMIC_TOKENS and i > 0 and i < len(tokens) - 1:
            given = " ".join(tokens[:i])
            patronym = " ".join(tokens[i:])
            return IdentityRecord(
                raw=clean,
                full_name=clean,
                display_name=given,
                given_name=given,
                family_name=None,
                patronymic=patronym,
                is_mononym=False,
                script_type=script
            )

    # European / Arabic particle handling (e.g. "Guido van Rossum", "Omar Al-Mansoor")
    particle_indices = [idx for idx, t in enumerate(lower_tokens) if t in NAME_PARTICLES and idx > 0]
    if particle_indices:
        first_particle_idx = particle_indices[0]
        given = " ".join(tokens[:first_particle_idx])
        family = " ".join(tokens[first_particle_idx:])
        return IdentityRecord(
            raw=clean,
            full_name=clean,
            display_name=f"{given} {family}",
            given_name=given,
            family_name=family,
            is_mononym=False,
            script_type=script
        )

    # Standard multi-token split: first token as given, remainder as family
    given = tokens[0]
    family = " ".join(tokens[1:])

    return IdentityRecord(
        raw=clean,
        full_name=clean,
        display_name=clean,
        given_name=given,
        family_name=family,
        is_mononym=False,
        script_type=script
    )
