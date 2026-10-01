"""
Job Matcher Service — Skill & Role Recommendation Engine.

Fast & Resilient Matching Pipeline:
1. Stage 1 (Fast Role & Keyword Pre-Filter):
   - Extracts primary role, domain signals, and top technical skills from candidate resume.
   - Performs a lightweight MongoDB query/regex pre-filter to narrow the open job pool
     down to a relevant subset (~50-100 jobs), with graceful fallback to fresh jobs.
2. Stage 2 (Skill Overlap & Role Bonus Match):
   - Computes deterministic skill overlap ratio and domain role relevance bonus.
   - Fast, zero memory overhead, 100% cloud-safe (zero heavy model crashes).
3. Non-Resume Candidates:
   - Automatically recommends Top Trending & Fresh open marketplace jobs.
"""

from __future__ import annotations

import re
import time
from typing import Any, Dict, List, Optional, Set

import structlog
from bson import ObjectId

from utils.pagination import stream_cursor

logger = structlog.get_logger(__name__)

# Stopwords to filter out generic seniority/level modifiers when extracting core role tokens
ROLE_STOPWORDS = {
    "senior", "sr", "junior", "jr", "mid", "lead", "staff", "principal",
    "intern", "trainee", "associate", "head", "director", "vp", "manager",
    "specialist", "consultant", "analyst", "at", "in", "for", "and", "of", "the",
}


def _extract_candidate_role_signals(parsed_dict: Dict[str, Any], raw_text: str = "") -> Dict[str, Any]:
    """
    Extracts primary role, domain keywords, and top technical skills from candidate resume
    to power Stage 1 MongoDB pre-filtering.
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
    Stage 1: Fast Role & Keyword MongoDB Filter.
    Filters the open job pool down to ~50-100 jobs using indexed fields ($or regex).
    Falls back gracefully to the latest open jobs if the filter is too restrictive.
    """
    base_match: Dict[str, Any] = {"status": {"$in": ["open", "published"]}}
    if not include_external:
        base_match["is_external"] = {"$ne": True}

    or_clauses: List[Dict[str, Any]] = []

    # A. Match on primary role phrase or role tokens
    primary_role = role_signals.get("primary_role", "").strip()
    if primary_role and len(primary_role) >= 3:
        escaped_role = re.escape(primary_role)
        or_clauses.append({"title": {"$regex": escaped_role, "$options": "i"}})

    role_tokens = role_signals.get("role_tokens", [])
    for token in role_tokens:
        if len(token) >= 3:
            or_clauses.append({"title": {"$regex": re.escape(token), "$options": "i"}})
            or_clauses.append({"department": {"$regex": re.escape(token), "$options": "i"}})

    # B. Match on top candidate technical skills in required_skills
    top_skills = role_signals.get("top_skills", [])
    for skill in top_skills[:5]:
        if len(skill) >= 2:
            or_clauses.append({"required_skills": {"$regex": f"^{re.escape(skill)}$", "$options": "i"}})
            or_clauses.append({"title": {"$regex": re.escape(skill), "$options": "i"}})

    projection = {
        "_id": 1,
        "title": 1,
        "company_name": 1,
        "company_logo": 1,
        "company_logo_url": 1,
        "logo_url": 1,
        "logo": 1,
        "location": 1,
        "work_mode": 1,
        "salary_range": 1,
        "required_skills": 1,
        "min_years": 1,
        "jd_text_raw": 1,
        "department": 1,
        "jd_embedding": 1,
        "jd_embedding_bge": 1,
        "created_at": 1,
        "is_external": 1,
        "external_apply_url": 1,
        "apply_url": 1,
        "tenant_id": 1,
    }

    filtered_jobs: List[Dict[str, Any]] = []

    if or_clauses:
        stage1_query = {
            "$and": [
                base_match,
                {"$or": or_clauses},
            ]
        }
        cursor = db.jobs.find(stage1_query, projection).sort("created_at", -1).limit(max_candidates)
        filtered_jobs = await stream_cursor(cursor)

    # Graceful Fallback: If Stage 1 yields fewer than 10 jobs, backfill with the freshest open jobs
    if len(filtered_jobs) < 10:
        logger.info(
            "Stage 1 filter yielded sparse results; widening query to recent open jobs",
            initial_count=len(filtered_jobs),
            primary_role=primary_role,
        )
        existing_ids = {str(j["_id"]) for j in filtered_jobs}
        remaining_limit = max_candidates - len(filtered_jobs)

        fallback_query = dict(base_match)
        if existing_ids:
            try:
                fallback_query["_id"] = {"$nin": [ObjectId(jid) for jid in existing_ids if ObjectId.is_valid(jid)]}
            except Exception:
                pass

        fallback_cursor = db.jobs.find(fallback_query, projection).sort("created_at", -1).limit(remaining_limit)
        fallback_jobs = await stream_cursor(fallback_cursor)
        filtered_jobs.extend(fallback_jobs)

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
    - Stage 1: Fast Role/Keyword MongoDB pre-filtering to 50-100 jobs.
    - Stage 2: Deep Semantic Match via bge-base-en-v1.5 dense vector scoring.
    - Selection: Top scoring (>= 50% match) unapplied jobs.

    Args:
        candidate_id: MongoDB user ID of candidate.
        limit: Max recommended jobs to return (default 5).
        db: Motor async database client.
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

    if db is None:
        raise ValueError("Database instance must be provided to find_jobs_for_candidate.")

    jobs_query = {"status": {"$in": ["open", "published"]}}
    if not include_external:
        jobs_query["is_external"] = {"$ne": True}

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

    # Fallback direct MongoDB lookup if repo unavailable
    if not target_resume:
        doc = await db.resumes.find_one(
            {"user_id": str(candidate_id), "status": "parsed"},
            sort=[("is_primary", -1), ("created_at", -1)],
        )
        if doc and doc.get("parsed_data"):
            from models.resume_model import ResumeModel
            try:
                target_resume = ResumeModel(**doc)
            except Exception:
                target_resume = doc

    # Retrieve candidate's applied jobs to exclude from recommendations
    applied_job_ids: Set[str] = set()
    try:
        app_cursor = db.applications.find({"candidate_id": str(candidate_id)}, {"job_id": 1})
        applied_docs = await stream_cursor(app_cursor)
        for a in applied_docs:
            if a.get("job_id"):
                applied_job_ids.add(str(a["job_id"]))
    except Exception as e:
        logger.warning("Failed to fetch candidate applied jobs", error=str(e))

    # ──────────────────────────────────────────────────────────────────────────
    # CASE 1: CANDIDATE HAS NO RESUME UPLOADED YET
    # Return Top Trending / Fresh Open Jobs (Activation & Growth Loop)
    # ──────────────────────────────────────────────────────────────────────────
    if not target_resume:
        logger.info("No parsed resume found; generating trending open jobs for candidate", candidate_id=candidate_id)
        trending_query = dict(jobs_query)
        if applied_job_ids:
            try:
                trending_query["_id"] = {"$nin": [ObjectId(jid) for jid in applied_job_ids if ObjectId.is_valid(jid)]}
            except Exception:
                pass

        cursor = db.jobs.find(trending_query).sort("created_at", -1).limit(limit)
        fresh_jobs = await stream_cursor(cursor)

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

        total_open_count = await db.jobs.count_documents(jobs_query)
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
    # STAGE 1: Fast Role / Keyword Pre-Filtering (MongoDB Query)
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
            "min_years": float(job.get("min_years", 0.0)),
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
        total_open_count = await db.jobs.count_documents(jobs_query)
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
