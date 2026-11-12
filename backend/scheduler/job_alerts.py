"""Nightly & Mid-Day AI Job Alert Engine (Azure Logic App Webhook)."""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import structlog
from sqlalchemy import func, or_, select, update

try:
    from zoneinfo import ZoneInfo
    IST = ZoneInfo("Asia/Kolkata")
except Exception:
    IST = timezone(timedelta(hours=5, minutes=30))

from config.db import get_pg_session_factory
from models.tables import Job, Resume, User
from services.email_service import send_job_alert_email
from services.job_matcher import find_jobs_for_candidate
from services.job_scraper import scrape_external_jobs

logger = structlog.get_logger(__name__)


def calculate_slot_id(now: Optional[datetime] = None, slot_type: Optional[str] = None) -> str:
    """Compute deterministic slot identifier in Asia/Kolkata timezone."""
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    ist_now = now.astimezone(IST)
    date_str = ist_now.strftime("%Y-%m-%d")

    if slot_type == "morning":
        return f"{date_str}_07:30"
    if slot_type == "afternoon":
        return f"{date_str}_14:00"
    if slot_type == "manual":
        return f"{date_str}_manual_{ist_now.strftime('%H%M%S')}"
    return f"{date_str}_07:30" if ist_now.hour < 12 else f"{date_str}_14:00"


async def run_external_job_scrape() -> Dict[str, int]:
    """Run JSearch external scrape + 5-day cleanup against PostgreSQL."""
    try:
        return await scrape_external_jobs()
    except Exception as exc:
        logger.error("External job scrape failed", error=str(exc))
        return {"fetched": 0, "upserted": 0, "skipped": 0, "deleted": 0}


async def run_nightly_job_alerts(
    db: Optional[Any] = None,
    target_email: Optional[str] = None,
    slot_id: Optional[str] = None,
    slot_type: Optional[str] = None,
    triggered_by: str = "scheduler",
    force_replay: bool = False,
    concurrency_limit: int = 3,
    session_factory: Any = None,
) -> Dict[str, Any]:
    """Scrape fresh jobs, match top open roles per candidate, and email alerts via Brevo."""
    t0 = time.perf_counter()
    now_utc = datetime.now(timezone.utc)
    effective_slot_id = slot_id or calculate_slot_id(
        now_utc, slot_type="manual" if target_email else slot_type
    )
    effective_slot_type = (
        "manual"
        if target_email
        else (slot_type or ("morning" if "07:30" in effective_slot_id else "afternoon"))
    )

    if not target_email:
        await run_external_job_scrape()

    sf = session_factory or get_pg_session_factory()
    async with sf() as session:
        open_jobs_count = (
            await session.execute(
                select(func.count()).select_from(Job).where(Job.status.in_(["open", "published"]))
            )
        ).scalar() or 0

        if open_jobs_count == 0:
            return {
                "status": "completed",
                "slot_id": effective_slot_id,
                "slot_type": effective_slot_type,
                "timestamp": now_utc.isoformat(),
                "candidates_scanned": 0,
                "candidates_with_resume": 0,
                "candidates_matched": 0,
                "emails_delivered": 0,
                "emails_uncertain": 0,
                "emails_failed": 0,
                "elapsed_ms": int((time.perf_counter() - t0) * 1000),
                "reason": "no_open_jobs",
            }

        user_stmt = select(User).where(User.status != "deleted")
        if target_email:
            user_stmt = user_stmt.where(User.email == target_email.strip().lower())
        else:
            user_stmt = user_stmt.where(
                or_(User.role == "candidate", User.role.is_(None)),
                User.job_alerts_enabled.isnot(False),
            )
        users = (await session.execute(user_stmt)).scalars().all()
        resume_user_ids = {
            str(uid)
            for uid in (
                await session.execute(
                    select(Resume.user_id)
                    .where(Resume.status == "parsed", Resume.parsed_data.isnot(None))
                    .distinct()
                )
            ).scalars().all()
        }

    candidates_with_resume = 0
    candidates_matched = 0
    emails_delivered = 0
    emails_uncertain = 0
    emails_failed = 0
    delivery_details: List[Dict[str, Any]] = []
    semaphore = asyncio.Semaphore(concurrency_limit)

    async def process_candidate(user: Any) -> None:
        nonlocal candidates_with_resume, candidates_matched, emails_delivered, emails_uncertain, emails_failed

        candidate_id = str(user.id)
        candidate_email = getattr(user, "email", None)
        candidate_name = getattr(user, "full_name", None) or getattr(user, "name", None) or "Candidate"
        if not candidate_email or "@" not in candidate_email:
            return
        if not target_email and not force_replay and getattr(user, "last_alert_slot", None) == effective_slot_id:
            return

        async with semaphore:
            try:
                has_resume = candidate_id in resume_user_ids
                if has_resume:
                    candidates_with_resume += 1

                match_res = await find_jobs_for_candidate(candidate_id=candidate_id, limit=6, db=db)
                top_3_jobs = [
                    j for j in match_res.get("recommended_jobs", []) if not j.get("is_applied", False)
                ][:3]
                if not top_3_jobs:
                    return

                candidates_matched += 1
                for j in top_3_jobs:
                    logo = j.get("company_logo_url") or j.get("company_logo")
                    if logo and not str(logo).startswith("data:image/"):
                        clean_logo = str(logo).strip()
                        j["company_logo_url"] = clean_logo
                        j["company_logo"] = clean_logo

                dispatch_res = await send_job_alert_email(
                    to_email=candidate_email,
                    candidate_name=candidate_name,
                    matched_jobs=top_3_jobs,
                    has_resume=has_resume,
                )

                if dispatch_res.get("sent"):
                    emails_delivered += 1
                    delivery_details.append({
                        "candidate_id": candidate_id,
                        "email": candidate_email,
                        "matched_count": len(top_3_jobs),
                        "message_id": dispatch_res.get("message_id"),
                    })
                    try:
                        async with sf() as update_session:
                            async with update_session.begin():
                                await update_session.execute(
                                    update(User)
                                    .where(User.id == candidate_id)
                                    .values(last_alert_slot=effective_slot_id)
                                )
                    except Exception:
                        pass
                elif dispatch_res.get("uncertain"):
                    emails_uncertain += 1
                    logger.warning("Job alert marked UNCERTAIN", candidate_id=candidate_id, email=candidate_email)
                else:
                    emails_failed += 1
            except Exception as exc:
                emails_failed += 1
                logger.error("Error processing candidate for job alert", candidate_id=candidate_id, error=str(exc))

    await asyncio.gather(*[process_candidate(u) for u in users])

    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    logger.info(
        "AI Job Alerts batch completed",
        slot_id=effective_slot_id,
        triggered_by=triggered_by,
        scanned=len(users),
        matched=candidates_matched,
        delivered=emails_delivered,
        uncertain=emails_uncertain,
        failed=emails_failed,
        elapsed_ms=elapsed_ms,
    )
    return {
        "status": "completed",
        "slot_id": effective_slot_id,
        "slot_type": effective_slot_type,
        "timestamp": now_utc.isoformat(),
        "candidates_scanned": len(users),
        "candidates_with_resume": candidates_with_resume,
        "candidates_matched": candidates_matched,
        "emails_delivered": emails_delivered,
        "emails_uncertain": emails_uncertain,
        "emails_failed": emails_failed,
        "elapsed_ms": elapsed_ms,
        "sample_deliveries": delivery_details[:5],
    }
