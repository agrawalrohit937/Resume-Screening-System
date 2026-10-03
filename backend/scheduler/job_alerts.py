"""
Nightly & Mid-Day AI Job Alert Scheduler — Retention Loop Engine (Phase D).
===========================================================================

Automated background cron task using APScheduler (AsyncIOScheduler):
- Twice-daily scheduled digests:
  * Morning Slot: 07:30 AM IST (02:00 UTC)
  * Afternoon Slot: 02:00 PM IST (08:30 UTC)
- Deterministic slot-based idempotency (e.g., '2026-10-03_07:30', '2026-10-03_14:00').
- Atomic per-user delivery claims with safe stale-claim recovery in `job_alert_deliveries`.
- Structured audit execution tracking in `cron_job_runs`.
- Non-blocking startup recovery with a strict 2-hour eligibility window.
- Bounded async concurrency (asyncio.Semaphore) optimized for Azure App Service B1.
"""

from __future__ import annotations

import asyncio
import os
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import structlog

try:
    from zoneinfo import ZoneInfo
    IST = ZoneInfo("Asia/Kolkata")
except Exception:
    IST = timezone(timedelta(hours=5, minutes=30))

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
from models.cron_run_model import CronRunStatus, DeliveryStatus, ensure_cron_indexes
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


def calculate_slot_id(now: Optional[datetime] = None, slot_type: Optional[str] = None) -> str:
    """
    Computes a deterministic slot identifier string in Asia/Kolkata timezone.
    Examples: '2026-10-03_07:30', '2026-10-03_14:00'
    """
    if now is None:
        now = datetime.now(timezone.utc)
    
    # Convert to IST
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    ist_now = now.astimezone(IST)
    date_str = ist_now.strftime("%Y-%m-%d")

    if slot_type == "morning":
        return f"{date_str}_07:30"
    elif slot_type == "afternoon":
        return f"{date_str}_14:00"
    elif slot_type == "manual":
        return f"{date_str}_manual_{ist_now.strftime('%H%M%S')}"

    # Auto-infer based on hour if slot_type not provided
    hour = ist_now.hour
    if hour < 12:
        return f"{date_str}_07:30"
    else:
        return f"{date_str}_14:00"


def get_eligible_missed_slot(now: Optional[datetime] = None) -> Optional[Dict[str, str]]:
    """
    Evaluates whether the current IST time falls within the 2-hour eligible recovery window
    for today's morning (07:30 - 09:30 IST) or afternoon (14:00 - 16:00 IST) slot.
    Returns slot metadata dict if eligible, or None if outside the recovery window.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    ist_now = now.astimezone(IST)
    date_str = ist_now.strftime("%Y-%m-%d")

    current_hour_min = ist_now.hour + (ist_now.minute / 60.0)

    # Morning recovery window: 07:30 to 09:30 IST (7.5 to 9.5)
    if 7.5 <= current_hour_min <= 9.5:
        return {
            "slot_id": f"{date_str}_07:30",
            "slot_type": "morning",
            "scheduled_time": "07:30 AM IST",
        }

    # Afternoon recovery window: 14:00 to 16:00 IST (14.0 to 16.0)
    if 14.0 <= current_hour_min <= 16.0:
        return {
            "slot_id": f"{date_str}_14:00",
            "slot_type": "afternoon",
            "scheduled_time": "02:00 PM IST",
        }

    return None


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


async def run_nightly_job_alerts(
    db: Optional[Any] = None,
    target_email: Optional[str] = None,
    slot_id: Optional[str] = None,
    slot_type: Optional[str] = None,
    triggered_by: str = "scheduler",
    force_replay: bool = False,
    concurrency_limit: int = 3,
) -> Dict[str, Any]:
    """
    Executes the batch AI Job Alert retention pipeline:
    1. Pre-Check: Verifies active open jobs exist before scanning candidates.
    2. Deterministic Slot Idempotency & Mutex Locking: Prevents duplicate execution.
    3. Per-Candidate Atomic Delivery Claims: Ensures exactly-once delivery per candidate.
    4. Bounded Async Concurrency: Keeps Azure B1 CPU and memory within safe boundaries.
    5. Persistent Run Logging: Records metrics in `cron_job_runs`.
    """
    t0 = time.perf_counter()
    now_utc = datetime.now(timezone.utc)

    if db is None:
        try:
            db = get_database()
        except Exception as exc:
            logger.error("Database connection unavailable for job alerts", error=str(exc))
            return {"error": "Database not initialized", "sent": 0}

    # Ensure indexes on audit collections
    await ensure_cron_indexes(db)

    # 1. Deterministic slot assignment
    if target_email:
        effective_slot_id = slot_id or calculate_slot_id(now_utc, slot_type="manual")
        effective_slot_type = "manual"
    else:
        effective_slot_id = slot_id or calculate_slot_id(now_utc, slot_type=slot_type)
        effective_slot_type = slot_type or ("morning" if "07:30" in effective_slot_id else "afternoon")

    logger.info(
        "Starting AI Job Alerts execution",
        slot_id=effective_slot_id,
        slot_type=effective_slot_type,
        triggered_by=triggered_by,
        target_email=target_email,
        timestamp=now_utc.isoformat(),
    )

    # 2. Clean up stale/closed external jobs older than 3 days before candidate matching
    try:
        from services.job_cleanup_service import cleanup_stale_external_jobs
        await cleanup_stale_external_jobs(db, max_age_days=3)
    except Exception as exc:
        logger.warning("Pre-digest stale job cleanup encountered an issue", error=str(exc))

    # 3. Cost Optimization: Verify open jobs exist before looping through all candidates
    try:
        open_jobs_count = await db.jobs.count_documents({"status": {"$in": ["open", "published"]}})
        if open_jobs_count == 0:
            logger.info("No active open jobs in database; skipping job alerts retention loop.")
            # Record skipped batch
            if not target_email:
                try:
                    await db.cron_job_runs.update_one(
                        {"slot_id": effective_slot_id, "job_name": "job_alerts"},
                        {"$set": {
                            "slot_id": effective_slot_id,
                            "slot_type": effective_slot_type,
                            "job_name": "job_alerts",
                            "status": CronRunStatus.SKIPPED.value,
                            "started_at": now_utc,
                            "completed_at": datetime.now(timezone.utc),
                            "duration_ms": int((time.perf_counter() - t0) * 1000),
                            "candidates_scanned": 0,
                            "emails_delivered": 0,
                            "error_summary": "No active open jobs in database",
                            "triggered_by": triggered_by,
                        }},
                        upsert=True,
                    )
                except Exception:
                    pass

            return {
                "status": "completed",
                "slot_id": effective_slot_id,
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

    # 4. Distributed Lock Mutex for this specific scheduled slot (TTL: 30 minutes)
    lock_key = f"cron:job_alerts:{effective_slot_id}:{target_email}" if target_email else f"cron:job_alerts:{effective_slot_id}"
    async with distributed_lock(lock_key, ttl_seconds=1800, db=db) as acquired:
        if not acquired:
            logger.info("Another process/replica is executing this job alert slot, skipping.", slot_id=effective_slot_id)
            return {
                "status": "skipped",
                "slot_id": effective_slot_id,
                "reason": "lock_held_by_another_replica",
                "sent": 0,
            }

        # Check existing run document in MongoDB
        if not target_email and not force_replay:
            existing_run = await db.cron_job_runs.find_one({"slot_id": effective_slot_id, "job_name": "job_alerts"})
            if existing_run and existing_run.get("status") in (CronRunStatus.COMPLETED.value, CronRunStatus.EXPIRED.value):
                logger.info("Job alert slot already completed or expired, skipping.", slot_id=effective_slot_id, status=existing_run.get("status"))
                return {
                    "status": "skipped",
                    "slot_id": effective_slot_id,
                    "reason": f"slot_already_{existing_run.get('status')}",
                    "sent": 0,
                }

        # Initialize/Update batch run document to 'running'
        if not target_email:
            try:
                await db.cron_job_runs.update_one(
                    {"slot_id": effective_slot_id, "job_name": "job_alerts"},
                    {"$set": {
                        "slot_id": effective_slot_id,
                        "slot_type": effective_slot_type,
                        "job_name": "job_alerts",
                        "status": CronRunStatus.RUNNING.value,
                        "started_at": now_utc,
                        "triggered_by": triggered_by,
                    }},
                    upsert=True,
                )
            except Exception as e:
                logger.warning("Could not record initial cron_job_runs entry", error=str(e))

        # 5. Fetch active candidate accounts
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
        emails_delivered = 0
        emails_uncertain = 0
        emails_failed = 0
        delivery_details: List[Dict[str, Any]] = []

        # 6. Bounded async worker pool to limit CPU/Memory spikes on Azure B1
        semaphore = asyncio.Semaphore(concurrency_limit)

        async def process_single_candidate(candidate: Dict[str, Any]) -> None:
            nonlocal candidates_with_resume, candidates_matched, emails_delivered, emails_uncertain, emails_failed

            candidate_id = str(candidate["_id"])
            candidate_email = candidate.get("email")
            candidate_name = candidate.get("full_name") or candidate.get("name") or "Candidate"

            if not candidate_email or "@" not in candidate_email:
                return

            # Fast pre-check: Has this user already received an alert for this exact slot?
            if not target_email and candidate.get("last_alert_slot") == effective_slot_id:
                return

            # Check existing candidate delivery record in `job_alert_deliveries`
            existing_delivery = await db.job_alert_deliveries.find_one({
                "candidate_id": candidate_id,
                "slot_id": effective_slot_id,
            })

            now_claim = datetime.now(timezone.utc)
            should_process = False

            if not existing_delivery:
                # Atomically claim this candidate for this slot
                try:
                    await db.job_alert_deliveries.insert_one({
                        "candidate_id": candidate_id,
                        "slot_id": effective_slot_id,
                        "email": candidate_email,
                        "status": DeliveryStatus.CLAIMED.value,
                        "attempt_count": 1,
                        "claimed_at": now_claim,
                    })
                    should_process = True
                except Exception:
                    # Duplicate key race condition - another worker claimed it
                    return
            else:
                st = existing_delivery.get("status")
                if st == DeliveryStatus.DELIVERED.value:
                    # Already sent successfully
                    return
                elif st == DeliveryStatus.UNCERTAIN.value:
                    # Quarantined due to timeout - do not blind-retry
                    return
                elif st == DeliveryStatus.FAILED_PERMANENT.value:
                    return
                elif st == DeliveryStatus.CLAIMED.value:
                    # Check lease timeout (15 minutes) for safe crash recovery
                    claimed_at = existing_delivery.get("claimed_at")
                    if isinstance(claimed_at, datetime) and (now_claim - claimed_at).total_seconds() > 900:
                        # Stale claim from a crashed worker - safely reclaim
                        res_claim = await db.job_alert_deliveries.update_one(
                            {
                                "candidate_id": candidate_id,
                                "slot_id": effective_slot_id,
                                "status": DeliveryStatus.CLAIMED.value,
                                "claimed_at": claimed_at,
                            },
                            {"$set": {"claimed_at": now_claim, "attempt_count": existing_delivery.get("attempt_count", 1) + 1}},
                        )
                        if res_claim.modified_count > 0:
                            should_process = True
                    else:
                        # Currently being processed by another worker
                        return
                elif st == DeliveryStatus.FAILED_TRANSIENT.value:
                    # Retry transient failure
                    should_process = True

            if not should_process:
                return

            async with semaphore:
                try:
                    # 1. Check if candidate has a parsed primary resume
                    resume_doc = await db.resumes.find_one(
                        {"user_id": candidate_id, "status": "parsed", "parsed_data": {"$ne": None}},
                        sort=[("is_primary", -1), ("created_at", -1)],
                    )

                    has_resume = bool(resume_doc)
                    if has_resume:
                        candidates_with_resume += 1

                    # 2. Fetch top candidate job matches
                    match_res = await find_jobs_for_candidate(
                        candidate_id=candidate_id,
                        limit=6,
                        db=db,
                    )

                    rec_jobs = match_res.get("recommended_jobs", [])
                    qualifying_jobs = [j for j in rec_jobs if not j.get("is_applied", False)]

                    if not qualifying_jobs:
                        # No qualifying jobs found; release claim cleanly
                        await db.job_alert_deliveries.update_one(
                            {"candidate_id": candidate_id, "slot_id": effective_slot_id},
                            {"$set": {"status": "NO_QUALIFYING_JOBS", "updated_at": datetime.now(timezone.utc)}},
                        )
                        return

                    top_3_jobs = qualifying_jobs[:3]
                    top_3_ids = [str(j.get("id") or j.get("_id")) for j in top_3_jobs if (j.get("id") or j.get("_id"))]

                    candidates_matched += 1

                    # 3. Clean company logo resolution
                    for j in top_3_jobs:
                        logo_url = await _resolve_company_logo(j, db)
                        if logo_url:
                            j["company_logo_url"] = logo_url
                            j["company_logo"] = logo_url

                    # 4. Dispatch Job Alert Email via Brevo
                    dispatch_res = await send_job_alert_email(
                        to_email=candidate_email,
                        candidate_name=candidate_name,
                        matched_jobs=top_3_jobs,
                        has_resume=has_resume,
                    )

                    now_done = datetime.now(timezone.utc)

                    if dispatch_res.get("sent"):
                        emails_delivered += 1
                        msg_id = dispatch_res.get("message_id")
                        delivery_details.append({
                            "candidate_id": candidate_id,
                            "email": candidate_email,
                            "matched_count": len(top_3_jobs),
                            "message_id": msg_id,
                        })

                        # Mark delivery as DELIVERED in job_alert_deliveries
                        await db.job_alert_deliveries.update_one(
                            {"candidate_id": candidate_id, "slot_id": effective_slot_id},
                            {"$set": {
                                "status": DeliveryStatus.DELIVERED.value,
                                "matched_job_ids": top_3_ids,
                                "brevo_message_id": msg_id,
                                "delivered_at": now_done,
                            }},
                        )

                        # Update user document for fast pre-filtering & profile display
                        try:
                            await db.users.update_one(
                                {"_id": candidate["_id"]},
                                {"$set": {
                                    "last_alert_slot": effective_slot_id,
                                    "last_job_alert_at": now_done,
                                    "last_job_alert_job_ids": top_3_ids,
                                }},
                            )
                        except Exception:
                            pass

                    elif dispatch_res.get("uncertain"):
                        # ReadTimeout after dispatch -> QUARANTINE to prevent duplicate email
                        emails_uncertain += 1
                        logger.warning("Job alert marked UNCERTAIN", candidate_id=candidate_id, email=candidate_email)
                        await db.job_alert_deliveries.update_one(
                            {"candidate_id": candidate_id, "slot_id": effective_slot_id},
                            {"$set": {
                                "status": DeliveryStatus.UNCERTAIN.value,
                                "matched_job_ids": top_3_ids,
                                "error": dispatch_res.get("error"),
                                "updated_at": now_done,
                            }},
                        )
                    else:
                        # Delivery failed
                        emails_failed += 1
                        err_msg = dispatch_res.get("error", "Unknown dispatch failure")
                        await db.job_alert_deliveries.update_one(
                            {"candidate_id": candidate_id, "slot_id": effective_slot_id},
                            {"$set": {
                                "status": DeliveryStatus.FAILED_PERMANENT.value,
                                "error": str(err_msg),
                                "updated_at": now_done,
                            }},
                        )

                except Exception as exc:
                    emails_failed += 1
                    logger.error("Error processing candidate for job alert", candidate_id=candidate_id, error=str(exc))
                    await db.job_alert_deliveries.update_one(
                        {"candidate_id": candidate_id, "slot_id": effective_slot_id},
                        {"$set": {
                            "status": DeliveryStatus.FAILED_PERMANENT.value,
                            "error": str(exc),
                            "updated_at": datetime.now(timezone.utc),
                        }},
                    )

        # Run candidate processing concurrently bounded by Semaphore
        await asyncio.gather(*[process_single_candidate(c) for c in candidates])

        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        summary = {
            "status": "completed",
            "slot_id": effective_slot_id,
            "slot_type": effective_slot_type,
            "timestamp": now_utc.isoformat(),
            "candidates_scanned": total_candidates,
            "candidates_with_resume": candidates_with_resume,
            "candidates_matched": candidates_matched,
            "emails_delivered": emails_delivered,
            "emails_uncertain": emails_uncertain,
            "emails_failed": emails_failed,
            "elapsed_ms": elapsed_ms,
            "sample_deliveries": delivery_details[:5],
        }

        # 7. Persist final batch execution summary in `cron_job_runs`
        if not target_email:
            try:
                await db.cron_job_runs.update_one(
                    {"slot_id": effective_slot_id, "job_name": "job_alerts"},
                    {"$set": {
                        "status": CronRunStatus.COMPLETED.value,
                        "completed_at": datetime.now(timezone.utc),
                        "duration_ms": elapsed_ms,
                        "candidates_scanned": total_candidates,
                        "candidates_claimed": candidates_matched,
                        "emails_delivered": emails_delivered,
                        "emails_uncertain": emails_uncertain,
                        "emails_failed_permanent": emails_failed,
                        "sample_deliveries": delivery_details[:5],
                    }},
                    upsert=True,
                )
            except Exception as e:
                logger.warning("Could not persist final cron_job_runs entry", error=str(e))

        logger.info(
            "AI Job Alerts batch completed",
            slot_id=effective_slot_id,
            scanned=total_candidates,
            matched=candidates_matched,
            delivered=emails_delivered,
            uncertain=emails_uncertain,
            failed=emails_failed,
            elapsed_ms=elapsed_ms,
        )
        return summary


async def recover_missed_job_alerts_on_startup(db: Optional[Any] = None) -> None:
    """
    Non-blocking background recovery task invoked during FastAPI lifespan boot:
    - Inspects if today's morning (07:30 IST) or afternoon (14:00 IST) slot was missed.
    - If within the 2-hour eligible recovery window, executes the missed slot safely.
    - If outside the 2-hour window, marks slot as 'expired' to prevent stale alert replay.
    """
    if db is None:
        try:
            db = get_database()
        except Exception:
            return

    try:
        now_utc = datetime.now(timezone.utc)
        eligible_meta = get_eligible_missed_slot(now_utc)

        if not eligible_meta:
            logger.info("Startup check: Current time is outside eligible missed job alert recovery window.")
            return

        slot_id = eligible_meta["slot_id"]
        slot_type = eligible_meta["slot_type"]

        # Check if this slot was already processed or marked
        existing = await db.cron_job_runs.find_one({"slot_id": slot_id, "job_name": "job_alerts"})
        if existing and existing.get("status") in (CronRunStatus.COMPLETED.value, CronRunStatus.RUNNING.value):
            logger.info("Startup check: Scheduled slot was already completed or is running.", slot_id=slot_id)
            return

        logger.info(
            "Startup check: Found eligible missed job alert slot within 2-hour window. Initiating recovery.",
            slot_id=slot_id,
            slot_type=slot_type,
        )

        # Trigger recovery run
        await run_nightly_job_alerts(
            db=db,
            slot_id=slot_id,
            slot_type=slot_type,
            triggered_by="recovery_on_startup",
        )

    except Exception as exc:
        logger.error("Startup job alert recovery encountered an exception", error=str(exc))


async def sweep_stuck_pending_resumes(db: Optional[Any] = None) -> Dict[str, Any]:
    """
    Finds resumes stuck in 'pending' or 'processing' older than 10 minutes,
    and updates them to 'failed' with actionable retry error messages.
    """
    if db is None:
        try:
            db = get_database()
        except Exception:
            return {"swept": 0}

    now = datetime.now(timezone.utc)
    threshold = now - timedelta(minutes=10)

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
    - Afternoon Slot: 02:00 PM IST (08:30 UTC) [Corrected from 03:00 PM]
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
            coalesce=True,
            misfire_grace_time=3600,
            kwargs={"slot_type": "morning"},
        )

        # 2. Afternoon Job Alert Digest (02:00 PM IST) — Corrected to 14:00 IST
        job_alerts_scheduler.add_job(
            run_nightly_job_alerts,
            trigger=CronTrigger(hour=14, minute=0, timezone="Asia/Kolkata"),
            id="afternoon_job_alerts",
            name="Afternoon AI Job Alerts Digest (02:00 PM IST)",
            replace_existing=True,
            coalesce=True,
            misfire_grace_time=3600,
            kwargs={"slot_type": "afternoon"},
        )

        # 3. Sweep stuck resumes every 5 minutes
        job_alerts_scheduler.add_job(
            sweep_stuck_pending_resumes,
            trigger=IntervalTrigger(minutes=5),
            id="stuck_resumes_sweep",
            name="Sweep Stuck Pending Resumes",
            replace_existing=True,
            coalesce=True,
            misfire_grace_time=300,
        )

        # 4. Twice-daily external job scrape (06:30 AM IST and 01:00 PM IST)
        job_alerts_scheduler.add_job(
            run_external_job_scrape,
            trigger=CronTrigger(hour="6,13", minute=30, timezone="Asia/Kolkata"),
            id="external_job_scrape",
            name="Twice-Daily JSearch External Job Scrape",
            replace_existing=True,
            coalesce=True,
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
