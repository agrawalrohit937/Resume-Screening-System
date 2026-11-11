"""
Job Repository — Pure PostgreSQL via SQLAlchemy 2.0 Async ORM.
Handles job marketplace search, recruiter job management, applicant counts, and application tracking.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple, Union
import structlog
from sqlalchemy import select, update, delete, func, or_, Text
from sqlalchemy.orm import joinedload, selectinload

from core.config import settings
from config.db import get_pg_session_factory
from models import Job, JobApplication, CareerApplication, CandidateApplication, gen_uuid_str
from repositories.base_repo import BaseRepository

logger = structlog.get_logger(__name__)


def _job_to_dict(job_row: Job) -> dict:
    """Helper to convert SQLAlchemy Job model instance to dictionary matching job document."""
    d = {c.name: getattr(job_row, c.name) for c in Job.__table__.columns}
    job_id = str(d.get("id"))
    d["id"] = job_id
    d["_id"] = job_id
    # Exclude embeddings from light API payloads if not explicitly needed
    return d


class JobRepository(BaseRepository):
    def __init__(self, db: Optional[Any] = None, session_factory: Optional[Any] = None):
        self.session_factory = session_factory or get_pg_session_factory()

    # ─── Create ───────────────────────────────────────────────────────────────
    async def create(self, job_data: dict) -> dict:
        now = datetime.now(timezone.utc)
        data = dict(job_data)
        j_id = str(data.pop("_id", None) or data.pop("id", None) or gen_uuid_str())

        job_obj = {
            "id": j_id,
            "company_name": str(data.get("company_name", "")),
            "title": str(data.get("title", "")),
            "jd_text_raw": str(data.get("jd_text_raw") or data.get("description") or ""),
            "required_skills": data.get("required_skills") or [],
            "min_years": float(data.get("min_years") or 0.0),
            "location": str(data.get("location") or "Remote"),
            "work_mode": str(data.get("work_mode") or "Remote"),
            "salary_range": data.get("salary_range"),
            "status": str(data.get("status") or "open"),
            "jd_embedding": data.get("jd_embedding") or [],
            "department": data.get("department"),
            "company_logo": data.get("company_logo"),
            "company_website": data.get("company_website"),
            "company_about": data.get("company_about"),
            "company_size": data.get("company_size"),
            "is_external": bool(data.get("is_external", False)),
            "external_apply_url": data.get("external_apply_url"),
            "external_job_id": data.get("external_job_id"),
            "created_by": str(data.get("created_by", "")) if data.get("created_by") else None,
            "tenant_id": str(data.get("tenant_id", "default")),
            "applicant_count": int(data.get("applicant_count") or 0),
            "education_requirement_mode": str(data.get("education_requirement_mode") or "preferred"),
            "required_credentials": data.get("required_credentials") or [],
            "created_at": data.get("created_at") or now,
            "updated_at": data.get("updated_at") or now,
        }

        async with self.session_factory() as session:
            inst = Job(**job_obj)
            session.add(inst)
            await session.commit()
            await session.refresh(inst)
            return _job_to_dict(inst)

    async def get_by_id(
        self,
        job_id: str,
        *,
        include_applications: bool = False,
        include_creator: bool = False,
    ) -> Optional[dict]:
        if not job_id:
            return None

        async with self.session_factory() as session:
            stmt = select(Job).where(Job.id == str(job_id))
            if include_applications:
                stmt = stmt.options(selectinload(Job.applications))
            if include_creator:
                stmt = stmt.options(joinedload(Job.creator))
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if row:
                d = _job_to_dict(row)
                if include_creator and row.creator:
                    d["creator_email"] = row.creator.email
                    d["creator_name"] = row.creator.full_name
                return d
            return None

    async def update(self, job_id: str, update_data: dict) -> Optional[dict]:
        if not job_id:
            return None
        now = datetime.now(timezone.utc)
        clean_update = dict(update_data)
        clean_update["updated_at"] = now

        valid_cols = {c.name for c in Job.__table__.columns}
        filtered = {k: v for k, v in clean_update.items() if k in valid_cols}

        async with self.session_factory() as session:
            stmt = (
                update(Job)
                .where(Job.id == str(job_id))
                .values(**filtered)
                .returning(Job)
            )
            res = await session.execute(stmt)
            await session.commit()
            row = res.scalar_one_or_none()
            if row:
                return _job_to_dict(row)
            return None

    async def increment_applicant_count(self, job_id: str, amount: int = 1) -> None:
        if not job_id:
            return

        async with self.session_factory() as session:
            stmt = update(Job).where(Job.id == str(job_id)).values(
                applicant_count=Job.applicant_count + amount,
                updated_at=datetime.now(timezone.utc),
            )
            await session.execute(stmt)
            await session.commit()
        return

    async def list_jobs(
        self,
        *,
        search: Optional[str] = None,
        work_mode: Optional[str] = None,
        location: Optional[str] = None,
        min_years: Optional[float] = None,
        skill: Optional[str] = None,
        status_list: Optional[List[str]] = None,
        skip: int = 0,
        limit: int = 30,
    ) -> Tuple[List[dict], int]:
        async with self.session_factory() as session:
            filters = []

            # Status filter (open, published, active)
            valid_statuses = status_list or ["open", "published", "active", "Open", "Published", "Active"]
            filters.append(Job.status.in_(valid_statuses))

            # Search filter (title, company, description, skills)
            if search and search.strip():
                s = f"%{search.strip().lower()}%"
                filters.append(
                    or_(
                        func.lower(Job.title).like(s),
                        func.lower(Job.company_name).like(s),
                        func.lower(Job.jd_text_raw).like(s),
                        Job.required_skills.cast(Text).ilike(s),
                    )
                )

            # Work mode filter
            if work_mode and work_mode.strip().lower() != "all":
                filters.append(func.lower(Job.work_mode) == work_mode.strip().lower())

            # Location filter
            if location and location.strip().lower() != "all":
                loc = f"%{location.strip().lower()}%"
                filters.append(func.lower(Job.location).like(loc))

            # Experience filter
            if min_years is not None:
                filters.append(Job.min_years <= float(min_years))

            # Skill filter
            if skill and skill.strip():
                sk = f"%{skill.strip().lower()}%"
                filters.append(
                    or_(
                        Job.required_skills.cast(Text).ilike(sk),
                        func.lower(Job.title).like(sk),
                        func.lower(Job.jd_text_raw).like(sk),
                    )
                )

            # Total count
            count_stmt = select(func.count()).select_from(Job).where(*filters)
            count_res = await session.execute(count_stmt)
            total = count_res.scalar() or 0

            # Data rows
            stmt = (
                select(Job)
                .where(*filters)
                .order_by(Job.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
            res = await session.execute(stmt)
            jobs = [_job_to_dict(r) for r in res.scalars().all()]
            return jobs, total

    async def list_by_recruiter(self, recruiter_id: str, skip: int = 0, limit: int = 50) -> Tuple[List[dict], int]:
        if not recruiter_id:
            return [], 0

        async with self.session_factory() as session:
            filters = [Job.created_by == str(recruiter_id)]
            count_stmt = select(func.count()).select_from(Job).where(*filters)
            count_res = await session.execute(count_stmt)
            total = count_res.scalar() or 0

            stmt = select(Job).where(*filters).order_by(Job.created_at.desc()).offset(skip).limit(limit)
            res = await session.execute(stmt)
            jobs = [_job_to_dict(r) for r in res.scalars().all()]
            return jobs, total

    async def get_user_applied_job_ids(self, user_id: str) -> Set[str]:
        if not user_id:
            return set()

        applied = set()
        async with self.session_factory() as session:
            stmt = select(CandidateApplication.job_id).where(CandidateApplication.candidate_id == str(user_id))
            res = await session.execute(stmt)
            for r in res.fetchall():
                if r[0]:
                    applied.add(str(r[0]))
        return applied

    async def get_candidate_application(self, job_id: str, app_id: str) -> Optional[dict]:
        if not app_id:
            return None
        async with self.session_factory() as session:
            stmt = select(CandidateApplication).where(
                CandidateApplication.id == str(app_id),
                CandidateApplication.job_id == str(job_id)
            )
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if row:
                d = {c.name: getattr(row, c.name) for c in CandidateApplication.__table__.columns}
                d["_id"] = d.get("id")
                return d
    async def update_candidate_application(self, job_id: str, app_id: str, updates: dict) -> bool:
        if not app_id:
            return False
        now = datetime.now(timezone.utc)
        async with self.session_factory() as session:
            stmt = select(CandidateApplication).where(
                CandidateApplication.id == str(app_id),
                CandidateApplication.job_id == str(job_id)
            )
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()
            if existing:
                details = dict(existing.details or {})
                for k, v in updates.items():
                    if hasattr(CandidateApplication, k) and k != "id":
                        setattr(existing, k, v)
                    else:
                        details[k] = v
                existing.details = details
                existing.updated_at = now
                await session.commit()
                return True

    async def create_candidate_application(self, app_data: dict) -> dict:
        now = datetime.now(timezone.utc)
        doc = dict(app_data)
        app_id = doc.pop("_id", None) or doc.get("id") or gen_uuid_str()
        valid_cols = {c.name for c in CandidateApplication.__table__.columns}
        filtered = {k: v for k, v in doc.items() if k in valid_cols}
        details = {k: v for k, v in doc.items() if k not in valid_cols}
        filtered["id"] = str(app_id)
        filtered["details"] = details
        filtered["created_at"] = doc.get("created_at") or now
        filtered["updated_at"] = doc.get("updated_at") or now
        inst = CandidateApplication(**filtered)
        async with self.session_factory() as session:
            session.add(inst)
            await session.commit()
            d = {c.name: getattr(inst, c.name) for c in CandidateApplication.__table__.columns}
            if inst.details:
                d.update(inst.details)
            d["_id"] = d.get("id")
            return d

    async def list_candidate_applications(
        self,
        job_id: str,
        stage: Optional[str] = None,
        *,
        include_candidate: bool = True,
        include_resume: bool = True,
    ) -> List[dict]:
        async with self.session_factory() as session:
            stmt = select(CandidateApplication).where(CandidateApplication.job_id == str(job_id))
            if include_candidate:
                stmt = stmt.options(joinedload(CandidateApplication.candidate))
            if include_resume:
                stmt = stmt.options(joinedload(CandidateApplication.resume))
            if stage:
                stmt = stmt.where(CandidateApplication.stage == str(stage))
            stmt = stmt.order_by(CandidateApplication.match_score.desc(), CandidateApplication.created_at.desc())
            res = await session.execute(stmt)
            rows = res.scalars().unique().all()
            apps = []
            for r in rows:
                d = {c.name: getattr(r, c.name) for c in CandidateApplication.__table__.columns}
                if r.details:
                    d.update(r.details)
                app_id = str(d.get("id"))
                d["id"] = app_id
                d["_id"] = app_id
                if include_candidate and r.candidate:
                    d["candidate_name"] = r.candidate.full_name or d.get("candidate_name")
                    d["candidate_email"] = r.candidate.email or d.get("candidate_email")
                if include_resume and r.resume:
                    d["resume_filename"] = r.resume.filename or d.get("resume_filename")
                    d["resume_url"] = r.resume.file_url or d.get("resume_url")
                apps.append(d)
            return apps

    async def count_candidate_applications(self, job_id: str) -> int:
        async with self.session_factory() as session:
            stmt = select(func.count(CandidateApplication.id)).where(CandidateApplication.job_id == str(job_id))
            return (await session.execute(stmt)).scalar() or 0

    async def list_applications_by_candidate(
        self,
        candidate_id: str,
        *,
        include_job: bool = True,
    ) -> List[dict]:
        async with self.session_factory() as session:
            stmt = select(CandidateApplication).where(CandidateApplication.candidate_id == str(candidate_id))
            if include_job:
                stmt = stmt.options(joinedload(CandidateApplication.job))
            stmt = stmt.order_by(CandidateApplication.created_at.desc())
            res = await session.execute(stmt)
            rows = res.scalars().unique().all()
            apps = []
            for r in rows:
                d = {c.name: getattr(r, c.name) for c in CandidateApplication.__table__.columns}
                if r.details:
                    d.update(r.details)
                app_id = str(d.get("id"))
                d["id"] = app_id
                d["_id"] = app_id
                if include_job and r.job:
                    d["job_title"] = r.job.title or d.get("job_title")
                    d["company_name"] = r.job.company_name or d.get("company_name")
                    d["job_location"] = r.job.location or d.get("job_location")
                apps.append(d)
            return apps

    async def list_candidate_applications_by_tenant(self, tenant_id: str = "default", limit: int = 50) -> List[dict]:
        async with self.session_factory() as session:
            stmt = select(CandidateApplication)
            if tenant_id and tenant_id != "default":
                stmt = stmt.where(CandidateApplication.tenant_id == tenant_id)
            stmt = stmt.limit(limit)
            rows = (await session.execute(stmt)).scalars().all()
            results = []
            for r in rows:
                d = {c.name: getattr(r, c.name) for c in CandidateApplication.__table__.columns}
                app_id = str(d.get("id"))
                d["id"] = app_id
                d["_id"] = app_id
                results.append(d)
            return results

    async def get_candidate_application_by_id(self, application_id: str) -> Optional[dict]:
        async with self.session_factory() as session:
            stmt = select(CandidateApplication).where(CandidateApplication.id == str(application_id))
            row = (await session.execute(stmt)).scalar_one_or_none()
            if not row:
                return None
            d = {c.name: getattr(row, c.name) for c in CandidateApplication.__table__.columns}
            app_id = str(d.get("id"))
            d["id"] = app_id
            d["_id"] = app_id
            return d
