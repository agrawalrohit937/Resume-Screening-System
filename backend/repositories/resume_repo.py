"""
Resume Repository — Dual Engine (PostgreSQL via SQLAlchemy 2.0 / PostgreSQL Primary)
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
import structlog
from sqlalchemy import select, update, delete, func, and_
from sqlalchemy.orm import selectinload, joinedload

from core.config import settings
from config.db import get_pg_session_factory
from models import Resume, gen_uuid_str
from schemas.resume_schema import ResumeModel, ResumeStatus
from repositories.base_repo import BaseRepository

logger = structlog.get_logger(__name__)


def _resume_to_pydantic(row: Resume) -> ResumeModel:
    d = {c.name: getattr(row, c.name) for c in Resume.__table__.columns if getattr(row, c.name) is not None}
    res_id = str(getattr(row, "id", None) or d.get("id"))
    d["id"] = res_id
    d["_id"] = res_id
    return ResumeModel(**d)


class ResumeRepository(BaseRepository):
    def __init__(self, db: Optional[Any] = None, session_factory: Optional[Any] = None):
        self.session_factory = session_factory or get_pg_session_factory()

    # ─── Create ───────────────────────────────────────────────────────────────
    async def create(self, resume_data: dict) -> ResumeModel:
        data = dict(resume_data)
        r_id = str(data.pop("_id", None) or data.pop("id", None) or gen_uuid_str())
        now = datetime.now(timezone.utc)
        status_val = data.get("status", ResumeStatus.PENDING)
        status_str = status_val.value if hasattr(status_val, "value") else str(status_val)

        resume_obj = {
            "id": r_id,
            "user_id": str(data.get("user_id", "")),
            "tenant_id": str(data.get("tenant_id", "default")),
            "filename": data.get("filename", "resume.pdf"),
            "original_filename": data.get("original_filename", data.get("filename", "resume.pdf")),
            "file_type": data.get("file_type", "pdf"),
            "file_size_bytes": int(data.get("file_size_bytes") or 0),
            "storage_path": data.get("storage_path", ""),
            "file_url": data.get("file_url"),
            "cloudinary_public_id": data.get("cloudinary_public_id"),
            "status": status_str,
            "parsed_data": data.get("parsed_data"),
            "parse_error": data.get("parse_error"),
            "error_message": data.get("error_message"),
            "ats_score_history": data.get("ats_score_history") or [],
            "tags": data.get("tags") or [],
            "is_primary": bool(data.get("is_primary", False)),
            "version": int(data.get("version") or 1),
            "created_at": data.get("created_at") or now,
            "updated_at": data.get("updated_at") or now,
        }

        async with self.session_factory() as session:
            resume_inst = Resume(**resume_obj)
            session.add(resume_inst)
            await session.commit()
            await session.refresh(resume_inst)
            return _resume_to_pydantic(resume_inst)

    async def get_by_filename(self, filename: str) -> Optional[ResumeModel]:
        if not filename:
            return None
        async with self.session_factory() as session:
            stmt = select(Resume).where(Resume.filename == filename)
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if row:
                return _resume_to_pydantic(row)
            return None

    async def get_by_id(
        self,
        resume_id: str,
        *,
        include_ats_results: bool = False,
        include_user: bool = False,
    ) -> Optional[ResumeModel]:
        if not resume_id:
            return None

        async with self.session_factory() as session:
            stmt = select(Resume).where(Resume.id == str(resume_id))
            if include_ats_results:
                stmt = stmt.options(selectinload(Resume.ats_results))
            if include_user:
                stmt = stmt.options(joinedload(Resume.user))
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if row:
                return _resume_to_pydantic(row)
            return None

    async def get_by_id_and_user(
        self,
        resume_id: str,
        user_id: str,
        *,
        include_ats_results: bool = False,
    ) -> Optional[ResumeModel]:
        if not resume_id or not user_id:
            return None

        async with self.session_factory() as session:
            stmt = select(Resume).where(Resume.id == str(resume_id), Resume.user_id == str(user_id))
            if include_ats_results:
                stmt = stmt.options(selectinload(Resume.ats_results))
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if row:
                return _resume_to_pydantic(row)
            return None

    async def get_primary_by_user(self, user_id: str) -> Optional[ResumeModel]:
        if not user_id:
            return None

        async with self.session_factory() as session:
            # 1. Try parsed primary first
            stmt = (
                select(Resume)
                .where(Resume.user_id == str(user_id), Resume.status == ResumeStatus.PARSED.value)
                .order_by(Resume.is_primary.desc(), Resume.created_at.desc())
                .limit(1)
            )
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if row:
                return _resume_to_pydantic(row)

            # 2. Fall back to any resume by user
            stmt2 = (
                select(Resume)
                .where(Resume.user_id == str(user_id))
                .order_by(Resume.is_primary.desc(), Resume.created_at.desc())
                .limit(1)
            )
            res2 = await session.execute(stmt2)
            row2 = res2.scalar_one_or_none()
            if row2:
                return _resume_to_pydantic(row2)
            return None

    async def get_by_user(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
        status: Optional[ResumeStatus] = None,
    ) -> tuple[List[ResumeModel], int]:
        if not user_id:
            return [], 0

        async with self.session_factory() as session:
            filters = [Resume.user_id == str(user_id)]
            if status:
                st_str = status.value if hasattr(status, "value") else str(status)
                filters.append(Resume.status == st_str)

            count_stmt = select(func.count()).select_from(Resume).where(*filters)
            count_res = await session.execute(count_stmt)
            total = count_res.scalar() or 0

            stmt = (
                select(Resume)
                .where(*filters)
                .order_by(Resume.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
            res = await session.execute(stmt)
            resumes = [_resume_to_pydantic(r) for r in res.scalars().all()]
            return resumes, total

    async def update_status(
        self, resume_id: str, status: ResumeStatus, error: Optional[str] = None
    ) -> None:
        if not resume_id:
            return
        now = datetime.now(timezone.utc)
        st_str = status.value if hasattr(status, "value") else str(status)

        async with self.session_factory() as session:
            vals = {"status": st_str, "updated_at": now}
            if error:
                vals["parse_error"] = error
            stmt = update(Resume).where(Resume.id == str(resume_id)).values(**vals)
            await session.execute(stmt)
            await session.commit()
        return

    async def update_parsed_data(self, resume_id: str, parsed_data: dict) -> None:
        if not resume_id:
            return
        now = datetime.now(timezone.utc)

        async with self.session_factory() as session:
            stmt = (
                update(Resume)
                .where(Resume.id == str(resume_id))
                .values(
                    parsed_data=parsed_data,
                    status=ResumeStatus.PARSED.value,
                    updated_at=now,
                )
            )
            await session.execute(stmt)
            await session.commit()
        return

    async def update(self, resume_id: str, update_data: dict) -> Optional[ResumeModel]:
        if not resume_id:
            return None
        now = datetime.now(timezone.utc)
        clean_update = dict(update_data)
        clean_update["updated_at"] = now

        valid_cols = {c.name for c in Resume.__table__.columns}
        filtered = {k: v for k, v in clean_update.items() if k in valid_cols}

        async with self.session_factory() as session:
            stmt = (
                update(Resume)
                .where(Resume.id == str(resume_id))
                .values(**filtered)
                .returning(Resume)
            )
            res = await session.execute(stmt)
            await session.commit()
            row = res.scalar_one_or_none()
            if row:
                return _resume_to_pydantic(row)
            return None

    async def delete(self, resume_id: str, user_id: str) -> bool:
        if not resume_id:
            return False

        async with self.session_factory() as session:
            stmt = delete(Resume).where(Resume.id == str(resume_id), Resume.user_id == str(user_id))
            res = await session.execute(stmt)
            await session.commit()
            return res.rowcount > 0

    async def count_by_user(self, user_id: str) -> int:
        if not user_id:
            return 0

        async with self.session_factory() as session:
            stmt = select(func.count()).select_from(Resume).where(Resume.user_id == str(user_id))
            res = await session.execute(stmt)
            return res.scalar() or 0

    async def get_multiple_by_ids(self, resume_ids: List[str]) -> List[ResumeModel]:
        if not resume_ids:
            return []

        str_ids = [str(rid) for rid in resume_ids if rid]
        async with self.session_factory() as session:
            stmt = select(Resume).where(Resume.id.in_(str_ids))
            res = await session.execute(stmt)
            return [_resume_to_pydantic(r) for r in res.scalars().all()]
    async def set_primary_resume(self, user_id: str, resume_id: str) -> None:
        async with self.session_factory() as session:
            await session.execute(
                update(Resume)
                .where(Resume.user_id == str(user_id))
                .values(is_primary=False)
            )
            await session.execute(
                update(Resume)
                .where(and_(Resume.id == str(resume_id), Resume.user_id == str(user_id)))
                .values(is_primary=True)
            )
            await session.commit()

    async def ensure_single_primary(self, user_id: str, preferred_resume_id: Optional[str] = None) -> None:
        async with self.session_factory() as session:
            stmt = select(Resume.id).where(and_(Resume.user_id == str(user_id), Resume.is_primary == True))
            res = await session.execute(stmt)
            primaries = [r[0] for r in res.all()]
            if len(primaries) == 0 and preferred_resume_id:
                await session.execute(
                    update(Resume).where(Resume.id == str(preferred_resume_id)).values(is_primary=True)
                )
                await session.commit()
            elif len(primaries) > 1:
                target_id = preferred_resume_id or primaries[0]
                await session.execute(
                    update(Resume).where(and_(Resume.user_id == str(user_id), Resume.id != str(target_id))).values(is_primary=False)
                )
                await session.execute(
                    update(Resume).where(Resume.id == str(target_id)).values(is_primary=True)
                )
                await session.commit()

