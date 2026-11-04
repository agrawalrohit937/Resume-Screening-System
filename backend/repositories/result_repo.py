"""
Result Repository — Dual Engine (PostgreSQL via SQLAlchemy 2.0 / PostgreSQL Primary)
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
import structlog
from sqlalchemy import select, update, func, case, or_, and_

from core.config import settings
from config.db import get_pg_session_factory
from models import ATSResult, JobDescription, gen_uuid_str
from models.result_model import ATSResultModel, JobDescriptionModel
from repositories.base_repo import BaseRepository

logger = structlog.get_logger(__name__)


def _jd_to_pydantic(row: JobDescription) -> JobDescriptionModel:
    d = {c.name: getattr(row, c.name) for c in JobDescription.__table__.columns}
    d["_id"] = d.pop("id")
    return JobDescriptionModel(**d)


def _result_to_pydantic(row: ATSResult) -> ATSResultModel:
    d = {c.name: getattr(row, c.name) for c in ATSResult.__table__.columns}
    d["_id"] = d.pop("id")
    return ATSResultModel(**d)


class ResultRepository(BaseRepository):
    def __init__(self, db: Optional[Any] = None, session_factory: Optional[Any] = None):
        self.session_factory = session_factory or get_pg_session_factory()
    async def create_job_description(self, jd_data: dict) -> JobDescriptionModel:
        data = dict(jd_data)
        jd_id = str(data.pop("_id", None) or data.pop("id", None) or gen_uuid_str())
        now = datetime.now(timezone.utc)
        jd_obj = {
            "id": jd_id,
            "user_id": str(data.get("user_id", "")),
            "title": str(data.get("title") or "Job Description"),
            "company": data.get("company"),
            "description": str(data.get("description") or data.get("raw_text") or ""),
            "required_skills": data.get("required_skills") or [],
            "preferred_skills": data.get("preferred_skills") or [],
            "experience_years_min": data.get("experience_years_min"),
            "experience_years_max": data.get("experience_years_max"),
            "seniority_level": data.get("seniority_level"),
            "location": data.get("location"),
            "remote": bool(data.get("remote", False)),
            "salary_min": data.get("salary_min"),
            "salary_max": data.get("salary_max"),
            "industry": data.get("industry"),
            "raw_text": data.get("raw_text") or "",
            "created_at": data.get("created_at") or now,
        }
        async with self.session_factory() as session:
            inst = JobDescription(**jd_obj)
            session.add(inst)
            await session.commit()
            await session.refresh(inst)
            return _jd_to_pydantic(inst)

    async def get_jd_by_id(self, jd_id: str) -> Optional[JobDescriptionModel]:
        if not jd_id:
            return None

        async with self.session_factory() as session:
            stmt = select(JobDescription).where(JobDescription.id == str(jd_id))
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if row:
                return _jd_to_pydantic(row)
            return None

    async def create_result(self, result_data: dict) -> ATSResultModel:
        data = dict(result_data)
        r_id = str(data.get("resume_id", ""))
        j_id = str(data.get("job_description_id", ""))
        now = datetime.now(timezone.utc)

        async with self.session_factory() as session:
            # Check existing
            stmt = select(ATSResult).where(ATSResult.resume_id == r_id, ATSResult.job_description_id == j_id)
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()

            vals = {
                "user_id": str(data.get("user_id", "")),
                "tenant_id": str(data.get("tenant_id", "default")),
                "resume_id": r_id,
                "job_description_id": j_id,
                "final_score": float(data.get("final_score") or data.get("score") or 0.0),
                "experience_score": float(data.get("experience_score") or 0.0),
                "education_score": float(data.get("education_score") or 0.0),
                "matched_skills": data.get("matched_skills") or [],
                "missing_skills": data.get("missing_skills") or [],
                "breakdown": data.get("breakdown") or {},
                "detailed_analysis": data.get("detailed_analysis") or {},
            }

            if existing:
                for k, v in vals.items():
                    setattr(existing, k, v)
                await session.commit()
                await session.refresh(existing)
                return _result_to_pydantic(existing)
            else:
                new_id = str(data.get("_id") or data.get("id") or gen_uuid_str())
                inst = ATSResult(id=new_id, created_at=now, **vals)
                session.add(inst)
                await session.commit()
                await session.refresh(inst)
                return _result_to_pydantic(inst)

    async def get_result_by_id(self, result_id: str) -> Optional[ATSResultModel]:
        if not result_id:
            return None

        async with self.session_factory() as session:
            stmt = select(ATSResult).where(ATSResult.id == str(result_id))
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if row:
                return _result_to_pydantic(row)
            return None

    async def get_results_by_user(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
        min_score: Optional[float] = None,
    ) -> tuple[List[ATSResultModel], int]:
        if not user_id:
            return [], 0

        async with self.session_factory() as session:
            filters = [ATSResult.user_id == str(user_id)]
            if min_score is not None:
                filters.append(ATSResult.final_score >= float(min_score))

            count_stmt = select(func.count()).select_from(ATSResult).where(*filters)
            count_res = await session.execute(count_stmt)
            total = count_res.scalar() or 0

            stmt = (
                select(ATSResult)
                .where(*filters)
                .order_by(ATSResult.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
            res = await session.execute(stmt)
            results = [_result_to_pydantic(r) for r in res.scalars().all()]
            return results, total

    async def get_results_by_resume(self, resume_id: str) -> List[ATSResultModel]:
        if not resume_id:
            return []

        async with self.session_factory() as session:
            stmt = select(ATSResult).where(ATSResult.resume_id == str(resume_id)).order_by(ATSResult.created_at.desc()).limit(50)
            res = await session.execute(stmt)
            return [_result_to_pydantic(r) for r in res.scalars().all()]

    async def get_top_candidates(
        self,
        job_description_id: str,
        limit: int = 20,
    ) -> List[ATSResultModel]:
        if not job_description_id:
            return []

        async with self.session_factory() as session:
            stmt = select(ATSResult).where(ATSResult.job_description_id == str(job_description_id)).order_by(ATSResult.final_score.desc()).limit(limit)
            res = await session.execute(stmt)
            return [_result_to_pydantic(r) for r in res.scalars().all()]

    async def get_analytics_summary(self, user_id: Optional[str] = None) -> dict:
        async with self.session_factory() as session:
            filters = []
            if user_id:
                filters.append(ATSResult.user_id == str(user_id))

            stmt = select(
                func.count().label("total_checks"),
                func.avg(ATSResult.final_score).label("avg_score"),
                func.max(ATSResult.final_score).label("max_score"),
                func.min(ATSResult.final_score).label("min_score"),
                func.sum(
                    case(
                        (or_(ATSResult.final_score >= 80, and_(ATSResult.final_score <= 1.0, ATSResult.final_score >= 0.8)), 1),
                        else_=0
                    )
                ).label("strong_matches"),
                func.sum(
                    case(
                        (or_(
                            and_(ATSResult.final_score >= 60, ATSResult.final_score < 80),
                            and_(ATSResult.final_score <= 1.0, ATSResult.final_score >= 0.6, ATSResult.final_score < 0.8)
                        ), 1),
                        else_=0
                    )
                ).label("good_matches"),
                func.sum(
                    case(
                        (or_(ATSResult.final_score < 40, and_(ATSResult.final_score <= 1.0, ATSResult.final_score < 0.4)), 1),
                        else_=0
                    )
                ).label("poor_matches"),
            )
            if filters:
                stmt = stmt.where(*filters)
            res = await session.execute(stmt)
            row = res.fetchone()
            if not row or not row[0]:
                return {}
            return {
                "total_checks": row[0] or 0,
                "avg_score": float(row[1] or 0.0),
                "max_score": float(row[2] or 0.0),
                "min_score": float(row[3] or 0.0),
                "strong_matches": int(row[4] or 0),
                "good_matches": int(row[5] or 0),
                "poor_matches": int(row[6] or 0),
            }
