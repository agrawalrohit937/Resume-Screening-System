"""
Analytics Dashboard Routes — Platform-wide and user-level metrics.
Completely separated into controller and repository layers.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import structlog
from fastapi import APIRouter, Depends, Query

from api.deps import (
    get_current_user,
    get_admin_user,
    get_result_repo,
    get_user_repo,
    get_analytics_repo,
)
from schemas.user_schema import UserModel
from repositories.analytics_repo import AnalyticsRepository
from repositories.result_repo import ResultRepository
from repositories.user_repo import UserRepository

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get("/me")
async def get_my_analytics(
    days: int = Query(default=30, ge=1, le=365),
    current_user: UserModel = Depends(get_current_user),
    result_repo: ResultRepository = Depends(get_result_repo),
    analytics_repo: AnalyticsRepository = Depends(get_analytics_repo),
):
    uid = str(current_user.id)
    summary = await result_repo.get_analytics_summary(uid)

    # 1. Fetch recent scan results
    recent_results, _ = await result_repo.get_results_by_user(uid, skip=0, limit=10)

    # 2. Chronological Score Trend (oldest to newest) with dynamic date labels
    chrono_results = list(reversed(recent_results[:7]))
    score_trend = []
    for idx, r in enumerate(chrono_results):
        r_dt = r.created_at or datetime.now(timezone.utc)
        raw_sc = float(r.final_score or 0.5)
        pct_sc = round(raw_sc * 100 if raw_sc <= 1.0 else raw_sc)
        lbl = r_dt.strftime("%b %d") if hasattr(r_dt, "strftime") else f"Scan {idx+1}"
        score_trend.append({
            "id": str(r.id),
            "scan_number": idx + 1,
            "label": lbl,
            "date": r_dt.isoformat() if hasattr(r_dt, "isoformat") else str(r_dt),
            "score": pct_sc,
            "recommendation": getattr(r, "recommendation", None) or "ATS Scan",
        })

    # 3. Dynamic Activity Feed via AnalyticsRepository
    activity_feed = await analytics_repo.build_user_activity_feed(uid)

    # 4. Strict Areas to Improve Filter Logic:
    skill_frequency: Dict[str, int] = {}
    matched_frequency: Dict[str, int] = {}
    for r in recent_results:
        for skill in (r.missing_skills or []):
            sk = skill.strip()
            if sk:
                skill_frequency[sk] = skill_frequency.get(sk, 0) + 1
        for skill in (r.matched_skills or []):
            sk = skill.strip()
            if sk:
                matched_frequency[sk] = matched_frequency.get(sk, 0) + 1

    areas_to_improve = []
    for sk, count in sorted(skill_frequency.items(), key=lambda x: x[1], reverse=True)[:6]:
        gap_score = min(max(count * 10, 20), 45)
        if gap_score < 60:
            areas_to_improve.append({
                "skill": sk,
                "score": gap_score,
                "pct": gap_score,
                "status": "Missing Keyword",
                "frequency": count,
            })

    top_missing = sorted(skill_frequency.items(), key=lambda x: x[1], reverse=True)[:10]
    top_matched = sorted(matched_frequency.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "user_id": uid,
        "period_days": days,
        "summary": {
            "total_ats_checks": summary.get("total_checks", 0),
            "average_score": round(summary.get("avg_score", 0), 3),
            "best_score": round(summary.get("max_score", 0), 3),
            "strong_matches": summary.get("strong_matches", 0),
            "good_matches": summary.get("good_matches", 0),
            "poor_matches": summary.get("poor_matches", 0),
        },
        "score_trend": score_trend,
        "activity_feed": activity_feed,
        "areas_to_improve": areas_to_improve,
        "top_missing_skills": [{"skill": k, "frequency": v} for k, v in top_missing],
        "top_matched_skills": [{"skill": k, "frequency": v} for k, v in top_matched],
        "profile_completeness": _compute_profile_completeness(current_user),
        "improvement_tips": _get_improvement_tips(summary),
    }


@router.get("/activity")
async def get_my_activity_feed(
    current_user: UserModel = Depends(get_current_user),
    analytics_repo: AnalyticsRepository = Depends(get_analytics_repo),
):
    """Dedicated endpoint returning candidate's chronological cross-platform activity timeline."""
    activity_feed = await analytics_repo.build_user_activity_feed(str(current_user.id))
    return {"success": True, "items": activity_feed, "count": len(activity_feed)}


@router.get("/platform")
async def get_platform_analytics(
    admin_user: UserModel = Depends(get_admin_user),
    result_repo: ResultRepository = Depends(get_result_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    analytics_repo: AnalyticsRepository = Depends(get_analytics_repo),
):
    global_summary = await result_repo.get_analytics_summary()
    user_stats = await user_repo.get_platform_user_stats()
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    score_dist, top_missing, recent_checks, new_users = await analytics_repo.get_platform_score_distribution(week_ago)

    return {
        "global_summary": {
            "total_ats_checks": global_summary.get("total_checks", 0),
            "average_platform_score": round(global_summary.get("avg_score", 0), 3),
            "strong_match_rate": round(global_summary.get("strong_matches", 0) / max(global_summary.get("total_checks", 1), 1), 3),
        },
        "user_stats": user_stats,
        "score_distribution": score_dist,
        "top_missing_skills_platform": top_missing,
        "weekly_activity": {"ats_checks_last_7_days": recent_checks, "new_users_last_7_days": new_users},
    }


@router.get("/enterprise")
async def get_enterprise_analytics(
    current_user: UserModel = Depends(get_current_user),
    analytics_repo: AnalyticsRepository = Depends(get_analytics_repo),
):
    """Computes executive talent, headcount, hiring velocity, and anonymized diversity metrics."""
    tenant_id = getattr(current_user, "tenant_id", "default") or "default"
    user_roles = getattr(current_user, "roles", [getattr(current_user, "role", "candidate")])
    is_admin_or_exec = any(r in {"admin", "platform_admin", "executive", "exec"} for r in user_roles)

    ent_data = await analytics_repo.get_enterprise_analytics_data(
        tenant_id=tenant_id,
        is_admin_or_exec=is_admin_or_exec,
        user_id=str(current_user.id),
    )

    jobs_list = ent_data["jobs_list"]
    hired_apps = ent_data["hired_app_rows"]
    total_offers = ent_data["total_offers"]
    eeo_responses = ent_data["eeo_responses"]

    open_jobs = [j for j in jobs_list if str(j.get("status", "open")).lower() in ("open", "active")]
    approved_headcount = len(open_jobs)
    filled_hires = len(hired_apps)

    now = datetime.now(timezone.utc)
    months_meta = []
    for months_ago in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=months_ago * 30)).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        month_label = month_start.strftime("%b")
        months_meta.append((month_start, month_end, month_label))

    # 3. Department breakdown
    dept_map: dict = {}
    for j in jobs_list:
        dept = j.get("department") or "Engineering"
        if dept not in dept_map:
            dept_map[dept] = {"department": dept, "approved": 0, "filled": 0}
        if str(j.get("status", "open")).lower() in ("open", "active"):
            dept_map[dept]["approved"] += int(j.get("openings", 1) or 1)

    if hired_apps:
        job_dept_map = {str(j["id"]): (j.get("department") or "Engineering") for j in jobs_list}
        for ha in hired_apps:
            dept = job_dept_map.get(str(ha.get("job_id")), "Engineering")
            if dept not in dept_map:
                dept_map[dept] = {"department": dept, "approved": 0, "filled": 0}
            dept_map[dept]["filled"] += 1

    headcount_data = [v for v in dept_map.values() if v["approved"] > 0 or v["filled"] > 0]

    # 4. Offer acceptance rate
    offer_rate = round((filled_hires / max(1, total_offers or 0)) * 100, 1) if (total_offers or 0) > 0 else 0.0

    # 5. Avg time-to-fill (days)
    avg_time_to_fill = 0.0
    durations = []
    for a in hired_apps:
        c = a.get("created_at")
        u = a.get("updated_at")
        if c and u and hasattr(u, "timestamp") and hasattr(c, "timestamp"):
            days = (u - c).total_seconds() / 86400
            if 0 < days < 365:
                durations.append(days)
    if durations:
        avg_time_to_fill = round(sum(durations) / len(durations), 1)

    # 6. Monthly hiring velocity
    velocity_counts = {m_label: 0 for _, _, m_label in months_meta}
    for doc in hired_apps:
        u_at = doc.get("updated_at")
        if u_at and hasattr(u_at, "timestamp"):
            if u_at.tzinfo is None:
                u_at = u_at.replace(tzinfo=timezone.utc)
            for m_start, m_end, m_label in months_meta:
                if m_start <= u_at < m_end:
                    velocity_counts[m_label] += 1
                    break

    velocity = []
    monthly_target = round(approved_headcount / 6) if approved_headcount > 0 else 0
    for _, _, m_label in months_meta:
        velocity.append({"month": m_label, "hires": velocity_counts.get(m_label, 0), "target": monthly_target})

    # 7. EEO / Diversity
    total_eeo = len(eeo_responses or [])

    def _normalize_race(val: Optional[str]) -> str:
        if not val:
            return "declined"
        v = str(val).strip().lower()
        if any(k in v for k in ["hispanic", "latino", "black", "african", "american indian", "alaska", "native hawaiian", "pacific", "two or more"]):
            return "urm"
        if any(k in v for k in ["white", "caucasian", "asian"]):
            return "non_urm"
        return "declined"

    urm_count = sum(1 for e in eeo_responses if _normalize_race(e.get("race_ethnicity")) == "urm")
    non_urm_count = sum(1 for e in eeo_responses if _normalize_race(e.get("race_ethnicity")) == "non_urm")
    declined_count = sum(1 for e in eeo_responses if _normalize_race(e.get("race_ethnicity")) == "declined")

    if total_eeo > 0:
        diversity_dist = [
            {"name": "Underrepresented Minority (URM)", "value": round((urm_count / total_eeo) * 100), "count": urm_count, "color": "#6366F1"},
            {"name": "Non-URM Representation", "value": round((non_urm_count / total_eeo) * 100), "count": non_urm_count, "color": "#0284C7"},
            {"name": "Declined / Undisclosed", "value": round((declined_count / total_eeo) * 100), "count": declined_count, "color": "#94A3B8"},
        ]
        diversity_dist = [d for d in diversity_dist if d["value"] > 0]
        if not diversity_dist and total_eeo > 0:
            diversity_dist = [{"name": "Self-Identified", "value": 100, "count": total_eeo, "color": "#6366F1"}]
    else:
        diversity_dist = []

    gender_map: dict = {}
    for e in eeo_responses:
        g = e.get("gender") or "Decline to State"
        gender_map[g] = gender_map.get(g, 0) + 1

    gender_dist = []
    gender_palette = {"Female": "#EC4899", "Male": "#3B82F6", "Non-Binary": "#8B5CF6", "Decline to State": "#94A3B8"}
    for g_name, g_count in gender_map.items():
        pct = round((g_count / total_eeo) * 100) if total_eeo > 0 else 0
        gender_dist.append({
            "name": g_name,
            "value": pct,
            "count": g_count,
            "color": gender_palette.get(g_name, "#64748B")
        })

    race_map: dict = {}
    for e in eeo_responses:
        r = e.get("race_ethnicity") or "Decline to State"
        race_map[r] = race_map.get(r, 0) + 1

    race_dist = []
    race_palette = {
        "Asian": "#06B6D4",
        "Black or African American": "#8B5CF6",
        "Hispanic or Latino": "#F59E0B",
        "White (Not Hispanic or Latino)": "#3B82F6",
        "Two or More Races": "#10B981",
        "Decline to State": "#94A3B8",
    }
    for r_name, r_count in race_map.items():
        pct = round((r_count / total_eeo) * 100) if total_eeo > 0 else 0
        race_dist.append({
            "name": r_name,
            "value": pct,
            "count": r_count,
            "color": race_palette.get(r_name, "#64748B")
        })

    attainment_pct = round((filled_hires / max(1, approved_headcount)) * 100, 1) if approved_headcount > 0 else 0.0

    return {
        "tenant_id": tenant_id,
        "kpis": {
            "approved_headcount": approved_headcount,
            "filled_hires": filled_hires,
            "headcount_attainment_pct": attainment_pct,
            "offer_acceptance_rate": offer_rate,
            "avg_time_to_fill_days": avg_time_to_fill,
        },
        "headcount_by_department": headcount_data,
        "diversity_distribution": diversity_dist,
        "total_eeo_responses": total_eeo,
        "gender_distribution": gender_dist,
        "race_distribution": race_dist,
        "hiring_velocity": velocity,
    }


def _compute_profile_completeness(user: UserModel) -> dict:
    fields = {
        "email": bool(user.email), "full_name": bool(user.full_name),
        "phone": bool(user.phone), "linkedin_url": bool(user.linkedin_url),
        "github_username": bool(user.github_username), "profile_picture": bool(user.profile_picture),
        "has_resume": user.total_resumes > 0, "has_ats_check": user.total_ats_checks > 0,
    }
    completed = sum(fields.values())
    score = round(completed / len(fields), 2)
    return {"score": score, "percentage": int(score * 100), "fields": fields}


def _get_improvement_tips(summary: dict) -> list:
    tips = []
    avg = summary.get("avg_score", 0)
    if avg < 0.5:
        tips.append("Your average ATS score is below 50%. Focus on keyword optimization.")
        tips.append("Tailor your resume for each job application.")
    elif avg < 0.7:
        tips.append("You're on track! Improve keyword matching for higher scores.")
    else:
        tips.append("Excellent scores! Target senior-level roles.")
    if summary.get("total_checks", 0) < 3:
        tips.append("Run more ATS checks to understand patterns.")
    tips.append("Update your resume every 3 months with new skills and achievements.")
    return tips
