"""
Nightly AI Job Alert Scheduler — Retention Loop Engine (Phase D).

Automated background cron task using APScheduler (AsyncIOScheduler):
- Identifies active candidates with primary parsed resumes.
- Computes bidirectional AI match recommendations via local 768-dim BGE vector model.
- Filters opportunities with Match Score >= 75% that haven't been applied to yet.
- Dispatches professional HTML email digest via async SMTP/MIME service.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import structlog

try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    from apscheduler.triggers.interval import IntervalTrigger
    APSCHEDULER_AVAILABLE = True
except ImportError:
    AsyncIOScheduler = None
    CronTrigger = None
    IntervalTrigger = None
    APSCHEDULER_AVAILABLE = False

from config.db import get_database
from models.user_model import UserRole
from services.email_service import send_job_alert_email
from services.job_matcher import find_jobs_for_candidate
from services.job_scraper import scrape_external_jobs
from services.locking import distributed_lock
from utils.pagination import stream_cursor

logger = structlog.get_logger(__name__)


class _DummyScheduler:
    """Fallback dummy scheduler when apscheduler is not installed."""
    running: bool = False

    def add_job(self, *args: Any, **kwargs: Any) -> None:
        pass

    def start(self) -> None:
        pass

    def shutdown(self, *args: Any, **kwargs: Any) -> None:
        pass


# Global singleton AsyncIOScheduler instance (or dummy fallback)
job_alerts_scheduler: Any = AsyncIOScheduler() if APSCHEDULER_AVAILABLE else _DummyScheduler()


async def run_external_job_scrape() -> Dict[str, int]:
    """Run the JSearch import against the active MongoDB connection."""
    try:
        return await scrape_external_jobs(get_database())
    except Exception as exc:
        logger.error("External job scrape failed", error=str(exc))
        return {"fetched": 0, "upserted": 0, "skipped": 0}


async def _resolve_company_logo(job: Dict[str, Any], db: Any) -> Optional[str]:
    """Helper to cleanly resolve company logo URL for job cards."""
    logo = (
        job.get("company_logo_url")
        or job.get("company_logo")
        or job.get("logo_url")
        or job.get("logo")
    )
    if logo and not str(logo).startswith("data:image/"):
        return str(logo).strip()

    job_id = job.get("id") or job.get("_id")
    tenant_id = job.get("tenant_id")
    company_name = job.get("company_name") or job.get("company")

    comp_doc = None
    if tenant_id and tenant_id != "default":
        try:
            comp_doc = await db.companies.find_one({"tenant_id": tenant_id})
        except Exception:
            pass
    if not comp_doc and company_name:
        try:
            comp_doc = await db.companies.find_one(
                {"company_name": {"$regex": f"^{re.escape(str(company_name).strip())}$", "$options": "i"}}
            )
        except Exception:
            pass

    resolved_logo = (
        (comp_doc.get("logo_url") if comp_doc else None)
        or logo
    )

    if resolved_logo:
        logo_str = str(resolved_logo).strip()
        if logo_str.startswith("data:image/"):
            try:
                from services.cloudinary_service import upload_base64_company_logo
                c_id = tenant_id or (re.sub(r"[^a-zA-Z0-9_-]", "-", str(company_name).lower()) if company_name else "company")
                uploaded = await upload_base64_company_logo(logo_str, company_id=c_id)
                if uploaded:
                    return uploaded
            except Exception:
                pass
        return logo_str

    return None


async def run_nightly_job_alerts(db: Optional[Any] = None, target_email: Optional[str] = None) -> Dict[str, Any]:
    """
    Executes the batch Nightly AI Job Alert retention pipeline:
    1. Fast pre-check: Verifies active open jobs exist before scanning candidates.
    2. Scans active candidates with parsed resumes and enabled notifications.
    3. Finds top AI matches (cosine similarity >= 50% calibrated match) for unapplied jobs.
    4. Applies deduplication to avoid re-sending identical job sets sent in the last 24h.
    5. Dispatches responsive HTML digest email and updates last sent timestamp.
    """
    t0 = time.perf_counter()
    now_utc = datetime.now(timezone.utc)
    logger.info("Starting Nightly AI Job Alerts execution", timestamp=now_utc.isoformat(), target_email=target_email)

    if db is None:
        try:
            db = get_database()
        except Exception as exc:
            logger.error("Database connection unavailable for job alerts", error=str(exc))
            return {"error": "Database not initialized", "sent": 0}

    # 1. Clean up stale/closed external jobs older than 3 days before candidate matching
    try:
        from services.job_cleanup_service import cleanup_stale_external_jobs
        await cleanup_stale_external_jobs(db, max_age_days=3)
    except Exception as exc:
        logger.warning("Pre-digest stale job cleanup encountered an issue", error=str(exc))

    # 2. Cost Optimization: Verify open jobs exist before looping through all candidates
    try:
        open_jobs_count = await db.jobs.count_documents({"status": {"$in": ["open", "published"]}})
        if open_jobs_count == 0:
            logger.info("No active open jobs in database; skipping job alerts retention loop.")
            return {
                "status": "completed",
                "timestamp": now_utc.isoformat(),
                "candidates_scanned": 0,
                "candidates_with_resume": 0,
                "candidates_matched": 0,
                "emails_sent": 0,
                "errors": 0,
                "elapsed_ms": int((time.perf_counter() - t0) * 1000),
                "reason": "no_open_jobs",
            }
    except Exception as exc:
        logger.warning("Could not count open jobs, proceeding with caution", error=str(exc))

    # Distributed lock prevents duplicate runs across multi-replica deployments
    lock_key = f"cron:nightly_job_alerts:{target_email}" if target_email else "cron:nightly_job_alerts"
    async with distributed_lock(lock_key, ttl_seconds=3600, db=db) as acquired:
        if not acquired:
            logger.info("Another replica is executing nightly_job_alerts, skipping.")
            return {"status": "skipped", "reason": "lock_held_by_another_replica", "sent": 0}

        # 2. Fetch active candidate accounts
        candidates = []
        try:
            if target_email:
                candidate_cursor = db.users.find({"email": target_email.strip().lower(), "status": {"$ne": "deleted"}})
            else:
                candidate_cursor = db.users.find({
                    "$or": [
                        {"role": UserRole.CANDIDATE.value},
                        {"role": "candidate"},
                        {"role": None},
                    ],
                    "status": {"$ne": "deleted"},
                    "job_alerts_enabled": {"$ne": False},
                })
            candidates = await stream_cursor(candidate_cursor)
        except Exception as exc:
            logger.error("Failed to query candidates for job alert batch", error=str(exc))
            return {"error": str(exc), "sent": 0}

        total_candidates = len(candidates)
        candidates_with_resume = 0
        candidates_matched = 0
        emails_sent = 0
        errors_count = 0
        delivery_details: List[Dict[str, Any]] = []

        # 3. Iterate through candidates and compute recommendations
        for candidate in candidates:
            candidate_id = str(candidate["_id"])
            candidate_email = candidate.get("email")
            candidate_name = candidate.get("full_name") or candidate.get("name") or "Candidate"

            if not candidate_email or "@" not in candidate_email:
                continue

            try:
                # Check if candidate has a parsed resume
                resume_doc = await db.resumes.find_one(
                    {"user_id": candidate_id, "status": "parsed", "parsed_data": {"$ne": None}},
                    sort=[("is_primary", -1), ("created_at", -1)],
                )

                if not resume_doc:
                    continue

                candidates_with_resume += 1

                # Fetch top candidate job matches from vector engine
                match_res = await find_jobs_for_candidate(
                    candidate_id=candidate_id,
                    limit=6,
                    db=db,
                )

                rec_jobs = match_res.get("recommended_jobs", [])

                # Filter: match_score >= 50.0 and is_applied == False
                qualifying_jobs = [
                    j for j in rec_jobs
                    if float(j.get("match_score", 0)) >= 50.0 and not j.get("is_applied", False)
                ]

                if not qualifying_jobs:
                    continue

                top_3_jobs = qualifying_jobs[:3]
                top_3_ids = [str(j.get("id") or j.get("_id")) for j in top_3_jobs if (j.get("id") or j.get("_id"))]

                # Deduplication: Check if candidate already received identical recommendations in the last 5h
                last_sent_ids = candidate.get("last_job_alert_job_ids", [])
                last_sent_at = candidate.get("last_job_alert_at")
                if (
                    not target_email
                    and last_sent_ids
                    and set(top_3_ids) == set(last_sent_ids)
                    and isinstance(last_sent_at, datetime)
                    and (now_utc - last_sent_at).total_seconds() < 18000
                ):
                    logger.debug("Skipping candidate as identical job alert was sent in current slot", candidate_id=candidate_id)
                    continue

                candidates_matched += 1

                # Clean company logo resolution
                for j in top_3_jobs:
                    logo_url = await _resolve_company_logo(j, db)
                    if logo_url:
                        j["company_logo_url"] = logo_url
                        j["company_logo"] = logo_url

                # Dispatch Job Alert Email
                dispatch_res = await send_job_alert_email(
                    to_email=candidate_email,
                    candidate_name=candidate_name,
                    matched_jobs=top_3_jobs,
                )

                if dispatch_res.get("sent"):
                    emails_sent += 1
                    delivery_details.append({
                        "candidate_id": candidate_id,
                        "email": candidate_email,
                        "matched_count": len(top_3_jobs),
                        "simulated": dispatch_res.get("simulated", False),
                    })
                    # Persist last alert metadata for deduplication
                    try:
                        await db.users.update_one(
                            {"_id": candidate["_id"]},
                            {"$set": {
                                "last_job_alert_at": now_utc,
                                "last_job_alert_job_ids": top_3_ids,
                            }}
                        )
                    except Exception:
                        pass
                else:
                    errors_count += 1
                    logger.warning(
                        "Job alert email dispatch reported failure",
                        candidate_id=candidate_id,
                        email=candidate_email,
                        error=dispatch_res.get("error"),
                    )

            except Exception as exc:
                errors_count += 1
                logger.error(
                    "Error processing candidate for nightly job alert",
                    candidate_id=candidate_id,
                    error=str(exc),
                )

        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        summary = {
            "status": "completed",
            "timestamp": now_utc.isoformat(),
            "candidates_scanned": total_candidates,
            "candidates_with_resume": candidates_with_resume,
            "candidates_matched": candidates_matched,
            "emails_sent": emails_sent,
            "errors": errors_count,
            "elapsed_ms": elapsed_ms,
            "sample_deliveries": delivery_details[:5],
        }

        logger.info(
            "Nightly AI Job Alerts batch completed",
            scanned=total_candidates,
            matched=candidates_matched,
            sent=emails_sent,
            elapsed_ms=elapsed_ms,
        )
        return summary


async def sweep_stuck_pending_resumes(db: Optional[Any] = None) -> Dict[str, Any]:
    """
    Finds resumes stuck in 'pending' or 'processing' older than 10 minutes,
    and updates them to 'failed' with actionable retry error messages.
    """
    from datetime import timedelta
    if db is None:
        try:
            db = get_database()
        except Exception:
            return {"swept": 0}

    now = datetime.now(timezone.utc)
    threshold = now - timedelta(minutes=10)

    # Task 4.2: Distributed lock
    async with distributed_lock("cron:sweep_stuck_pending_resumes", ttl_seconds=300, db=db) as acquired:
        if not acquired:
            logger.info("Another replica is sweeping stuck resumes, skipping.")
            return {"status": "skipped", "reason": "lock_held_by_another_replica", "swept": 0}

        query = {
            "status": {"$in": ["pending", "processing"]},
            "created_at": {"$lt": threshold, "$type": "date"},
            "$or": [
                {"updated_at": {"$exists": False}},
                {"updated_at": None},
                {"updated_at": {"$lt": threshold, "$type": "date"}},
            ]
        }
        cursor = db.resumes.find(query)
        stuck_resumes = await stream_cursor(cursor)
        swept_count = 0

        for r in stuck_resumes:
            rid = r["_id"]
            error_msg = "Resume parsing timed out. Please retry parsing or re-upload your document."
            await db.resumes.update_one(
                {"_id": rid},
                {"$set": {
                    "status": "failed",
                    "error_message": error_msg,
                    "parse_error": error_msg,
                    "updated_at": now,
                }},
            )
            swept_count += 1
            logger.warning("Swept stuck resume", resume_id=str(rid), user_id=str(r.get("user_id")))

    if swept_count > 0:
        logger.info("Completed stuck pending resume sweep", swept_count=swept_count)
    return {"swept": swept_count}


def start_job_alert_scheduler() -> None:
    """
    Initializes and starts the APScheduler background cron job.
    Schedules job alerts twice daily:
    - Morning Slot: 07:30 AM IST (02:00 UTC)
    - Afternoon Slot: 02:00 PM IST (08:30 UTC)
    Plus periodic stuck-resume sweeps and external job scrapes.
    """
    if not APSCHEDULER_AVAILABLE:
        logger.info("APScheduler package not installed, running without background cron tasks")
        return

    if job_alerts_scheduler.running:
        logger.info("Job alerts scheduler is already running")
        return

    try:
        # 1. Morning Job Alert Digest (07:30 AM IST)
        job_alerts_scheduler.add_job(
            run_nightly_job_alerts,
            trigger=CronTrigger(hour=7, minute=30, timezone="Asia/Kolkata"),
            id="morning_job_alerts",
            name="Morning AI Job Alerts Digest (07:30 AM IST)",
            replace_existing=True,
            misfire_grace_time=3600,
        )

        # 2. Afternoon Job Alert Digest (02:00 PM IST)
        job_alerts_scheduler.add_job(
            run_nightly_job_alerts,
            trigger=CronTrigger(hour=14, minute=0, timezone="Asia/Kolkata"),
            id="afternoon_job_alerts",
            name="Afternoon AI Job Alerts Digest (02:00 PM IST)",
            replace_existing=True,
            misfire_grace_time=3600,
        )

        # 3. Sweep stuck resumes every 5 minutes
        job_alerts_scheduler.add_job(
            sweep_stuck_pending_resumes,
            trigger=IntervalTrigger(minutes=5),
            id="stuck_resumes_sweep",
            name="Sweep Stuck Pending Resumes",
            replace_existing=True,
            misfire_grace_time=300,
        )

        # 4. Twice-daily external job scrape (06:30 AM IST and 01:00 PM IST)
        job_alerts_scheduler.add_job(
            run_external_job_scrape,
            trigger=CronTrigger(hour="6,13", minute=30, timezone="Asia/Kolkata"),
            id="external_job_scrape",
            name="Twice-Daily JSearch External Job Scrape",
            replace_existing=True,
            misfire_grace_time=3600,
        )

        job_alerts_scheduler.start()
        logger.info("Twice-Daily AI Job Alerts (7:30 AM & 2:00 PM IST) & Background schedulers started")
    except Exception as exc:
        logger.error("Failed to start job alerts scheduler", error=str(exc))


def stop_job_alert_scheduler() -> None:
    """Safely shuts down the APScheduler background task during application teardown."""
    if job_alerts_scheduler.running:
        try:
            job_alerts_scheduler.shutdown(wait=False)
            logger.info("Nightly AI Job Alerts scheduler shut down successfully")
        except Exception as exc:
            logger.error("Error shutting down job alerts scheduler", error=str(exc))
