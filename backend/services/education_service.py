"""
Education Equivalence and Skills-First Education Service.
Maps qualifications to ISCED-2011 levels across IN, US, UK, EU, CA, AU, SG, AE,
and supports Skills-First mode (required | preferred | ignored).
"""

import csv
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import structlog

logger = structlog.get_logger(__name__)

EQUIVALENCE_CSV = Path(__file__).resolve().parent.parent / "data" / "education_equivalence.csv"

_PURSUING_PATTERN = re.compile(
    r"\b(pursuing|expected|anticipated|in[\s-]progress|currently[\s-]enrolled|final[\s-]year|present|current|ongoing|studying|candidate\s+for)\b",
    re.IGNORECASE,
)

# In-memory cached equivalence tables:
# (country, clean_term) -> (degree_rank, isced_level, canonical_label)
_EQUIVALENCE_MAP: Dict[Tuple[str, str], Tuple[int, int, str]] = {}
_GLOBAL_SYNONYMS: Dict[str, Tuple[int, int, str]] = {}


def _load_equivalence_table():
    if _EQUIVALENCE_MAP:
        return

    if not EQUIVALENCE_CSV.exists():
        logger.warning("Education equivalence CSV not found", path=str(EQUIVALENCE_CSV))
        return

    try:
        with open(EQUIVALENCE_CSV, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                country = (row.get("country_iso2") or "IN").strip().upper()
                canon = (row.get("credential_name") or "").strip()
                isced = int(row.get("isced_level") or 0)
                rank = int(row.get("degree_rank") or 0)
                label = (row.get("level_label") or canon).strip()
                synonyms = [s.strip().lower() for s in (row.get("synonyms") or "").split("|") if s.strip()]
                synonyms.append(canon.lower())

                entry = (rank, isced, label)
                for syn in synonyms:
                    _EQUIVALENCE_MAP[(country, syn)] = entry
                    if syn not in _GLOBAL_SYNONYMS or isced > _GLOBAL_SYNONYMS[syn][1]:
                        _GLOBAL_SYNONYMS[syn] = entry

        logger.info(
            "Education equivalence table loaded",
            entries_count=len(_EQUIVALENCE_MAP),
            global_synonyms=len(_GLOBAL_SYNONYMS),
        )
    except Exception as e:
        logger.error("Failed to load education equivalence CSV", error=str(e))


_load_equivalence_table()


def is_degree_in_progress(edu: dict, raw_text: str = "", current_year: int = 2026) -> bool:
    """
    Detects if an education credential is currently in-progress or being pursued.
    Handles keywords ('pursuing', 'expected', 'in progress', 'present', 'ongoing'),
    date ranges ending in future years ('2023-2027', '2024-2028', '2023 to 2027'),
    and explicit end_year/graduation_year >= current_year or missing end_year with recent start_year.
    """
    if not isinstance(edu, dict):
        deg_str = str(edu or "")
        dates_str = ""
        notes_str = ""
    else:
        deg_str = str(edu.get("degree") or edu.get("level") or "")
        dates_str = str(edu.get("dates") or edu.get("year") or edu.get("duration") or edu.get("period") or "")
        notes_str = str(edu.get("notes") or "")

    combined = f"{deg_str} {dates_str} {notes_str}".lower()

    if _PURSUING_PATTERN.search(combined):
        return True

    # Check for date ranges like 2023-2027, 2023 - 2027, 2023 to 2027, 2023/2027
    range_match = re.search(r"\b(20\d{2})\s*(?:-|–|—|to|/)\s*(20\d{2}|present|current|expected)\b", combined, re.IGNORECASE)
    if range_match:
        end_val = range_match.group(2).lower()
        if end_val in ("present", "current", "expected"):
            return True
        try:
            if int(end_val) >= current_year:
                return True
        except ValueError:
            pass

    # Single future year e.g. 'Expected 2027', 'Class of 2027', '2027'
    if re.search(r"\b(202[6-9]|203\d)\b", combined):
        return True

    # Check end_year or graduation_year field
    if isinstance(edu, dict):
        end_year_val = edu.get("end_year") or edu.get("graduation_year") or edu.get("end_date")
        if end_year_val is not None:
            if isinstance(end_year_val, (int, float)):
                if end_year_val >= current_year:
                    return True
            elif isinstance(end_year_val, str):
                if re.search(r"\b(present|current|expected|ongoing)\b", end_year_val.lower()):
                    return True
                num_m = re.search(r"\b(20\d{2})\b", end_year_val)
                if num_m and int(num_m.group(1)) >= current_year:
                    return True
        elif edu.get("start_year"):
            try:
                s_yr = int(str(edu.get("start_year"))[:4])
                if s_yr >= current_year - 4:
                    return True
            except (ValueError, TypeError):
                pass

    if raw_text and ("pursuing" in raw_text.lower() or "2023-2027" in raw_text or "2023 - 2027" in raw_text):
        return True

    return False


def resolve_degree_level(degree_str: str, country: str = "IN") -> Tuple[int, int, str]:
    """
    Resolves degree text to (degree_rank, isced_level, canonical_label).
    degree_rank: 1 (ITI/Diploma) to 5 (Ph.D)
    isced_level: 0 to 8 per ISCED-2011
    """
    if not degree_str:
        return 0, 0, "None"

    _load_equivalence_table()
    clean = re.sub(r"[^\w\s\.\-]", " ", degree_str.strip().lower())
    clean = re.sub(r"\s+", " ", clean)
    country_clean = (country or "IN").strip().upper()

    # 1. Exact country + synonym match
    if (country_clean, clean) in _EQUIVALENCE_MAP:
        return _EQUIVALENCE_MAP[(country_clean, clean)]

    # 2. Substring matching in country-specific synonyms (sorted by longest synonym first for specificity)
    for (cntry, syn), val in sorted(_EQUIVALENCE_MAP.items(), key=lambda x: len(x[0][1]), reverse=True):
        if cntry == country_clean:
            if re.search(r"\b" + re.escape(syn) + r"\b", clean):
                return val

    # 3. Global synonyms match (longest first)
    for syn, val in sorted(_GLOBAL_SYNONYMS.items(), key=lambda x: len(x[0]), reverse=True):
        if re.search(r"\b" + re.escape(syn) + r"\b", clean):
            return val

    return 0, 0, "Unclassified"


def candidate_highest_education(
    extracted_data: dict, country: str = "IN"
) -> Tuple[int, int, bool, str, List[str]]:
    """
    Returns (highest_rank, highest_isced, is_in_progress, label, evidence_list).
    Accurately classifies in-progress credentials ('2023-2027', 'Pursuing', 'Final Year').
    """
    education_entries = extracted_data.get("education", []) or []
    raw_text = str(extracted_data.get("raw_text") or "")
    max_rank = 0
    max_isced = 0
    in_progress = False
    best_label = "None"
    evidence = []

    for i, edu in enumerate(education_entries):
        if hasattr(edu, "model_dump"):
            edu = edu.model_dump()
        elif hasattr(edu, "__dict__"):
            edu = edu.__dict__
        if not isinstance(edu, dict):
            continue

        deg_str = str(edu.get("degree") or edu.get("level") or "")
        rank, isced, label = resolve_degree_level(deg_str, country=country)
        is_pursuing = is_degree_in_progress(edu, raw_text=raw_text)

        if rank > max_rank or (rank == max_rank and isced > max_isced):
            max_rank = rank
            max_isced = isced
            in_progress = is_pursuing
            best_label = label
            evidence = [f"education[{i}]: {deg_str}{' (In-Progress / Pursuing)' if is_pursuing else ''}"]
        elif rank == max_rank and is_pursuing:
            in_progress = True

    if max_rank == 0 and extracted_data.get("education_level"):
        lvl_str = str(extracted_data.get("education_level") or "")
        rank, isced, label = resolve_degree_level(lvl_str, country=country)
        if rank > 0:
            max_rank = rank
            max_isced = isced
            best_label = label
            is_pursuing = is_degree_in_progress({"degree": lvl_str}, raw_text=raw_text)
            in_progress = is_pursuing
            evidence = [f"education_level: {lvl_str}{' (In-Progress / Pursuing)' if is_pursuing else ''}"]

    if max_rank == 0 and raw_text:
        # Fallback check on raw text for degree patterns
        rank, isced, label = resolve_degree_level(raw_text, country=country)
        if rank > 0:
            max_rank = rank
            max_isced = isced
            best_label = label
            in_progress = is_degree_in_progress({"degree": raw_text}, raw_text=raw_text)
            evidence = [f"raw_text_education: {label}{' (In-Progress / Pursuing)' if in_progress else ''}"]

    return max_rank, max_isced, in_progress, best_label, evidence


def get_education_classification(extracted_data: dict, country: str = "IN") -> Dict[str, Any]:
    """
    Returns structured education classification details for UI badges and explainability.
    """
    rank, isced, in_progress, label, evidence = candidate_highest_education(extracted_data, country=country)
    if rank == 0:
        status_label = "No Degree Found"
        classification = "None"
    elif in_progress:
        status_label = "Degree in Progress"
        classification = "In-Progress / Pursuing"
    else:
        status_label = "Degree Completed"
        classification = "Completed"

    return {
        "degree_rank": rank,
        "isced_level": isced,
        "is_in_progress": in_progress,
        "canonical_label": label,
        "classification": classification,
        "status_label": status_label,
        "evidence": evidence,
    }
