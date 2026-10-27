"""
NLP Utilities — text cleaning, keyword extraction, skill detection, and contact extraction.
Thread-safe, ontology-backed, and multi-domain (Technology, Healthcare, Finance, Legal, etc.).
"""

import json
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Set, Tuple, Optional, Dict, Any

import structlog

logger = structlog.get_logger(__name__)

# ─── Compiled Pattern Cache for Fast Multi-Pattern Matching ──────────────────
_MATCHER_CACHE: Dict[str, Any] = {}
_MATCHER_LOCK = threading.Lock()


def clean_text(text: str, remove_stopwords: bool = False) -> str:
    """Sanitizes text by lowercasing, stripping URLs, special chars, and redundant spaces."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"http\S+|www\S+", "", text)
    text = re.sub(r"[^\w\s\-\+\#\.]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _skill_pattern(s: str) -> str:
    """Generates boundary-aware regex for individual skill string."""
    escaped = re.escape(s)
    left = r"(?<![a-zA-Z0-9_])"
    right = r"(?![a-zA-Z0-9_+#])" if (s.endswith("+") or s.endswith("#") or len(s) == 1) else r"(?![a-zA-Z0-9_])"
    return f"{left}{escaped}{right}"


AMBIGUOUS_SHORT_SKILLS = {"r", "c", "go"}


def _get_expanded_tech_skills() -> Set[str]:
    """Returns technical and domain skills expanded from custom aliases and full ESCO ontology knowledge graph."""
    combined: Set[str] = set()

    # Load custom aliases (e.g. FastAPI, LangChain, Next.js, Docker, etc.)
    custom_alias_file = Path(__file__).resolve().parent.parent / "data" / "custom_skill_aliases.json"
    if custom_alias_file.exists():
        try:
            with open(custom_alias_file, "r", encoding="utf-8") as f:
                custom_aliases = json.load(f)
                combined.update(custom_aliases.keys())
                combined.update(v.lower() for v in custom_aliases.values())
        except Exception as err:
            logger.debug("Custom aliases load skipped", error=str(err))

    try:
        from services.skill_ontology import get_all_known_skills
        ontology_skills = get_all_known_skills()
        if ontology_skills:
            combined.update(ontology_skills)
    except Exception as e:
        # ─── [FALLBACK] Ontology Graph Failure Fallback ────────────────────────
        # Fallback: If ontology graph fails to load, preserve curated baseline TECH_SKILLS
        logger.warning("Could not expand skills from ontology, using baseline", error=str(e))
    return combined


def _get_compiled_skill_matcher(skills_tuple: Tuple[str, ...]) -> Tuple[Any, List[Tuple[str, Any]]]:
    """
    Builds a high-performance compiled multi-pattern matcher:
    1. Standard alphanumeric skills combined into a single pre-compiled word-boundary regex (O(n) scan).
    2. Special ending skills (+, #) or single chars compiled with strict boundary patterns.
    Ambiguous short skills ('R', 'C', 'Go') are matched only in delimiter/list contexts.
    Cached by hash of skill tuple.
    """
    cache_key = hash(skills_tuple)
    with _MATCHER_LOCK:
        if cache_key in _MATCHER_CACHE:
            return _MATCHER_CACHE[cache_key]

        special_skills = []
        std_skills = []

        # Sort longer phrases first so greedy matching captures multi-word skills before substrings
        sorted_skills = sorted(set(skills_tuple), key=lambda x: -len(x))
        for s in sorted_skills:
            if not s or not s.strip():
                continue
            s_clean = s.strip().lower()
            if s_clean in AMBIGUOUS_SHORT_SKILLS:
                # Restrict to list/bullet/delimiter or skills header context (e.g. ", C, " or "Skills: Go")
                delim_pattern = rf"(?:[\,\;\|\•\-\/\(\)\[\]\:\n]\s*|\b(?:skills?|stack|technologies?|tools?)\s*[:\-\s]\s*)\b({re.escape(s_clean)})\b(?=\s*[\,\;\|\•\-\/\(\)\[\]\:\n]|\s*$)"
                special_skills.append((s_clean, re.compile(delim_pattern, re.IGNORECASE)))
            elif s_clean.endswith("+") or s_clean.endswith("#") or len(s_clean) == 1:
                special_skills.append((s_clean, re.compile(_skill_pattern(s_clean), re.IGNORECASE)))
            else:
                std_skills.append(s_clean)

        combined_regex = None
        if std_skills:
            chunk = "|".join(re.escape(s) for s in std_skills)
            combined_regex = re.compile(rf"(?<![a-zA-Z0-9_])({chunk})(?![a-zA-Z0-9_])", re.IGNORECASE)

        matcher = (combined_regex, special_skills)
        _MATCHER_CACHE[cache_key] = matcher
        return matcher


_EXPANDED_TECH_SKILLS: Optional[Set[str]] = None
_TECH_MATCHER: Optional[Tuple[Any, List[Tuple[str, Any]]]] = None
_SOFT_MATCHER: Optional[Tuple[Any, List[Tuple[str, Any]]]] = None
_SKILLS_INIT_LOCK = threading.Lock()


def _get_cached_tech_skills_and_matcher() -> Tuple[Set[str], Tuple[Any, List[Tuple[str, Any]]]]:
    """Thread-safe singleton getter for expanded tech skills vocabulary and compiled matcher."""
    global _EXPANDED_TECH_SKILLS, _TECH_MATCHER
    if _EXPANDED_TECH_SKILLS is not None and _TECH_MATCHER is not None:
        return _EXPANDED_TECH_SKILLS, _TECH_MATCHER
    with _SKILLS_INIT_LOCK:
        if _EXPANDED_TECH_SKILLS is not None and _TECH_MATCHER is not None:
            return _EXPANDED_TECH_SKILLS, _TECH_MATCHER
        all_tech = _get_expanded_tech_skills()
        tech_tuple = tuple(sorted(all_tech))
        matcher = _get_compiled_skill_matcher(tech_tuple)
        _EXPANDED_TECH_SKILLS = all_tech
        _TECH_MATCHER = matcher
        return _EXPANDED_TECH_SKILLS, _TECH_MATCHER


def _get_cached_soft_matcher() -> Tuple[Any, List[Tuple[str, Any]]]:
    """Thread-safe singleton getter for soft skills compiled matcher."""
    global _SOFT_MATCHER
    if _SOFT_MATCHER is not None:
        return _SOFT_MATCHER
    with _SKILLS_INIT_LOCK:
        if _SOFT_MATCHER is not None:
            return _SOFT_MATCHER
        soft_tuple = (
            "adaptability", "agile", "collaboration", "communication", "creativity",
            "critical thinking", "leadership", "mentoring", "negotiation", "presentation",
            "problem solving", "project management", "scrum", "teamwork", "time management"
        )
        _SOFT_MATCHER = _get_compiled_skill_matcher(soft_tuple)
        return _SOFT_MATCHER


def detect_skills_in_text(text: str) -> Tuple[List[str], List[str]]:
    """
    Returns (technical_skills, soft_skills) found in text using cached multi-pattern matching.
    Supports all ontology domains: Technology, Healthcare, Finance, Legal, Trades, and Sales.
    Expanded vocabularies and matchers are compiled once and reused in O(1).
    """
    if not text or not text.strip():
        return [], []

    # Fast multi-term search using cached vocabulary and pre-compiled matchers
    all_tech, (std_regex, special_patterns) = _get_cached_tech_skills_and_matcher()

    found_tech: Set[str] = set()

    if std_regex:
        for match in std_regex.finditer(text):
            found_str = match.group(1).lower()
            found_tech.add(found_str)
            # If a multi-word skill matched (e.g. 'phlebotomy procedures'), also check if
            # any sub-phrase exists in all_tech (e.g. 'phlebotomy')
            words = found_str.split()
            if len(words) > 1:
                for w in words:
                    if w in all_tech:
                        found_tech.add(w)

    for skill_name, pat in special_patterns:
        if pat.search(text):
            found_tech.add(skill_name)

    # Soft skills matching using cached matcher
    soft_regex, soft_special = _get_cached_soft_matcher()
    found_soft: Set[str] = set()

    if soft_regex:
        for match in soft_regex.finditer(text):
            found_soft.add(match.group(1).lower())

    for skill_name, pat in soft_special:
        if pat.search(text):
            found_soft.add(skill_name)

    return sorted(found_tech), sorted(found_soft)


def extract_email(text: str) -> Optional[str]:
    """Extracts first valid email address from text with support for subdomains and tags."""
    if not text:
        return None
    match = re.search(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", text)
    return match.group(0) if match else None


_DATE_RANGE_PAT = re.compile(r"^(19\d{2}|20\d{2})[\s\-–to]+(19\d{2}|20\d{2})$")


def extract_phone(text: str) -> Optional[str]:
    """
    Extracts phone numbers using Google's phonenumbers library with fallback to regex.
    Rejects calendar date ranges (e.g. 2020-2024).
    Returns valid number formatted in International format or as found.
    """
    if not text:
        return None

    # Primary: phonenumbers library
    try:
        import phonenumbers
        for match in phonenumbers.PhoneNumberMatcher(text, "IN"):
            raw_cand = match.raw_string.strip()
            # Explicitly reject calendar date ranges like 2020-2024
            if _DATE_RANGE_PAT.search(raw_cand):
                continue
            num = match.number
            if phonenumbers.is_valid_number(num) or phonenumbers.is_possible_number(num):
                return phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.INTERNATIONAL)
    except Exception:
        pass

    # ─── [FALLBACK] Deterministic Regex Phone Matcher Fallback ────────────────
    # Fallback: If phonenumbers library is missing or fails on non-standard delimiters,
    # match 10+ digit candidates while rejecting calendar year ranges (e.g. 2020-2024).
    match = re.search(r"(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,5}", text)
    if match:
        candidate = match.group(0).strip()
        # Reject date ranges like 2020-2024
        if _DATE_RANGE_PAT.search(candidate):
            return None
        digits = [c for c in candidate if c.isdigit()]
        if len(digits) >= 10:
            return candidate
    return None


def extract_urls(text: str) -> List[str]:
    """Extracts web links, LinkedIn, and GitHub profiles from text."""
    if not text:
        return []
    pattern = r"https?://[^\s<>\"]+|www\.[^\s<>\"]+|linkedin\.com/in/[^\s<>\"]+|github\.com/[^\s<>\"]*"
    return re.findall(pattern, text, re.IGNORECASE)


def extract_contact_details(text: str) -> Dict[str, Optional[str]]:
    """
    Extracts email, phone, and profile URLs (linkedin, github, portfolio) as a normalized dictionary.
    Picks 'portfolio' ONLY from URLs in the first ~10 non-empty lines (header), excluding LinkedIn/GitHub,
    preventing project repository links from being mistaken as personal portfolios.
    """
    if not text:
        return {"email": None, "phone": None, "linkedin": None, "github": None, "portfolio": None}

    # Header region: first 10 non-empty lines
    header_lines = [l.strip() for l in text.splitlines() if l.strip()][:10]
    header_text = "\n".join(header_lines)
    header_urls = extract_urls(header_text)

    all_urls = extract_urls(text)
    linkedin = next((u for u in all_urls if "linkedin" in u.lower()), None)
    github = next((u for u in all_urls if "github" in u.lower()), None)
    # Portfolio comes ONLY from header region URLs
    portfolio = next(
        (u for u in header_urls if "linkedin" not in u.lower() and "github" not in u.lower()),
        None
    )

    return {
        "email": extract_email(text),
        "phone": extract_phone(text),
        "linkedin": linkedin,
        "github": github,
        "portfolio": portfolio,
    }


def count_words(text: str) -> int:
    """Returns total word count."""
    return len(text.split()) if text else 0


_HEADER_BLACKLIST_WORDS = {
    "resume", "curriculum", "vitae", "cv", "profile", "contact", "summary",
    "experience", "education", "skills", "projects", "certifications",
    "phone", "email", "address", "page", "portfolio", "github", "linkedin",
    "website", "job", "career", "objective", "applicant", "candidate",
    "technical", "personal", "professional", "details", "information"
}


def extract_name(text: str) -> Optional[str]:
    """
    Deterministically extracts the candidate's name from the top header of a resume.
    Avoids false positives such as 'Curriculum Vitae', 'Resume', headers, emails, or phone numbers.
    Supports Western, South Asian patronymics, and non-Latin scripts.
    """
    if not text or not text.strip():
        return None

    # Inspect first 8 non-empty lines (header region)
    lines = [line.strip() for line in text.strip().splitlines() if line.strip()][:8]

    for line in lines:
        # Ignore lines with emails, URLs, or long digit sequences (phones/dates)
        if "@" in line or "http" in line or "www." in line or "linkedin" in line or "github" in line:
            continue
        if re.search(r"\d{4,}", line):
            continue

        # Strip prefixes like "Name:", "Candidate Name:", "Resume of"
        cleaned_line = re.sub(
            r"^(?:name|candidate\s*name|resume\s*of|cv\s*of)\s*[:\-]?\s*",
            "",
            line,
            flags=re.IGNORECASE
        ).strip()
        cleaned_line = re.sub(r"[\(\[\{].*?[\)\]\}]", "", cleaned_line).strip()
        cleaned_line = cleaned_line.strip(",|•-–—:")

        if not cleaned_line or len(cleaned_line) > 50:
            continue

        lower = cleaned_line.lower()
        if lower in _HEADER_BLACKLIST_WORDS:
            continue

        tokens = cleaned_line.split()
        if not (1 <= len(tokens) <= 4):
            continue

        if any(t.lower() in _HEADER_BLACKLIST_WORDS for t in tokens):
            continue

        # Cultural name validation and structuring via identity_service
        try:
            from services.identity_service import parse_cultural_name
            identity = parse_cultural_name(cleaned_line)
            if identity and identity.full_name and len(identity.full_name) >= 2:
                if any(c.isalpha() for c in identity.full_name):
                    return identity.full_name
        except Exception:
            pass

    return None


def extract_years_of_experience(text: str) -> float:
    """
    Parse total years of experience from resume/JD text.
    Handles explicit freshers (0.0 years), ranges (e.g. 2-4 years -> 2.0),
    and tenured experience (e.g. 5+ years -> 5.0) while filtering out false-positive dates (e.g. 2020-2024).
    """
    if not text or not text.strip():
        return 0.0

    # 1. Explicit zero / entry-level / fresher check
    is_fresher = bool(re.search(
        r"\b(fresher|freshers|entry[\s-]level|trainee|intern|internship|graduate|no\s+prior\s+experience|no\s+experience\s+required|no\s+experience\s+needed|zero\s+experience|0\s*(?:[-–]|to)\s*1\s*(?:years?|yrs?)|0\+?\s*(?:years?|yrs?)|0\s*(?:years?|yrs?)\s+experience)\b",
        text,
        re.IGNORECASE,
    ))

    # 2. Check range patterns first (e.g. '2-4 years', '3 to 5 yrs')
    range_match = re.search(
        r"\b(\d+(?:\.\d+)?)\s*(?:[-–]|to)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp|clinical|work|professional)",
        text,
        re.IGNORECASE,
    )
    range_val = 0.0
    if range_match:
        try:
            r1 = float(range_match.group(1))
            if 0 < r1 < 50:
                range_val = r1
        except Exception:
            pass

    # 3. Check standard experience patterns
    patterns = [
        r"(?<!\d)(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp|clinical|work|professional|industry)",
        r"(?:experience|exp|background)\s*(?:of\s*)?(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)",
        r"(?<!\d)(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)(?:\s+(?:in|with|of))?\s+(?:[a-zA-Z\s]{0,25})?(?:experience|exp)",
    ]

    max_years = 0.0
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            prefix = text[max(0, match.start() - 6):match.start()]
            if re.search(r"0\s*(?:[-–]|to)\s*$", prefix, re.IGNORECASE):
                continue
            try:
                years = float(match.group(1))
                # Ignore calendar years like 2020, 1999
                if years > 50:
                    continue
                max_years = max(max_years, years)
            except ValueError:
                pass

    # If range was detected (e.g. 2-4 years), the lower bound takes precedence for min requirement
    if range_val > 0:
        max_years = range_val if max_years == 0 else min(max_years, range_val)

    if is_fresher and max_years < 2.0:
        return 0.0

    return max_years


# Precompiled date parsing patterns and month indices for fast interval calculation
_YEAR_PAT = re.compile(r"\b(19\d{2}|20\d{2})\b")
_MONTH_NAMES: Dict[str, int] = {
    "jan": 0, "feb": 1, "mar": 2, "apr": 3, "may": 4, "jun": 5,
    "jul": 6, "aug": 7, "sep": 8, "oct": 9, "nov": 10, "dec": 11,
}
_MM_YYYY_PAT = re.compile(r"\b(0?[1-9]|1[0-2])[\/\-](?:19\d{2}|20\d{2})\b")
_YYYY_MM_PAT = re.compile(r"\b(?:19\d{2}|20\d{2})[\/\-](0?[1-9]|1[0-2])\b")


def calculate_experience_from_intervals(work_experience: List[Any]) -> float:
    """
    Computes total non-overlapping years of experience using interval union of [start_date, end_date].
    Prevents double-counting overlapping tenures (e.g. concurrent freelance and full-time roles).
    Does NOT infer exact months when only years are provided in the resume text.
    Handles single-year entries, current roles, and falls back to duration_months for undated roles.
    """
    if not work_experience:
        return 0.0

    now = datetime.now(timezone.utc)
    current_year_float = now.year + (now.month - 1) / 12.0

    def _parse_date_to_float(date_val: Any, default_is_current: bool = False) -> Tuple[Optional[float], bool]:
        if not date_val:
            return (current_year_float, True) if default_is_current else (None, False)
        d_str = str(date_val).lower().strip()
        if any(w in d_str for w in ["present", "current", "now", "ongoing"]):
            return (current_year_float, True)
        m_year = _YEAR_PAT.search(d_str)
        if not m_year:
            return (None, False)
        year = float(m_year.group(1))
        month_fraction = 0.0
        has_month = False
        for m_str, m_idx in _MONTH_NAMES.items():
            if m_str in d_str:
                month_fraction = m_idx / 12.0
                has_month = True
                break

        if not has_month:
            num_m = _MM_YYYY_PAT.search(d_str)
            if num_m:
                month_fraction = (int(num_m.group(1)) - 1) / 12.0
                has_month = True
            else:
                num_m2 = _YYYY_MM_PAT.search(d_str)
                if num_m2:
                    month_fraction = (int(num_m2.group(1)) - 1) / 12.0
                    has_month = True

        return (year + month_fraction, has_month)

    intervals: List[Tuple[float, float]] = []
    undated_months = 0

    for exp in work_experience:
        start_date = getattr(exp, "start_date", None) if not isinstance(exp, dict) else exp.get("start_date")
        end_date = getattr(exp, "end_date", None) if not isinstance(exp, dict) else exp.get("end_date")
        is_cur = getattr(exp, "is_current", False) if not isinstance(exp, dict) else bool(exp.get("is_current", False))
        dur_m = getattr(exp, "duration_months", None) if not isinstance(exp, dict) else exp.get("duration_months")

        start, start_has_m = _parse_date_to_float(start_date)
        end, end_has_m = _parse_date_to_float(end_date, default_is_current=is_cur)

        # Sanity check valid career years
        if start is not None and 1960 <= start <= current_year_float + 0.5:
            if end is not None:
                end = min(end, current_year_float)
                if end == start:
                    # Provide realistic minimum duration for single-year entries (6 months for year-only, 1 month for month-level)
                    end = start + ((1.0 / 12.0) if (start_has_m or end_has_m) else 0.5)
                if end >= start and (end - start) < 55:
                    intervals.append((start, end))
                    continue

        # ─── [FALLBACK] Undated Work Experience Duration Fallback ─────────────
        # Fallback: If dates are missing or invalid, collect explicit duration_months
        if dur_m and isinstance(dur_m, (int, float)) and 0 < dur_m < 600:
            undated_months += int(dur_m)

    if not intervals:
        # Fallback: If no date intervals could be parsed, use total undated months
        return round(undated_months / 12.0, 1) if undated_months > 0 else 0.0

    # Sort intervals by start date and compute union
    intervals.sort(key=lambda x: x[0])
    merged: List[Tuple[float, float]] = [intervals[0]]
    for cur_start, cur_end in intervals[1:]:
        last_start, last_end = merged[-1]
        if cur_start <= last_end:
            merged[-1] = (last_start, max(last_end, cur_end))
        else:
            merged.append((cur_start, cur_end))

    total_years = sum(end - start for start, end in merged)
    return round(total_years, 1)


def extract_sections(text: str) -> Dict[str, str]:
    """
    Split resume text into named sections by detecting common headers across industries:
    Technology, Healthcare/Clinical, Finance/Accounting, Legal, Trades, and Academia.
    """
    section_headers = {
        "summary": r"(career\s*summary|professional\s*summary|personal\s*statement|executive\s*summary|summary|objective|profile|about\s*me|overview)",
        "experience": r"(employment\s*history|work\s*history|job\s*history|relevant\s*experience|professional\s*experience|work\s*experience|clinical\s*experience|clinical\s*rotations?|hospital\s*postings?|residency|practicum|positions?\s*held|experience|employment|career|internship)",
        "education": r"(academic\s*background|academic\s*history|education|academic|qualification|qualifications|schooling|degree|university|college)",
        "skills": r"(technical\s*skills|core\s*competencies|key\s*skills|areas\s*of\s*expertise|clinical\s*skills|technical\s*proficiencies|tech\s*stack|skills|competencies|expertise|technologies|tools|languages)",
        "projects": r"(personal\s*projects?|key\s*projects?|academic\s*projects?|notable\s*projects?|case\s*studies|projects?|portfolio)",
        "certifications": r"(professional\s*certifications?|licensure\s*(?:&|and)?\s*credentials?|certifications?\s*(?:&|and)?\s*licenses?|certifications?|certificates?|licenses?|licensure|credentials?|courses?|training|accreditations?|achievements?|awards?|medical\s*registrations?|board\s*certifications?)",
        "publications": r"(publications?|papers?|research|patents?)",
        "volunteer": r"(volunteer|community|extracurricular|activities|leadership)",
    }
    sections: Dict[str, str] = {}
    lines = text.split("\n")
    current_section = "header"
    buffer: List[str] = []

    for line in lines:
        line_stripped = line.strip()
        if not line_stripped:
            buffer.append(line)
            continue

        matched_section = None
        # Headers are typically short lines (≤80 chars) with optional formatting symbols (: - = #)
        if len(line_stripped) <= 80:
            for section, pattern in section_headers.items():
                if re.search(rf"^[\W_]*({pattern})[\W_:]*$", line_stripped, re.IGNORECASE):
                    matched_section = section
                    break

        if matched_section:
            if buffer:
                sections[current_section] = "\n".join(buffer).strip()
            current_section = matched_section
            buffer = []
        else:
            buffer.append(line)

    # Save final section
    if buffer:
        sections[current_section] = "\n".join(buffer).strip()

    return sections
