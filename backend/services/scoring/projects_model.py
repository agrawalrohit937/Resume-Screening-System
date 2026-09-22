"""
Projects Scoring Module (Phase 1.2).
Evaluates project signals for entry-level / fresher candidates:
1. Tech overlap between project technologies and JD skills (weighted by criticality)
2. Project relevance (embedding similarity mapped to [0.2, 1.0])
3. Evidence quality (GitHub/live link, measurable metrics/outcomes, description depth)
4. Aggregate project score capped at 1.0.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple, Set
import numpy as np
import structlog

logger = structlog.get_logger(__name__)

# Regex for measurable outcomes and quantitative metrics (%, 10x, 500ms, 10k users, etc.)
_METRIC_RE = re.compile(
    r"\b(?:\d+(?:\.\d+)?%|\d+(?:\.\d+)?[xX]|\$?\d+(?:\.\d+)?[kKmMbB]?\+?|\d+\s*(?:ms|sec|seconds|min|users|rps|qps|req/s|queries|requests|stars|downloads|clients))\b",
    re.IGNORECASE,
)

# Regex for repository or live deployment links
_LINK_RE = re.compile(
    r"(?:https?://[^\s]+|github\.com/[^\s]+|gitlab\.com/[^\s]+|[a-zA-Z0-9_\-]+\.(?:vercel\.app|netlify\.app|onrender\.com|herokuapp\.com|dev|io))",
    re.IGNORECASE,
)


def extract_project_technologies(proj: Dict[str, Any], known_skills: Optional[Set[str]] = None) -> List[str]:
    """
    Extracts explicit or inferred technologies from a project dictionary.
    
    Time Complexity: O(T + W) where T is explicit tech tokens, W is text words.
    Space Complexity: O(T)
    """
    found = set()
    for key in ("technologies", "tech_stack", "tools", "skills", "tags"):
        val = proj.get(key)
        if isinstance(val, list):
            for item in val:
                if isinstance(item, str) and item.strip():
                    found.add(item.strip().lower())
        elif isinstance(val, str) and val.strip():
            for item in re.split(r"[,/|;•]+", val):
                if item.strip():
                    found.add(item.strip().lower())

    hl = proj.get("highlights") or []
    hl_str = " ".join(str(h) for h in hl if h) if isinstance(hl, list) else str(hl or "")
    text = f"{proj.get('title', '')} {proj.get('description', '')} {hl_str}".lower()
    if known_skills:
        for sk in known_skills:
            if re.search(r"\b" + re.escape(sk.lower()) + r"\b", text):
                found.add(sk.lower())

    return sorted(list(found))


def compute_single_project_score(
    project: Dict[str, Any],
    jd_text: str,
    jd_skills: List[str],
    criticality_map: Optional[Dict[str, float]] = None,
    embedding_model_fn: Optional[Any] = None,
    jd_vector: Optional[np.ndarray] = None,
) -> Dict[str, Any]:
    """
    Evaluates a single project for tech overlap, relevance, and evidence quality.

    Time Complexity: O(S + L) where S is JD skills count, L is text length.
    Space Complexity: O(D) where D is embedding dimension or word count.
    """
    title = str(project.get("title") or "Project").strip()
    desc = str(project.get("description") or "").strip()
    highlights = project.get("highlights") or []
    highlights_text = " ".join([str(h) for h in highlights]) if isinstance(highlights, list) else str(highlights)
    combined_text = f"{title}. {desc}. {highlights_text}".strip()

    # 1. Tech Overlap (weighted by criticality)
    crit_map = criticality_map or {}
    known_set = set([s.lower() for s in jd_skills]) if jd_skills else set()
    proj_techs = extract_project_technologies(project, known_skills=known_set)

    matched_techs: List[str] = []
    matched_weight = 0.0
    total_crit_weight = 0.0

    for s in jd_skills:
        s_low = s.lower()
        w = float(crit_map.get(s, 2.0 if s_low in ("python", "java", "c++", "react", "sql") else 1.0))
        total_crit_weight += w
        if any(pt == s_low or pt in s_low or s_low in pt for pt in proj_techs):
            matched_techs.append(s)
            matched_weight += w

    if total_crit_weight > 0:
        # Scale overlap against an effective target of up to 5 key skills
        effective_target = min(total_crit_weight, 8.0)
        tech_overlap = min(1.0, matched_weight / max(1.0, effective_target))
    else:
        tech_overlap = 0.5 if proj_techs else 0.0

    # 2. Project Relevance (Embedding similarity mapped to [0.2, 1.0])
    relevance = 0.5
    if embedding_model_fn and combined_text and jd_text:
        try:
            if jd_vector is None:
                jd_vec_res = embedding_model_fn.encode([jd_text[:1500]])
                jd_vec = np.array(jd_vec_res[0])
                jd_norm = np.linalg.norm(jd_vec)
                if jd_norm > 0:
                    jd_vec = jd_vec / jd_norm
            else:
                jd_vec = jd_vector

            p_vec_res = embedding_model_fn.encode([combined_text[:1500]])
            p_vec = np.array(p_vec_res[0])
            p_norm = np.linalg.norm(p_vec)
            if p_norm > 0:
                p_vec = p_vec / p_norm

            cos = float(np.dot(p_vec, jd_vec))
            # Linear mapping: [0.30, 0.85] -> [0.20, 1.00]
            mapped = 0.20 + ((cos - 0.30) / 0.55) * 0.80
            relevance = max(0.20, min(1.00, mapped))
        except Exception as e:
            logger.debug("Project embedding relevance failed, falling back", error=str(e))
            relevance = 0.5

    # 3. Evidence Quality
    # A. GitHub / Live link
    link_in_fields = bool(project.get("link") or project.get("github") or project.get("url") or project.get("live_url"))
    link_in_text = bool(_LINK_RE.search(combined_text))
    has_link = link_in_fields or link_in_text

    # B. Measurable outcomes / metrics
    has_metrics = bool(_METRIC_RE.search(combined_text))

    # C. Description depth
    desc_len = len(combined_text)
    has_depth = desc_len >= 80

    quality_score = 0.0
    if has_link:
        quality_score += 0.40
    if has_metrics:
        quality_score += 0.35
    if has_depth:
        quality_score += 0.25
    quality_score = min(1.0, quality_score)

    # 4. Composite Project Score in [0.0, 1.0]
    # 40% tech overlap + 35% domain relevance + 25% evidence quality
    score = min(1.0, (0.40 * tech_overlap) + (0.35 * relevance) + (0.25 * quality_score))

    return {
        "title": title,
        "score": round(score, 4),
        "tech_overlap": round(tech_overlap, 3),
        "relevance": round(relevance, 3),
        "quality_score": round(quality_score, 3),
        "matched_technologies": matched_techs,
        "has_link": has_link,
        "has_metrics": has_metrics,
        "description_length": desc_len,
    }


def compute_projects_score(
    projects: Optional[List[Dict[str, Any]]],
    jd_text: str,
    jd_skills: List[str],
    criticality_map: Optional[Dict[str, float]] = None,
    embedding_model_fn: Optional[Any] = None,
) -> Tuple[float, List[Dict[str, Any]]]:
    """
    Computes overall S_projects in [0.0, 1.0] across all candidate projects.
    
    Formula:
    - Zero projects -> 0.0
    - Multiple projects -> weighted top-3 aggregator (0.55 * p1 + 0.30 * p2 + 0.15 * p3)
    - Capped strictly at 1.0.

    Time Complexity: O(P * (S + L)) where P is number of projects.
    Space Complexity: O(P)
    """
    if not projects:
        return 0.0, []

    # Encode JD vector once if embedding model provided
    jd_vector: Optional[np.ndarray] = None
    if embedding_model_fn and jd_text:
        try:
            res = embedding_model_fn.encode([jd_text[:1500]])
            v = np.array(res[0])
            norm = np.linalg.norm(v)
            if norm > 0:
                jd_vector = v / norm
        except Exception:
            jd_vector = None

    evaluated = []
    for p in projects:
        if not isinstance(p, dict):
            continue
        eval_dict = compute_single_project_score(
            p,
            jd_text=jd_text,
            jd_skills=jd_skills,
            criticality_map=criticality_map,
            embedding_model_fn=embedding_model_fn,
            jd_vector=jd_vector,
        )
        evaluated.append(eval_dict)

    if not evaluated:
        return 0.0, []

    # Sort descending by individual score
    evaluated.sort(key=lambda x: x["score"], reverse=True)

    # Weighted aggregate
    if len(evaluated) == 1:
        agg = evaluated[0]["score"]
    elif len(evaluated) == 2:
        agg = (0.70 * evaluated[0]["score"]) + (0.30 * evaluated[1]["score"])
    else:
        agg = (0.55 * evaluated[0]["score"]) + (0.30 * evaluated[1]["score"]) + (0.15 * evaluated[2]["score"])

    final_s_projects = min(1.0, max(0.0, round(float(agg), 4)))
    return final_s_projects, evaluated
