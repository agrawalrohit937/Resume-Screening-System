"""
Analytics Repository
====================
Encapsulates all platform-level, candidate-level, and enterprise-level analytics aggregations
using native PostgreSQL and SQLAlchemy 2.0.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
import structlog
from sqlalchemy import select, func, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from models.tables import (
    CandidateApplication, Job, Resume, ATSResult,
    Certificate, InterviewSessionModel, User, EeoResponse
)
from repositories.base_repo import BaseRepository

logger = structlog.get_logger(__name__)


class AnalyticsRepository(BaseRepository):
    def __init__(self, session_factory=None):
        super().__init__(model_cls=ATSResult, session_factory=session_factory)

    async def build_user_activity_feed(self, user_id: str, limit: int = 8) -> List[Dict[str, Any]]:
        """Aggregates a diverse timeline of candidate platform events via pure SQLAlchemy ORM."""
        activity: List[Dict[str, Any]] = []
        now = datetime.now(timezone.utc)

        async with self._get_session() as sess:
            # 1. Job Applications (joined with Job to avoid N+1 queries)
            try:
                stmt = (
                    select(CandidateApplication, Job.title, Job.company_name)
                    .outerjoin(Job, CandidateApplication.job_id == Job.id)
                    .where(CandidateApplication.candidate_id == str(user_id))
                    .order_by(CandidateApplication.created_at.desc())
                    .limit(6)
                )
                rows = (await sess.execute(stmt)).all()
                for row in rows:
                    a = row[0]
                    job_title = row[1] or "Software Engineer"
                    company_name = row[2] or "CareerShala Partner"
                    dt = a.created_at or now

                    activity.append({
                        "id": f"app_{a.id}",
                        "type": "job_application",
                        "title": f"Applied to {job_title}",
                        "detail": company_name,
                        "created_at": dt.isoformat() if hasattr(dt, "isoformat") else str(dt),
                        "timestamp": dt.timestamp() if hasattr(dt, "timestamp") else 0,
                    })
            except Exception as exc:
                logger.warning("Error fetching applications for activity feed", error=str(exc))

            # 2. Resumes Uploaded
            try:
                res_stmt = select(Resume).where(Resume.user_id == str(user_id)).order_by(Resume.created_at.desc()).limit(4)
                resumes = (await sess.execute(res_stmt)).scalars().all()
                for r in resumes:
                    dt = r.created_at or now
                    fname = r.filename or "Primary Resume.pdf"
                    clean_name = fname.split("_")[0] if ("_" in fname and len(fname.split("_")[0]) > 6) else fname
                    activity.append({
                        "id": f"res_{r.id}",
                        "type": "resume_upload",
                        "title": "Resume Uploaded & Parsed",
                        "detail": clean_name,
                        "created_at": dt.isoformat() if hasattr(dt, "isoformat") else str(dt),
                        "timestamp": dt.timestamp() if hasattr(dt, "timestamp") else 0,
                    })
            except Exception as exc:
                logger.warning("Error fetching resumes for activity feed", error=str(exc))

            # 3. ATS Scans
            try:
                scans_stmt = select(ATSResult).where(ATSResult.user_id == str(user_id)).order_by(ATSResult.created_at.desc()).limit(15)
                scans = (await sess.execute(scans_stmt)).scalars().all()
                for sc in scans:
                    dt = sc.created_at or now
                    raw_score = float(sc.final_score or 0.5)
                    pct_score = round(raw_score * 100 if raw_score <= 1.0 else raw_score)
                    rec = getattr(sc, "recommendation", None) or ("High Match" if pct_score >= 80 else "Good Match" if pct_score >= 60 else "Evaluated")
                    activity.append({
                        "id": f"ats_{sc.id}",
                        "type": "ats_scan",
                        "title": "ATS Resume Scan",
                        "detail": f"Match Score: {pct_score}% ({rec})",
                        "created_at": dt.isoformat() if hasattr(dt, "isoformat") else str(dt),
                        "timestamp": dt.timestamp() if hasattr(dt, "timestamp") else 0,
                    })
            except Exception as exc:
                logger.warning("Error fetching ATS scans for activity feed", error=str(exc))

            # 4. Certificates
            try:
                cert_stmt = select(Certificate).where(Certificate.user_id == str(user_id)).order_by(Certificate.issued_at.desc()).limit(3)
                certs = (await sess.execute(cert_stmt)).scalars().all()
                for c in certs:
                    dt = c.issued_at or now
                    snap = getattr(c, "snapshot", {}) or {}
                    topic = snap.get("assessment_name") or snap.get("topic") or "Verified Skill"
                    score_val = snap.get("score")
                    score_str = f" ({score_val}%)" if score_val else ""
                    activity.append({
                        "id": f"cert_{c.id}",
                        "type": "certificate",
                        "title": f"Skill Certificate Earned: {topic}{score_str}",
                        "detail": f"Official Credential #{str(c.id)[:8].upper()}",
                        "created_at": dt.isoformat() if hasattr(dt, "isoformat") else str(dt),
                        "timestamp": dt.timestamp() if hasattr(dt, "timestamp") else 0,
                    })
            except Exception as exc:
                logger.warning("Error fetching certificates for activity feed", error=str(exc))

            # 5. Mock Interview Sessions
            try:
                int_stmt = select(InterviewSessionModel).where(InterviewSessionModel.user_id == str(user_id)).order_by(InterviewSessionModel.created_at.desc()).limit(3)
                int_sess_rows = (await sess.execute(int_stmt)).scalars().all()
                for i_sess in int_sess_rows:
                    dt = i_sess.created_at or now
                    activity.append({
                        "id": f"int_{i_sess.id}",
                        "type": "interview",
                        "title": "Mock Interview Completed",
                        "detail": f"Score: {int(getattr(i_sess, 'overall_score', 80) or getattr(i_sess, 'score', 80) or 80)}%",
                        "created_at": dt.isoformat() if hasattr(dt, "isoformat") else str(dt),
                        "timestamp": dt.timestamp() if hasattr(dt, "timestamp") else 0,
                    })
            except Exception as exc:
                logger.warning("Error fetching interview sessions for activity feed", error=str(exc))

        activity.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
        return activity[:limit]

    async def get_platform_score_distribution(self, week_ago: datetime) -> Tuple[Dict[str, int], List[Dict[str, Any]], int, int]:
        """Calculates platform-wide score distribution and weekly activity counts."""
        score_dist = {"80-100": 0, "60-79": 0, "40-59": 0, "0-39": 0}
        async with self._get_session() as sess:
            res = await sess.execute(select(ATSResult.final_score).limit(500))
            for score in res.scalars().all():
                if score is None:
                    continue
                val = float(score) * 100 if float(score) <= 1.0 else float(score)
                if val >= 80:
                    score_dist["80-100"] += 1
                elif val >= 60:
                    score_dist["60-79"] += 1
                elif val >= 40:
                    score_dist["40-59"] += 1
                else:
                    score_dist["0-39"] += 1

            top_missing: List[Dict[str, Any]] = []
            recent_checks = (await sess.execute(select(func.count(ATSResult.id)).where(ATSResult.created_at >= week_ago))).scalar() or 0
            new_users = (await sess.execute(select(func.count(User.id)).where(User.created_at >= week_ago))).scalar() or 0

        return score_dist, top_missing, recent_checks, new_users

    async def get_enterprise_analytics_data(
        self,
        tenant_id: str,
        is_admin_or_exec: bool,
        user_id: str,
    ) -> Dict[str, Any]:
        """Fetches authentic internal job requisitions, confirmed applications, and EEO records for enterprise aggregation."""
        async with self._get_session() as session:
            # Exclude public external job board scrapes (is_external == True).
            # Only count actual authorized internal requisitions created by this enterprise/recruiter.
            stmt = select(Job).where(
                or_(Job.is_external.is_(False), Job.is_external == False),
                Job.created_by.isnot(None),
            ).order_by(Job.created_at.desc())

            if tenant_id and tenant_id != "default":
                stmt = stmt.where(Job.tenant_id == tenant_id)
            elif not is_admin_or_exec:
                stmt = stmt.where(Job.created_by == str(user_id))

            jobs_res = await session.execute(stmt)
            raw_jobs = jobs_res.scalars().all()
            jobs_list = [{"id": str(j.id), "_id": str(j.id), "title": j.title, "department": j.department, "status": j.status, "openings": getattr(j, "openings", 1) or 1} for j in raw_jobs]
            job_ids = [str(j["id"]) for j in jobs_list]

            hired_app_rows = []
            total_offers = 0
            if job_ids:
                hired_res = await session.execute(
                    select(CandidateApplication).where(CandidateApplication.job_id.in_(job_ids), CandidateApplication.stage.in_(["Hired", "hired"]))
                )
                hired_app_rows = hired_res.scalars().all()
                total_offers = (await session.execute(
                    select(func.count(CandidateApplication.id)).where(CandidateApplication.job_id.in_(job_ids), CandidateApplication.stage.in_(["offer", "Offer", "hired", "Hired"]))
                )).scalar() or 0

            eeo_stmt = select(EeoResponse).order_by(EeoResponse.submitted_at.desc())
            if tenant_id and tenant_id != "default":
                eeo_stmt = eeo_stmt.where(EeoResponse.tenant_id == tenant_id)
            eeo_res = await session.execute(eeo_stmt.limit(1000))
            eeo_responses = [{"race_ethnicity": r.race_ethnicity, "gender": r.gender} for r in eeo_res.scalars().all()]

            return {
                "jobs_list": jobs_list,
                "job_ids": job_ids,
                "hired_app_rows": [{"job_id": str(r.job_id), "created_at": r.created_at, "updated_at": r.updated_at} for r in hired_app_rows],
                "total_offers": total_offers,
                "eeo_responses": eeo_responses,
            }

