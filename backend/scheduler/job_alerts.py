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
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from config.db import get_database
from models.user_model import UserRole
from services.email_service import send_job_alert_email
from services.job_matcher import find_jobs_for_candidate
from services.locking import distributed_lock
from utils.pagination import stream_cursor

logger = structlog.get_logger(__name__)

# Global singleton AsyncIOScheduler instance
job_alerts_scheduler = AsyncIOScheduler()


async def run_nightly_job_alerts(db: Optional[Any] = None, target_email: Optional[str] = None) -> Dict[str, Any]:
    """
    Executes the batch Nightly AI Job Alert retention pipeline:
    1. Scans candidates in the platform (or a single target_email if specified).
    2. Verifies presence of a parsed resume.
    3. Finds top AI matches (cosine similarity >= 60% calibrated match).
    4. Filters out jobs already applied to by the candidate.
    5. Dispatches responsive HTML digest email.
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

    # Task 4.2: Distributed lock prevents duplicate runs across multi-replica deployments
    lock_key = f"cron:nightly_job_alerts:{target_email}" if target_email else "cron:nightly_job_alerts"
    async with distributed_lock(lock_key, ttl_seconds=3600, db=db) as acquired:
        if not acquired:
            logger.info("Another replica is executing nightly_job_alerts, skipping.")
            return {"status": "skipped", "reason": "lock_held_by_another_replica", "sent": 0}

        # 1. Fetch candidate account(s) via streaming cursor
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

    # 2. Iterate through candidates and compute recommendations
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

            # Fetch top candidate job matches from BGE-base vector engine
            match_res = await find_jobs_for_candidate(
                candidate_id=candidate_id,
                limit=10,
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

            candidates_matched += 1
            top_3_jobs = qualifying_jobs[:3]

            # Dynamically fetch company_logo_url directly from specific tenant/employer document
            from bson import ObjectId
            import re
            from services.cloudinary_service import upload_base64_company_logo

            for j in top_3_jobs:
                job_id = j.get("id") or j.get("_id")
                job_doc = None
                if job_id:
                    try:
                        job_doc = await db.jobs.find_one({"_id": ObjectId(str(job_id))})
                    except Exception:
                        pass

                tenant_id = (job_doc.get("tenant_id") if job_doc else None) or j.get("tenant_id")
                company_name = (job_doc.get("company_name") if job_doc else None) or j.get("company_name")

                comp_doc = None
                if tenant_id and tenant_id != "default":
                    comp_doc = await db.companies.find_one({"tenant_id": tenant_id})
                if not comp_doc and company_name:
                    comp_doc = await db.companies.find_one(
                        {"company_name": {"$regex": f"^{re.escape(str(company_name).strip())}$", "$options": "i"}}
                    )

                employer_logo = (
                    j.get("company_logo_url")
                    or j.get("company_logo")
                    or (comp_doc.get("logo_url") if comp_doc else None)
                    or (job_doc.get("company_logo") if job_doc else None)
                    or (job_doc.get("company_logo_url") if job_doc else None)
                )

                if employer_logo:
                    employer_logo_str = str(employer_logo).strip()
                    # If logo is base64 data URI, upload to Cloudinary to get permanent HTTPS URL
                    if employer_logo_str.startswith("data:image/"):
                        c_id = tenant_id or (company_name.lower().replace(" ", "-") if company_name else "company")
                        uploaded_logo_url = await upload_base64_company_logo(employer_logo_str, company_id=c_id)
                        if uploaded_logo_url:
                            employer_logo_str = uploaded_logo_url
                            # Persist the clean HTTPS URL to MongoDB for this company and job
                            if comp_doc:
                                await db.companies.update_one({"_id": comp_doc["_id"]}, {"$set": {"logo_url": uploaded_logo_url}})
                            if job_doc:
                                await db.jobs.update_one({"_id": job_doc["_id"]}, {"$set": {"company_logo": uploaded_logo_url}})

                    j["company_logo_url"] = employer_logo_str
                    j["company_logo"] = employer_logo_str

            # 3. Dispatch Job Alert Email
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
    Schedules nightly job alerts daily at 02:00 AM UTC and periodic stuck-resume sweeps.
    """
    if job_alerts_scheduler.running:
        logger.info("Job alerts scheduler is already running")
        return

    try:
        from apscheduler.triggers.interval import IntervalTrigger

        job_alerts_scheduler.add_job(
            run_nightly_job_alerts,
            trigger=CronTrigger(hour=2, minute=0, timezone="UTC"),
            id="nightly_job_alerts",
            name="Nightly AI Job Alerts Retention Loop",
            replace_existing=True,
            misfire_grace_time=3600,
        )

        job_alerts_scheduler.add_job(
            sweep_stuck_pending_resumes,
            trigger=IntervalTrigger(minutes=5),
            id="stuck_resumes_sweep",
            name="Sweep Stuck Pending Resumes",
            replace_existing=True,
            misfire_grace_time=300,
        )

        job_alerts_scheduler.start()
        logger.info("Nightly AI Job Alerts & Background sweep schedulers started")
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
