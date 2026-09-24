"""JSearch RapidAPI integration for candidate-only external job listings with LinkedIn & Naukri priority."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

import httpx
import structlog

logger = structlog.get_logger(__name__)

JSEARCH_URL = "https://jsearch.p.rapidapi.com/search-v2"
JSEARCH_HOST = "jsearch.p.rapidapi.com"

# Target search queries for high-demand tech roles across India
SEARCH_QUERIES = [
    "Software Engineer in India",
    "Frontend Developer React in India",
    "Backend Developer Python Node Java in India",
    "Data Scientist Machine Learning AI in India",
]


def resolve_best_apply_url(external_job: Dict[str, Any]) -> Tuple[str, str]:
    """
    Prioritizes LinkedIn first, then Naukri, then direct employer portals,
    avoiding dead third-party aggregates.
    """
    options = external_job.get("apply_options") or []

    # Priority 1: LinkedIn
    for opt in options:
        pub = (opt.get("publisher") or "").lower()
        link = opt.get("apply_link") or ""
        if "linkedin" in pub or "linkedin.com" in link:
            return link, "LinkedIn"

    # Priority 2: Naukri
    for opt in options:
        pub = (opt.get("publisher") or "").lower()
        link = opt.get("apply_link") or ""
        if "naukri" in pub or "naukri.com" in link:
            return link, "Naukri"

    # Priority 3: Direct employer portals / Workday / Greenhouse / Lever / Indeed
    for opt in options:
        pub = (opt.get("publisher") or "").lower()
        link = opt.get("apply_link") or ""
        if not any(b in pub or b in link for b in ["internshala.com", "internshala"]):
            if link:
                return link, opt.get("publisher") or "Company Portal"

    # Fallback to first available option
    if options and options[0].get("apply_link"):
        return options[0].get("apply_link"), options[0].get("publisher") or "Direct"

    fallback_link = external_job.get("job_apply_link") or ""
    fallback_pub = external_job.get("job_publisher") or "External"
    return fallback_link, fallback_pub


async def scrape_external_jobs(db: Any, queries: List[str] | None = None) -> Dict[str, int]:
    """Fetch fresh JSearch results (LinkedIn & Naukri prioritized) and upsert them by provider job_id."""
    # 1. Clean up stale external jobs older than 7 days first
    try:
        from services.job_cleanup_service import cleanup_stale_external_jobs
        await cleanup_stale_external_jobs(db, max_age_days=7)
    except Exception as exc:
        logger.warning("Pre-scrape stale job cleanup encountered an issue", error=str(exc))

    api_key = os.getenv("RAPIDAPI_KEY", "").strip()
    if not api_key:
        logger.warning("Skipping external job scrape because RAPIDAPI_KEY is not configured")
        return {"fetched": 0, "upserted": 0, "skipped": 0}

    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": JSEARCH_HOST,
    }

    if hasattr(db, "_raw_db"):
        jobs_coll = db._raw_db["jobs"]
    elif hasattr(db, "get_collection") and not hasattr(db, "client"):
        jobs_coll = db.get_collection("jobs")
    else:
        jobs_coll = db["jobs"]

    now = datetime.now(timezone.utc)
    total_fetched = 0
    total_upserted = 0
    total_skipped = 0

    queries_to_run = queries or SEARCH_QUERIES

    async with httpx.AsyncClient(timeout=45.0) as client:
        for q in queries_to_run:
            params = {
                "query": q,
                "date_posted": "week",  # Only fetch fresh, actively open listings posted within the last 7 days
                "employment_types": "FULLTIME,INTERN",
                "page": 1,
                "num_pages": 1,
            }

            try:
                response = await client.get(JSEARCH_URL, headers=headers, params=params)
                response.raise_for_status()
                payload = response.json()
            except Exception as exc:
                logger.error("JSearch query failed", query=q, error=str(exc))
                continue

            # Extract data safely (Handling JSearch v2 nested structure)
            if not isinstance(payload, dict):
                continue

            data_node = payload.get("data", [])
            if isinstance(data_node, dict):
                data_list = data_node.get("jobs", [])
            else:
                data_list = data_node

            if not isinstance(data_list, list):
                continue

            total_fetched += len(data_list)

            for external_job in data_list:
                if not isinstance(external_job, dict):
                    continue

                external_job_id = str(external_job.get("job_id", "")).strip()
                if not external_job_id:
                    total_skipped += 1
                    continue

                apply_url, publisher_source = resolve_best_apply_url(external_job)
                if not apply_url:
                    total_skipped += 1
                    continue

                # Parse experience requirements
                exp_data = external_job.get("job_required_experience") or {}
                min_months = exp_data.get("required_experience_in_months")
                min_years = round(min_months / 12.0, 1) if min_months else 0.0

                # Parse salary if available
                min_sal = external_job.get("job_min_salary")
                max_sal = external_job.get("job_max_salary")
                currency = external_job.get("job_salary_currency") or "INR"
                salary_str = None
                if min_sal and max_sal:
                    salary_str = f"{currency} {min_sal:,.0f} - {max_sal:,.0f}"
                elif min_sal:
                    salary_str = f"{currency} {min_sal:,.0f}+"

                # Parse required skills
                raw_skills = external_job.get("job_required_skills") or []
                skills_list = [str(s).strip() for s in raw_skills if str(s).strip()] if isinstance(raw_skills, list) else []

                city = external_job.get("job_city") or ""
                state = external_job.get("job_state") or ""
                country = external_job.get("job_country") or "India"
                loc_parts = [p for p in [city, state, country] if p]
                location_str = ", ".join(loc_parts) if loc_parts else "India"

                jd_text = external_job.get("job_description") or ""

                # Compute dense vector embedding for instant ATS matching
                jd_embedding_vec = []
                try:
                    from services.embedding_service import embedding_model, EMBEDDING_DIMENSIONS
                    text_for_emb = f"{external_job.get('job_title') or 'Software Engineer'}. Skills: {', '.join(skills_list)}. {jd_text[:1000]}"
                    vecs = embedding_model.encode([text_for_emb])
                    if vecs and len(vecs[0]) == EMBEDDING_DIMENSIONS:
                        jd_embedding_vec = vecs[0]
                except Exception as emb_exc:
                    logger.warning("Failed to generate embedding during job scrape", error=str(emb_exc))

                job_doc = {
                    "company_name": external_job.get("employer_name") or "Leading Tech Employer",
                    "title": external_job.get("job_title") or "Software Engineer",
                    "jd_text_raw": jd_text,
                    "jd_text": jd_text,
                    "jd_embedding_bge": jd_embedding_vec,
                    "jd_embedding": jd_embedding_vec,
                    "company_logo": external_job.get("employer_logo"),
                    "company_website": external_job.get("employer_website"),
                    "location": location_str,
                    "work_mode": "Remote" if external_job.get("job_is_remote") else "Hybrid" if "hybrid" in str(external_job.get("job_title", "")).lower() else "Onsite",
                    "status": "open",
                    "is_external": True,
                    "publisher_source": publisher_source,
                    "external_apply_url": apply_url,
                    "external_job_id": external_job_id,
                    "min_years": min_years,
                    "salary_range": salary_str,
                    "required_skills": skills_list,
                    "updated_at": now,
                }

                await jobs_coll.update_one(
                    {"external_job_id": external_job_id},
                    {
                        "$set": job_doc,
                        "$setOnInsert": {
                            "tenant_id": "default",
                            "applicant_count": 0,
                            "created_at": now,
                        },
                    },
                    upsert=True,
                )
                total_upserted += 1

    logger.info("External job scrape completed", fetched=total_fetched, upserted=total_upserted, skipped=total_skipped)
    return {"fetched": total_fetched, "upserted": total_upserted, "skipped": total_skipped}


if __name__ == "__main__":
    import asyncio
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from core.config import settings
    from config.db import connect_db, disconnect_db, get_database

    async def _run_manual_scrape() -> None:
        try:
            await connect_db()
            result = await scrape_external_jobs(get_database())
            print(f"Job scrape completed successfully: {result}")
        except Exception as exc:
            print(f"Job scrape failed: {exc}")
            sys.exit(1)
        finally:
            await disconnect_db()

    asyncio.run(_run_manual_scrape())