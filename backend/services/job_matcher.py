"""Job Matcher Service — Simple Random Open Jobs Picker."""

from __future__ import annotations

import random
from typing import Any, Dict, List, Set

from sqlalchemy import and_, desc, or_, select

from config.db import get_pg_session_factory
from models.tables import CandidateApplication, Job


# Format a single open Job DB row into the standard API recommendation dictionary.
def _format_recommended_job(job: Job, is_applied: bool = False) -> Dict[str, Any]:
    """Serialize an open Job row into the standard recommendation payload."""
    req_skills = [str(s).strip() for s in (job.required_skills or []) if str(s).strip()]
    return {
        "id": str(job.id),
        "title": job.title or "Software Engineer",
        "company_name": job.company_name or "Technology Corp",
        "company_logo": job.company_logo,
        "company_logo_url": job.company_logo,
        "location": job.location or "Remote",
        "work_mode": job.work_mode or "Remote",
        "salary_range": job.salary_range,
        "department": job.department,
        "min_years": float(job.min_years) if job.min_years is not None else None,
        "required_skills": req_skills[:6],
        "matched_skills": [],
        "match_score": 0.0,
        "is_applied": is_applied,
        "created_at": job.created_at,
        "is_external": bool(job.is_external),
        "external_apply_url": job.external_apply_url,
    }


# Fetch open jobs from PostgreSQL and return a random selection (skipping already-applied jobs when possible).
async def find_jobs_for_candidate(
    candidate_id: str,
    limit: int = 5,
    db: Any = None,
    resume_repo: Any = None,
    include_external: bool = True,
) -> Dict[str, Any]:
    """Return random open jobs for a candidate (excluding already-applied jobs when possible)."""
    applied_job_ids: Set[str] = set()
    open_jobs: List[Job] = []

    async with get_pg_session_factory()() as session:
        try:
            app_rows = (
                await session.execute(
                    select(CandidateApplication.job_id).where(CandidateApplication.candidate_id == str(candidate_id))
                )
            ).all()
            applied_job_ids = {str(r[0]) for r in app_rows if r[0]}
        except Exception:
            pass

        filters: List[Any] = [Job.status == "open"]
        if not include_external:
            filters.append(or_(Job.is_external.is_(False), Job.is_external.is_(None)))

        open_jobs = list(
            (
                await session.execute(
                    select(Job).where(and_(*filters)).order_by(desc(Job.created_at)).limit(100)
                )
            ).scalars().all()
        )

    pool = [j for j in open_jobs if str(j.id) not in applied_job_ids] or open_jobs
    picked = random.sample(pool, min(limit, len(pool))) if pool else []
    recommended = [_format_recommended_job(j, is_applied=str(j.id) in applied_job_ids) for j in picked]

    return {
        "recommended_jobs": recommended,
        "total_open_jobs": len(open_jobs),
        "has_resume": True,
        "resume_id": None,
    }
