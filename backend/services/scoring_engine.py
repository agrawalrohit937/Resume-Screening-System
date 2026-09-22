"""
Scoring Engine — Unified Multi-Factor ATS & Reranking Scoring Architecture.

Phase 1 of Budget-Smart Hybrid-RAG Overhaul:
- Single unified entrypoint: `score_resume(resume, jd, mode="candidate" | "recruiter")`
- Parameterized scoring weights via `WeightProfile` dataclass
  * Candidate Mode: 80% Strict / Knockout Math (70% Skills, 15% Experience, 15% Education) + 20% Semantic Vector Match
  * Recruiter Mode: 60% Strict / Knockout Math (50% Skills, 30% Experience, 20% Education) + 40% Semantic Vector Match + Hard Knockout enforcement
- Eliminates duplicated scoring code between candidate and recruiter routes.

Changelog (v2.0.1):
- Vector similarity (embedding path) is now min-max calibrated (VEC_SIM_FLOOR..VEC_SIM_CEIL -> 0..100)
  instead of raw cosine * 100, so the semantic weight has real spread.
- Fixed: `_semantic_vector_similarity` truncated the 12,000-char smart embedding text back to 2,500 chars.
- Cosine computed with explicit normalization (numpy) instead of assuming unit-norm vectors.
"""

from __future__ import annotations

import gc
import json
import math
import os
import re
import time
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import numpy as np
import requests
import structlog

from services.scoring.constants import SkillMatch
from services.scoring.criticality import JDCriticalityIndex, infer_criticality
from services.scoring.experience_model import calculate_effective_experience
from services.scoring.features import extract_scoring_features
from services.chunking_service import chunk_resume, chunk_jd, compute_max_sim_vector_score
from services.embedding_service import embedding_model, EMBEDDING_MODEL_VERSION
from services.reranker_service import reranker_service
import core.feature_flags as ff
from core.feature_flags import (
    FEATURE_CRITICALITY_WEIGHTING,
    FEATURE_SPLIT_ELIGIBILITY,
    FEATURE_MULTI_VECTOR_EMBEDDING,
    FEATURE_REAL_EXPERIENCE_MODEL,
    FEATURE_CROSS_ENCODER_RERANK,
    FEATURE_BLIND_SCORING,
    FEATURE_PROJECTS_SCORING,
    FEATURE_CONTEXTUAL_SKILLS,
)

try:
    from services.security.pii_redactor import mask_pii_extended
except Exception:
    mask_pii_extended = None

logger = structlog.get_logger(__name__)

# External services / ontology (fail-safe imports)
try:
    from services.nlp_extractor import (
        extract_resume_data_deterministic,
        extract_skills_deterministic,
        extract_skills_from_sections,
    )
except Exception:
    extract_resume_data_deterministic = None
    extract_skills_deterministic = None
    extract_skills_from_sections = None

try:
    from services.skill_ontology import evaluate_skill_fulfillment, canonicalize_skills, normalize_skill, ONTOLOGY_VERSION
except Exception:
    evaluate_skill_fulfillment = None
    canonicalize_skills = None
    normalize_skill = None
    ONTOLOGY_VERSION = "ontology-v2.1.0-fallback"

HF_TOKEN = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_API_KEY")
HF_API_URL = os.getenv("HF_API_URL", "https://api-inference.huggingface.co/models/BAAI/bge-large-en-v1.5")

# Cosine calibration bounds for the embedding path (BGE cosine typically lives in ~0.40-0.85).
# Min-Max maps raw cosine [VEC_SIM_FLOOR, VEC_SIM_CEIL] -> [0, 100].
VEC_SIM_FLOOR = float(os.getenv("VEC_SIM_FLOOR", "0.40"))
VEC_SIM_CEIL = float(os.getenv("VEC_SIM_CEIL", "0.85"))
VEC_TEXT_BUDGET = 12000  # chars fed to the embedder (matches build_smart_embedding_text budget)


# ══════════════════════════════════════════════════════════════════════════
# 1. WEIGHT PROFILES & CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════

SCORING_ENGINE_VERSION: str = "2.1.0"



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
    # Phase 1.2: Fresher weight shift distribution (must sum to 1.0)
    fresher_skills_share: float = 0.60
    fresher_projects_share: float = 0.25
    fresher_education_share: float = 0.15

CANDIDATE_PROFILE = WeightProfile(
    strict_weight=0.80,
    semantic_weight=0.20,
    skills_weight=0.70,
    experience_weight=0.15,
    education_weight=0.15,
    enforce_hard_knockout=False,
    knockout_years_threshold_ratio=0.5,
    fresher_skills_share=0.60,
    fresher_projects_share=0.25,
    fresher_education_share=0.15,
)

RECRUITER_PROFILE = WeightProfile(
    strict_weight=0.60,
    semantic_weight=0.40,
    skills_weight=0.50,
    experience_weight=0.30,
    education_weight=0.20,
    enforce_hard_knockout=True,
    knockout_years_threshold_ratio=0.5,
    fresher_skills_share=0.60,
    fresher_projects_share=0.25,
    fresher_education_share=0.15,
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

_ENTRY_LEVEL_PATTERN = re.compile(
    r"\b(entry[\s-]level|fresher|freshers|junior|intern|internship|trainee|graduate|0\s*[-–to]\s*1\s*years?|0\+?\s*years?|no\s+experience\s+required)\b",
    re.IGNORECASE,
)

_DEGREE_RANK = {
    "high school": 1, "diploma": 1, "iti": 1,
    "associate": 2,
    "bachelor": 3, "b.tech": 3, "btech": 3, "b.e.": 3, "be": 3, "b.s.": 3,
    "bs": 3, "b.a.": 3, "ba": 3, "bca": 3, "bsc": 3, "b.sc": 3,
    "master": 4, "m.tech": 4, "mtech": 4, "m.s.": 4, "ms": 4, "m.a.": 4,
    "ma": 4, "mba": 4, "mca": 4, "msc": 4, "m.sc": 4, "b.ed": 4, "bed": 4,
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
    if not jd_text or not jd_text.strip():
        return None

    # 1. Strict Entry-Level / Fresher / 0-1 Years mapping
    zero_exp_match = bool(re.search(
        r"\b(fresher|freshers|entry[\s-]level|trainee|intern|internship|graduate|no\s+prior\s+experience|no\s+experience\s+required|no\s+experience\s+needed|zero\s+experience|0\s*(?:[-–]|to)\s*1\s*(?:years?|yrs?)|0\+?\s*(?:years?|yrs?)|0\s*(?:years?|yrs?)\s+experience)\b",
        jd_text,
        re.IGNORECASE,
    ))

    # 2. Check for higher tenure requirements (>= 2 years)
    senior_patterns = [
        re.compile(r"([2-9]|\d{2,})\s*\+\s*years?", re.IGNORECASE),
        re.compile(r"([2-9]|\d{2,})\s*(?:to|-|–)\s*\d+\s*years?", re.IGNORECASE),
        re.compile(r"minimum\s+(?:of\s+)?([2-9]|\d{2,})\s*years?", re.IGNORECASE),
        re.compile(r"at\s+least\s+([2-9]|\d{2,})\s*years?", re.IGNORECASE),
        re.compile(r"([2-9]|\d{2,})\s*years?\s*(?:of\s+)?(?:relevant\s+|professional\s+|work\s+)?experience", re.IGNORECASE),
    ]

    best: Optional[Tuple[float, bool]] = None
    for pattern in senior_patterns:
        for m in pattern.finditer(jd_text):
            prefix = jd_text[max(0, m.start() - 6):m.start()]
            if re.search(r"0\s*(?:[-–]|to)\s*$", prefix, re.IGNORECASE):
                continue
            try:
                years = float(m.group(1))
            except (ValueError, IndexError):
                continue
            is_hard = _context_is_hard_requirement(jd_text, m.start(), m.end())
            if best is None or years > best[0]:
                best = (years, is_hard)

    # If a senior requirement (>= 2.0 yrs) is found, prioritize it
    if best is not None and best[0] >= 2.0:
        return best

    # If Fresher / 0-1 Years / Entry level was detected, explicitly map to 0.0 years
    if zero_exp_match:
        return (0.0, False)

    # Standard 1+ years pattern evaluation
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

        if label == "be":
            prefix = jd_text[max(0, m.start() - 15):m.start()].lower()
            if re.search(r"\b(must|will|should|to|can|could|shall|may|might|would)\s+$", prefix):
                continue
            surrounding = jd_text[max(0, m.start() - 15):min(len(jd_text), m.end() + 15)]
            if not re.search(r"\b(b\.e\.|b\.tech|degree|engineering)\b", surrounding, re.IGNORECASE):
                continue

        is_hard = _context_is_hard_requirement(jd_text, m.start(), m.end())
        if best is None or rank > best[0]:
            best = (rank, label, is_hard)
    return best


def _candidate_max_degree_rank(extracted_data: dict) -> Tuple[int, bool]:
    from core.feature_flags import FEATURE_SKILLS_FIRST_EDUCATION
    if FEATURE_SKILLS_FIRST_EDUCATION:
        try:
            from services.education_service import candidate_highest_education
            max_rank, max_isced, in_progress, best_label, evidence = candidate_highest_education(extracted_data)
            if max_rank > 0:
                return max_rank, in_progress
        except Exception as e:
            logger.debug("Failed in ISCED education resolution", error=str(e))

    education = extracted_data.get("education", []) or []
    raw_text = str(extracted_data.get("raw_text") or "")
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
        try:
            from services.education_service import is_degree_in_progress
            is_pursuing = is_degree_in_progress(edu, raw_text=raw_text)
        except Exception:
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
    jd_source: Union[str, JDCriticalityIndex] = "",
    explicit_required: Optional[Set[str]] = None,
    extracted_data: Optional[Dict[str, Any]] = None,
    raw_text: str = "",
) -> Tuple[float, List[str], List[str], List[str], List[Dict[str, Any]]]:
    """
    Computes criticality-weighted graded skill credit and partitions required skills into:
      - matched_skills (credit >= 0.85)
      - transferable_skills (credit in [0.3, 0.85))
      - missing_skills (credit < 0.3)

    When FEATURE_CONTEXTUAL_SKILLS is True, modulates credit with evidence location,
    recency decay, duration, and anti-keyword-stuffing verification.

    Weighting:
      skills_score = Σ(credit_i × weight_i) / Σ(weight_i)

    Complexity:
      Time: O(N_jd * N_cand + N_jd * L_jd + N_skills * L_resume)
      Space: O(N_jd + N_cand + L_jd)
    """
    matched, transferable, missing = [], [], []
    skill_evidence: List[Dict[str, Any]] = []
    canonical_jd = canonicalize_skills(jd_skills) if canonicalize_skills else list(dict.fromkeys(jd_skills or []))
    if not canonical_jd:
        return 1.0, cand_skills, [], [], []

    canonical_cand = canonicalize_skills(cand_skills) if canonicalize_skills else cand_skills

    # Build section index if contextual skill scoring is active
    section_index = None
    if ff.FEATURE_CONTEXTUAL_SKILLS and extracted_data:
        try:
            from services.scoring.contextual_skills import build_resume_section_index, evaluate_skill_context
            section_index = build_resume_section_index(extracted_data, raw_text=raw_text)
        except Exception as e:
            logger.debug("Failed building section index for contextual skills", error=str(e))
            section_index = None

    # Precomputed JD criticality index
    jd_index = None
    if FEATURE_CRITICALITY_WEIGHTING and jd_source:
        if isinstance(jd_source, JDCriticalityIndex):
            jd_index = jd_source
        elif isinstance(jd_source, str) and jd_source.strip():
            jd_index = JDCriticalityIndex(jd_source)

    total_weighted_credit = 0.0
    total_weights = 0.0

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

        # Contextual modulation if active and skill is fulfilled/transferable
        if section_index is not None and credit > 0.0:
            try:
                ev = evaluate_skill_context(req, section_index)
                skill_evidence.append(ev)
                credit = credit * ev["credit"]
            except Exception:
                pass

        # Calculate requirement weight in {3.0 must, 2.0 important, 1.0 nice_to_have}
        if jd_index is not None:
            weight = infer_criticality(req, jd_index, explicit_required)
        else:
            weight = 2.0

        total_weighted_credit += credit * weight
        total_weights += weight

        # Partition strictly into one of the three disjoint buckets
        if bucket == "matched" or credit >= 0.85:
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

    score = (total_weighted_credit / total_weights) if total_weights > 0 else 1.0
    return score, matched, transferable, missing, skill_evidence


def _compute_experience(
    extracted_data: dict,
    jd_text: str,
    min_years: Optional[float] = None,
) -> Tuple[float, Optional[Any]]:
    """
    Computes experience score (normalized 0.0 - 1.0) and optional ExperienceProfile.
    Uses real experience model (calendar merge, 8-yr half-life decay, role relevance, gap tracking)
    when FEATURE_REAL_EXPERIENCE_MODEL is True and work experience data is present.
    """
    if min_years is not None:
        required_exp = max(0.0, float(min_years))
    else:
        years_req = _extract_years_requirement(jd_text)
        required_exp = years_req[0] if years_req else 0.0

    if FEATURE_REAL_EXPERIENCE_MODEL and (extracted_data.get("experience") or extracted_data.get("work_experience")):
        try:
            profile = calculate_effective_experience(
                extracted_data=extracted_data,
                target_role_text=jd_text,
                min_years=required_exp,
                embedding_model_fn=embedding_model,
            )
            # profile.experience_score is in [0.0, 100.0]
            normalized = min(1.0, max(0.0, float(profile.experience_score) / 100.0))
            return normalized, profile
        except Exception as e:
            logger.debug("calculate_effective_experience failed, using baseline", error=str(e))

    cand_exp = float(extracted_data.get("total_experience_years") or 0.0)
    if required_exp <= 0:
        baseline_score = 1.0 if cand_exp >= 0 else 0.0
    elif cand_exp >= required_exp:
        baseline_score = 1.0
    elif cand_exp <= 0:
        baseline_score = 0.0
    else:
        x = max(0.0, cand_exp / required_exp)
        denom = 1.0 - math.exp(-1.4)
        baseline_score = min(1.0, max(0.0, (1.0 - math.exp(-1.4 * x)) / denom))

    return baseline_score, None


def _experience_score(extracted_data: dict, jd_text: str, min_years: Optional[float] = None) -> float:
    score, _ = _compute_experience(extracted_data, jd_text, min_years)
    return score


def _education_score(extracted_data: dict, jd_text: str) -> float:
    """
    Computes education match score with explicit support and partial credit for in-progress degrees.
    Applies 90% credit for in-progress candidates matching the major/target tier,
    and 85% credit for general in-progress candidates at the required level.
    """
    degree_req = _extract_degree_requirement(jd_text)
    required_rank = degree_req[0] if degree_req else 1
    cand_rank, in_progress = _candidate_max_degree_rank(extracted_data)

    if cand_rank >= required_rank:
        if in_progress:
            # Check major/domain alignment for partial credit (80% - 90%)
            edu_entries = extracted_data.get("education", []) or []
            major_str = " ".join([str(e.get("field") or e.get("major") or e.get("degree") or "") for e in edu_entries if isinstance(e, dict)]).lower()
            raw_text = str(extracted_data.get("raw_text") or "").lower()
            is_relevant_major = bool(re.search(r"\b(computer|software|tech|information|data|engineering|science|it|cse|ece|ai|ml|math|statistics)\b", major_str + " " + raw_text)) or bool(extracted_data.get("skills"))
            return 0.90 if is_relevant_major else 0.85
        return 1.0
    elif cand_rank > 0:
        ratio = cand_rank / max(required_rank, 1)
        if in_progress:
            return round(0.80 * ratio, 2)
        return ratio
    else:
        return 0.75 if in_progress else 0.60


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

    # Dynamic Weight Shifting for Entry-Level / 0-Experience (Phase 1.5)
    cand_exp = float(extracted_data.get("total_experience_years") or 0.0)
    work_exp = extracted_data.get("work_experience") or extracted_data.get("experience") or []
    has_zero_exp = (cand_exp <= 0.0) and len(work_exp) == 0
    is_entry_jd = bool(_ENTRY_LEVEL_PATTERN.search(jd_text or ""))
    years_req = _extract_years_requirement(jd_text or "")
    jd_min_years = years_req[0] if years_req else None
    jd_has_high_min = (jd_min_years is not None and jd_min_years > 1.0)
    should_redistribute = is_entry_jd or (has_zero_exp and not jd_has_high_min) or (jd_min_years is not None and jd_min_years <= 1.0 and exp_score < 1.0)

    skills_w = prof.skills_weight
    exp_w = prof.experience_weight
    edu_w = prof.education_weight

    if should_redistribute and (has_zero_exp or exp_score == 0.0):
        base_sum = skills_w + edu_w
        if base_sum > 0:
            skills_w = skills_w + (exp_w * (skills_w / base_sum))
            edu_w = edu_w + (exp_w * (edu_w / base_sum))
            exp_w = 0.0

    math_score = (
        (s_score * skills_w)
        + (exp_score * exp_w)
        + (edu_score * edu_w)
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
    # Table / Grid Detection
    has_tables = bool(re.search(r"(\|[^\n]+\|\n){2,}", text))
    if has_tables:
        warnings.append("Embedded tables detected — may impact line parsing in legacy ATS systems.")

    # Multi-Column detection
    has_multicol = short_token_ratio > 0.35 and word_count > 100
    if has_multicol:
        confidence -= 0.15

    confidence = max(0.0, min(1.0, confidence))

    # Run Candidate ATS Format Checker
    format_report = None
    try:
        from services.ats_format_check import check_ats_formatting
        format_report = check_ats_formatting(raw_text, layout_meta={"has_tables": has_tables, "has_multi_column": has_multicol})
    except Exception:
        format_report = {"is_ats_compliant": confidence >= 0.6, "format_issues": [], "compliance_score": round(confidence * 100, 1)}

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
            "has_tables": has_tables,
            "has_multi_column": has_multicol,
        },
        "ats_format_report": format_report,
        "format_issues": format_report.get("format_issues", []) if format_report else [],
    }


def _evaluate_eligibility(
    extracted_data: dict,
    jd_text: str,
    min_years: Optional[float] = None,
    profile: Optional[WeightProfile] = None,
    parsing_health: Optional[dict] = None,
    job: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Evaluates candidate eligibility independently from quality score.
    Produces structured checks with severity, observed values, and evidence.
    status is 'ineligible' iff any hard check fails; 'unverified' if parse fails/data missing; else 'eligible'.
    """
    reasons: List[str] = []
    advisories: List[str] = []
    checks: List[Dict[str, Any]] = []
    prof = profile or CANDIDATE_PROFILE

    if not jd_text or not jd_text.strip():
        return {
            "status": "eligible",
            "eligibility_rank": 0,
            "checks": [],
            "is_knockout": False,
            "reasons": [],
            "advisories": [],
        }

    candidate_years = float(extracted_data.get("total_experience_years") or 0)

    # Reconcile min_years (structured field) vs regex extraction from JD text
    regex_years_req = _extract_years_requirement(jd_text)
    if min_years is not None:
        required_years = float(min_years)
        is_hard = regex_years_req[1] if regex_years_req is not None else False
        exp_source = "structured_min_years"
    elif regex_years_req is not None:
        required_years, is_hard = regex_years_req
        exp_source = "jd_regex"
    else:
        required_years, is_hard = None, False
        exp_source = "jd_regex"

    if required_years is not None and required_years > 0:
        threshold_ratio = getattr(prof, "knockout_years_threshold_ratio", 0.5)
        exp_list = extracted_data.get("experience", []) or extracted_data.get("work_experience", []) or []
        exp_evidence = [f"experience[{i}]" for i in range(min(len(exp_list), 3))] or ["total_experience_years"]

        years_passed = True
        if candidate_years <= 0 and required_years > 0:
            years_passed = False
            msg = f"Requires {required_years:.0f}+ years of professional experience — none detected."
            if is_hard:
                reasons.append(msg)
            else:
                advisories.append(msg + " (preferred)")
        elif candidate_years < required_years:
            msg = f"Requires {required_years:.0f}+ years of experience; resume shows ~{candidate_years:.1f} year(s)."
            if is_hard and candidate_years < required_years * threshold_ratio:
                years_passed = False
                reasons.append(msg)
            else:
                advisories.append(msg)

        checks.append({
            "rule_id": "min_years",
            "label": f"{required_years:.0f}+ years required",
            "passed": years_passed,
            "severity": "hard" if is_hard else "soft",
            "observed": f"~{candidate_years:.1f} years" if candidate_years > 0 else "none detected",
            "evidence": exp_evidence,
            "source": exp_source,
        })

    edu_mode = "preferred"
    if isinstance(job, dict):
        edu_mode = job.get("education_requirement_mode") or "preferred"
    elif job is not None:
        edu_mode = getattr(job, "education_requirement_mode", "preferred") or "preferred"
    edu_mode = edu_mode.lower()

    # Skills-first mode: when 'ignored', degree requirements produce no eligibility check
    if edu_mode != "ignored":
        degree_req = _extract_degree_requirement(jd_text)
        if degree_req is not None:
            required_rank, required_label, is_hard = degree_req
            if edu_mode == "required":
                is_hard = True
            elif edu_mode == "preferred":
                is_hard = False

            candidate_rank, in_progress = _candidate_max_degree_rank(extracted_data)
            edu_list = extracted_data.get("education", []) or []
            edu_evidence = [f"education[{i}]" for i in range(min(len(edu_list), 2))] or ["education_level"]

            degree_passed = True
            if candidate_rank == 0:
                degree_passed = False
                msg = f"Requires a {required_label.title()}-level degree — none found on resume."
                if is_hard:
                    reasons.append(msg)
                else:
                    advisories.append(msg + " (preferred)")
            elif candidate_rank < required_rank:
                if not in_progress:
                    degree_passed = False
                    msg = f"Requires a {required_label.title()}-level degree; highest education ranks below."
                    if is_hard:
                        reasons.append(msg)
                    else:
                        advisories.append(msg)
                else:
                    advisories.append(f"Meets the {required_label.title()}-level requirement with a degree currently in progress (Degree in Progress).")
            elif in_progress:
                advisories.append(f"Meets the {required_label.title()}-level requirement with a degree currently in progress (Degree in Progress).")

            checks.append({
                "rule_id": "degree_level",
                "label": f"{required_label.title()}-level degree required",
                "passed": degree_passed,
                "severity": "hard" if is_hard else "soft",
                "observed": "Degree in Progress" if in_progress else str(extracted_data.get("education_level") or ("Degree Aligned" if degree_passed else "none found")),
                "status_label": "Degree in Progress" if in_progress else ("Degree Aligned" if degree_passed else "Degree Mismatch"),
                "is_in_progress": in_progress,
                "evidence": edu_evidence,
                "source": "jd_regex",
            })

    # Pluggable Credential Verification Layer
    from core.feature_flags import FEATURE_CREDENTIAL_VERIFICATION
    if FEATURE_CREDENTIAL_VERIFICATION:
        try:
            from services.credential_service import evaluate_credential_eligibility, parse_candidate_credentials
            req_creds = []
            if isinstance(job, dict):
                req_creds = job.get("required_credentials", []) or []
            elif job is not None:
                req_creds = getattr(job, "required_credentials", []) or []

            if req_creds:
                cand_creds = parse_candidate_credentials(extracted_data)
                cred_checks, cred_reasons, cred_advisories = evaluate_credential_eligibility(
                    candidate_credentials=cand_creds,
                    required_credentials=req_creds,
                )
                checks.extend(cred_checks)
                reasons.extend(cred_reasons)
                advisories.extend(cred_advisories)
        except Exception as e:
            logger.debug("Failed evaluating credential eligibility", error=str(e))

    # Phase 5: Structured Optional Recruiter Eligibility Checks (driven by job fields)
    if job and isinstance(job, dict):
        # 1. Location & Remote Policy Check (Off by default, configurable per job)
        # Fairness Note: Location constraints are strictly driven by verified job specifications.
        req_loc = str(job.get("location") or job.get("required_location") or "").strip()
        remote_pol = str(job.get("remote_policy") or "").strip().lower()
        if req_loc or remote_pol:
            cand_loc = str(extracted_data.get("location") or extracted_data.get("city") or "").strip()
            if remote_pol in ("remote", "work_from_home", "fully_remote"):
                loc_passed = True
                loc_obs = f"Remote policy ({remote_pol}) accommodates candidate"
            elif not cand_loc:
                loc_passed = "unverified"
                loc_obs = "Location not explicitly specified on resume"
            elif req_loc.lower() in cand_loc.lower() or cand_loc.lower() in req_loc.lower():
                loc_passed = True
                loc_obs = cand_loc
            else:
                loc_passed = False
                loc_obs = f"Candidate located in {cand_loc}, role requires {req_loc}"

            is_hard_loc = bool(job.get("hard_location_requirement", False))
            checks.append({
                "rule_id": "location_policy",
                "label": f"Location: {req_loc or remote_pol}",
                "passed": loc_passed,
                "severity": "hard" if (is_hard_loc and loc_passed is False) else "soft",
                "observed": loc_obs,
                "evidence": ["location"] if cand_loc else [],
                "source": "job_location_spec",
            })
            if loc_passed is False:
                if is_hard_loc:
                    reasons.append(loc_obs)
                else:
                    advisories.append(loc_obs)

        # 2. Notice Period Check
        max_notice = job.get("max_notice_days") or job.get("notice_period_days")
        if max_notice is not None:
            max_notice_val = float(max_notice)
            cand_notice = extracted_data.get("notice_period_days") or extracted_data.get("notice_days")
            if cand_notice is None:
                n_passed = "unverified"
                n_obs = "Notice period not stated on resume"
            else:
                cand_notice_val = float(cand_notice)
                n_passed = cand_notice_val <= max_notice_val
                n_obs = f"{cand_notice_val:.0f} days (max allowed: {max_notice_val:.0f} days)"

            is_hard_notice = bool(job.get("hard_notice_requirement", False))
            checks.append({
                "rule_id": "notice_period",
                "label": f"Notice period <= {max_notice_val:.0f} days",
                "passed": n_passed,
                "severity": "hard" if (is_hard_notice and n_passed is False) else "soft",
                "observed": n_obs,
                "evidence": ["notice_period_days"] if cand_notice is not None else [],
                "source": "job_notice_spec",
            })
            if n_passed is False:
                if is_hard_notice:
                    reasons.append(n_obs)
                else:
                    advisories.append(n_obs)

        # 3. Work Authorization Check (Off by default, fairness note documented)
        if bool(job.get("require_work_auth", False)):
            req_auth = str(job.get("work_authorization") or "Valid Work Authorization").strip()
            cand_auth = extracted_data.get("work_authorization") or extracted_data.get("visa_status")
            if not cand_auth:
                auth_passed = "unverified"
                auth_obs = "Work authorization status unverified on resume"
            else:
                auth_passed = True
                auth_obs = str(cand_auth)

            checks.append({
                "rule_id": "work_authorization",
                "label": f"Work Authorization: {req_auth}",
                "passed": auth_passed,
                "severity": "hard" if auth_passed is False else "soft",
                "observed": auth_obs,
                "evidence": ["work_authorization"] if cand_auth else [],
                "source": "job_auth_spec",
            })

        # 4. Salary Expectation vs Budget
        max_salary = job.get("max_salary") or job.get("salary_budget_max")
        if max_salary is not None:
            max_sal_val = float(max_salary)
            cand_exp_sal = extracted_data.get("expected_salary") or extracted_data.get("salary_expectation")
            if cand_exp_sal is None:
                sal_passed = "unverified"
                sal_obs = "Salary expectation not stated on resume"
            else:
                cand_sal_val = float(cand_exp_sal)
                sal_passed = cand_sal_val <= max_sal_val
                sal_obs = f"Expected: {cand_sal_val:,.0f} (Budget: {max_sal_val:,.0f})"

            checks.append({
                "rule_id": "salary_expectation",
                "label": f"Salary Budget <= {max_sal_val:,.0f}",
                "passed": sal_passed,
                "severity": "soft",
                "observed": sal_obs,
                "evidence": ["expected_salary"] if cand_exp_sal is not None else [],
                "source": "job_salary_spec",
            })
            if sal_passed is False:
                advisories.append(sal_obs)

        # 5. Required Languages
        req_langs = job.get("required_languages") or []
        if req_langs and isinstance(req_langs, list):
            cand_langs = [str(l).lower() for l in (extracted_data.get("languages") or [])]
            missing_langs = [l for l in req_langs if str(l).lower() not in cand_langs]
            if not cand_langs:
                lang_passed = "unverified"
                lang_obs = "Languages not listed on resume"
            elif not missing_langs:
                lang_passed = True
                lang_obs = f"Proficient in {', '.join(req_langs)}"
            else:
                lang_passed = False
                lang_obs = f"Missing required language(s): {', '.join(missing_langs)}"

            checks.append({
                "rule_id": "language_requirements",
                "label": f"Languages: {', '.join(req_langs)}",
                "passed": lang_passed,
                "severity": "soft",
                "observed": lang_obs,
                "evidence": ["languages"] if cand_langs else [],
                "source": "job_language_spec",
            })
            if lang_passed is False:
                advisories.append(lang_obs)

    # Domain Occupation Adapter Rules (Healthcare, Legal, Trades, etc.)
    from core.feature_flags import FEATURE_OCCUPATION_ADAPTERS
    if FEATURE_OCCUPATION_ADAPTERS:
        try:
            from services.scoring.adapters.registry import detect_occupation_adapter
            job_obj = job if job is not None else {"title": "", "description": jd_text}
            title = ""
            occ_code = None
            if isinstance(job_obj, dict):
                title = str(job_obj.get("title") or "")
                occ_code = job_obj.get("occupation_code")
            else:
                title = str(getattr(job_obj, "title", "") or "")
                occ_code = getattr(job_obj, "occupation_code", None)

            adapter = detect_occupation_adapter(job_title=title, jd_text=jd_text, occupation_code=occ_code)
            for rule in adapter.eligibility_rules(job_obj):
                passed, observed, evidence = rule.evaluate(extracted_data, job_obj)
                checks.append({
                    "rule_id": rule.rule_id,
                    "label": rule.label,
                    "passed": passed,
                    "severity": rule.severity,
                    "observed": observed,
                    "evidence": evidence,
                    "source": rule.source,
                })
                if not passed:
                    if rule.severity == "hard":
                        reasons.append(f"{rule.label}: {observed}")
                    else:
                        advisories.append(f"{rule.label}: {observed}")
        except Exception as e:
            logger.warning("Failed executing occupation adapter eligibility rules", error=str(e))

    # Overall status resolution
    has_hard_failure = any(c["severity"] == "hard" and c["passed"] is False for c in checks)
    has_unverified = any(c["passed"] == "unverified" for c in checks)
    is_parse_unverified = (
        parsing_health is not None
        and not parsing_health.get("is_healthy", True)
        and float(parsing_health.get("confidence", 1.0)) < 0.3
    )

    if has_hard_failure:
        status = "ineligible"
        eligibility_rank = 2
    elif has_unverified or is_parse_unverified:
        status = "unverified"
        eligibility_rank = 1
    else:
        status = "eligible"
        eligibility_rank = 0

    return {
        "status": status,
        "eligibility_rank": eligibility_rank,
        "checks": checks,
        "is_knockout": status == "ineligible",
        "reasons": reasons,
        "advisories": advisories,
    }


def _knockout_check(
    extracted_data: dict,
    jd_text: str,
    min_years: Optional[float] = None,
    profile: Optional[WeightProfile] = None,
    parsing_health: Optional[dict] = None,
) -> Dict[str, Any]:
    """Compatibility wrapper for legacy callers delegating to _evaluate_eligibility."""
    return _evaluate_eligibility(
        extracted_data=extracted_data,
        jd_text=jd_text,
        min_years=min_years,
        profile=profile,
        parsing_health=parsing_health,
    )


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


def _calibrate_cosine(sim: float) -> float:
    """
    Min-max maps raw embedding cosine [VEC_SIM_FLOOR, VEC_SIM_CEIL] -> [0, 100].
    BGE cosine practically lives in ~0.3-0.8, so raw cosine * 100 compresses the semantic
    component into a narrow band. O(1).
    """
    span = max(VEC_SIM_CEIL - VEC_SIM_FLOOR, 1e-6)
    return round(min(100.0, max(0.0, (sim - VEC_SIM_FLOOR) / span * 100.0)), 1)


def _semantic_vector_similarity(resume_text: str, jd_text: str) -> float:
    if not resume_text or not jd_text:
        return 0.0

    # 1. Prefer local BGE embedding model (instant, offline CPU execution)
    try:
        from services.embedding_service import embedding_model
        vecs = embedding_model.encode([resume_text[:VEC_TEXT_BUDGET], jd_text[:VEC_TEXT_BUDGET]])
        if len(vecs) == 2:
            v1 = np.asarray(vecs[0], dtype=np.float32)
            v2 = np.asarray(vecs[1], dtype=np.float32)
            denom = float(np.linalg.norm(v1) * np.linalg.norm(v2)) or 1.0
            return _calibrate_cosine(float(v1 @ v2) / denom)
    except Exception as e:
        logger.debug("Local embedding similarity failed, trying remote or TF-IDF", error=str(e))

    # NOTE: the remote HF and TF-IDF fallbacks have different score distributions than local BGE
    # and are intentionally NOT calibrated with the BGE floor/ceil above.
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
    projects_score: float = 0.0
    projects_breakdown: List[Dict[str, Any]] = field(default_factory=list)
    skill_evidence: List[Dict[str, Any]] = field(default_factory=list)
    transferable_skills: List[str] = field(default_factory=list)
    eligibility: Dict[str, Any] = field(default_factory=dict)
    experience_profile: Optional[Any] = None
    attribution_evidence: List[Dict[str, Any]] = field(default_factory=list)
    education_requirement_mode: str = "preferred"

    @property
    def knockout_result(self) -> Dict[str, Any]:
        return {
            "passed": not bool(self.knockout.get("is_knockout", False)),
            "reasons": list(self.knockout.get("reasons", [])),
        }


def build_smart_embedding_text(
    extracted_data: Optional[Dict[str, Any]],
    raw_text: str,
    max_chars: int = 12000,
) -> str:
    """
    Intelligently builds embedding input up to max_chars budget (default 12,000 for full BGE-M3 context).
    Prioritizes high-signal content in order:
    1. Structured Skills (technical & core)
    2. Structured Education (degrees & domains)
    3. Structured Work Experience (most recent first; drops least recent if over budget)
    4. Professional Summary & Projects
    Falls back to naive text truncation only when structured parsed data is absent.
    """
    if not extracted_data or not isinstance(extracted_data, dict):
        return (raw_text or "")[:max_chars].strip()

    # 1. Collect skills (including multi-section extraction from coursework, projects, experience)
    direct_skills = list(
        extracted_data.get("skills")
        or extracted_data.get("technical_skills")
        or []
    )
    if extract_skills_from_sections:
        try:
            sec_skills = extract_skills_from_sections(extracted_data)
            skills_list = list(dict.fromkeys(direct_skills + sec_skills))
        except Exception:
            skills_list = direct_skills
    else:
        skills_list = direct_skills
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

    # Task 3.5: Indian Context PII Blinding
    if FEATURE_BLIND_SCORING and mask_pii_extended and raw_text:
        cand_name = None
        if isinstance(resume, dict):
            cand_name = resume.get("candidate_name") or (extracted_data.get("name") if isinstance(extracted_data, dict) else None)
        raw_text, _ = mask_pii_extended(raw_text, candidate_name=cand_name)

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
    eligibility = _evaluate_eligibility(
        extracted_data,
        jd_text,
        min_years=resolved_min_years,
        profile=profile,
        parsing_health=parsing_health,
        job=jd,
    )
    knockout = eligibility
    keyword_match = _exact_keyword_match(raw_text, skill_universe)

    # Precomputed JD Criticality Index for O(L_jd) weighting
    jd_index = JDCriticalityIndex(jd_text) if (FEATURE_CRITICALITY_WEIGHTING and jd_text) else ""
    cand_skills_direct = list(extracted_data.get("skills", []) or extracted_data.get("technical_skills", []) or [])
    if extract_skills_from_sections:
        try:
            cand_section_skills = extract_skills_from_sections(extracted_data)
            cand_skills = list(dict.fromkeys(cand_skills_direct + cand_section_skills))
        except Exception:
            cand_skills = cand_skills_direct
    else:
        cand_skills = cand_skills_direct

    s_score, matched_skills, transferable_skills, missing_skills, skill_evidence = _skills_score(
        cand_skills,
        skill_universe,
        jd_source=jd_index,
        explicit_required=set(explicit_reqs),
        extracted_data=extracted_data,
        raw_text=raw_text,
    )
    exp_score, exp_profile = _compute_experience(extracted_data, jd_text, min_years=resolved_min_years)
    edu_score = _education_score(extracted_data, jd_text)

    # Project scoring for entry-level / portfolio evidence (Phase 1.2)
    cand_projects = extracted_data.get("projects") or []
    if not cand_projects and raw_text:
        try:
            from services.portfolio_service import extract_all_projects
            cand_projects = extract_all_projects(raw_text, cand_skills)
        except Exception:
            cand_projects = []

    proj_score = 0.0
    proj_breakdown: List[Dict[str, Any]] = []
    if FEATURE_PROJECTS_SCORING and cand_projects:
        try:
            from services.scoring.projects_model import compute_projects_score
            proj_score, proj_breakdown = compute_projects_score(
                projects=cand_projects,
                jd_text=jd_text,
                jd_skills=skill_universe,
                embedding_model_fn=embedding_model,
            )
        except Exception as e:
            logger.debug("Project scoring calculation failed", error=str(e))
            proj_score, proj_breakdown = 0.0, []

    # Vector embedding score: multi-vector Max-Sim late interaction with fallback
    vector_score = 0.0
    attribution_evidence: List[Dict[str, Any]] = []

    if FEATURE_MULTI_VECTOR_EMBEDDING:
        try:
            chunks = chunk_resume(extracted_data, raw_text=raw_text)
            reqs = chunk_jd(jd_text, skills=skill_universe)
            if chunks and reqs:
                chunk_texts = [c["text"] for c in chunks]
                req_texts = [r["text"] for r in reqs]
                weights = np.array([float(r.get("criticality", 2.0)) for r in reqs], dtype=np.float32)

                chunk_vecs = np.array(embedding_model.encode(chunk_texts))
                req_vecs = np.array(embedding_model.encode(req_texts))

                # Normalize vectors for matrix multiplication
                c_norms = np.linalg.norm(chunk_vecs, axis=1, keepdims=True)
                c_norms[c_norms == 0] = 1.0
                chunk_vecs = chunk_vecs / c_norms

                r_norms = np.linalg.norm(req_vecs, axis=1, keepdims=True)
                r_norms[r_norms == 0] = 1.0
                req_vecs = req_vecs / r_norms

                v_score, attribution_evidence = compute_max_sim_vector_score(
                    req_vectors=req_vecs,
                    chunk_vectors=chunk_vecs,
                    weights=weights,
                    req_meta=reqs,
                    chunk_meta=chunks,
                )
                vector_score = v_score
        except Exception as e:
            logger.debug("Multi-vector Max-Sim failed, falling back to smart embedding", error=str(e))
            vector_score = 0.0

    if vector_score <= 0.0:
        # Smart prioritized embedding input fallback (12,000 char budget for full BGE-M3 context)
        smart_resume_text = build_smart_embedding_text(extracted_data, raw_text, max_chars=VEC_TEXT_BUDGET)
        vector_score = _semantic_vector_similarity(smart_resume_text, jd_text)

    edu_mode = "preferred"
    if isinstance(jd, dict):
        edu_mode = jd.get("education_requirement_mode") or "preferred"
    elif hasattr(jd, "education_requirement_mode"):
        edu_mode = getattr(jd, "education_requirement_mode", "preferred") or "preferred"

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
        projects_score=proj_score,
        projects_breakdown=proj_breakdown,
        skill_evidence=skill_evidence,
        eligibility=eligibility,
        experience_profile=exp_profile,
        attribution_evidence=attribution_evidence,
        education_requirement_mode=edu_mode,
    )


def _apply_profile(
    components: SharedScoringComponents,
    profile: WeightProfile,
    mode: str = "candidate",
) -> Dict[str, Any]:
    """Applies a specific WeightProfile to previously computed shared components."""
    edu_mode = getattr(components, "education_requirement_mode", "preferred")

    # Dynamic Weight Shifting for Entry-Level / 0-Experience (Phase 1.2 & 1.5)
    cand_exp = float(components.extracted_data.get("total_experience_years") or 0.0)
    work_exp = components.extracted_data.get("work_experience") or components.extracted_data.get("experience") or []
    has_zero_exp = (cand_exp <= 0.0) and len(work_exp) == 0
    is_entry_jd = bool(_ENTRY_LEVEL_PATTERN.search(components.jd_text or ""))
    years_req = _extract_years_requirement(components.jd_text or "")
    jd_min_years = years_req[0] if years_req else None
    jd_has_high_min = (jd_min_years is not None and jd_min_years > 1.0)
    should_redistribute = is_entry_jd or (has_zero_exp and not jd_has_high_min) or (jd_min_years is not None and jd_min_years <= 1.0 and components.experience_score < 1.0)

    skills_w = profile.skills_weight
    exp_w = profile.experience_weight
    edu_w = profile.education_weight
    proj_w = 0.0

    if should_redistribute and (has_zero_exp or components.experience_score == 0.0):
        # Dynamically redistribute Experience weight proportionally
        if edu_mode == "ignored":
            skills_w = 1.0
            exp_w = 0.0
            edu_w = 0.0
            math_score_norm = components.skills_score
        cand_projects = components.extracted_data.get("projects") or []
        if FEATURE_PROJECTS_SCORING and cand_projects:
            # Phase 1.2: redistribute freed experience weight into skills, projects, and education
            w_freed = exp_w
            skills_w = skills_w + (w_freed * profile.fresher_skills_share)
            proj_w = w_freed * profile.fresher_projects_share
            edu_w = edu_w + (w_freed * profile.fresher_education_share)
            exp_w = 0.0
            math_score_norm = (
                (components.skills_score * skills_w)
                + (components.projects_score * proj_w)
                + (components.education_score * edu_w)
            )
        else:
            base_sum = skills_w + edu_w
            if base_sum > 0:
                skills_w = skills_w + (exp_w * (skills_w / base_sum))
                edu_w = edu_w + (exp_w * (edu_w / base_sum))
                exp_w = 0.0
            math_score_norm = (
                (components.skills_score * skills_w)
                + (components.education_score * edu_w)
            )
    elif edu_mode == "ignored":
        tot_w = skills_w + exp_w
        math_score_norm = ((components.skills_score * skills_w) + (components.experience_score * exp_w)) / tot_w if tot_w > 0 else components.skills_score
    else:
        math_score_norm = (
            (components.skills_score * skills_w)
            + (components.experience_score * exp_w)
            + (components.education_score * edu_w)
        )
    math_score = round(math_score_norm * 100, 1)

    final_score = round(
        (math_score * profile.strict_weight) + (components.vector_score * profile.semantic_weight),
        1
    )

    # Cross-encoder reranker (Phase 1.3 - optional / guarded)
    reranker_score = None
    if FEATURE_CROSS_ENCODER_RERANK:
        try:
            smart_text = build_smart_embedding_text(components.extracted_data, components.raw_text, max_chars=500)
            pair = (components.jd_text[:512], smart_text[:512])
            scores = reranker_service.rerank_pairs([pair])
            if scores:
                reranker_score = round(float(scores[0]) * 100.0, 1)
                # Blend 70% base score + 30% cross-encoder reranker score
                final_score = round(final_score * 0.70 + reranker_score * 0.30, 1)
        except Exception as e:
            logger.debug("Cross-encoder reranking failed", error=str(e))

    # Task 0.3 & Phase 1.5: Split eligibility from quality — 45.0 cap completely removed!
    # quality_score and recruiter_score calculate naturally based purely on mathematical weights.
    # Knockouts are exposed exclusively via eligibility.status ('eligible', 'ineligible', 'unverified') and knockout_status.
    quality_score = final_score

    elig_data = getattr(components, "eligibility", {}) or components.knockout
    is_ineligible = elig_data.get("status") == "ineligible" or components.knockout.get("is_knockout", False)

    # Derived recruiter_score equals natural final_score without artificial knockout capping
    legacy_recruiter_score = final_score

    # Recommendation
    if quality_score >= 80.0:
        rec_label = "Strong Match" if mode == "candidate" else "strong_match"
    elif quality_score >= 60.0:
        rec_label = "Good Match" if mode == "candidate" else "good_match"
    elif quality_score >= 40.0:
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
    cand_rank, in_progress = _candidate_max_degree_rank(components.extracted_data)
    if in_progress:
        suggestions.append(
            "Degree in Progress: Highlight anticipated graduation timeline, relevant technical coursework, and capstone projects."
        )
    elif round(components.education_score * 100, 1) < 70:
        suggestions.append(
            "Education requirement differs from target degree. Emphasize relevant coursework, certifications, and technical capstone projects."
        )
    if quality_score >= 80:
        suggestions.append("Strong technical alignment and high skill relevance for this role.")

    result_payload: Dict[str, Any] = {
        "quality_score": quality_score,
        "final_score": final_score,
        "eligibility": {
            "status": elig_data.get("status", "eligible"),
            "checks": elig_data.get("checks", []),
        },
        "eligibility_rank": elig_data.get("eligibility_rank", 0),
        "recruiter_score": legacy_recruiter_score,
        "knockout_status": {
            "passed": not is_ineligible,
            "reasons": components.knockout.get("reasons", []),
        },
        "mode": mode,
        "scoring_version": SCORING_ENGINE_VERSION,
        "recommendation": rec_label,
        "matched_skills": components.matched_skills,
        "transferable_skills": getattr(components, "transferable_skills", []),
        "missing_skills": components.missing_skills,
        "skills_score": round(components.skills_score * 100, 1),
        "experience_score": round(components.experience_score * 100, 1),
        "education_score": round(components.education_score * 100, 1),
        "education_status": "in_progress" if in_progress else ("completed" if cand_rank > 0 else "unspecified"),
        "education_label": "Degree in Progress" if in_progress else ("Degree Aligned" if components.education_score >= 0.7 else "Degree Mismatch"),
        "is_in_progress": in_progress,
        "strict_score": math_score,
        "math_score": math_score,
        "vector_score": components.vector_score,
        "keyword_score": components.keyword_match["strict_ats_score"],
        "parsing_health": components.parsing_health,
        "knockout": components.knockout,
        "is_knockout": is_ineligible,
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
        "reranker_score": reranker_score,
        "projects_score": round(getattr(components, "projects_score", 0.0) * 100, 1),
        "projects_breakdown": getattr(components, "projects_breakdown", []),
        "skill_evidence": getattr(components, "skill_evidence", []),
        "format_issues": components.parsing_health.get("format_issues", []),
        "ats_format_report": components.parsing_health.get("ats_format_report", {}),
    }

    # Phase 7: Learned-to-Rank Model Evaluation (behind FEATURE_LEARNED_RANKER)
    from core.feature_flags import FEATURE_LEARNED_RANKER
    if FEATURE_LEARNED_RANKER:
        try:
            from services.ltr_service import ltr_service
            ltr_score = ltr_service.predict_score(result_payload)
            result_payload["learned_ranker_score"] = ltr_score
        except Exception as e:
            logger.debug("LTR scoring evaluation failed", error=str(e))
            result_payload["learned_ranker_score"] = None
    else:
        result_payload["learned_ranker_score"] = None

    # Extract stable ScoringFeatures (Phase 1.5)
    active_flags: List[str] = []
    if FEATURE_MULTI_VECTOR_EMBEDDING:
        active_flags.append("FEATURE_MULTI_VECTOR_EMBEDDING")
    if FEATURE_CROSS_ENCODER_RERANK:
        active_flags.append("FEATURE_CROSS_ENCODER_RERANK")
    if FEATURE_REAL_EXPERIENCE_MODEL:
        active_flags.append("FEATURE_REAL_EXPERIENCE_MODEL")
    if FEATURE_SPLIT_ELIGIBILITY:
        active_flags.append("FEATURE_SPLIT_ELIGIBILITY")
    if FEATURE_CRITICALITY_WEIGHTING:
        active_flags.append("FEATURE_CRITICALITY_WEIGHTING")
    if FEATURE_PROJECTS_SCORING:
        active_flags.append("FEATURE_PROJECTS_SCORING")
    if FEATURE_CONTEXTUAL_SKILLS:
        active_flags.append("FEATURE_CONTEXTUAL_SKILLS")

    features_obj = extract_scoring_features(
        result_payload,
        flags_active=active_flags,
        embedding_version=EMBEDDING_MODEL_VERSION,
    )
    if components.experience_profile is not None:
        prof = components.experience_profile
        features_obj.raw_calendar_years = getattr(prof, "raw_calendar_years", 0.0)
        features_obj.effective_years = getattr(prof, "effective_years", 0.0)
        features_obj.seniority_rank = getattr(prof, "seniority_rank", 1)
        features_obj.seniority_delta = getattr(prof, "seniority_delta", 0)
        features_obj.career_gaps_count = len(getattr(prof, "gaps", []))

    feat_dict = features_obj.to_dict()
    feat_dict["features_hash"] = features_obj.compute_hash()

    result_payload["features"] = feat_dict
    result_payload["attribution_evidence"] = components.attribution_evidence

    # Phase B3: Reproducible Snapshot Metadata
    import dataclasses
    import hashlib
    res_raw = components.raw_text or ""
    jd_raw = components.jd_text or ""
    result_payload["ontology_version"] = ONTOLOGY_VERSION
    result_payload["embedding_model_version"] = EMBEDDING_MODEL_VERSION
    result_payload["weights_snapshot"] = dataclasses.asdict(profile) if dataclasses.is_dataclass(profile) else {}
    result_payload["flags_snapshot"] = active_flags
    result_payload["calibration_bounds"] = {
        "floor": VEC_SIM_FLOOR,
        "ceil": VEC_SIM_CEIL,
    }
    result_payload["input_hashes"] = {
        "resume_hash": hashlib.sha256(res_raw.encode("utf-8")).hexdigest(),
        "jd_hash": hashlib.sha256(jd_raw.encode("utf-8")).hexdigest(),
    }
    result_payload["features_hash"] = feat_dict.get("features_hash")

    if components.experience_profile is not None:
        prof = components.experience_profile
        result_payload["experience_profile"] = {
            "raw_calendar_years": getattr(prof, "raw_calendar_years", 0.0),
            "effective_years": getattr(prof, "effective_years", 0.0),
            "experience_score": getattr(prof, "experience_score", 0.0),
            "seniority_level": getattr(prof, "seniority_level", "junior"),
            "seniority_rank": getattr(prof, "seniority_rank", 1),
            "seniority_delta": getattr(prof, "seniority_delta", 0),
            "gaps": [g.__dict__ if hasattr(g, "__dict__") else g for g in getattr(prof, "gaps", [])],
            "role_breakdown": getattr(prof, "role_breakdown", []),
        }

    return result_payload


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
    start_t = time.perf_counter()
    try:
        from core.telemetry import trace_span
        from core.metrics import record_ats_match_metrics
        from services.multi_tenancy.tenant_context import get_current_tenant_id

        with trace_span("scoring_engine.score_resume", attributes={"scoring.mode": mode}):
            active_profile = profile or SCORING_PROFILES.get(mode, CANDIDATE_PROFILE)
            components = _compute_shared_components(
                resume=resume,
                jd=jd,
                required_skills=required_skills,
                min_years=min_years,
                profile=active_profile,
            )
            result = _apply_profile(components, active_profile, mode=mode)
            duration = time.perf_counter() - start_t
            record_ats_match_metrics(tenant_id=get_current_tenant_id(), duration_sec=duration, status="success")
            gc.collect()
            return result
    except Exception as exc:
        duration = time.perf_counter() - start_t
        try:
            from core.metrics import record_ats_match_metrics
            from services.multi_tenancy.tenant_context import get_current_tenant_id
            record_ats_match_metrics(tenant_id=get_current_tenant_id(), duration_sec=duration, status="failed")
        except Exception:
            pass
        raise exc


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
            "scoring_version": SCORING_ENGINE_VERSION,
        }
    """
    start_t = time.perf_counter()
    try:
        from core.telemetry import trace_span
        from core.metrics import record_ats_match_metrics
        from services.multi_tenancy.tenant_context import get_current_tenant_id

        with trace_span("scoring_engine.score_resume_dual"):
            components = _compute_shared_components(
                resume=resume,
                jd=jd,
                required_skills=required_skills,
                min_years=min_years,
            )
            cand_res = _apply_profile(components, CANDIDATE_PROFILE, mode="candidate")
            rec_res = _apply_profile(components, RECRUITER_PROFILE, mode="recruiter")
            duration = time.perf_counter() - start_t
            record_ats_match_metrics(tenant_id=get_current_tenant_id(), duration_sec=duration, status="success")
            gc.collect()
            return {
                "candidate_score": cand_res["final_score"],
                "recruiter_score": rec_res.get("recruiter_score", rec_res["final_score"]),
                "quality_score": rec_res["quality_score"],
                "eligibility": rec_res["eligibility"],
                "eligibility_rank": rec_res["eligibility_rank"],
                "candidate_result": cand_res,
                "recruiter_result": rec_res,
                "features": rec_res.get("features") or cand_res.get("features"),
                "attribution_evidence": components.attribution_evidence,
                "knockout": components.knockout_result,
                "scoring_version": SCORING_ENGINE_VERSION,
            }
    except Exception as exc:
        duration = time.perf_counter() - start_t
        try:
            from core.metrics import record_ats_match_metrics
            from services.multi_tenancy.tenant_context import get_current_tenant_id
            record_ats_match_metrics(tenant_id=get_current_tenant_id(), duration_sec=duration, status="failed")
        except Exception:
            pass
        raise exc