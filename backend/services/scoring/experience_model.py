"""
Real Experience Model Module.

Phase 1.4:
- Replaces naive year counting with relevance-weighted, recency-decayed effective experience.
- Formula: effective = Σ_i (months_i / 12) * relevance_i * decay_i
    relevance_i = clip(map(cosine(role_vec_i, target_role_vec), [0.3, 0.9] -> [0.2, 1.0]), 0.2, 1.0)
    decay_i     = 0.5 ** (years_since_end_i / 8.0)          # 8-year half-life
- Overlap handling: merges concurrent roles in O(N log N) so calendar time is never double-counted.
- Gap handling: records gaps > 6 months in gaps[] with ZERO score penalty (fairness for leave, caregiving, etc.).
- Saturating experience score: 1 - exp(-1.4 * effective_years / required_years) (~0.75 at parity, asymptotes to 1.0).
- Seniority level & seniority delta calculation.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

# Seniority ranking map
SENIORITY_RANKS: Dict[str, int] = {
    "intern": 0,
    "junior": 1,
    "mid": 2,
    "senior": 3,
    "staff": 4,
    "principal": 5,
    "manager": 4,
    "director": 6,
    "exec": 7,
}


@dataclass
class RoleInterval:
    start_date: date
    end_date: date
    title: str
    company: str
    description: str
    is_current: bool = False


@dataclass
class CareerGap:
    start_date: date
    end_date: date
    duration_months: float


@dataclass
class ExperienceProfile:
    raw_calendar_years: float
    effective_years: float
    experience_score: float
    seniority_level: str
    seniority_rank: int
    seniority_delta: int
    gaps: List[CareerGap] = field(default_factory=list)
    role_breakdown: List[Dict[str, Any]] = field(default_factory=list)


def parse_flexible_date(val: Any, default_is_start: bool = True) -> Optional[date]:
    """Parses various date formats from resume extraction (YYYY, MM/YYYY, 'Present', etc.)."""
    if not val:
        return None
    if isinstance(val, (datetime, date)):
        return val.date() if isinstance(val, datetime) else val

    s = str(val).strip().lower()
    if s in ("present", "current", "now", "ongoing", "today"):
        return date.today()

    # Look for 4-digit year
    year_match = re.search(r"\b(19\d\d|20\d\d)\b", s)
    if not year_match:
        return None
    year = int(year_match.group(1))

    # Look for month (name or number)
    month_map = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }
    month = 1 if default_is_start else 12
    for m_name, m_num in month_map.items():
        if m_name in s:
            month = m_num
            break
    else:
        # Numeric month pattern MM/YYYY or YYYY-MM
        m_num_match = re.search(r"\b(0?[1-9]|1[0-2])[\/\-](19\d\d|20\d\d)\b", s)
        if m_num_match:
            month = int(m_num_match.group(1))
        else:
            m_num_match2 = re.search(r"\b(19\d\d|20\d\d)[\/\-](0?[1-9]|1[0-2])\b", s)
            if m_num_match2:
                month = int(m_num_match2.group(2))

    try:
        return date(year, month, 1)
    except Exception:
        return date(year, 1, 1)


def merge_calendar_intervals(intervals: Any) -> Tuple[float, List[CareerGap]]:
    """
    Merges concurrent intervals in O(N log N) to calculate true calendar days
    without double-counting concurrent roles, and detects gaps > 6 months.
    """
    if not intervals:
        return 0.0, []

    norm_intervals: List[Tuple[date, date]] = []
    for x in intervals:
        if isinstance(x, RoleInterval):
            norm_intervals.append((x.start_date, x.end_date))
        elif hasattr(x, "start_date") and hasattr(x, "end_date"):
            norm_intervals.append((getattr(x, "start_date"), getattr(x, "end_date")))
        elif isinstance(x, (tuple, list)):
            norm_intervals.append((x[0], x[1]))

    if not norm_intervals:
        return 0.0, []

    # Sort intervals by start date
    sorted_intervals = sorted(norm_intervals, key=lambda x: (x[0], x[1]))
    merged: List[Tuple[date, date]] = []

    cur_start, cur_end = sorted_intervals[0]
    for s, e in sorted_intervals[1:]:
        if s <= cur_end:
            # Overlapping or contiguous
            cur_end = max(cur_end, e)
        else:
            merged.append((cur_start, cur_end))
            cur_start, cur_end = s, e
    merged.append((cur_start, cur_end))

    # Calculate total calendar days
    total_days = sum((e - s).days for s, e in merged)
    calendar_years = max(0.0, total_days / 365.25)

    # Detect gaps > 6 months (180 days)
    gaps: List[CareerGap] = []
    for i in range(len(merged) - 1):
        prev_end = merged[i][1]
        next_start = merged[i + 1][0]
        gap_days = (next_start - prev_end).days
        if gap_days > 180:
            gaps.append(CareerGap(
                start_date=prev_end,
                end_date=next_start,
                duration_months=round(gap_days / 30.4375, 1),
            ))

    return round(calendar_years, 2), gaps


def infer_seniority(title: str, text: str = "") -> Tuple[str, int]:
    """Normalizes title and scope signals to derive seniority level and rank."""
    combined = f"{title} {text}".lower()

    if re.search(r"\b(chief|cto|ceo|cfo|cpo|vp|vice president|head of|director)\b", combined):
        if "director" in combined:
            return "director", SENIORITY_RANKS["director"]
        return "exec", SENIORITY_RANKS["exec"]
    if re.search(r"\b(principal|fellow|distinguished)\b", combined):
        return "principal", SENIORITY_RANKS["principal"]
    if re.search(r"\b(staff|lead architect|tech lead|engineering manager)\b", combined):
        return "staff", SENIORITY_RANKS["staff"]
    if re.search(r"\b(senior|sr\.|sr|lead)\b", combined):
        return "senior", SENIORITY_RANKS["senior"]
    if re.search(r"\b(junior|jr\.|jr|associate|trainee|fresher)\b", combined):
        return "junior", SENIORITY_RANKS["junior"]
    if re.search(r"\b(intern|internship|co-op)\b", combined):
        return "intern", SENIORITY_RANKS["intern"]

    return "mid", SENIORITY_RANKS["mid"]


def compute_experience_saturation(
    effective_years: float,
    required_years: float,
    k: float = 1.4,
) -> float:
    """
    Computes normalized experience score in [0.0, 1.0].

    Implementation Rules:
    1. Requirement Check: If effective_years >= required_years, returns 1.0 (100%).
    2. Fresher Baseline: If required_years == 0 (Fresher/Entry-Level) and effective_years >= 0, returns 1.0 (100%).
    3. Partial Credit: Only applies saturating curve (1 - exp(-k * x)) / (1 - exp(-k)) when 0 < effective_years < required_years.
    4. If effective_years <= 0 and required_years > 0: returns 0.0.
    """
    if required_years <= 0:
        return 1.0 if effective_years >= 0 else 0.0
    if effective_years >= required_years:
        return 1.0
    if effective_years <= 0:
        return 0.0

    x = effective_years / required_years
    denom = 1.0 - math.exp(-k)
    if denom == 0:
        return min(1.0, max(0.0, x))
    val = (1.0 - math.exp(-k * x)) / denom
    return min(1.0, max(0.0, float(val)))


def calculate_effective_experience(
    roles: Optional[Union[List[Dict[str, Any]], Dict[str, Any]]] = None,
    target_role_text: str = "",
    target_role_vec: Optional[np.ndarray] = None,
    required_years: float = 3.0,
    min_years: Optional[float] = None,
    embedding_model_fn: Optional[Any] = None,
    reference_date: Optional[date] = None,
    extracted_data: Optional[Dict[str, Any]] = None,
    k_saturation: float = 1.4,
) -> ExperienceProfile:
    """
    Relevance-weighted, recency-decayed effective years.

    effective = Σ_i (months_i / 12) * relevance_i * decay_i
      relevance_i = clip(map(cosine(role_vec_i, target_role_vec), [0.3, 0.9] -> [0.2, 1.0]), 0.2, 1.0)
      decay_i     = 0.5 ** (years_since_end_i / 8.0)          # 8-year half-life
    """
    now = reference_date or date.today()
    if min_years is not None:
        target_years = max(0.0, float(min_years))
    elif target_role_text:
        from services.nlp_extractor import extract_experience_requirement
        req_from_text = extract_experience_requirement(target_role_text)
        if req_from_text is not None:
            target_years = max(0.0, float(req_from_text))
        else:
            target_years = max(0.0, float(required_years if required_years is not None else 0.0))
    else:
        target_years = max(0.0, float(required_years if required_years is not None else 0.0))

    if isinstance(roles, dict):
        role_list = roles.get("work_experience") or roles.get("experience") or []
    elif isinstance(extracted_data, dict):
        role_list = extracted_data.get("work_experience") or extracted_data.get("experience") or []
    elif isinstance(roles, list):
        role_list = roles
    else:
        role_list = []

    if not role_list:
        # Zero experience profile
        cand_exp = float(extracted_data.get("total_experience_years") or 0.0) if extracted_data else 0.0
        score = 100.0 if (target_years <= 0 and cand_exp >= 0) or (target_years > 0 and cand_exp >= target_years) else 0.0
        return ExperienceProfile(
            raw_calendar_years=cand_exp,
            effective_years=cand_exp,
            experience_score=score,
            seniority_level="junior",
            seniority_rank=1,
            seniority_delta=0 if target_years <= 0 else -1,
            gaps=[],
            role_breakdown=[],
        )

    # 1. Parse intervals
    parsed_intervals: List[Tuple[date, date]] = []
    role_data_list: List[Dict[str, Any]] = []

    for r in role_list:
        if not isinstance(r, dict):
            continue
        title = str(r.get("role") or r.get("title") or r.get("job_title") or "Engineer").strip()
        company = str(r.get("company") or r.get("organization") or "").strip()
        desc = str(r.get("description") or "").strip()

        s_date = parse_flexible_date(r.get("start_date"), default_is_start=True)
        e_date = parse_flexible_date(r.get("end_date"), default_is_start=False) or now

        if s_date is None:
            dur_y = float(r.get("duration_years") or 0.0)
            if dur_y <= 0 and r.get("duration_months"):
                dur_y = float(r.get("duration_months")) / 12.0
            if dur_y <= 0 and extracted_data and extracted_data.get("total_experience_years"):
                dur_y = float(extracted_data.get("total_experience_years")) / max(1, len(role_list))
            if dur_y <= 0:
                dur_y = 1.5
            days_span = int(dur_y * 365.25)
            s_date = date.fromordinal(max(1, e_date.toordinal() - days_span))

        if s_date > e_date:
            s_date, e_date = e_date, s_date

        parsed_intervals.append((s_date, e_date))
        role_data_list.append({
            "title": title,
            "company": company,
            "description": desc,
            "start_date": s_date,
            "end_date": e_date,
            "duration_months": max(1.0, (e_date - s_date).days / 30.4375),
            "years_since_end": max(0.0, (now - e_date).days / 365.25),
        })

    # 2. Merge intervals for calendar years & gaps
    calendar_years, gaps = merge_calendar_intervals(parsed_intervals)

    # 3. Calculate embeddings & relevance for roles
    role_descriptions = [f"{r['title']} at {r['company']}. {r['description']}" for r in role_data_list]
    role_vectors: Optional[np.ndarray] = None
    target_vec: Optional[np.ndarray] = target_role_vec

    if embedding_model_fn and target_vec is None and target_role_text:
        try:
            encoded_target = embedding_model_fn.encode([target_role_text])
            if encoded_target:
                target_vec = np.array(encoded_target[0])
                t_norm = np.linalg.norm(target_vec)
                if t_norm > 0:
                    target_vec = target_vec / t_norm
        except Exception:
            target_vec = None

    if embedding_model_fn and role_descriptions and target_vec is not None:
        try:
            vec_list = embedding_model_fn.encode(role_descriptions)
            role_vectors = np.array(vec_list)
            # Normalize role vectors
            r_norms = np.linalg.norm(role_vectors, axis=1, keepdims=True)
            r_norms[r_norms == 0] = 1.0
            role_vectors = role_vectors / r_norms
        except Exception:
            role_vectors = None

    # Target seniority
    target_seniority, target_rank = infer_seniority(target_role_text)

    # 4. Compute effective experience
    total_effective_years = 0.0
    role_breakdowns: List[Dict[str, Any]] = []
    max_cand_rank = 1
    max_cand_seniority = "junior"

    for i, r in enumerate(role_data_list):
        months = r["duration_months"]
        years_since_end = r["years_since_end"]

        # Recency decay (8-year half-life)
        decay = float(0.5 ** (years_since_end / 8.0))

        # Relevance weighting
        relevance = 1.0
        if role_vectors is not None and target_vec is not None and i < len(role_vectors):
            dot = float(np.dot(role_vectors[i], target_vec))
            # Linear map [0.30, 0.90] -> [0.20, 1.00]
            mapped = 0.20 + ((dot - 0.30) / 0.60) * 0.80
            relevance = max(0.20, min(1.00, mapped))

        # Internship / co-op weighting: count internships as experience with 0.5x duration weight
        is_intern = bool(re.search(r"\b(intern|internship|co-op)\b", r["title"], re.IGNORECASE))
        intern_mult = 0.5 if is_intern else 1.0

        role_effective = (months / 12.0) * relevance * decay * intern_mult
        total_effective_years += role_effective

        # Role seniority
        s_level, s_rank = infer_seniority(r["title"], r["description"])
        if s_rank > max_cand_rank:
            max_cand_rank = s_rank
            max_cand_seniority = s_level

        role_breakdowns.append({
            "title": r["title"],
            "company": r["company"],
            "duration_months": round(months, 1),
            "years_since_end": round(years_since_end, 1),
            "decay": round(decay, 3),
            "relevance": round(relevance, 3),
            "effective_years": round(role_effective, 2),
            "seniority": s_level,
            "is_internship": is_intern,
        })

    # Bound effective years
    effective_years = min(round(total_effective_years, 2), calendar_years * 1.05)

    # 5. Normalized Saturating Experience Score (Phase 1.1)
    norm_ratio = compute_experience_saturation(effective_years, target_years, k=k_saturation)
    final_exp_score = round(norm_ratio * 100.0, 1)

    seniority_delta = max_cand_rank - target_rank

    return ExperienceProfile(
        raw_calendar_years=calendar_years,
        effective_years=effective_years,
        experience_score=final_exp_score,
        seniority_level=max_cand_seniority,
        seniority_rank=max_cand_rank,
        seniority_delta=seniority_delta,
        gaps=gaps,
        role_breakdown=role_breakdowns,
    )
