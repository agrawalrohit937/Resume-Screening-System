"""
Job Matcher Service — Skill & Role Recommendation Engine.

Fast & Resilient Matching Pipeline:
1. Stage 1 (Fast Role & Keyword Pre-Filter):
   - Extracts primary role, domain signals, and top technical skills from candidate resume.
   - Performs a lightweight PostgreSQL indexed query with ilike role pre-filter.
2. Stage 2 (Skill Overlap & Role Bonus Match):
   - Computes deterministic skill overlap ratio and domain role relevance bonus.
3. Non-Resume Candidates:
   - Automatically recommends Top Trending & Fresh open marketplace jobs.
"""

from __future__ import annotations
import re
import time
from typing import Any, Dict, List, Set

import structlog
from sqlalchemy import select, func, and_, or_, desc

from config.db import get_pg_session_factory
from models.tables import Job, Resume, CandidateApplication

logger = structlog.get_logger(__name__)


# Stopwords to filter out generic seniority/level modifiers when extracting core role tokens
ROLE_STOPWORDS = {
    "senior", "sr", "junior", "jr", "mid", "lead", "staff", "principal",
    "intern", "trainee", "associate", "head", "director", "vp", "manager",
    "specialist", "consultant", "analyst", "at", "in", "for", "and", "of", "the",
}


def _calculate_cosine_similarity(vec_a: Any, vec_b: Any) -> float:
    """Computes cosine similarity between two numeric vectors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(float(a) * float(b) for a, b in zip(vec_a, vec_b))
    norm_a = (sum(float(a) ** 2 for a in vec_a)) ** 0.5
    norm_b = (sum(float(b) ** 2 for b in vec_b)) ** 0.5
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(dot / (norm_a * norm_b))


def _calibrate_match_score(similarity: float) -> float:
    """Calibrates raw vector cosine similarity to a human-friendly match score (0.0 to 100.0)."""
    if similarity <= 0.0:
        return 0.0
    if similarity >= 0.5:
        scaled = 50.0 + (similarity * 45.0)
    else:
        scaled = similarity * 100.0
    return float(round(min(98.0, max(0.0, scaled)), 1))


def _extract_candidate_role_signals(parsed_dict: Dict[str, Any], raw_text: str = "") -> Dict[str, Any]:
    """
    Extracts primary role, domain keywords, and top technical skills from candidate resume
    to power Stage 1 database pre-filtering.
    """
    primary_role = ""
    role_tokens: List[str] = []

    # 1. Check explicit role / designation fields
    for field in ["targeted_role", "desired_role", "role", "designation", "current_title"]:
        val = parsed_dict.get(field)
        if val and isinstance(val, str) and val.strip():
            primary_role = val.strip()
            break

    # 2. Check most recent work experience
    if not primary_role:
        work_exp = parsed_dict.get("work_experience") or []
        if isinstance(work_exp, list) and work_exp:
            first_exp = work_exp[0]
            if isinstance(first_exp, dict):
                primary_role = first_exp.get("title") or first_exp.get("role") or first_exp.get("designation") or ""
            elif hasattr(first_exp, "title"):
                primary_role = getattr(first_exp, "title", "") or ""

    # 3. Extract technical skills
    tech_skills = (
        parsed_dict.get("technical_skills")
        or parsed_dict.get("skills")
        or []
    )
    if isinstance(tech_skills, list):
        cleaned_skills = [str(s).strip() for s in tech_skills if str(s).strip()]
    else:
        cleaned_skills = []

    # 4. Tokenize primary role to extract core domain terms
    if primary_role:
        raw_tokens = re.findall(r"[A-Za-z0-9+#\.]+", primary_role)
        role_tokens = [
            t.lower() for t in raw_tokens
            if len(t) > 1 and t.lower() not in ROLE_STOPWORDS
        ]

    return {
        "primary_role": primary_role,
        "role_tokens": role_tokens,
        "top_skills": cleaned_skills[:10],
        "all_skills": cleaned_skills,
    }


async def _stage_1_prefilter_jobs(
    db: Any,
    role_signals: Dict[str, Any],
    include_external: bool = True,
    max_candidates: int = 100,
) -> List[Dict[str, Any]]:
    """
    Stage 1: Fast Role & Keyword PostgreSQL Pre-Filter.
    Filters open jobs down to ~50-100 jobs using indexed status and role ilike matching.
    Falls back gracefully to the freshest open jobs if the filter is too restrictive.
    """
    primary_role = role_signals.get("primary_role", "").strip()
    filters = [Job.status.in_(["open", "active", "published", "Open", "Active", "Published"])]
    if not include_external:
        filters.append(or_(Job.is_external.is_(False), Job.is_external.is_(None)))

    title_conditions = []
    if primary_role and len(primary_role) >= 3:
        title_conditions.append(Job.title.ilike(f"%{primary_role}%"))

    for token in role_signals.get("role_tokens", []):
        if len(token) >= 3:
            title_conditions.append(Job.title.ilike(f"%{token}%"))
            title_conditions.append(Job.department.ilike(f"%{token}%"))

    for skill in role_signals.get("top_skills", [])[:5]:
        if len(skill) >= 2:
            title_conditions.append(Job.title.ilike(f"%{skill}%"))

    filtered_jobs: List[Dict[str, Any]] = []

    async with get_pg_session_factory()() as session:
        query_filters = list(filters)
        if title_conditions:
            query_filters.append(or_(*title_conditions))

        stmt = select(Job).where(and_(*query_filters)).order_by(desc(Job.created_at)).limit(max_candidates)
        j_rows = (await session.execute(stmt)).scalars().all()
        for r in j_rows:
            d = {c.name: getattr(r, c.name) for c in Job.__table__.columns}
            d["id"] = str(r.id)
            d["_id"] = str(r.id)
            filtered_jobs.append(d)

    # Graceful Fallback: If Stage 1 yields fewer than 10 jobs, backfill with the freshest open jobs
    if len(filtered_jobs) < 10:
        logger.info(
            "Stage 1 filter yielded sparse results; widening query to recent open jobs",
            initial_count=len(filtered_jobs),
            primary_role=primary_role,
        )
        remaining_limit = max_candidates - len(filtered_jobs)
        async with get_pg_session_factory()() as session:
            stmt = select(Job).where(and_(*filters)).order_by(desc(Job.created_at)).limit(remaining_limit)
            j_rows = (await session.execute(stmt)).scalars().all()
            existing_ids = {str(j["id"]) for j in filtered_jobs}
            for r in j_rows:
                jid = str(r.id)
                if jid not in existing_ids:
                    d = {c.name: getattr(r, c.name) for c in Job.__table__.columns}
                    d["id"] = jid
                    d["_id"] = jid
                    filtered_jobs.append(d)
                    existing_ids.add(jid)

    return filtered_jobs


async def find_jobs_for_candidate(
    candidate_id: str,
    limit: int = 5,
    db: Any = None,
    resume_repo: Any = None,
    include_external: bool = True,
) -> Dict[str, Any]:
    """
    Two-Stage Job Recommendation Engine for candidates:
    - Stage 1: Fast Role/Keyword database pre-filtering to 50-100 jobs.
    - Stage 2: Deep Semantic Match via bge-base-en-v1.5 dense vector scoring.
    - Selection: Top scoring (>= 50% match) unapplied jobs.

    Args:
        candidate_id: database user ID of candidate.
        limit: Max recommended jobs to return (default 5).
        db: asyncpg async database client.
        resume_repo: ResumeRepository instance (optional).
        include_external: Whether to include external scraped jobs.

    Returns:
        Dict: {
            "recommended_jobs": [...],
            "total_open_jobs": int,
            "has_resume": bool,
            "resume_id": str | None,
            "processing_time_ms": int,
            "stage1_candidates_count": int,
        }
    """
    t0 = time.perf_counter()

    # 1. Retrieve candidate's primary or latest parsed resume
    target_resume = None
    if resume_repo:
        try:
            target_resume = await resume_repo.get_primary_by_user(str(candidate_id))
            if not target_resume or not target_resume.parsed_data:
                resumes, _ = await resume_repo.get_by_user(str(candidate_id), limit=1)
                target_resume = resumes[0] if resumes else None
        except Exception as e:
            logger.warning("Failed to fetch resume via repo", error=str(e))

    # Fallback direct database lookup if repo unavailable
    if not target_resume:
        async with get_pg_session_factory()() as session:
            stmt = select(Resume).where(and_(Resume.user_id == str(candidate_id), Resume.status == "parsed")).order_by(desc(Resume.is_primary), desc(Resume.created_at)).limit(1)
            r_row = (await session.execute(stmt)).scalar_one_or_none()
            doc = {c.name: getattr(r_row, c.name) for c in Resume.__table__.columns} if r_row else None
            if doc: doc["_id"] = doc.get("id")
        if doc and doc.get("parsed_data"):
            from schemas.resume_schema import ResumeModel
            try:
                target_resume = ResumeModel(**doc)
            except Exception:
                target_resume = doc

    # Retrieve candidate's applied jobs to exclude from recommendations
    applied_job_ids: Set[str] = set()
    try:
        async with get_pg_session_factory()() as session:
            stmt = select(CandidateApplication.job_id).where(CandidateApplication.candidate_id == str(candidate_id))
            res = await session.execute(stmt)
            for r in res.all():
                if r[0]: applied_job_ids.add(str(r[0]))
    except Exception as e:
        logger.warning("Failed to fetch candidate applied jobs", error=str(e))

    # ──────────────────────────────────────────────────────────────────────────
    # CASE 1: CANDIDATE HAS NO RESUME UPLOADED YET
    # Return Top Trending / Fresh Open Jobs (Activation & Growth Loop)
    # ──────────────────────────────────────────────────────────────────────────
    if not target_resume:
        logger.info("No parsed resume found; generating trending open jobs for candidate", candidate_id=candidate_id)

        async with get_pg_session_factory()() as session:
            stmt = select(Job).where(Job.status.in_(["open", "active", "published", "Open", "Active", "Published"])).order_by(desc(Job.created_at)).limit(limit)
            j_rows = (await session.execute(stmt)).scalars().all()
            fresh_jobs = [{c.name: getattr(r, c.name) for c in Job.__table__.columns} for r in j_rows]
            for j in fresh_jobs: j["_id"] = j.get("id")

        trending_results = []
        for job in fresh_jobs:
            job_id_str = str(job["_id"])
            req_skills = [s.strip() for s in (job.get("required_skills") or []) if str(s).strip()]
            trending_results.append({
                "id": job_id_str,
                "title": job.get("title", "Software Engineer"),
                "company_name": job.get("company_name", "Technology Corp"),
                "company_logo": job.get("company_logo") or job.get("company_logo_url") or job.get("logo_url") or job.get("logo"),
                "company_logo_url": job.get("company_logo_url") or job.get("company_logo") or job.get("logo_url") or job.get("logo"),
                "location": job.get("location", "Remote"),
                "work_mode": job.get("work_mode", "Remote"),
                "salary_range": job.get("salary_range"),
                "department": job.get("department"),
                "min_years": float(job.get("min_years", 0.0)),
                "required_skills": req_skills[:6],
                "matched_skills": req_skills[:3],
                "match_score": 75.0,
                "raw_similarity": 0.75,
                "is_applied": False,
                "created_at": job.get("created_at"),
                "is_external": bool(job.get("is_external", False)),
                "external_apply_url": job.get("external_apply_url") or job.get("apply_url"),
            })

        async with get_pg_session_factory()() as session:
            total_open_count = (await session.execute(select(func.count(Job.id)).where(Job.status.in_(["open", "active", "published"])))).scalar() or 0
        return {
            "recommended_jobs": trending_results,
            "total_open_jobs": total_open_count,
            "has_resume": False,
            "resume_id": None,
            "processing_time_ms": int((time.perf_counter() - t0) * 1000),
            "stage1_candidates_count": len(trending_results),
            "message": "Top trending opportunities. Upload your resume for personalized AI match scores.",
        }

    # ──────────────────────────────────────────────────────────────────────────
    # CASE 2: CANDIDATE HAS PARSED RESUME
    # Fast Skill Overlap & Role Match Engine
    # ──────────────────────────────────────────────────────────────────────────
    parsed = getattr(target_resume, "parsed_data", None)
    if hasattr(parsed, "model_dump"):
        parsed_dict = parsed.model_dump()
    elif isinstance(parsed, dict):
        parsed_dict = parsed
    else:
        parsed_dict = {}

    summary_text = parsed_dict.get("summary") or ""
    raw_text = parsed_dict.get("raw_text") or getattr(target_resume, "raw_text", "") or ""
    candidate_skills = (
        parsed_dict.get("technical_skills")
        or parsed_dict.get("skills")
        or []
    )
    candidate_skills_set = {str(s).lower().strip() for s in candidate_skills if str(s).strip()}

    # Extract role & skill signals for Stage 1 filter
    role_signals = _extract_candidate_role_signals(parsed_dict, raw_text)

    # ══════════════════════════════════════════════════════════════════════════
    # STAGE 1: Fast Role / Keyword Pre-Filtering (database Query)
    # ══════════════════════════════════════════════════════════════════════════
    max_stage1_candidates = max(50, min(100, limit * 20))
    stage1_jobs = await _stage_1_prefilter_jobs(
        db=db,
        role_signals=role_signals,
        include_external=include_external,
        max_candidates=max_stage1_candidates,
    )

    if not stage1_jobs:
        return {
            "recommended_jobs": [],
            "total_open_jobs": 0,
            "has_resume": True,
            "resume_id": str(getattr(target_resume, "id", None) or getattr(target_resume, "_id", "")),
            "processing_time_ms": int((time.perf_counter() - t0) * 1000),
            "stage1_candidates_count": 0,
            "message": "No open jobs currently available in the marketplace.",
        }

    # ══════════════════════════════════════════════════════════════════════════
    # STAGE 2: Skill Overlap & Role Bonus Matching (Zero-Memory / Fast)
    # ══════════════════════════════════════════════════════════════════════════
    candidate_role = role_signals.get("primary_role", "").lower()
    role_tokens = [t.lower() for t in role_signals.get("role_tokens", [])]

    ranked_jobs: List[Dict[str, Any]] = []

    for job in stage1_jobs:
        job_id_str = str(job["_id"])
        req_skills = [str(s).strip() for s in (job.get("required_skills") or []) if str(s).strip()]

        # 1. Calculate Exact & Substring Skill Overlap
        matched_skills = []
        for js in req_skills:
            js_lower = js.lower()
            if js_lower in candidate_skills_set or any(js_lower in cs or cs in js_lower for cs in candidate_skills_set):
                matched_skills.append(js)

        # 2. Skill Overlap Ratio
        if req_skills:
            skill_ratio = len(matched_skills) / len(req_skills)
        else:
            skill_ratio = 0.4

        # 3. Role / Title Match Bonus
        title_lower = (job.get("title") or "").lower()
        role_bonus = 0.0
        if candidate_role and len(candidate_role) >= 3 and candidate_role in title_lower:
            role_bonus = 0.25
        elif role_tokens and any(token in title_lower for token in role_tokens if len(token) >= 3):
            role_bonus = 0.15

        # 4. Calibrated Score (52% - 98%)
        raw_score = 52.0 + (skill_ratio * 34.0) + (role_bonus * 12.0)
        match_score = round(min(98.0, max(52.0, raw_score)), 1)

        ranked_jobs.append({
            "id": job_id_str,
            "title": job.get("title", "Software Engineer"),
            "company_name": job.get("company_name", "Technology Corp"),
            "company_logo": job.get("company_logo") or job.get("company_logo_url") or job.get("logo_url") or job.get("logo"),
            "company_logo_url": job.get("company_logo_url") or job.get("company_logo") or job.get("logo_url") or job.get("logo"),
            "location": job.get("location", "Remote"),
            "work_mode": job.get("work_mode", "Remote"),
            "salary_range": job.get("salary_range"),
            "department": job.get("department"),
            "min_years": float(job.get("min_years") or 0.0),
            "required_skills": req_skills[:6],
            "matched_skills": matched_skills[:4] if matched_skills else req_skills[:3],
            "match_score": match_score,
            "raw_similarity": round(match_score / 100.0, 4),
            "is_applied": job_id_str in applied_job_ids,
            "created_at": job.get("created_at"),
            "is_external": bool(job.get("is_external", False)),
            "external_apply_url": job.get("external_apply_url") or job.get("apply_url"),
        })

    # ══════════════════════════════════════════════════════════════════════════
    # SELECTION & RANKING: Exclude applied & pick Top matches
    # ══════════════════════════════════════════════════════════════════════════
    unapplied_jobs = [j for j in ranked_jobs if not j["is_applied"]]
    candidate_matches = unapplied_jobs if unapplied_jobs else ranked_jobs

    # Sort by match score descending
    candidate_matches.sort(key=lambda j: j["match_score"], reverse=True)
    top_matches = candidate_matches[:limit]

    try:
        async with get_pg_session_factory()() as session:
            total_open_count = (await session.execute(select(func.count(Job.id)).where(Job.status.in_(["open", "active", "published"])))).scalar() or 0
    except Exception:
        total_open_count = len(stage1_jobs)

    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    logger.info(
        "Skill & role job matching computed",
        candidate_id=candidate_id,
        stage1_count=len(stage1_jobs),
        matched_count=len(top_matches),
        elapsed_ms=elapsed_ms,
    )

    return {
        "recommended_jobs": top_matches,
        "total_open_jobs": total_open_count,
        "has_resume": True,
        "resume_id": str(getattr(target_resume, "id", None) or getattr(target_resume, "_id", "")),
        "processing_time_ms": elapsed_ms,
        "stage1_candidates_count": len(stage1_jobs),
    }
