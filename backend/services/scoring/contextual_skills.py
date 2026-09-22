"""
Contextual Skill Scoring Module (Phase 3).
Evaluates evidence-aware skill fulfillment based on:
1. Evidence location (skills-list: 0.60, certification: 0.80, project: 0.85, work experience: 1.00)
2. Recency decay (half-life configurable, default 5y)
3. Duration of usage inferred from role dates
4. Anti keyword-stuffing detection (dense comma spam & repeated ungrounded tokens)
5. Time Complexity: O(N_skills * L_resume) single-pass token and section indexing.
"""

from __future__ import annotations

from datetime import date, datetime
import math
import os
import re
from typing import Any, Dict, List, Optional, Set, Tuple
import structlog

from services.scoring.experience_model import parse_flexible_date

logger = structlog.get_logger(__name__)

# Metrics pattern for experience bullets with measurable outcome
_METRIC_RE = re.compile(
    r"(?:\d+(?:\.\d+)?%|\d+(?:\.\d+)?[xX]|\$?\d+(?:\.\d+)?[kKmMbB]?\+?|\d+\s*(?:ms|sec|users|clients|rps|qps|req/s|queries|requests|downloads))\b",
    re.IGNORECASE,
)

EVIDENCE_MULTIPLIERS = {
    "work_experience_metric": 1.00,
    "work_experience": 1.00,
    "project": 0.85,
    "certification": 0.80,
    "skills_list": 0.60,
    "unknown": 0.50,
}


def make_skill_regex(skill: str) -> re.Pattern:
    """
    Creates a regex pattern that matches the skill name with robust boundary detection,
    safely handling non-word tokens like C++, C#, .NET.
    """
    escaped = re.escape(skill.strip().lower())
    return re.compile(rf"(?<![a-zA-Z0-9]){escaped}(?![a-zA-Z0-9])", re.IGNORECASE)


def build_resume_section_index(
    extracted_data: Dict[str, Any],
    raw_text: str = "",
    reference_date: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Builds a single-pass normalized index of resume sections, role intervals, and text blocks.
    
    Time Complexity: O(L_resume)
    Space Complexity: O(L_resume)
    """
    now = reference_date or date.today()

    experiences = extracted_data.get("work_experience") or extracted_data.get("experience") or []
    projects = extracted_data.get("projects") or []
    certifications = extracted_data.get("certifications") or []
    skills_list = extracted_data.get("skills") or extracted_data.get("technical_skills") or []

    exp_blocks: List[Dict[str, Any]] = []
    for exp in experiences:
        if not isinstance(exp, dict):
            continue
        title = str(exp.get("title") or exp.get("role") or "").strip()
        desc = str(exp.get("description") or "").strip()
        highlights = exp.get("highlights") or []
        hl_str = " ".join([str(h) for h in highlights if h]) if isinstance(highlights, list) else str(highlights)
        text = f"{title}. {desc} {hl_str}".strip()

        s_date = parse_flexible_date(exp.get("start_date"), default_is_start=True)
        e_date = parse_flexible_date(exp.get("end_date"), default_is_start=False) or now
        if s_date is None:
            dur_y = float(exp.get("duration_years") or 1.0)
            days = int(dur_y * 365.25)
            s_date = date.fromordinal(max(1, e_date.toordinal() - days))
        if s_date > e_date:
            s_date, e_date = e_date, s_date

        dur_years = max(0.2, (e_date - s_date).days / 365.25)
        years_ago = max(0.0, (now - e_date).days / 365.25)

        has_metric = bool(_METRIC_RE.search(text))
        exp_blocks.append({
            "text": text.lower(),
            "has_metric": has_metric,
            "duration_years": dur_years,
            "years_since_end": years_ago,
        })

    proj_blocks: List[Dict[str, Any]] = []
    for proj in projects:
        if isinstance(proj, dict):
            p_title = str(proj.get("title") or proj.get("name") or "").strip()
            p_desc = str(proj.get("description") or "").strip()
            p_hl = proj.get("highlights") or []
            p_hl_str = " ".join([str(h) for h in p_hl if h]) if isinstance(p_hl, list) else str(p_hl)
            p_tech = " ".join(proj.get("technologies", [])) if isinstance(proj.get("technologies"), list) else str(proj.get("technologies") or "")
            p_text = f"{p_title}. {p_desc} {p_hl_str} {p_tech}".strip()
            e_date = parse_flexible_date(proj.get("end_date") or proj.get("date"), default_is_start=False) or now
        else:
            p_text = str(proj).strip()
            e_date = now

        years_ago = max(0.0, (now - e_date).days / 365.25)
        proj_blocks.append({
            "text": p_text.lower(),
            "years_since_end": years_ago,
            "has_metric": bool(_METRIC_RE.search(p_text)),
        })

    cert_texts = [str(c.get("name") if isinstance(c, dict) else c).lower() for c in certifications if c]

    # Keyword stuffing detector: check for dense comma-separated skill lists
    stuffed_tokens: Set[str] = set()
    raw_lower = raw_text.lower()
    dense_blocks = re.findall(r"(?:[a-zA-Z0-9+#.-]{2,15}[,\t|•/]\s*){7,}[a-zA-Z0-9+#.-]{2,15}", raw_text)
    for block in dense_blocks:
        tokens = re.split(r"[,/|•\t]+", block.lower())
        if len(tokens) >= 7:
            for t in tokens:
                t_clean = t.strip()
                if len(t_clean) >= 2:
                    stuffed_tokens.add(t_clean)

    return {
        "experiences": exp_blocks,
        "projects": proj_blocks,
        "certifications": cert_texts,
        "skills_list": [str(s).lower() for s in skills_list if s],
        "raw_lower": raw_lower,
        "stuffed_tokens": stuffed_tokens,
    }


def evaluate_skill_context(
    skill: str,
    section_index: Dict[str, Any],
    half_life_years: float = 5.0,
) -> Dict[str, Any]:
    """
    Evaluates where a skill appears, its recency, duration of use, and keyword-stuffing status.

    Returns:
        {
            "skill": skill,
            "where": "work_experience_metric" | "work_experience" | "project" | "certification" | "skills_list",
            "recency_years": float,
            "recency_decay": float,
            "duration_years": float,
            "is_stuffed": bool,
            "credit": float (in [0.10, 1.00]),
        }
    """
    sk_low = skill.lower().strip()
    sk_pattern = make_skill_regex(sk_low)

    # 1. Search Work Experience (highest evidence)
    in_work = False
    in_work_metric = False
    min_exp_years_ago = 99.0
    total_exp_duration = 0.0

    for exp in section_index["experiences"]:
        if sk_pattern.search(exp["text"]):
            in_work = True
            if exp["has_metric"]:
                in_work_metric = True
            min_exp_years_ago = min(min_exp_years_ago, exp["years_since_end"])
            total_exp_duration += exp["duration_years"]

    # 2. Search Projects
    in_project = False
    min_proj_years_ago = 99.0
    for proj in section_index["projects"]:
        if sk_pattern.search(proj["text"]):
            in_project = True
            min_proj_years_ago = min(min_proj_years_ago, proj["years_since_end"])

    # 3. Search Certifications
    in_cert = any(sk_pattern.search(c) for c in section_index["certifications"])

    # 4. Search Skills List
    in_skills_list = any(sk_low == s or sk_pattern.search(s) for s in section_index["skills_list"])

    # Resolve location and base multiplier
    if in_work_metric:
        where = "work_experience_metric"
        base_mult = 1.00
        recency_years = min_exp_years_ago if min_exp_years_ago < 90 else 0.0
    elif in_work:
        where = "work_experience"
        base_mult = 1.00
        recency_years = min_exp_years_ago if min_exp_years_ago < 90 else 0.0
    elif in_project:
        where = "project"
        base_mult = 0.85
        recency_years = min_proj_years_ago if min_proj_years_ago < 90 else 0.0
    elif in_cert:
        where = "certification"
        base_mult = 0.80
        recency_years = 0.0
    elif in_skills_list:
        where = "skills_list"
        base_mult = 0.60
        recency_years = 0.0
    else:
        # Appears in raw text only
        where = "skills_list"
        base_mult = 0.60
        recency_years = 0.0

    # 5. Recency Decay (exponential half-life)
    recency_decay = float(0.5 ** (recency_years / max(1.0, half_life_years)))

    # 6. Duration Factor (saturating curve)
    if in_work or in_work_metric:
        duration_factor = min(1.0, 0.90 + 0.10 * min(1.0, total_exp_duration / 2.0))
    elif in_project:
        duration_factor = 1.00
    elif in_cert:
        duration_factor = 1.00
    else:
        duration_factor = 1.00

    # 7. Anti Keyword-Stuffing Penalty
    is_stuffed = False
    if where == "skills_list" and (sk_low in section_index["stuffed_tokens"] or len(re.findall(sk_pattern, section_index["raw_lower"])) > 6):
        is_stuffed = True

    stuffing_penalty = 0.60 if is_stuffed else 1.00

    # 8. Composite Skill Credit in [0.10, 1.00]
    final_credit = min(1.00, max(0.10, base_mult * recency_decay * duration_factor * stuffing_penalty))

    return {
        "skill": skill,
        "where": where,
        "recency_years": round(recency_years, 1),
        "recency_decay": round(recency_decay, 3),
        "duration_years": round(total_exp_duration, 1),
        "is_stuffed": is_stuffed,
        "credit": round(final_credit, 4),
    }


def compute_contextual_skills_breakdown(
    matched_skills: List[str],
    extracted_data: Dict[str, Any],
    raw_text: str = "",
    half_life_years: float = 5.0,
    reference_date: Optional[date] = None,
) -> Tuple[float, List[Dict[str, Any]]]:
    """
    Computes evidence-weighted average fulfillment across matched skills.
    
    Time Complexity: O(N_skills * L_resume)
    Space Complexity: O(N_skills)
    """
    if not matched_skills:
        return 0.0, []

    section_index = build_resume_section_index(extracted_data, raw_text=raw_text, reference_date=reference_date)
    evidence_list: List[Dict[str, Any]] = []

    for sk in matched_skills:
        ev = evaluate_skill_context(sk, section_index, half_life_years=half_life_years)
        evidence_list.append(ev)

    avg_credit = sum(e["credit"] for e in evidence_list) / len(evidence_list) if evidence_list else 1.0
    return round(avg_credit, 4), evidence_list
