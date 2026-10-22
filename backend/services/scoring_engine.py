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
import math
import os
import re
import time
from contextlib import nullcontext
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import numpy as np
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

try:
    from core.telemetry import trace_span
    from core.metrics import record_ats_match_metrics
    from services.multi_tenancy.tenant_context import get_current_tenant_id
except Exception:
    trace_span = None
    record_ats_match_metrics = None
    get_current_tenant_id = None

def _record_metrics(start_t: float, status: str) -> None:
    if record_ats_match_metrics and get_current_tenant_id:
        try:
            record_ats_match_metrics(tenant_id=get_current_tenant_id(), duration_sec=time.perf_counter() - start_t, status=status)
        except Exception:
            pass

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

from services.nlp_extractor import _ZERO_EXP_PATTERN as _ENTRY_LEVEL_PATTERN


def _extract_years_requirement(jd_text: str) -> Optional[Tuple[float, bool]]:
    """Extracts required experience years from JD text using unified NLP extractor."""
    if not jd_text or not jd_text.strip():
        return None
    try:
        from services.nlp_extractor import extract_experience_requirement
        years = extract_experience_requirement(jd_text)
        is_hard = years > 0
        return (years, is_hard)
    except Exception:
        return (0.0, False)


def _map_education_level(level_str: Optional[str]) -> Optional[Tuple[int, str]]:
    """Maps education level string to (rank, label) using education equivalence service."""
    if not level_str or not str(level_str).strip():
        return None
    try:
        from services.education_service import resolve_degree_level
        rank, _, label = resolve_degree_level(str(level_str))
        if rank > 0:
            return (rank, label)
    except Exception:
        pass
    return None


def _extract_degree_requirement(jd_text: str) -> Optional[Tuple[int, str, bool]]:
    """Extracts degree requirements from JD text using standardized education equivalence service."""
    if not jd_text or not jd_text.strip():
        return None
    try:
        from services.education_service import resolve_degree_level
        rank, isced, label = resolve_degree_level(jd_text)
        if rank > 0 and label and label != "Unclassified":
            return (rank, label, True)
    except Exception:
        pass
    return None


def _candidate_max_degree_rank(extracted_data: dict) -> Tuple[int, bool]:
    """Accurately resolves candidate's highest degree rank and in-progress status via education_service."""
    try:
        from services.education_service import candidate_highest_education
        max_rank, _, in_progress, _, _ = candidate_highest_education(extracted_data)
        return max_rank, in_progress
    except Exception as e:
        logger.debug("Failed in ISCED education resolution", error=str(e))
        return 0, False


def _skills_score(
    cand_skills: List[str],
    jd_skills: List[str],
    jd_source: Union[str, JDCriticalityIndex] = "",
    explicit_required: Optional[Set[str]] = None,
    extracted_data: Optional[Dict[str, Any]] = None,
    raw_text: str = "",
    or_groups: Optional[List[Set[str]]] = None,
) -> Tuple[float, List[str], List[str], List[str], List[Dict[str, Any]], Set[str]]:
    """
    Computes criticality-weighted graded skill credit and partitions required skills into:
      - matched_skills (credit >= 0.85)
      - transferable_skills (credit in [0.3, 0.85))
      - missing_skills (credit < 0.3)

    Supports disjunctive 'OR' skill groups (e.g. 'at least one of Java, Python, C++, or JavaScript').
    When a candidate satisfies at least one alternative, other unsatisfied alternatives in that group
    are treated as satisfied options and are not marked as missing or penalized.
    """
    matched, transferable, missing = [], [], []
    skill_evidence: List[Dict[str, Any]] = []
    canonical_jd = canonicalize_skills(jd_skills) if canonicalize_skills else list(dict.fromkeys(jd_skills or []))
    if not canonical_jd:
        return 1.0, cand_skills, [], [], [], set()

    canonical_cand = canonicalize_skills(cand_skills) if canonicalize_skills else cand_skills

    # Resolve satisfied disjunctive OR groups
    satisfied_group_alternatives: Set[str] = set()
    if or_groups:
        cand_norm_set = {c.lower() for c in (canonical_cand or [])}
        for group in or_groups:
            norm_group = {s for s in group if s}
            matched_in_group = set()
            for member in norm_group:
                is_match = False
                if evaluate_skill_fulfillment:
                    res = evaluate_skill_fulfillment(member, canonical_cand)
                    credit_val = res.credit if isinstance(res, SkillMatch) else (1.0 if res[0] else 0.0)
                    is_match = (credit_val >= 0.85)
                else:
                    is_match = member.lower() in cand_norm_set
                if is_match:
                    matched_in_group.add(member)

            if matched_in_group:
                for alt in (norm_group - matched_in_group):
                    satisfied_group_alternatives.add(alt.lower())

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

        # If unfulfilled alternative in already-satisfied OR group, do not penalize or mark missing
        if credit < 0.3 and req.lower() in satisfied_group_alternatives:
            continue

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
    seen_missing = set()
    deduped_missing = []
    for s in missing:
        s_low = s.lower()
        if s_low not in matched_set and s_low not in transferable_set and s_low not in seen_missing:
            seen_missing.add(s_low)
            deduped_missing.append(s)
    missing = deduped_missing

    score = (total_weighted_credit / total_weights) if total_weights > 0 else 1.0
    return score, matched, transferable, missing, skill_evidence, satisfied_group_alternatives


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


def _education_score(extracted_data: dict, jd_text: str, min_education: Optional[str] = None) -> float:
    """
    Computes education match score with explicit support and partial credit for in-progress degrees.
    Applies 90% credit for in-progress candidates matching the major/target tier,
    and 85% credit for general in-progress candidates at the required level.
    """
    mapped_edu = _map_education_level(min_education)
    if mapped_edu is not None:
        required_rank = mapped_edu[0]
    else:
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


def _parsing_health(raw_text: str) -> Dict[str, Any]:
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

    has_tables = bool(re.search(r"(\|[^\n]+\|\n){2,}", text))
    short_tokens = sum(1 for w in words if len(re.sub(r"[^A-Za-z0-9]", "", w)) <= 2)
    short_token_ratio = round(short_tokens / word_count, 3)
    has_multicol = short_token_ratio > 0.35 and word_count > 100
    alpha_chars = sum(1 for c in text if c.isalpha())
    alpha_ratio = round(alpha_chars / max(len(text), 1), 3)
    clean_lengths = [len(re.sub(r"[^A-Za-z0-9]", "", w)) for w in words if re.sub(r"[^A-Za-z0-9]", "", w)]
    avg_word_len = round(sum(clean_lengths) / len(clean_lengths), 2) if clean_lengths else 0.0
    sections_found = sum(1 for pat in _EXPECTED_SECTION_HINTS if re.search(pat, text.lower()))

    warnings: List[str] = []
    if word_count < 100:
        warnings.append(f"Only {word_count} words extracted — unusually brief for a resume.")
    if short_token_ratio > 0.35:
        warnings.append("High ratio of short text fragments (likely multi-column layout issue).")
    if alpha_ratio < 0.55:
        warnings.append("High ratio of symbols/whitespace to letters.")
    if avg_word_len and avg_word_len < 3.2:
        warnings.append("Extracted words are unusually short on average.")
    if sections_found == 0:
        warnings.append("No standard resume section headers detected.")
    if has_tables:
        warnings.append("Embedded tables detected — may impact line parsing in legacy ATS systems.")

    conf = 1.0 - (0.4 if word_count < 100 else 0.0) - min(short_token_ratio, 0.5) - (0.2 if alpha_ratio < 0.55 else 0.0) - (0.15 if has_multicol else 0.0)
    confidence = round(max(0.0, min(1.0, conf)), 2)

    format_report = None
    try:
        from services.ats_format_check import check_ats_formatting
        format_report = check_ats_formatting(raw_text, layout_meta={"has_tables": has_tables, "has_multi_column": has_multicol})
    except Exception:
        format_report = {"is_ats_compliant": confidence >= 0.6, "format_issues": [], "compliance_score": round(confidence * 100, 1)}

    return {
        "is_healthy": confidence >= 0.6 and word_count >= 100,
        "confidence": confidence,
        "warnings": warnings,
        "metrics": {
            "word_count": word_count,
            "short_token_ratio": short_token_ratio,
            "alpha_ratio": alpha_ratio,
            "avg_word_len": avg_word_len,
            "sections_found": sections_found,
            "has_tables": has_tables,
            "has_multi_column": has_multicol,
        },
        "ats_format_report": format_report,
        "format_issues": format_report.get("format_issues", []) if format_report else [],
    }


def _record_check(
    checks: List[Dict[str, Any]],
    reasons: List[str],
    advisories: List[str],
    rule_id: str,
    label: str,
    passed: Any,
    severity: str,
    observed: str,
    evidence: Optional[List[str]] = None,
    source: str = "",
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    chk = {
        "rule_id": rule_id,
        "label": label,
        "passed": passed,
        "severity": severity,
        "observed": observed,
        "evidence": evidence or [],
        "source": source,
    }
    if extra:
        chk.update(extra)
    checks.append(chk)
    if passed is False:
        if severity == "hard":
            reasons.append(observed)
        else:
            advisories.append(observed)


def _evaluate_eligibility(
    extracted_data: dict,
    jd_text: str,
    min_years: Optional[float] = None,
    min_education: Optional[str] = None,
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
    if min_years is not None:
        required_years = float(min_years)
        is_hard = (required_years > 0)
        exp_source = "structured_min_years"
    else:
        regex_years_req = _extract_years_requirement(jd_text)
        required_years, is_hard = regex_years_req if regex_years_req is not None else (None, False)
        exp_source = "jd_regex"

    if required_years is not None and required_years > 0:
        threshold_ratio = getattr(prof, "knockout_years_threshold_ratio", 0.5)
        exp_list = extracted_data.get("experience", []) or extracted_data.get("work_experience", []) or []
        exp_evidence = [f"experience[{i}]" for i in range(min(len(exp_list), 3))] or ["total_experience_years"]

        years_passed = True
        obs_text = f"~{candidate_years:.1f} years" if candidate_years > 0 else "none detected"
        if candidate_years <= 0 and required_years > 0:
            years_passed = False
            obs_text = f"Requires {required_years:.0f}+ years of professional experience — none detected."
        elif candidate_years < required_years:
            obs_text = f"Requires {required_years:.0f}+ years of experience; resume shows ~{candidate_years:.1f} year(s)."
            if is_hard and candidate_years < required_years * threshold_ratio:
                years_passed = False

        _record_check(
            checks, reasons, advisories,
            rule_id="min_years",
            label=f"{required_years:.0f}+ years required",
            passed=years_passed,
            severity="hard" if is_hard else "soft",
            observed=obs_text,
            evidence=exp_evidence,
            source=exp_source,
        )

    edu_mode = "preferred"
    if isinstance(job, dict):
        edu_mode = job.get("education_requirement_mode") or "preferred"
    elif job is not None:
        edu_mode = getattr(job, "education_requirement_mode", "preferred") or "preferred"
    edu_mode = edu_mode.lower()

    # Skills-first mode: when 'ignored', degree requirements produce no eligibility check
    if edu_mode != "ignored":
        mapped_edu = _map_education_level(min_education)
        if mapped_edu is not None:
            required_rank, required_label = mapped_edu
            is_hard = (edu_mode == "required") or (required_rank > 0 and edu_mode != "preferred")
            edu_source = "structured_min_education"
            degree_req = (required_rank, required_label, is_hard) if required_rank > 0 else None
        else:
            degree_req = _extract_degree_requirement(jd_text)
            edu_source = "jd_regex"

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
            elif candidate_rank < required_rank:
                if not in_progress:
                    degree_passed = False
                    msg = f"Requires a {required_label.title()}-level degree; highest education ranks below."
                else:
                    msg = f"Meets the {required_label.title()}-level requirement with a degree currently in progress (Degree in Progress)."
            elif in_progress:
                msg = f"Meets the {required_label.title()}-level requirement with a degree currently in progress (Degree in Progress)."
            else:
                msg = "Degree Aligned"

            observed_str = "Degree in Progress" if in_progress else str(extracted_data.get("education_level") or (msg if not degree_passed else "Degree Aligned"))
            status_label = "Degree in Progress" if in_progress else ("Degree Aligned" if degree_passed else "Degree Mismatch")

            _record_check(
                checks, reasons, advisories,
                rule_id="degree_level",
                label=f"{required_label.title()}-level degree required",
                passed=degree_passed,
                severity="hard" if is_hard else "soft",
                observed=observed_str,
                evidence=edu_evidence,
                source=edu_source,
                extra={"status_label": status_label, "is_in_progress": in_progress},
            )

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

    # Recruiter Eligibility Checks (driven by job fields)
    if job and isinstance(job, dict):
        # 1. Location & Remote Policy
        req_loc = str(job.get("location") or job.get("required_location") or "").strip()
        remote_pol = str(job.get("remote_policy") or "").strip().lower()
        if req_loc or remote_pol:
            cand_loc = str(extracted_data.get("location") or extracted_data.get("city") or "").strip()
            if remote_pol in ("remote", "work_from_home", "fully_remote"):
                loc_passed, loc_obs = True, f"Remote policy ({remote_pol}) accommodates candidate"
            elif not cand_loc:
                loc_passed, loc_obs = "unverified", "Location not explicitly specified on resume"
            elif req_loc.lower() in cand_loc.lower() or cand_loc.lower() in req_loc.lower():
                loc_passed, loc_obs = True, cand_loc
            else:
                loc_passed, loc_obs = False, f"Candidate located in {cand_loc}, role requires {req_loc}"
            is_hard_loc = bool(job.get("hard_location_requirement", False))
            _record_check(checks, reasons, advisories, "location_policy", f"Location: {req_loc or remote_pol}", loc_passed, "hard" if (is_hard_loc and loc_passed is False) else "soft", loc_obs, ["location"] if cand_loc else [], "job_location_spec")

        # 2. Notice Period & Salary Expectations
        max_notice = job.get("max_notice_days") or job.get("notice_period_days")
        if max_notice is not None:
            max_notice_val = float(max_notice)
            cand_notice = extracted_data.get("notice_period_days") or extracted_data.get("notice_days")
            n_passed = "unverified" if cand_notice is None else (float(cand_notice) <= max_notice_val)
            n_obs = "Notice period not stated on resume" if cand_notice is None else f"{float(cand_notice):.0f} days (max allowed: {max_notice_val:.0f} days)"
            is_hard_notice = bool(job.get("hard_notice_requirement", False))
            _record_check(checks, reasons, advisories, "notice_period", f"Notice period <= {max_notice_val:.0f} days", n_passed, "hard" if (is_hard_notice and n_passed is False) else "soft", n_obs, ["notice_period_days"] if cand_notice is not None else [], "job_notice_spec")

        max_salary = job.get("max_salary") or job.get("salary_budget_max")
        if max_salary is not None:
            max_sal_val = float(max_salary)
            cand_exp_sal = extracted_data.get("expected_salary") or extracted_data.get("salary_expectation")
            sal_passed = "unverified" if cand_exp_sal is None else (float(cand_exp_sal) <= max_sal_val)
            sal_obs = "Salary expectation not stated on resume" if cand_exp_sal is None else f"Expected: {float(cand_exp_sal):,.0f} (Budget: {max_sal_val:,.0f})"
            _record_check(checks, reasons, advisories, "salary_expectation", f"Salary Budget <= {max_sal_val:,.0f}", sal_passed, "soft", sal_obs, ["expected_salary"] if cand_exp_sal is not None else [], "job_salary_spec")

        # 3. Work Authorization & Languages
        if bool(job.get("require_work_auth", False)):
            req_auth = str(job.get("work_authorization") or "Valid Work Authorization").strip()
            cand_auth = extracted_data.get("work_authorization") or extracted_data.get("visa_status")
            auth_passed = "unverified" if not cand_auth else True
            auth_obs = "Work authorization status unverified on resume" if not cand_auth else str(cand_auth)
            _record_check(checks, reasons, advisories, "work_authorization", f"Work Authorization: {req_auth}", auth_passed, "hard" if auth_passed is False else "soft", auth_obs, ["work_authorization"] if cand_auth else [], "job_auth_spec")

        req_langs = job.get("required_languages") or []
        if req_langs and isinstance(req_langs, list):
            cand_langs = [str(l).lower() for l in (extracted_data.get("languages") or [])]
            missing_langs = [l for l in req_langs if str(l).lower() not in cand_langs]
            lang_passed = "unverified" if not cand_langs else (len(missing_langs) == 0)
            lang_obs = "Languages not listed on resume" if not cand_langs else (f"Proficient in {', '.join(req_langs)}" if not missing_langs else f"Missing required language(s): {', '.join(missing_langs)}")
            _record_check(checks, reasons, advisories, "language_requirements", f"Languages: {', '.join(req_langs)}", lang_passed, "soft", lang_obs, ["languages"] if cand_langs else [], "job_language_spec")

    # Domain Occupation Adapter Rules (Healthcare, Legal, Trades, etc.)
    from core.feature_flags import FEATURE_OCCUPATION_ADAPTERS
    if FEATURE_OCCUPATION_ADAPTERS:
        try:
            from services.scoring.adapters.registry import detect_occupation_adapter
            job_obj = job if job is not None else {"title": "", "description": jd_text}
            title = str(job_obj.get("title") or "") if isinstance(job_obj, dict) else str(getattr(job_obj, "title", "") or "")
            occ_code = job_obj.get("occupation_code") if isinstance(job_obj, dict) else getattr(job_obj, "occupation_code", None)
            adapter = detect_occupation_adapter(job_title=title, jd_text=jd_text, occupation_code=occ_code)
            for rule in adapter.eligibility_rules(job_obj):
                passed, observed, evidence = rule.evaluate(extracted_data, job_obj)
                _record_check(checks, reasons, advisories, rule.rule_id, rule.label, passed, rule.severity, observed, evidence, rule.source)
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




def _exact_keyword_match(
    raw_text: str,
    skill_universe: List[str],
    satisfied_alternatives: Optional[Set[str]] = None,
    matched_skills: Optional[List[str]] = None,
) -> Dict[str, Any]:
    text = raw_text or ""
    universe = canonicalize_skills(skill_universe) if canonicalize_skills else []
    if not universe:
        seen = set()
        universe = [
            s.strip() for s in (skill_universe or [])
            if s and s.strip() and s.strip().lower() not in seen and not seen.add(s.strip().lower())
        ]

    if not universe:
        return {"strict_ats_score": 0.0, "matched_exact": [], "missing_exact": []}

    known_matched = {m.lower() for m in (matched_skills or [])}
    sat_alts = {s.lower() for s in (satisfied_alternatives or [])}
    matched, missing = [], []
    for skill in universe:
        if skill.lower() in known_matched:
            matched.append(skill)
            continue

        sub_skills = [sub.strip() for sub in skill.split("/") if sub.strip()]
        skill_matched = False
        for sub in sub_skills:
            parts = [re.escape(p) for p in re.split(r'[\s\-\.]+', sub) if p]
            if parts:
                pat = r"(?<![A-Za-z0-9])" + r"[\s\-\.\n\r]+".join(parts) + r"(?![A-Za-z0-9])"
                try:
                    if re.search(pat, text, re.IGNORECASE):
                        skill_matched = True
                        break
                except re.error:
                    continue

        if skill_matched:
            matched.append(skill)
        elif skill.lower() not in sat_alts:
            missing.append(skill)

    matched_set = {m.lower() for m in matched}
    seen_missing = set()
    deduped_missing = []
    for s in missing:
        s_low = s.lower()
        if s_low not in matched_set and s_low not in seen_missing:
            seen_missing.add(s_low)
            deduped_missing.append(s)
    missing = deduped_missing
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
    """
    100% Neural & Semantic ATS vector similarity powered by BGE-M3 / BGE embeddings.
    Strictly zero legacy TF-IDF/BM25 keyword matching for true deep semantic understanding.
    """
    if not resume_text or not jd_text:
        return 0.0

    try:
        from services.embedding_service import embedding_model
        vecs = embedding_model.encode([resume_text[:VEC_TEXT_BUDGET], jd_text[:VEC_TEXT_BUDGET]])
        if len(vecs) == 2:
            v1 = np.asarray(vecs[0], dtype=np.float32)
            v2 = np.asarray(vecs[1], dtype=np.float32)
            denom = float(np.linalg.norm(v1) * np.linalg.norm(v2)) or 1.0
            return _calibrate_cosine(float(v1 @ v2) / denom)
    except Exception as e:
        logger.warning("Neural embedding similarity calculation error", error=str(e))
        return 0.0

    return 0.0


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
    min_years: Optional[float] = None
    min_education: Optional[str] = None

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
    3. Structured Work Experience (most recent first)
    4. Professional Summary & Projects
    """
    if not extracted_data or not isinstance(extracted_data, dict):
        return (raw_text or "")[:max_chars].strip()

    skills_list = list(extracted_data.get("skills") or extracted_data.get("technical_skills") or [])
    if extract_skills_from_sections:
        try:
            skills_list = list(dict.fromkeys(skills_list + extract_skills_from_sections(extracted_data)))
        except Exception:
            pass

    edu_strings = []
    for edu in (extracted_data.get("education") or []):
        d = edu.model_dump() if hasattr(edu, "model_dump") else (edu if isinstance(edu, dict) else getattr(edu, "__dict__", {}))
        clean_parts = [str(d.get(k) or "").strip() for k in ("degree", "field_of_study", "institution") if d.get(k)]
        if clean_parts:
            edu_strings.append(" - ".join(clean_parts))

    exp_strings = []
    for exp in (extracted_data.get("work_experience") or []):
        d = exp.model_dump() if hasattr(exp, "model_dump") else (exp if isinstance(exp, dict) else getattr(exp, "__dict__", {}))
        role = str(d.get("title") or d.get("role") or "").strip()
        comp = str(d.get("company") or "").strip()
        desc = str(d.get("description") or "").strip()
        tech = f"Tech: {', '.join(d.get('technologies') or [])}" if d.get("technologies") else ""
        header = f"{role} at {comp}" if (role or comp) else ""
        line = " ".join(p for p in (header, tech, desc) if p)
        if line:
            exp_strings.append(line)

    summary = str(extracted_data.get("summary") or "").strip()

    sections = []
    if skills_list:
        sections.append(f"Skills: {', '.join(str(s) for s in skills_list if s)}")
    if edu_strings:
        sections.append(f"Education: {'; '.join(edu_strings)}")
    if exp_strings:
        sections.append(f"Experience: {' | '.join(exp_strings)}")
    if summary:
        sections.append(f"Summary: {summary}")

    result = "\n".join(sections).strip()
    return result[:max_chars] if result else (raw_text or "")[:max_chars].strip()


def _compute_shared_components(
    resume: Union[Dict[str, Any], str],
    jd: Union[Dict[str, Any], str],
    required_skills: Optional[List[str]] = None,
    min_years: Optional[float] = None,
    min_education: Optional[str] = None,
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

    # Resolve min_years and min_education if not explicitly passed
    resolved_min_years = min_years
    if resolved_min_years is None and isinstance(jd, dict):
        resolved_min_years = jd.get("min_years")

    resolved_min_education = min_education
    if resolved_min_education is None and isinstance(jd, dict):
        resolved_min_education = jd.get("minimum_education") or jd.get("min_education")

    # 2. Formulate Skill Universe
    canon_fn = canonicalize_skills or (lambda seq: list(dict.fromkeys(str(s).strip() for s in seq if s and str(s).strip())))
    extract_fn = extract_skills_deterministic or (lambda t: [])
    explicit_reqs = canon_fn(required_skills or [])
    jd_skills = canon_fn(extract_fn(jd_text))
    skill_universe = canon_fn(explicit_reqs + jd_skills)

    # 3. Execute Modular Shared Components (Embedding & NLP called ONCE)
    parsing_health = _parsing_health(raw_text)
    eligibility = _evaluate_eligibility(
        extracted_data,
        jd_text,
        min_years=resolved_min_years,
        min_education=resolved_min_education,
        profile=profile,
        parsing_health=parsing_health,
        job=jd,
    )
    knockout = eligibility

    # Precomputed JD Criticality Index for O(L_jd) weighting
    jd_index = JDCriticalityIndex(jd_text) if (FEATURE_CRITICALITY_WEIGHTING and jd_text) else ""
    cand_skills = list(extracted_data.get("skills", []) or extracted_data.get("technical_skills", []) or [])
    if extract_skills_from_sections:
        try:
            cand_skills = list(dict.fromkeys(cand_skills + extract_skills_from_sections(extracted_data)))
        except Exception:
            pass

    # Extract OR groups from JD text
    try:
        from services.nlp_extractor import extract_skill_or_groups
        or_groups = extract_skill_or_groups(jd_text)
    except Exception:
        or_groups = []

    s_score, matched_skills, transferable_skills, missing_skills, skill_evidence, satisfied_alts = _skills_score(
        cand_skills,
        skill_universe,
        jd_source=jd_index,
        explicit_required=set(explicit_reqs),
        extracted_data=extracted_data,
        raw_text=raw_text,
        or_groups=or_groups,
    )
    keyword_match = _exact_keyword_match(
        raw_text,
        skill_universe,
        satisfied_alternatives=satisfied_alts,
        matched_skills=matched_skills,
    )
    exp_score, exp_profile = _compute_experience(extracted_data, jd_text, min_years=resolved_min_years)
    edu_score = _education_score(extracted_data, jd_text, min_education=resolved_min_education)

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
        min_years=resolved_min_years,
        min_education=resolved_min_education,
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
    is_entry_jd = bool(_ENTRY_LEVEL_PATTERN.search(components.jd_text or "")) or (components.min_years is not None and components.min_years <= 1.0)
    if components.min_years is not None:
        jd_min_years = components.min_years
    else:
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
    rec_tiers = [(80.0, "Strong Match", "strong_match"), (60.0, "Good Match", "good_match"), (40.0, "Partial Match", "partial_match")]
    rec_label = next((c if mode == "candidate" else r for thresh, c, r in rec_tiers if quality_score >= thresh), "Low Match" if mode == "candidate" else "poor_match")

    # Actionable Suggestions
    suggestions: List[str] = []
    if components.missing_skills:
        suggestions.append(f"Missing mandatory skills for this role: {', '.join(components.missing_skills[:5])}.")
    if round(components.experience_score * 100, 1) < 70:
        suggestions.append("Experience duration is below the target requirement. Add detailed internship highlights or technical project bullets to showcase hands-on exposure.")
    cand_rank, in_progress = _candidate_max_degree_rank(components.extracted_data)
    if in_progress:
        suggestions.append("Degree in Progress: Highlight anticipated graduation timeline, relevant technical coursework, and capstone projects.")
    elif round(components.education_score * 100, 1) < 70:
        suggestions.append("Education requirement differs from target degree. Emphasize relevant coursework, certifications, and technical capstone projects.")
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
    flag_pairs = [
        ("FEATURE_MULTI_VECTOR_EMBEDDING", FEATURE_MULTI_VECTOR_EMBEDDING),
        ("FEATURE_CROSS_ENCODER_RERANK", FEATURE_CROSS_ENCODER_RERANK),
        ("FEATURE_REAL_EXPERIENCE_MODEL", FEATURE_REAL_EXPERIENCE_MODEL),
        ("FEATURE_SPLIT_ELIGIBILITY", FEATURE_SPLIT_ELIGIBILITY),
        ("FEATURE_CRITICALITY_WEIGHTING", FEATURE_CRITICALITY_WEIGHTING),
        ("FEATURE_PROJECTS_SCORING", FEATURE_PROJECTS_SCORING),
        ("FEATURE_CONTEXTUAL_SKILLS", FEATURE_CONTEXTUAL_SKILLS),
    ]
    active_flags = [name for name, enabled in flag_pairs if enabled]

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
    min_education: Optional[str] = None,
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
        min_education: Optional authoritative minimum education level override.

    Returns:
        Unified dictionary with final_score, component scores, knockout status,
        parsing health, keyword match details, scoring_version, and recommendations.
    """
    start_t = time.perf_counter()
    try:
        tracer = trace_span("scoring_engine.score_resume", attributes={"scoring.mode": mode}) if trace_span else nullcontext()
        with tracer:
            active_profile = profile or SCORING_PROFILES.get(mode, CANDIDATE_PROFILE)
            components = _compute_shared_components(
                resume=resume,
                jd=jd,
                required_skills=required_skills,
                min_years=min_years,
                min_education=min_education,
                profile=active_profile,
            )
            result = _apply_profile(components, active_profile, mode=mode)
            _record_metrics(start_t, "success")
            gc.collect()
            return result
    except Exception as exc:
        _record_metrics(start_t, "failed")
        raise exc


def score_resume_dual(
    resume: Union[Dict[str, Any], str],
    jd: Union[Dict[str, Any], str],
    required_skills: Optional[List[str]] = None,
    min_years: Optional[float] = None,
    min_education: Optional[str] = None,
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
        tracer = trace_span("scoring_engine.score_resume_dual") if trace_span else nullcontext()
        with tracer:
            components = _compute_shared_components(
                resume=resume,
                jd=jd,
                required_skills=required_skills,
                min_years=min_years,
                min_education=min_education,
            )
            cand_res = _apply_profile(components, CANDIDATE_PROFILE, mode="candidate")
            rec_res = _apply_profile(components, RECRUITER_PROFILE, mode="recruiter")
            _record_metrics(start_t, "success")
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
        _record_metrics(start_t, "failed")
        raise exc