"""
Scoring Engine — Unified Multi-Factor ATS & Reranking Scoring Architecture.

Phase 1 of Budget-Smart Hybrid-RAG Overhaul:
- Single unified entrypoint: `score_resume(resume, jd, mode="candidate" | "recruiter")`
- Parameterized scoring weights via `WeightProfile` dataclass
  * Candidate Mode: 80% Strict / Knockout Math (70% Skills, 15% Experience, 15% Education) + 20% Semantic Vector Match
  * Recruiter Mode: 60% Strict / Knockout Math (50% Skills, 30% Experience, 20% Education) + 40% Semantic Vector Match + Hard Knockout enforcement
- Eliminates duplicated scoring code between candidate and recruiter routes.
"""

from __future__ import annotations

import gc
import math
import os
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Union

import requests
import structlog

from services.scoring.constants import SkillMatch

logger = structlog.get_logger(__name__)

# External services / ontology (fail-safe imports)
try:
    from services.nlp_extractor import extract_resume_data_deterministic, extract_skills_deterministic
except Exception:
    extract_resume_data_deterministic = None
    extract_skills_deterministic = None

try:
    from services.skill_ontology import evaluate_skill_fulfillment, canonicalize_skills, normalize_skill
except Exception:
    evaluate_skill_fulfillment = None
    canonicalize_skills = None
    normalize_skill = None

HF_TOKEN = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_API_KEY")
HF_API_URL = os.getenv("HF_API_URL", "https://api-inference.huggingface.co/models/BAAI/bge-large-en-v1.5")


# ══════════════════════════════════════════════════════════════════════════
# 1. WEIGHT PROFILES & CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════

SCORING_ENGINE_VERSION: str = "1.0.0"


@dataclass
class WeightProfile:
    """Configurable scoring weights for candidate vs. recruiter evaluation."""
    strict_weight: float = 0.70       # Knockout / deterministic skills math weight
    semantic_weight: float = 0.30     # Vector embedding / semantic similarity weight
    skills_weight: float = 0.50       # Weight of mandatory skills within strict math
    experience_weight: float = 0.30   # Weight of experience years within strict math
    education_weight: float = 0.20    # Weight of degree ranking within strict math
    enforce_hard_knockout: bool = False # In recruiter mode, immediately downrank / flag hard rejections
    knockout_years_threshold_ratio: float = 0.5 # Configurable ratio below which experience is hard-knockout

CANDIDATE_PROFILE = WeightProfile(
    strict_weight=0.80,
    semantic_weight=0.20,
    skills_weight=0.70,
    experience_weight=0.15,
    education_weight=0.15,
    enforce_hard_knockout=False,
    knockout_years_threshold_ratio=0.5,
)

RECRUITER_PROFILE = WeightProfile(
    strict_weight=0.60,
    semantic_weight=0.40,
    skills_weight=0.50,
    experience_weight=0.30,
    education_weight=0.20,
    enforce_hard_knockout=True,
    knockout_years_threshold_ratio=0.5,
)

SCORING_PROFILES = {
    "candidate": CANDIDATE_PROFILE,
    "recruiter": RECRUITER_PROFILE,
}


# ══════════════════════════════════════════════════════════════════════════
# 2. INTERNAL MATH & EVALUATION HELPERS
# ══════════════════════════════════════════════════════════════════════════

_EXPECTED_SECTION_HINTS = [
    r"experience", r"education", r"skills", r"projects", r"summary",
    r"objective", r"certifi", r"work history", r"employment",
]

_SOFT_LANGUAGE = re.compile(
    r"\b(preferred|nice[\s-]to[\s-]have|plus|bonus|desirable|a\s+plus|ideally|good\s+to\s+have)\b",
    re.IGNORECASE,
)
_HARD_LANGUAGE = re.compile(
    r"\b(required|must\s+have|minimum|at\s+least|essential|mandatory|must\s+possess|need\s+to\s+have)\b",
    re.IGNORECASE,
)

_YEARS_PATTERNS = [
    re.compile(r"(\d+)\s*\+\s*years?", re.IGNORECASE),
    re.compile(r"(\d+)\s*(?:to|-|–)\s*\d+\s*years?", re.IGNORECASE),
    re.compile(r"minimum\s+of\s+(\d+)\s*years?", re.IGNORECASE),
    re.compile(r"at\s+least\s+(\d+)\s*years?", re.IGNORECASE),
    re.compile(r"(\d+)\s*years?\s*(?:of\s+)?(?:relevant\s+|professional\s+|work\s+)?experience", re.IGNORECASE),
]

_DEGREE_RANK = {
    "high school": 1, "diploma": 1,
    "associate": 2,
    "bachelor": 3, "b.tech": 3, "btech": 3, "b.e.": 3, "be": 3, "b.s.": 3,
    "bs": 3, "b.a.": 3, "ba": 3, "bca": 3, "bsc": 3,
    "master": 4, "m.tech": 4, "mtech": 4, "m.s.": 4, "ms": 4, "m.a.": 4,
    "ma": 4, "mba": 4, "mca": 4, "msc": 4,
    "phd": 5, "ph.d.": 5, "doctorate": 5,
}

_DEGREE_WORD_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in sorted(_DEGREE_RANK, key=len, reverse=True)) + r")\b",
    re.IGNORECASE,
)

_PURSUING_PATTERN = re.compile(
    r"\b(pursuing|expected|anticipated|in\s+progress|currently\s+enrolled|final[\s-]year)\b",
    re.IGNORECASE,
)

_ENGLISH_STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from",
    "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him", "himself",
    "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me", "more", "most",
    "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once", "only", "or", "other", "our",
    "ours", "ourselves", "out", "over", "own", "same", "she", "should", "so", "some", "such", "than",
    "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they", "this",
    "those", "through", "to", "too", "under", "until", "up", "very", "was", "we", "were", "what",
    "when", "where", "which", "while", "who", "whom", "why", "with", "would", "you", "your", "yours",
    "resume", "experience", "education", "skills", "project", "projects", "work", "responsibilities"
}


def _context_is_hard_requirement(jd_text: str, match_start: int, match_end: int, window: int = 90) -> bool:
    lo = max(0, match_start - window)
    hi = min(len(jd_text), match_end + window)
    ctx = jd_text[lo:hi]
    if _SOFT_LANGUAGE.search(ctx):
        return False
    if _HARD_LANGUAGE.search(ctx):
        return True
    return True


def _extract_years_requirement(jd_text: str) -> Optional[Tuple[float, bool]]:
    best: Optional[Tuple[float, bool]] = None
    for pattern in _YEARS_PATTERNS:
        for m in pattern.finditer(jd_text):
            try:
                years = float(m.group(1))
            except (ValueError, IndexError):
                continue
            is_hard = _context_is_hard_requirement(jd_text, m.start(), m.end())
            if best is None or years > best[0]:
                best = (years, is_hard)
    return best


def _extract_degree_requirement(jd_text: str) -> Optional[Tuple[int, str, bool]]:
    best: Optional[Tuple[int, str, bool]] = None
    for m in _DEGREE_WORD_PATTERN.finditer(jd_text):
        label = m.group(1).lower()
        rank = _DEGREE_RANK.get(label)
        if rank is None:
            continue
        is_hard = _context_is_hard_requirement(jd_text, m.start(), m.end())
        if best is None or rank > best[0]:
            best = (rank, label, is_hard)
    return best


def _candidate_max_degree_rank(extracted_data: dict) -> Tuple[int, bool]:
    education = extracted_data.get("education", []) or []
    max_rank = 0
    in_progress = False
    for edu in education:
        if hasattr(edu, "model_dump"):
            edu = edu.model_dump()
        elif hasattr(edu, "__dict__"):
            edu = edu.__dict__
        degree_str = str(edu.get("degree") or "")
        m = _DEGREE_WORD_PATTERN.search(degree_str)
        if not m:
            continue
        rank = _DEGREE_RANK.get(m.group(1).lower(), 0)
        is_pursuing = bool(_PURSUING_PATTERN.search(degree_str)) or not edu.get("end_year")
        if rank > max_rank:
            max_rank = rank
            in_progress = is_pursuing
        elif rank == max_rank and is_pursuing:
            in_progress = True

    if max_rank == 0 and extracted_data.get("education_level"):
        edu_level_str = str(extracted_data.get("education_level") or "")
        m = _DEGREE_WORD_PATTERN.search(edu_level_str)
        if m:
            max_rank = _DEGREE_RANK.get(m.group(1).lower(), 0)

    return max_rank, in_progress


def _skills_score(
    cand_skills: List[str],
    jd_skills: List[str],
) -> Tuple[float, List[str], List[str], List[str]]:
    """
    Computes graded skill credit and partitions required skills into:
      - matched_skills (credit >= 0.9)
      - transferable_skills (credit in [0.3, 0.9))
      - missing_skills (credit < 0.3)

    Complexity:
      Time: O(N_jd * N_cand)
      Space: O(N_jd + N_cand)
    """
    matched, transferable, missing = [], [], []
    canonical_jd = canonicalize_skills(jd_skills) if canonicalize_skills else list(dict.fromkeys(jd_skills or []))
    if not canonical_jd:
        return 1.0, cand_skills, [], []

    canonical_cand = canonicalize_skills(cand_skills) if canonicalize_skills else cand_skills
    total_credit = 0.0

    for req in canonical_jd:
        match_obj: Optional[SkillMatch] = None
        if evaluate_skill_fulfillment:
            res = evaluate_skill_fulfillment(req, canonical_cand)
            if isinstance(res, SkillMatch):
                match_obj = res
            elif isinstance(res, tuple):
                match_obj = SkillMatch(
                    required=req,
                    credit=1.0 if res[0] else 0.0,
                    match_type=str(res[1]),
                    bucket="matched" if res[0] else "missing",
                )
        else:
            is_exact = (req or "").lower() in [c.lower() for c in (canonical_cand or [])]
            match_obj = SkillMatch(
                required=req,
                credit=1.0 if is_exact else 0.0,
                match_type="EXACT" if is_exact else "NONE",
                bucket="matched" if is_exact else "missing",
            )

        credit = match_obj.credit if match_obj is not None else 0.0
        bucket = match_obj.bucket if match_obj is not None else "missing"
        total_credit += credit

        # Partition strictly into one of the three disjoint buckets
        if bucket == "matched" or credit >= 0.9:
            matched.append(req)
        elif bucket == "transferable" or credit >= 0.3:
            transferable.append(req)
        else:
            missing.append(req)

    # Invariant: Pairwise disjoint sets whose union equals canonical_jd
    matched_set = {m.lower() for m in matched}
    transferable = [t for t in transferable if t.lower() not in matched_set]
    transferable_set = {t.lower() for t in transferable}
    missing = [s for s in missing if s.lower() not in matched_set and s.lower() not in transferable_set]

    score = total_credit / len(canonical_jd) if canonical_jd else 1.0
    return score, matched, transferable, missing


def _experience_score(extracted_data: dict, jd_text: str, min_years: Optional[float] = None) -> float:
    cand_exp = float(extracted_data.get("total_experience_years") or 0.0)
    # Fix 5: Authoritative structured min_years resolution
    if min_years is not None and float(min_years) > 0:
        required_exp = float(min_years)
    else:
        years_req = _extract_years_requirement(jd_text)
        required_exp = years_req[0] if years_req else 0.0
    return min(1.0, cand_exp / required_exp) if required_exp > 0 else (0.8 if cand_exp > 0 else 0.5)


def _education_score(extracted_data: dict, jd_text: str) -> float:
    degree_req = _extract_degree_requirement(jd_text)
    required_rank = degree_req[0] if degree_req else 1
    cand_rank, _ = _candidate_max_degree_rank(extracted_data)
    return 1.0 if cand_rank >= required_rank else (cand_rank / max(required_rank, 1) if cand_rank > 0 else 0.6)


def _knockout_math(
    extracted_data: dict,
    jd_text: str,
    skill_universe: Optional[List[str]] = None,
    profile: Optional[WeightProfile] = None,
) -> Dict[str, Any]:
    prof = profile or CANDIDATE_PROFILE
    cand_skills = extracted_data.get("skills", []) or extracted_data.get("technical_skills", []) or []

    # Identify JD skills
    if skill_universe:
        jd_skills = canonicalize_skills(skill_universe) if canonicalize_skills else skill_universe
    elif extract_skills_deterministic:
        raw_jd_skills = extract_skills_deterministic(jd_text)
        jd_skills = canonicalize_skills(raw_jd_skills) if canonicalize_skills else raw_jd_skills
    else:
        jd_skills = []

    s_score, matched_skills, transferable_skills, missing_skills = _skills_score(cand_skills, jd_skills)
    exp_score = _experience_score(extracted_data, jd_text)
    edu_score = _education_score(extracted_data, jd_text)

    math_score = (
        (s_score * prof.skills_weight)
        + (exp_score * prof.experience_weight)
        + (edu_score * prof.education_weight)
    )

    return {
        "skills_score": round(s_score * 100, 1),
        "experience_score": round(exp_score * 100, 1),
        "education_score": round(edu_score * 100, 1),
        "knockout_math_score": round(math_score * 100, 1),
        "matched_skills": matched_skills,
        "transferable_skills": transferable_skills,
        "missing_skills": missing_skills,
    }


def _parsing_health(raw_text: str) -> Dict[str, Any]:
    warnings: List[str] = []
    text = (raw_text or "").strip()
    words = text.split()
    word_count = len(words)

    if word_count == 0:
        return {
            "is_healthy": False,
            "confidence": 0.0,
            "warnings": ["No text could be extracted at all. The file may be a scanned image or corrupted."],
            "metrics": {"word_count": 0},
        }

    too_short = word_count < 100
    short_tokens = sum(1 for w in words if len(re.sub(r"[^A-Za-z0-9]", "", w)) <= 2)
    short_token_ratio = short_tokens / word_count
    alpha_chars = sum(1 for c in text if c.isalpha())
    alpha_ratio = alpha_chars / max(len(text), 1)
    clean_lengths = [len(re.sub(r"[^A-Za-z0-9]", "", w)) for w in words]
    clean_lengths = [l for l in clean_lengths if l > 0]
    avg_word_len = sum(clean_lengths) / len(clean_lengths) if clean_lengths else 0
    sections_found = sum(1 for pat in _EXPECTED_SECTION_HINTS if re.search(pat, text.lower()))

    if too_short:
        warnings.append(f"Only {word_count} words extracted — unusually brief for a resume.")
    if short_token_ratio > 0.35:
        warnings.append("High ratio of short text fragments (likely multi-column layout issue).")
    if alpha_ratio < 0.55:
        warnings.append("High ratio of symbols/whitespace to letters.")
    if avg_word_len and avg_word_len < 3.2:
        warnings.append("Extracted words are unusually short on average.")
    if sections_found == 0:
        warnings.append("No standard resume section headers detected.")

    confidence = 1.0
    if too_short:
        confidence -= 0.4
    confidence -= min(short_token_ratio, 0.5)
    if alpha_ratio < 0.55:
        confidence -= 0.2
    if avg_word_len and avg_word_len < 3.2:
        confidence -= 0.15
    if sections_found == 0:
        confidence -= 0.2
    confidence = max(0.0, min(1.0, confidence))

    return {
        "is_healthy": confidence >= 0.6 and not too_short,
        "confidence": round(confidence, 2),
        "warnings": warnings,
        "metrics": {
            "word_count": word_count,
            "short_token_ratio": round(short_token_ratio, 3),
            "alpha_ratio": round(alpha_ratio, 3),
            "avg_word_len": round(avg_word_len, 2),
            "sections_found": sections_found,
        },
    }


def _knockout_check(
    extracted_data: dict,
    jd_text: str,
    min_years: Optional[float] = None,
    profile: Optional[WeightProfile] = None,
) -> Dict[str, Any]:
    reasons: List[str] = []
    advisories: List[str] = []
    prof = profile or CANDIDATE_PROFILE

    if not jd_text or not jd_text.strip():
        return {"is_knockout": False, "reasons": [], "advisories": []}

    candidate_years = float(extracted_data.get("total_experience_years") or 0)

    # Fix 5: Reconcile min_years (structured field) vs regex extraction from JD text.
    # 1. Authoritative: if min_years is present and > 0, use it.
    # 2. Tone/severity: regex classification from JD text determines hard vs. soft framing.
    regex_years_req = _extract_years_requirement(jd_text)
    if min_years is not None and float(min_years) > 0:
        required_years = float(min_years)
        is_hard = regex_years_req[1] if regex_years_req is not None else True
    elif regex_years_req is not None:
        required_years, is_hard = regex_years_req
    else:
        required_years, is_hard = None, False

    if required_years is not None and required_years > 0:
        threshold_ratio = getattr(prof, "knockout_years_threshold_ratio", 0.5)
        if candidate_years <= 0 and required_years > 0:
            msg = f"Requires {required_years:.0f}+ years of professional experience — none detected."
            if is_hard:
                reasons.append(msg)
            else:
                advisories.append(msg + " (preferred)")
        elif candidate_years < required_years:
            msg = f"Requires {required_years:.0f}+ years of experience; resume shows ~{candidate_years:.1f} year(s)."
            if is_hard and candidate_years < required_years * threshold_ratio:
                reasons.append(msg)
            else:
                advisories.append(msg)

    degree_req = _extract_degree_requirement(jd_text)
    if degree_req is not None:
        required_rank, required_label, is_hard = degree_req
        candidate_rank, in_progress = _candidate_max_degree_rank(extracted_data)
        if candidate_rank == 0:
            msg = f"Requires a {required_label.title()}-level degree — none found on resume."
            if is_hard:
                reasons.append(msg)
            else:
                advisories.append(msg + " (preferred)")
        elif candidate_rank < required_rank:
            msg = f"Requires a {required_label.title()}-level degree; highest education ranks below."
            if is_hard:
                reasons.append(msg)
            else:
                advisories.append(msg)
        elif in_progress:
            advisories.append(f"Meets the {required_label.title()}-level requirement with a degree currently in progress.")

    return {
        "is_knockout": len(reasons) > 0,
        "reasons": reasons,
        "advisories": advisories,
    }


def _exact_keyword_match(raw_text: str, skill_universe: List[str]) -> Dict[str, Any]:
    text = raw_text or ""
    universe = canonicalize_skills(skill_universe) if canonicalize_skills else []
    if not universe:
        seen = set()
        for s in (skill_universe or []):
            key = (s or "").strip().lower()
            if key and key not in seen:
                seen.add(key)
                universe.append(s.strip())

    if not universe:
        return {"strict_ats_score": 0.0, "matched_exact": [], "missing_exact": []}

    matched, missing = [], []
    for skill in universe:
        sub_skills = [sub.strip() for sub in skill.split("/") if sub.strip()] if "/" in skill else [skill]
        skill_matched = False
        for sub in sub_skills:
            cleaned = sub.strip()
            if not cleaned:
                continue
            parts = [p for p in re.split(r'[\s\-\.]+', cleaned) if p]
            if not parts:
                continue
            escaped_parts = [re.escape(part) for part in parts]
            regex_str = r"[\s\-\.\n\r]+".join(escaped_parts)
            try:
                pattern = re.compile(r"(?<![A-Za-z0-9])" + regex_str + r"(?![A-Za-z0-9])", re.IGNORECASE)
                if pattern.search(text):
                    skill_matched = True
                    break
            except re.error:
                continue

        if skill_matched:
            matched.append(skill)
        else:
            missing.append(skill)

    # Invariant: Matched cannot be missing
    matched_set = {m.lower() for m in matched}
    missing = [s for s in missing if s.lower() not in matched_set]

    total = len(matched) + len(missing)
    score = round((len(matched) / total) * 100, 1) if total > 0 else 0.0
    return {
        "strict_ats_score": score,
        "matched_exact": matched,
        "missing_exact": missing,
    }


def _semantic_vector_similarity(resume_text: str, jd_text: str) -> float:
    if not resume_text or not jd_text:
        return 0.0

    # 1. Prefer local BGE embedding model (instant, offline CPU execution)
    try:
        from services.embedding_service import embedding_model
        vecs = embedding_model.encode([resume_text[:2500], jd_text[:2500]])
        if len(vecs) == 2:
            v1, v2 = vecs[0], vecs[1]
            dot = sum(a * b for a, b in zip(v1, v2))
            return round(min(100.0, max(0.0, dot * 100.0)), 1)
    except Exception as e:
        logger.debug("Local embedding similarity failed, trying remote or TF-IDF", error=str(e))

    if HF_TOKEN:
        headers = {"Authorization": f"Bearer {HF_TOKEN}"}
        payload = {
            "inputs": {
                "source_sentence": jd_text[:2500],
                "sentences": [resume_text[:2500]],
            }
        }
        try:
            response = requests.post(HF_API_URL, headers=headers, json=payload, timeout=10)
            if response.status_code == 200:
                raw_json = response.json()
                if isinstance(raw_json, list) and raw_json:
                    val_item = raw_json[0]
                    if isinstance(val_item, list) and val_item:
                        val_item = val_item[0]
                    val = float(val_item)
                    val_pct = val * 100.0 if val <= 1.0 else val
                    return max(0.0, min(100.0, round(val_pct, 1)))
        except Exception as e:
            logger.debug("HuggingFace API similarity failed, using TF-IDF fallback", error=str(e))

    # Fast TF-IDF Cosine Similarity Fallback
    words1 = [w for w in re.findall(r"\b[a-zA-Z0-9+#.-]{2,}\b", (resume_text or "").lower()) if w not in _ENGLISH_STOPWORDS]
    words2 = [w for w in re.findall(r"\b[a-zA-Z0-9+#.-]{2,}\b", (jd_text or "").lower()) if w not in _ENGLISH_STOPWORDS]
    if not words1 or not words2:
        return 0.0

    tf1 = Counter(words1)
    tf2 = Counter(words2)
    common_terms = set(tf1.keys()).intersection(set(tf2.keys()))
    if not common_terms:
        return 0.0

    dot_product = sum(tf1[term] * tf2[term] for term in common_terms)
    mag1 = math.sqrt(sum(v ** 2 for v in tf1.values()))
    mag2 = math.sqrt(sum(v ** 2 for v in tf2.values()))
    if mag1 == 0 or mag2 == 0:
        return 0.0

    cosine_sim = dot_product / (mag1 * mag2)
    return round(min(100.0, max(0.0, cosine_sim * 100.0)), 1)


# ══════════════════════════════════════════════════════════════════════════
# 3. UNIFIED PUBLIC ENTRYPOINT
# ══════════════════════════════════════════════════════════════════════════

@dataclass
class SharedScoringComponents:
    """Cached intermediate results from single NLP extraction and vector embedding run."""
    raw_text: str
    extracted_data: Dict[str, Any]
    jd_text: str
    skill_universe: List[str]
    parsing_health: Dict[str, Any]
    knockout: Dict[str, Any]
    keyword_match: Dict[str, Any]
    skills_score: float
    matched_skills: List[str]
    missing_skills: List[str]
    experience_score: float
    education_score: float
    vector_score: float
    transferable_skills: List[str] = field(default_factory=list)

    @property
    def knockout_result(self) -> Dict[str, Any]:
        return {
            "passed": not bool(self.knockout.get("is_knockout", False)),
            "reasons": list(self.knockout.get("reasons", [])),
        }


def build_smart_embedding_text(
    extracted_data: Optional[Dict[str, Any]],
    raw_text: str,
    max_chars: int = 2500,
) -> str:
    """
    Intelligently builds embedding input up to max_chars budget (default 2500).
    Prioritizes high-signal content in order:
    1. Structured Skills (technical & core)
    2. Structured Education (degrees & domains)
    3. Structured Work Experience (most recent first; drops least recent if over budget)
    4. Professional Summary & Projects
    Falls back to naive text truncation only when structured parsed data is absent.
    """
    if not extracted_data or not isinstance(extracted_data, dict):
        return (raw_text or "")[:max_chars].strip()

    # 1. Collect skills
    skills_list = (
        extracted_data.get("skills")
        or extracted_data.get("technical_skills")
        or []
    )
    skills_part = f"Skills: {', '.join(str(s) for s in skills_list if s)}" if skills_list else ""

    # 2. Collect education
    edu_entries = extracted_data.get("education") or []
    edu_strings = []
    for edu in edu_entries:
        if hasattr(edu, "model_dump"):
            edu = edu.model_dump()
        elif hasattr(edu, "__dict__"):
            edu = edu.__dict__
        if isinstance(edu, dict):
            parts = [
                str(edu.get("degree") or "").strip(),
                str(edu.get("field_of_study") or "").strip(),
                str(edu.get("institution") or "").strip(),
            ]
            clean_parts = [p for p in parts if p]
            if clean_parts:
                edu_strings.append(" - ".join(clean_parts))
    edu_part = f"Education: {'; '.join(edu_strings)}" if edu_strings else ""

    # 3. Collect work experience (most recent first)
    exp_entries = list(extracted_data.get("work_experience") or [])
    exp_strings = []
    for exp in exp_entries:
        if hasattr(exp, "model_dump"):
            exp = exp.model_dump()
        elif hasattr(exp, "__dict__"):
            exp = exp.__dict__
        if isinstance(exp, dict):
            role = str(exp.get("title") or exp.get("role") or "").strip()
            comp = str(exp.get("company") or "").strip()
            desc = str(exp.get("description") or "").strip()
            tech = exp.get("technologies") or []
            tech_str = f"Tech: {', '.join(tech)}" if tech else ""
            line = f"{role} at {comp}. {tech_str}. {desc}".strip()
            if line:
                exp_strings.append(line)

    summary = str(extracted_data.get("summary") or "").strip()

    base_parts = [p for p in [skills_part, edu_part] if p]
    base_text = "\n".join(base_parts)

    remaining_budget = max_chars - len(base_text) - 10

    packed_exp = []
    for exp_str in exp_strings:
        if len(exp_str) + 2 <= remaining_budget:
            packed_exp.append(exp_str)
            remaining_budget -= (len(exp_str) + 2)
        else:
            if remaining_budget > 60:
                packed_exp.append(exp_str[:remaining_budget - 3] + "...")
            break

    exp_part = f"Experience: {' | '.join(packed_exp)}" if packed_exp else ""

    final_sections = [base_text]
    if exp_part:
        final_sections.append(exp_part)
    if summary and remaining_budget > 100:
        final_sections.append(f"Summary: {summary[:remaining_budget - 15]}")

    result = "\n".join(s for s in final_sections if s).strip()
    return result[:max_chars] if result else (raw_text or "")[:max_chars].strip()


def _compute_shared_components(
    resume: Union[Dict[str, Any], str],
    jd: Union[Dict[str, Any], str],
    required_skills: Optional[List[str]] = None,
    min_years: Optional[float] = None,
    profile: Optional[WeightProfile] = None,
) -> SharedScoringComponents:
    """Computes all expensive NLP, ontology, extraction, and embedding math ONCE."""
    # 1. Normalize Inputs
    if isinstance(resume, dict):
        raw_text = str(resume.get("raw_text") or "")
        extracted_data = resume.get("parsed_data") if isinstance(resume.get("parsed_data"), dict) else resume
    else:
        raw_text = str(resume or "")
        extracted_data = {}

    if not extracted_data.get("skills") and extract_resume_data_deterministic and raw_text:
        extracted_data = extract_resume_data_deterministic(raw_text)

    jd_text = jd.get("description") or jd.get("text") or str(jd or "") if isinstance(jd, dict) else str(jd or "")

    # Resolve min_years if not explicitly passed
    resolved_min_years = min_years
    if resolved_min_years is None and isinstance(jd, dict):
        resolved_min_years = jd.get("min_years")

    # 2. Formulate Skill Universe
    explicit_reqs = canonicalize_skills(required_skills) if canonicalize_skills else [s.strip() for s in (required_skills or []) if s and s.strip()]
    jd_skills = canonicalize_skills(extract_skills_deterministic(jd_text)) if (canonicalize_skills and extract_skills_deterministic) else (extract_skills_deterministic(jd_text) if extract_skills_deterministic else [])
    if canonicalize_skills:
        skill_universe = canonicalize_skills(explicit_reqs + jd_skills)
    else:
        skill_universe = list(dict.fromkeys(explicit_reqs + jd_skills))

    # 3. Execute Modular Shared Components (Embedding & NLP called ONCE)
    parsing_health = _parsing_health(raw_text)
    knockout = _knockout_check(extracted_data, jd_text, min_years=resolved_min_years, profile=profile)
    keyword_match = _exact_keyword_match(raw_text, skill_universe)

    cand_skills = extracted_data.get("skills", []) or extracted_data.get("technical_skills", []) or []
    s_score, matched_skills, transferable_skills, missing_skills = _skills_score(cand_skills, skill_universe)
    exp_score = _experience_score(extracted_data, jd_text, min_years=resolved_min_years)
    edu_score = _education_score(extracted_data, jd_text)

    # Smart prioritized embedding input
    smart_resume_text = build_smart_embedding_text(extracted_data, raw_text, max_chars=2500)
    vector_score = _semantic_vector_similarity(smart_resume_text, jd_text)

    return SharedScoringComponents(
        raw_text=raw_text,
        extracted_data=extracted_data,
        jd_text=jd_text,
        skill_universe=skill_universe,
        parsing_health=parsing_health,
        knockout=knockout,
        keyword_match=keyword_match,
        skills_score=s_score,
        matched_skills=matched_skills,
        transferable_skills=transferable_skills,
        missing_skills=missing_skills,
        experience_score=exp_score,
        education_score=edu_score,
        vector_score=vector_score,
    )


def _apply_profile(
    components: SharedScoringComponents,
    profile: WeightProfile,
    mode: str = "candidate",
) -> Dict[str, Any]:
    """Applies a specific WeightProfile to previously computed shared components."""
    math_score_norm = (
        (components.skills_score * profile.skills_weight)
        + (components.experience_score * profile.experience_weight)
        + (components.education_score * profile.education_weight)
    )
    math_score = round(math_score_norm * 100, 1)

    final_score = round(
        (math_score * profile.strict_weight) + (components.vector_score * profile.semantic_weight),
        1
    )

    # In recruiter mode with hard knockout enforcement:
    if profile.enforce_hard_knockout and components.knockout.get("is_knockout", False):
        final_score = min(final_score, 45.0)

    # Recommendation
    if final_score >= 80.0:
        rec_label = "Strong Match" if mode == "candidate" else "strong_match"
    elif final_score >= 60.0:
        rec_label = "Good Match" if mode == "candidate" else "good_match"
    elif final_score >= 40.0:
        rec_label = "Partial Match" if mode == "candidate" else "partial_match"
    else:
        rec_label = "Low Match" if mode == "candidate" else "poor_match"

    # Actionable Suggestions
    suggestions: List[str] = []
    missing = components.missing_skills
    if missing:
        suggestions.append(f"Missing mandatory skills for this role: {', '.join(missing[:5])}.")
    if round(components.experience_score * 100, 1) < 70:
        suggestions.append(
            "Experience duration is below the target requirement. Add detailed internship highlights or technical project bullets to showcase hands-on exposure."
        )
    if round(components.education_score * 100, 1) < 70:
        suggestions.append(
            "Education requirement differs from target degree. Emphasize relevant coursework, certifications, and technical capstone projects."
        )
    if final_score >= 80:
        suggestions.append("Strong technical alignment and high skill relevance for this role.")

    return {
        "final_score": final_score,
        "mode": mode,
        "scoring_version": SCORING_ENGINE_VERSION,
        "recommendation": rec_label,
        "matched_skills": components.matched_skills,
        "transferable_skills": getattr(components, "transferable_skills", []),
        "missing_skills": components.missing_skills,
        "skills_score": round(components.skills_score * 100, 1),
        "experience_score": round(components.experience_score * 100, 1),
        "education_score": round(components.education_score * 100, 1),
        "strict_score": math_score,
        "math_score": math_score,
        "vector_score": components.vector_score,
        "keyword_score": components.keyword_match["strict_ats_score"],
        "parsing_health": components.parsing_health,
        "knockout": components.knockout,
        "is_knockout": components.knockout["is_knockout"],
        "knockout_reasons": components.knockout["reasons"],
        "knockout_advisories": components.knockout["advisories"],
        "strict_ats_score": components.keyword_match["strict_ats_score"],
        "strict_matched_keywords": components.keyword_match["matched_exact"],
        "strict_missing_keywords": components.keyword_match["missing_exact"],
        "parsing_is_healthy": components.parsing_health["is_healthy"],
        "parsing_confidence": components.parsing_health["confidence"],
        "parsing_warnings": components.parsing_health["warnings"],
        "feedback_suggestions": suggestions,
        "extracted_data": components.extracted_data,
    }


def score_resume(
    resume: Union[Dict[str, Any], str],
    jd: Union[Dict[str, Any], str],
    mode: str = "candidate",
    required_skills: Optional[List[str]] = None,
    profile: Optional[WeightProfile] = None,
    min_years: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Unified multi-factor scoring entrypoint for candidate and recruiter modes.

    Args:
        resume: Either a raw text string, or a parsed dictionary containing 'raw_text'
                and extracted metadata ('skills', 'experience', etc.).
        jd: Job description string or dict with 'description' / 'text'.
        mode: 'candidate' (80/20 weighting) or 'recruiter' (60/40 + hard knockouts).
        required_skills: Optional list of required target skills.
        profile: Optional custom WeightProfile override.
        min_years: Optional authoritative minimum years override.

    Returns:
        Unified dictionary with final_score, component scores, knockout status,
        parsing health, keyword match details, scoring_version, and recommendations.
    """
    active_profile = profile or SCORING_PROFILES.get(mode, CANDIDATE_PROFILE)
    components = _compute_shared_components(
        resume=resume,
        jd=jd,
        required_skills=required_skills,
        min_years=min_years,
        profile=active_profile,
    )
    result = _apply_profile(components, active_profile, mode=mode)
    gc.collect()
    return result


def score_resume_dual(
    resume: Union[Dict[str, Any], str],
    jd: Union[Dict[str, Any], str],
    required_skills: Optional[List[str]] = None,
    min_years: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Runs shared extraction/embedding ONCE, returns both scoring perspectives.

    Returns:
        {
            "candidate_score": float,  # Lenient, candidate-facing
            "recruiter_score": float,  # Strict, hard-knockout-enforced, recruiter-facing
            "candidate_result": dict,  # Full candidate perspective details
            "recruiter_result": dict,  # Full recruiter perspective details
            "knockout": {"passed": bool, "reasons": list[str]},
            "scoring_version": "1.0.0",
        }
    """
    components = _compute_shared_components(
        resume=resume,
        jd=jd,
        required_skills=required_skills,
        min_years=min_years,
    )
    cand_res = _apply_profile(components, CANDIDATE_PROFILE, mode="candidate")
    rec_res = _apply_profile(components, RECRUITER_PROFILE, mode="recruiter")
    gc.collect()
    return {
        "candidate_score": cand_res["final_score"],
        "recruiter_score": rec_res["final_score"],
        "candidate_result": cand_res,
        "recruiter_result": rec_res,
        "knockout": components.knockout_result,
        "scoring_version": SCORING_ENGINE_VERSION,
    }
