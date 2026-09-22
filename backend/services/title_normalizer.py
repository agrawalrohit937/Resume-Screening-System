"""
Job Title and Seniority Normalizer Module (Phase 4).
Maps raw job titles to canonical job families and standardized seniority levels.
Computes seniority delta and soft title matching scores for ATS evaluation.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple
import structlog

logger = structlog.get_logger(__name__)

# Seniority Level Definitions & Ordinal Rank
SENIORITY_RANKS: Dict[str, int] = {
    "intern": 0,
    "junior": 1,
    "mid": 2,
    "senior": 3,
    "staff": 4,
    "lead": 5,
    "manager": 5,
    "director": 6,
    "vp": 7,
    "c_level": 8,
}

# Regex Patterns for Seniority Levels
_SENIORITY_PATTERNS: List[Tuple[str, re.Pattern]] = [
    ("c_level", re.compile(r"\b(?:cto|cio|cpo|chief\s+technology\s+officer|founder|co-founder)\b", re.IGNORECASE)),
    ("vp", re.compile(r"\b(?:vp|vice\s+president)\b", re.IGNORECASE)),
    ("director", re.compile(r"\b(?:director|head\s+of)\b", re.IGNORECASE)),
    ("manager", re.compile(r"\b(?:engineering\s+manager|manager|dev\s+manager|em)\b", re.IGNORECASE)),
    ("lead", re.compile(r"\b(?:lead|tech\s+lead|team\s+lead|lead\s+developer|lead\s+engineer)\b", re.IGNORECASE)),
    ("staff", re.compile(r"\b(?:staff|principal|distinguished|sde\s*[-_]?\s*4|l4)\b", re.IGNORECASE)),
    ("senior", re.compile(r"\b(?:senior|sr\.?|sde\s*[-_]?\s*(?:3|iii)|engineer\s*[-_]?\s*(?:3|iii)|level\s*3|l3)\b", re.IGNORECASE)),
    ("junior", re.compile(r"\b(?:junior|jr\.?|associate|entry\s*level|graduate|trainee|sde\s*[-_]?\s*(?:1|i)\b|engineer\s*[-_]?\s*(?:1|i)\b|level\s*1|l1)\b", re.IGNORECASE)),
    ("intern", re.compile(r"\b(?:intern|internship|apprentice)\b", re.IGNORECASE)),
    ("mid", re.compile(r"\b(?:sde\s*[-_]?\s*(?:2|ii)|engineer\s*[-_]?\s*(?:2|ii)|level\s*2|l2|mid\s*level|intermediate)\b", re.IGNORECASE)),
]

# Regex Patterns for Job Families
_FAMILY_PATTERNS: List[Tuple[str, re.Pattern]] = [
    ("devops_cloud", re.compile(r"\b(?:devops|sre|site\s+reliability|cloud|infrastructure|platform\s+engineer|sysadmin|systems\s+engineer)\b", re.IGNORECASE)),
    ("data_science_ml", re.compile(r"\b(?:data\s+scientist|machine\s+learning|ml\s+engineer|ai\s+engineer|deep\s+learning|nlp\s+engineer|computer\s+vision|research\s+engineer)\b", re.IGNORECASE)),
    ("data_engineering", re.compile(r"\b(?:data\s+engineer|big\s+data|etl\s+developer|spark\s+developer|data\s+warehouse)\b", re.IGNORECASE)),
    ("frontend_engineer", re.compile(r"\b(?:frontend|front-end|ui\s+engineer|ui\s+developer|react\s+developer|vue\s+developer|angular\s+developer|web\s+developer)\b", re.IGNORECASE)),
    ("backend_engineer", re.compile(r"\b(?:backend|back-end|server\s+engineer|api\s+developer|java\s+developer|python\s+developer|golang\s+developer|node\s+developer)\b", re.IGNORECASE)),
    ("fullstack_engineer", re.compile(r"\b(?:fullstack|full-stack|full\s+stack)\b", re.IGNORECASE)),
    ("mobile_engineer", re.compile(r"\b(?:mobile|ios\s+developer|android\s+developer|flutter|react\s+native)\b", re.IGNORECASE)),
    ("qa_engineer", re.compile(r"\b(?:qa|quality\s+assurance|test\s+engineer|sdet|automation\s+engineer|tester)\b", re.IGNORECASE)),
    ("security_engineer", re.compile(r"\b(?:security|infosec|cybersecurity|appsec)\b", re.IGNORECASE)),
    ("product_manager", re.compile(r"\b(?:product\s+manager|technical\s+product\s+manager|product\s+owner|pm)\b", re.IGNORECASE)),
    ("software_engineer", re.compile(r"\b(?:software\s+engineer|software\s+developer|programmer|developer|coder|swe|sde)\b", re.IGNORECASE)),
]


def normalize_title(title: str) -> Dict[str, Any]:
    """
    Normalizes a job title string to its canonical job family, seniority level, and numeric rank.
    
    Time Complexity: O(L_title)
    Space Complexity: O(1)
    """
    if not title or not isinstance(title, str):
        return {
            "raw_title": "",
            "family": "general",
            "level": "mid",
            "rank": SENIORITY_RANKS["mid"],
            "canonical_title": "Software Engineer",
        }

    raw = title.strip()
    clean = re.sub(r"[^\w\s+#.-]", " ", raw)

    # 1. Identify Seniority Level
    detected_level = "mid"
    for lvl, pat in _SENIORITY_PATTERNS:
        if pat.search(clean):
            detected_level = lvl
            break

    # 2. Identify Job Family
    detected_family = "software_engineer"
    for fam, pat in _FAMILY_PATTERNS:
        if pat.search(clean):
            detected_family = fam
            break

    # 3. Format Canonical Title
    family_display = {
        "devops_cloud": "DevOps Engineer",
        "data_science_ml": "Machine Learning Engineer",
        "data_engineering": "Data Engineer",
        "frontend_engineer": "Frontend Engineer",
        "backend_engineer": "Backend Engineer",
        "fullstack_engineer": "Full Stack Engineer",
        "mobile_engineer": "Mobile Engineer",
        "qa_engineer": "QA Engineer",
        "security_engineer": "Security Engineer",
        "product_manager": "Product Manager",
        "software_engineer": "Software Engineer",
    }.get(detected_family, "Software Engineer")

    level_prefix = {
        "intern": "Intern",
        "junior": "Junior",
        "mid": "",
        "senior": "Senior",
        "staff": "Staff",
        "lead": "Lead",
        "manager": "Engineering Manager",
        "director": "Director of",
        "vp": "VP of",
        "c_level": "Chief",
    }.get(detected_level, "")

    if detected_level in ("manager", "c_level"):
        canonical = level_prefix if detected_level == "manager" else f"CTO / {family_display}"
    elif level_prefix:
        canonical = f"{level_prefix} {family_display}".strip()
    else:
        canonical = family_display

    return {
        "raw_title": raw,
        "family": detected_family,
        "level": detected_level,
        "rank": SENIORITY_RANKS.get(detected_level, 2),
        "canonical_title": canonical,
    }


def calculate_title_match(cand_title: str, jd_title: str) -> Dict[str, Any]:
    """
    Computes title family compatibility and seniority delta between candidate and JD.

    Returns:
        {
            "family_match": bool,
            "seniority_delta": int (cand_rank - jd_rank),
            "match_score": float in [0.0, 1.0],
            "cand_norm": dict,
            "jd_norm": dict,
        }
    """
    c_norm = normalize_title(cand_title)
    j_norm = normalize_title(jd_title)

    # Check Family Compatibility
    same_family = c_norm["family"] == j_norm["family"]
    # Fullstack is compatible with frontend / backend
    is_compatible_family = (
        same_family
        or (c_norm["family"] == "fullstack_engineer" and j_norm["family"] in ("frontend_engineer", "backend_engineer", "software_engineer"))
        or (j_norm["family"] == "fullstack_engineer" and c_norm["family"] in ("frontend_engineer", "backend_engineer", "software_engineer"))
        or (c_norm["family"] == "software_engineer" or j_norm["family"] == "software_engineer")
    )

    seniority_delta = c_norm["rank"] - j_norm["rank"]

    # Base score by family match
    if same_family:
        base_family_score = 1.00
    elif is_compatible_family:
        base_family_score = 0.85
    else:
        base_family_score = 0.40

    # Seniority penalty / boost
    if seniority_delta == 0:
        seniority_mult = 1.00
    elif seniority_delta == 1:
        seniority_mult = 1.00  # slightly more senior is great
    elif seniority_delta > 1:
        seniority_mult = 0.90  # overqualified
    elif seniority_delta == -1:
        seniority_mult = 0.80  # one level below
    else:
        seniority_mult = max(0.40, 1.0 - 0.20 * abs(seniority_delta))

    final_match_score = round(base_family_score * seniority_mult, 3)

    return {
        "family_match": is_compatible_family,
        "seniority_delta": seniority_delta,
        "match_score": final_match_score,
        "cand_norm": c_norm,
        "jd_norm": j_norm,
    }
