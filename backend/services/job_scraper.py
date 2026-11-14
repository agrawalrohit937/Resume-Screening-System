"""JSearch RapidAPI integration & 5-day external job cleanup (PostgreSQL)."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx
import structlog
from sqlalchemy import delete, select

import core.config  # noqa: F401 - ensures .env is loaded for CLI & worker runs
from config.db import get_pg_session_factory
from models.tables import Job

logger = structlog.get_logger(__name__)

JSEARCH_URL = "https://jsearch.p.rapidapi.com/search-v2"
JSEARCH_HOST = "jsearch.p.rapidapi.com"

# Morning slot queries (07:30 AM IST) - Core software, Full Stack, Python & AI
MORNING_QUERIES = [
    "Fresher Software Engineer in India",
    "Junior Full Stack Developer in India",
    "Python Developer in India",
    "AI Engineer in India",
]

# Afternoon slot queries (02:00 PM IST) - Frontend, Backend Java, Data & ML
AFTERNOON_QUERIES = [
    "Frontend Developer React in India",
    "Junior Backend Developer Java in India",
    "Data Analyst Fresher in India",
    "Machine Learning Engineer in India",
]

SEARCH_QUERIES = MORNING_QUERIES


def resolve_queries_for_slot(slot_type: Optional[str] = None) -> List[str]:
    """Return distinct targeted queries based on scheduler slot (morning vs afternoon)."""
    s = (slot_type or "").lower()
    if "morning" in s or "07:30" in s:
        return MORNING_QUERIES
    if "afternoon" in s or "14:00" in s:
        return AFTERNOON_QUERIES
    try:
        from zoneinfo import ZoneInfo
        ist = ZoneInfo("Asia/Kolkata")
    except Exception:
        ist = timezone(timedelta(hours=5, minutes=30))
    now_ist = datetime.now(timezone.utc).astimezone(ist)
    return MORNING_QUERIES if now_ist.hour < 12 else AFTERNOON_QUERIES


# Picks the highest-priority apply link from RapidAPI options (LinkedIn > Naukri > Direct > fallback).
def resolve_best_apply_url(external_job: Dict[str, Any]) -> Tuple[str, str]:
    """Prioritize LinkedIn, Naukri, then non-Internshala direct portals."""
    options = external_job.get("apply_options") or []
    ranked: Dict[int, Tuple[str, str]] = {}
    for opt in options:
        pub, link = (opt.get("publisher") or "").lower(), opt.get("apply_link") or ""
        if not link:
            continue
        if "linkedin" in pub or "linkedin.com" in link:
            ranked.setdefault(0, (link, "LinkedIn"))
        elif "naukri" in pub or "naukri.com" in link:
            ranked.setdefault(1, (link, "Naukri"))
        elif "internshala" not in pub and "internshala.com" not in link:
            ranked.setdefault(2, (link, opt.get("publisher") or "Company Portal"))
        else:
            ranked.setdefault(3, (link, opt.get("publisher") or "Direct"))

    if ranked:
        return ranked[min(ranked)]
    return external_job.get("job_apply_link") or "", external_job.get("job_publisher") or "External"


# Converts RapidAPI required_experience_in_months into years without guessing if missing.
def _extract_real_min_years(external_job: Dict[str, Any]) -> Optional[float]:
    """Return real required experience in years only when explicitly provided by RapidAPI."""
    exp = external_job.get("job_required_experience") or {}
    min_months = exp.get("required_experience_in_months")
    if min_months is not None:
        return round(float(min_months) / 12.0, 1)
    return None


# Formats min/max salary and currency from RapidAPI into a readable string (or None).
def _format_salary(external_job: Dict[str, Any]) -> Optional[str]:
    min_sal, max_sal = external_job.get("job_min_salary"), external_job.get("job_max_salary")
    currency = external_job.get("job_salary_currency") or "INR"
    if min_sal and max_sal:
        return f"{currency} {min_sal:,.0f} - {max_sal:,.0f}"
    return f"{currency} {min_sal:,.0f}+" if min_sal else None


# Deletes external scraped jobs older than max_age_days (default 7 days) from PostgreSQL.
async def cleanup_stale_external_jobs(max_age_days: int = 7, session_factory: Any = None) -> Dict[str, Any]:
    """Delete any external job (`is_external == True`) older than `max_age_days`."""
    session_factory = session_factory or get_pg_session_factory()
    cutoff_dt = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    try:
        async with session_factory() as session:
            async with session.begin():
                stmt = delete(Job).where(Job.is_external == True, Job.created_at < cutoff_dt)  # noqa: E712
                deleted_count = getattr(await session.execute(stmt), "rowcount", 0) or 0
        logger.info("External job cleanup completed", deleted_count=deleted_count, max_age_days=max_age_days)
        return {"success": True, "deleted_count": deleted_count, "cutoff": cutoff_dt.isoformat(), "max_age_days": max_age_days}
    except Exception as exc:
        logger.error("Failed to cleanup external jobs", error=str(exc), max_age_days=max_age_days)
        return {"success": False, "deleted_count": 0, "error": str(exc), "max_age_days": max_age_days}


# Cleans stale external jobs, fetches fresh India listings via JSearch, and inserts new ones into DB.
async def scrape_external_jobs(
    queries: List[str] | None = None,
    slot_type: Optional[str] = None,
    num_pages: int = 2,
    max_age_days: int = 7,
) -> Dict[str, int]:
    """Clean up 7-day-old external jobs, then fetch & insert new JSearch listings."""
    cleanup_res = await cleanup_stale_external_jobs(max_age_days=max_age_days)
    api_key = os.getenv("RAPIDAPI_KEY", "").strip()
    if not api_key:
        logger.warning("Skipping external job scrape because RAPIDAPI_KEY is not configured")
        return {"fetched": 0, "upserted": 0, "skipped": 0, "deleted": cleanup_res.get("deleted_count", 0)}

    headers = {"X-RapidAPI-Key": api_key, "X-RapidAPI-Host": JSEARCH_HOST}
    now = datetime.now(timezone.utc)
    total_fetched, total_skipped = 0, 0
    parsed_jobs: Dict[str, Dict[str, Any]] = {}
    target_queries = queries or resolve_queries_for_slot(slot_type)
    pages_to_fetch = max(1, min(int(num_pages), 2))

    async with httpx.AsyncClient(timeout=45.0) as client:
        for q in target_queries:
            params: Dict[str, Any] = {
                "query": q,
                "date_posted": "week",
                "employment_types": "FULLTIME,INTERN",
                "job_requirements": "under_3_years_experience",
                "page": 1,
                "num_pages": pages_to_fetch,
            }

            try:
                resp = await client.get(JSEARCH_URL, headers=headers, params=params)
                resp.raise_for_status()
                data_node = resp.json().get("data", [])
                items = data_node.get("jobs", []) if isinstance(data_node, dict) else data_node
            except Exception as exc:
                logger.error("JSearch query failed", query=q, error=str(exc))
                continue

            if not isinstance(items, list):
                continue
            total_fetched += len(items)
            for ext in items:
                if not isinstance(ext, dict):
                    continue
                ext_id = str(ext.get("job_id", "")).strip()
                apply_url, _ = resolve_best_apply_url(ext)
                if not ext_id or not apply_url:
                    total_skipped += 1
                    continue

                title = ext.get("job_title") or "Software Engineer"
                raw_skills = ext.get("job_required_skills") or []
                loc_parts = [p for p in (ext.get("job_city") or "", ext.get("job_state") or "", ext.get("job_country") or "India") if p]
                parsed_jobs[ext_id] = {
                    "company_name": ext.get("employer_name") or "Leading Tech Employer",
                    "title": title,
                    "jd_text_raw": ext.get("job_description") or "",
                    "jd_embedding": [],
                    "company_logo": ext.get("employer_logo"),
                    "company_website": ext.get("employer_website"),
                    "location": ", ".join(loc_parts) if loc_parts else "India",
                    "work_mode": "Remote" if ext.get("job_is_remote") else ("Hybrid" if "hybrid" in title.lower() else "Onsite"),
                    "status": "open",
                    "is_external": True,
                    "external_apply_url": apply_url,
                    "external_job_id": ext_id,
                    "min_years": _extract_real_min_years(ext),
                    "salary_range": _format_salary(ext),
                    "required_skills": [str(s).strip() for s in raw_skills if str(s).strip()] if isinstance(raw_skills, list) else [],
                    "updated_at": now,
                }

    total_upserted = 0
    if parsed_jobs:
        async with get_pg_session_factory()() as session:
            existing_ids = {
                str(r)
                for r in (await session.execute(select(Job.external_job_id).where(Job.external_job_id.in_(list(parsed_jobs))))).scalars().all()
            }
            for ext_id, doc in parsed_jobs.items():
                if ext_id not in existing_ids:
                    session.add(Job(id=str(uuid.uuid4()), tenant_id="default", applicant_count=0, created_at=now, **doc))
                    total_upserted += 1
            await session.commit()

    deleted = cleanup_res.get("deleted_count", 0)
    logger.info("External job scrape completed", fetched=total_fetched, upserted=total_upserted, skipped=total_skipped, deleted=deleted)
    return {"fetched": total_fetched, "upserted": total_upserted, "skipped": total_skipped, "deleted": deleted}


if __name__ == "__main__":
    import asyncio
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from config.db import connect_db, disconnect_db

    async def _run() -> None:
        try:
            await connect_db()
            print(f"Job scrape completed: {await scrape_external_jobs()}")
        finally:
            await disconnect_db()

    asyncio.run(_run())
