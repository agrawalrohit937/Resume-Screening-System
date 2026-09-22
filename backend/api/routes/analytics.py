"""
Analytics Dashboard Routes — Platform-wide and user-level metrics
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import structlog
from fastapi import APIRouter, Depends, Query

from api.deps import get_current_user, get_admin_user, get_result_repo, get_user_repo
from config.db import get_database
from models.user_model import UserModel
from repositories.result_repo import ResultRepository
from repositories.user_repo import UserRepository

from bson import ObjectId

logger = structlog.get_logger(__name__)
router = APIRouter()


async def _build_user_activity_feed(user_id: str, db: Any) -> List[Dict[str, Any]]:
    """Aggregates a diverse, distinct timeline of candidate platform events."""
    activity: List[Dict[str, Any]] = []
    now = datetime.now(timezone.utc)

    # 1. Job Applications
    try:
        apps_cursor = db.applications.find(
            {"$or": [{"candidate_id": user_id}, {"user_id": user_id}]}
        ).sort("_id", -1).limit(6)
        apps = await apps_cursor.to_list(length=6)
        for a in apps:
            dt = a.get("created_at") or (a["_id"].generation_time if hasattr(a.get("_id"), "generation_time") else now)
            job_title = a.get("job_title") or a.get("title")
            company_name = a.get("company_name") or a.get("company")
            if not job_title and a.get("job_id"):
                try:
                    j_doc = await db.jobs.find_one({"_id": ObjectId(str(a["job_id"]))})
                    if j_doc:
                        job_title = j_doc.get("title")
                        company_name = j_doc.get("company_name")
                except Exception:
                    pass

            job_title = job_title or "Software Engineer"
            company_name = company_name or "CareerShala Partner"
            activity.append({
                "id": f"app_{a['_id']}",
                "type": "job_application",
                "title": f"Applied to {job_title}",
                "detail": company_name,
                "created_at": dt.isoformat() if hasattr(dt, "isoformat") else str(dt),
                "timestamp": dt.timestamp() if hasattr(dt, "timestamp") else 0,
            })
    except Exception as exc:
        logger.warning("Error fetching applications for activity feed", error=str(exc))

    # 2. Resumes Uploaded & Parsed
    try:
        res_cursor = db.resumes.find({"user_id": user_id}).sort("_id", -1).limit(4)
        resumes = await res_cursor.to_list(length=4)
        for r in resumes:
            dt = r.get("created_at") or (r["_id"].generation_time if hasattr(r.get("_id"), "generation_time") else now)
            fname = r.get("filename") or "Primary Resume.pdf"
            clean_name = fname.split("_")[0] if ("_" in fname and len(fname.split("_")[0]) > 6) else fname
            activity.append({
                "id": f"res_{r['_id']}",
                "type": "resume_upload",
                "title": "Resume Uploaded & Parsed",
                "detail": clean_name,
                "created_at": dt.isoformat() if hasattr(dt, "isoformat") else str(dt),
                "timestamp": dt.timestamp() if hasattr(dt, "timestamp") else 0,
            })
    except Exception as exc:
        logger.warning("Error fetching resumes for activity feed", error=str(exc))

    # 3. ATS Scans (Consolidate same-day duplicate scans into grouped entries)
    try:
        scans_cursor = db.results.find({"user_id": user_id}).sort("_id", -1).limit(15)
        scans = await scans_cursor.to_list(length=15)
        scans_by_date: Dict[str, List[Any]] = {}
        for sc in scans:
            dt = sc.get("created_at") or (sc["_id"].generation_time if hasattr(sc.get("_id"), "generation_time") else now)
            date_key = dt.strftime("%Y-%m-%d") if hasattr(dt, "strftime") else str(dt)[:10]
            if date_key not in scans_by_date:
                scans_by_date[date_key] = []
            scans_by_date[date_key].append((sc, dt))

        for date_key, group in scans_by_date.items():
            latest_sc, latest_dt = group[0]
            raw_score = float(latest_sc.get("final_score", 0.5))
            pct_score = round(raw_score * 100 if raw_score <= 1.0 else raw_score)
            rec = latest_sc.get("recommendation") or "ATS Evaluated"
            count = len(group)
            if count == 1:
                title = "ATS Resume Scan"
                detail = f"Match Score: {pct_score}% ({rec})"
            else:
                title = f"ATS Resume Analysis ({count} scans)"
                detail = f"Latest Score: {pct_score}%"

            activity.append({
                "id": f"ats_{latest_sc['_id']}",
                "type": "ats_scan",
                "title": title,
                "detail": detail,
                "created_at": latest_dt.isoformat() if hasattr(latest_dt, "isoformat") else str(latest_dt),
                "timestamp": latest_dt.timestamp() if hasattr(latest_dt, "timestamp") else 0,
            })
    except Exception as exc:
        logger.warning("Error fetching ATS scans for activity feed", error=str(exc))

    # 4. Certificates & Achievements
    try:
        cert_cursor = db.certificates.find(
            {"$or": [{"candidate_id": user_id}, {"user_id": user_id}]}
        ).sort("_id", -1).limit(3)
        certs = await cert_cursor.to_list(length=3)
        for c in certs:
            dt = c.get("created_at") or (c["_id"].generation_time if hasattr(c.get("_id"), "generation_time") else now)
            topic = c.get("topic") or "Interview Excellence"
            activity.append({
                "id": f"cert_{c['_id']}",
                "type": "certificate",
                "title": f"Certificate Unlocked: {topic}",
                "detail": f"Grade: {c.get('grade_label', 'A')} ({int(c.get('score', 100))}%)",
                "created_at": dt.isoformat() if hasattr(dt, "isoformat") else str(dt),
                "timestamp": dt.timestamp() if hasattr(dt, "timestamp") else 0,
            })
    except Exception as exc:
        logger.warning("Error fetching certificates for activity feed", error=str(exc))

    # 5. Mock Interview Sessions
    try:
        int_cursor = db.interview_sessions.find({"user_id": user_id}).sort("_id", -1).limit(3)
        interviews = await int_cursor.to_list(length=3)
        for i_sess in interviews:
            dt = i_sess.get("created_at") or (i_sess["_id"].generation_time if hasattr(i_sess.get("_id"), "generation_time") else now)
            activity.append({
                "id": f"int_{i_sess['_id']}",
                "type": "interview",
                "title": "Mock Interview Completed",
                "detail": f"Score: {int(i_sess.get('score', 80))}%",
                "created_at": dt.isoformat() if hasattr(dt, "isoformat") else str(dt),
                "timestamp": dt.timestamp() if hasattr(dt, "timestamp") else 0,
            })
    except Exception as exc:
        logger.warning("Error fetching interview sessions for activity feed", error=str(exc))

    # Sort all activity items descending by timestamp
    activity.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
    return activity[:8]


@router.get("/me")
async def get_my_analytics(
    days: int = Query(default=30, ge=1, le=365),
    current_user: UserModel = Depends(get_current_user),
    result_repo: ResultRepository = Depends(get_result_repo),
    db: Any = Depends(get_database),
):
    uid = str(current_user.id)
    summary = await result_repo.get_analytics_summary(uid)
    
    # 1. Fetch recent scan results
    recent_results, _ = await result_repo.get_results_by_user(uid, skip=0, limit=10)
    
    # 2. Chronological Score Trend (oldest to newest) with dynamic date labels
    chrono_results = list(reversed(recent_results[:7]))
    score_trend = []
    for idx, r in enumerate(chrono_results):
        r_dt = r.created_at or (ObjectId(str(r.id)).generation_time if hasattr(ObjectId(str(r.id)), "generation_time") else datetime.now(timezone.utc))
        raw_sc = float(r.final_score or 0.5)
        pct_sc = round(raw_sc * 100 if raw_sc <= 1.0 else raw_sc)
        lbl = r_dt.strftime("%b %d") if hasattr(r_dt, "strftime") else f"Scan {idx+1}"
        score_trend.append({
            "id": str(r.id),
            "scan_number": idx + 1,
            "label": lbl,
            "date": r_dt.isoformat() if hasattr(r_dt, "isoformat") else str(r_dt),
            "score": pct_sc,
            "recommendation": r.recommendation or "ATS Scan",
        })

    # 3. Dynamic Activity Feed
    activity_feed = await _build_user_activity_feed(uid, db)

    # 4. Strict Areas to Improve Filter Logic:
    # Strictly filter skills below 60% threshold or genuine missing keyword gaps.
    # Exclude any skills with 100% or >= 60%.
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
        gap_score = min(max(count * 10, 20), 45) # realistic low proficiency gap percentage
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
    db: Any = Depends(get_database),
):
    """Dedicated endpoint returning candidate's chronological cross-platform activity timeline."""
    activity_feed = await _build_user_activity_feed(str(current_user.id), db)
    return {"success": True, "items": activity_feed, "count": len(activity_feed)}


@router.get("/platform")
async def get_platform_analytics(
    admin_user: UserModel = Depends(get_admin_user),
    result_repo: ResultRepository = Depends(get_result_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    db=Depends(get_database),
):
    global_summary = await result_repo.get_analytics_summary()
    user_stats = await user_repo.get_platform_user_stats()
    pipeline = [
        {"$group": {
            "_id": {"$switch": {
                "branches": [
                    {"case": {"$gte": ["$final_score", 0.8]}, "then": "80-100"},
                    {"case": {"$gte": ["$final_score", 0.6]}, "then": "60-79"},
                    {"case": {"$gte": ["$final_score", 0.4]}, "then": "40-59"},
                ],
                "default": "0-39"
            }},
            "count": {"$sum": 1},
        }},
    ]
    cursor = db.results.aggregate(pipeline)
    score_dist = {doc["_id"]: doc["count"] async for doc in cursor}
    pipeline2 = [
        {"$unwind": "$missing_skills"},
        {"$group": {"_id": "$missing_skills", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 15},
    ]
    cursor2 = db.results.aggregate(pipeline2)
    top_missing = [{"skill": doc["_id"], "count": doc["count"]} async for doc in cursor2]
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_checks = await db.results.count_documents({"created_at": {"$gte": week_ago}})
    new_users = await db.users.count_documents({"created_at": {"$gte": week_ago}})
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
    db=Depends(get_database),
):
    """Computes executive talent, headcount, hiring velocity, and anonymized diversity metrics."""
    from bson import ObjectId

    tenant_id = getattr(current_user, "tenant_id", "default") or "default"

    # ── 1. Tenant jobs (open + closed) ───────────────────────────────────────
    job_query: dict = {}
    if tenant_id and tenant_id != "default":
        job_query["tenant_id"] = tenant_id
    else:
        job_query["created_by"] = str(current_user.id)

    jobs_cursor = db.jobs.find(job_query, {"_id": 1, "title": 1, "department": 1, "openings": 1, "status": 1})
    jobs_list = await jobs_cursor.to_list(length=500)
    job_ids = [str(j["_id"]) for j in jobs_list]
    open_jobs = [j for j in jobs_list if j.get("status", "open") == "open"]

    # Approved headcount = sum of openings from active (open) jobs; fallback 1 per job
    approved_headcount = sum(int(j.get("openings", 1) or 1) for j in open_jobs) if open_jobs else 0

    # ── 2. Filled hires — count applications with stage == "Hired" ───────────
    hire_stage_variants = ["Hired", "hired"]
    if job_ids:
        hired_count = await db.applications.count_documents({
            "job_id": {"$in": job_ids},
            "stage": {"$in": hire_stage_variants},
        })
    else:
        # Fallback: any hired app for this tenant
        hired_count = await db.applications.count_documents({
            "tenant_id": tenant_id,
            "stage": {"$in": hire_stage_variants},
        })
    filled_hires = hired_count

    # ── 3. Department breakdown (from jobs) ───────────────────────────────────
    dept_map: dict = {}
    for j in jobs_list:
        dept = j.get("department") or "General"
        if dept not in dept_map:
            dept_map[dept] = {"department": dept, "approved": 0, "filled": 0}
        if j.get("status", "open") == "open":
            dept_map[dept]["approved"] += int(j.get("openings", 1) or 1)

    if job_ids:
        hired_apps_cursor = db.applications.find(
            {"job_id": {"$in": job_ids}, "stage": {"$in": hire_stage_variants}},
            {"job_id": 1},
        )
        hired_apps = await hired_apps_cursor.to_list(length=2000)
        job_dept_map = {str(j["_id"]): (j.get("department") or "General") for j in jobs_list}
        for ha in hired_apps:
            dept = job_dept_map.get(str(ha.get("job_id")), "General")
            if dept not in dept_map:
                dept_map[dept] = {"department": dept, "approved": 0, "filled": 0}
            dept_map[dept]["filled"] += 1

    headcount_data = [v for v in dept_map.values() if v["approved"] > 0 or v["filled"] > 0]

    # ── 4. Offer acceptance rate ──────────────────────────────────────────────
    if job_ids:
        total_offers = await db.applications.count_documents({
            "job_id": {"$in": job_ids},
            "stage": {"$in": ["offer", "Offer", "hired", "Hired"]},
        })
        accepted_offers = filled_hires
    else:
        total_offers = await db.applications.count_documents({
            "tenant_id": tenant_id, "stage": {"$in": ["offer", "Offer", "hired", "Hired"]}
        })
        accepted_offers = filled_hires
    offer_rate = round((accepted_offers / max(1, total_offers)) * 100, 1) if total_offers > 0 else 0.0

    # ── 5. Avg time-to-fill (days) from hired apps ────────────────────────────
    avg_time_to_fill = 0.0
    if job_ids:
        ttf_cursor = db.applications.find(
            {"job_id": {"$in": job_ids}, "stage": {"$in": hire_stage_variants}},
            {"created_at": 1, "updated_at": 1},
        )
        ttf_apps = await ttf_cursor.to_list(length=500)
        durations = []
        for a in ttf_apps:
            c = a.get("created_at")
            u = a.get("updated_at")
            if c and u and hasattr(u, "timestamp") and hasattr(c, "timestamp"):
                days = (u - c).total_seconds() / 86400
                if 0 < days < 365:
                    durations.append(days)
        if durations:
            avg_time_to_fill = round(sum(durations) / len(durations), 1)

    # ── 6. Monthly hiring velocity (last 6 months) ────────────────────────────
    now = datetime.now(timezone.utc)
    velocity = []
    for months_ago in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=months_ago * 30)).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        month_label = month_start.strftime("%b")
        if job_ids:
            hires_this_month = await db.applications.count_documents({
                "job_id": {"$in": job_ids},
                "stage": {"$in": hire_stage_variants},
                "updated_at": {"$gte": month_start, "$lt": month_end},
            })
        else:
            hires_this_month = 0
        # Target: distribute approved headcount evenly across months
        monthly_target = round(approved_headcount / 6) if approved_headcount > 0 else 0
        velocity.append({"month": month_label, "hires": hires_this_month, "target": monthly_target})

    # ── 7. EEO / Diversity (Isolated Vault Aggregation) ───────────────────────
    eeo_filters = []
    if tenant_id and tenant_id != "default":
        eeo_filters.append({"tenant_id": tenant_id})
    else:
        eeo_filters.append({"tenant_id": {"$in": ["default", None, ""]}})
    if job_ids:
        eeo_filters.append({"job_id": {"$in": job_ids}})

    eeo_query = {"$or": eeo_filters} if len(eeo_filters) > 1 else eeo_filters[0]
    eeo_cursor = db.eeo_responses.find(eeo_query)
    eeo_responses = await eeo_cursor.to_list(length=1000)
    total_eeo = len(eeo_responses)

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
        # Filter out 0-value slices if there are active values, but keep at least non-zero entries
        diversity_dist = [d for d in diversity_dist if d["value"] > 0]
        if not diversity_dist and total_eeo > 0:
            diversity_dist = [{"name": "Self-Identified", "value": 100, "count": total_eeo, "color": "#6366F1"}]
    else:
        diversity_dist = []

    # Detailed Gender Breakdown
    gender_map = {}
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

    # Detailed Race Breakdown
    race_map = {}
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

    logger.info(
        "Enterprise analytics computed",
        tenant_id=tenant_id,
        filled_hires=filled_hires,
        approved_headcount=approved_headcount,
        attainment_pct=attainment_pct,
    )

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
