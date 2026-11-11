"""
Application Repository — Pure PostgreSQL (SQLAlchemy 2.0 Async ORM).
Persistence for AI Apply Assistant applications.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from sqlalchemy import select, update, delete, func

from config.db import get_pg_session_factory
from models import JobApplication, gen_uuid_str
from schemas.application_schema import (
    ApplicationStatus,
    is_valid_transition,
)


def _app_to_dict(row: JobApplication) -> Optional[dict]:
    if not row:
        return None
    d = {c.name: getattr(row, c.name) for c in JobApplication.__table__.columns}
    app_id = str(d.get("id"))
    d["id"] = app_id
    d["_id"] = app_id
    return d


class ApplicationRepository:
    def __init__(self, db=None, session_factory=None):
        self.session_factory = session_factory or get_pg_session_factory()

    async def create(
        self,
        *,
        user_id: str,
        resume_id: str,
        company_name: str,
        job_title: str,
        hr_email: str,
        job_description: str,
    ) -> dict:
        now = datetime.now(timezone.utc)
        new_id = gen_uuid_str()
        inst = JobApplication(
            id=new_id,
            user_id=str(user_id),
            resume_id=str(resume_id),
            company_name=company_name,
            job_title=job_title,
            hr_email=hr_email,
            job_description=job_description,
            status=ApplicationStatus.DRAFT.value,
            needs_manual_review=False,
            send_metadata={
                "sent_at": None,
                "provider_message_id": None,
                "attempts": 0,
                "last_error": None,
            },
            created_at=now,
            updated_at=now,
        )
        async with self.session_factory() as session:
            session.add(inst)
            await session.commit()
            await session.refresh(inst)
            return _app_to_dict(inst)

    async def get_by_id(self, application_id: str, user_id: str) -> Optional[dict]:
        if not application_id:
            return None

        async with self.session_factory() as session:
            stmt = select(JobApplication).where(
                JobApplication.id == str(application_id),
                JobApplication.user_id == str(user_id),
            )
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            return _app_to_dict(row)

    async def get_by_id_only(self, application_id: str) -> Optional[dict]:
        if not application_id:
            return None
        async with self.session_factory() as session:
            stmt = select(JobApplication).where(JobApplication.id == str(application_id))
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            return _app_to_dict(row)

    async def list_by_user(self, user_id: str, page: int = 1, page_size: int = 20) -> Tuple[List[dict], int]:
        if not user_id:
            return [], 0

        async with self.session_factory() as session:
            count_stmt = (
                select(func.count())
                .select_from(JobApplication)
                .where(JobApplication.user_id == str(user_id))
            )
            count_res = await session.execute(count_stmt)
            total = count_res.scalar() or 0

            stmt = (
                select(JobApplication)
                .where(JobApplication.user_id == str(user_id))
                .order_by(JobApplication.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
            res = await session.execute(stmt)
            items = [_app_to_dict(r) for r in res.scalars().all()]
            return items, total

    async def save_generated_draft(
        self,
        application_id: str,
        *,
        user_id: str,
        jd_analysis: dict,
        ats_result_ref: dict,
        generated_draft: dict,
        needs_manual_review: bool,
    ) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        vals = {
            "jd_analysis": jd_analysis,
            "ats_result_ref": ats_result_ref,
            "generated_draft": generated_draft,
            "needs_manual_review": needs_manual_review,
            "status": ApplicationStatus.READY_FOR_REVIEW.value,
            "updated_at": now,
        }

        async with self.session_factory() as session:
            stmt = (
                update(JobApplication)
                .where(
                    JobApplication.id == str(application_id),
                    JobApplication.user_id == str(user_id),
                )
                .values(**vals)
                .returning(JobApplication)
            )
            res = await session.execute(stmt)
            await session.commit()
            row = res.scalar_one_or_none()
            return _app_to_dict(row)

    async def save_edited_draft(self, application_id: str, user_id: str, edits: dict) -> Optional[dict]:
        if not application_id:
            return None

        edits = {k: v for k, v in edits.items() if v is not None}
        now = datetime.now(timezone.utc)

        if not edits:
            return await self.get_by_id(application_id, user_id)

        async with self.session_factory() as session:
            stmt = (
                update(JobApplication)
                .where(
                    JobApplication.id == str(application_id),
                    JobApplication.user_id == str(user_id),
                )
                .values(
                    edited_draft={**edits, "edited_at": now.isoformat()},
                    updated_at=now,
                )
                .returning(JobApplication)
            )
            res = await session.execute(stmt)
            await session.commit()
            row = res.scalar_one_or_none()
            return _app_to_dict(row)

    async def update_status(
        self,
        application_id: str,
        current_status: str,
        target_status: str,
        **extra_fields,
    ) -> bool:
        if not is_valid_transition(current_status, target_status):
            return False

        now = datetime.now(timezone.utc)
        vals = {"status": target_status, "updated_at": now, **extra_fields}
        async with self.session_factory() as session:
            stmt = (
                update(JobApplication)
                .where(
                    JobApplication.id == str(application_id),
                    JobApplication.status == current_status,
                )
                .values(**vals)
            )
            res = await session.execute(stmt)
            await session.commit()
            return res.rowcount == 1

    async def update_stage(self, application_id: str, stage: str) -> bool:
        if not application_id:
            return False
        now = datetime.now(timezone.utc)
        async with self.session_factory() as session:
            async with session.begin():
                stmt = (
                    update(JobApplication)
                    .where(JobApplication.id == str(application_id))
                    .values(stage=stage, updated_at=now)
                )
                res = await session.execute(stmt)
                return bool(res.rowcount and res.rowcount > 0)

    async def find_by_id(self, application_id: str) -> Optional[dict]:
        return await self.get_by_id_only(application_id)

    async def update_fields(self, application_id: str, fields: dict) -> Optional[dict]:
        if not application_id:
            return None
        now = datetime.now(timezone.utc)
        valid_cols = {col.name for col in JobApplication.__table__.columns}
        vals = {k: v for k, v in fields.items() if k in valid_cols and k != 'id'}
        vals['updated_at'] = now
        async with self.session_factory() as session:
            async with session.begin():
                stmt = update(JobApplication).where(JobApplication.id == str(application_id)).values(**vals).returning(JobApplication)
                res = await session.execute(stmt)
                return _app_to_dict(res.scalar_one_or_none())

    async def delete(self, application_id: str, user_id: str) -> bool:
        if not application_id:
            return False

        async with self.session_factory() as session:
            stmt = delete(JobApplication).where(
                JobApplication.id == str(application_id),
                JobApplication.user_id == str(user_id),
            )
            res = await session.execute(stmt)
            await session.commit()
            return res.rowcount == 1
