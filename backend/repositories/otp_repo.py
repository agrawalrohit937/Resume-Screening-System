"""
OTP Repository — Dual Engine (PostgreSQL via SQLAlchemy 2.0 / PostgreSQL Primary)
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from sqlalchemy import select, update, delete, func

from core.config import settings
from config.db import get_pg_session_factory
from models import OTP, gen_uuid_str
from schemas.otp_schema import OTPModel, OTPPurpose
from repositories.base_repo import BaseRepository


def _otp_to_pydantic(otp_row: OTP) -> OTPModel:
    d = {c.name: getattr(otp_row, c.name) for c in OTP.__table__.columns}
    otp_id = str(d.get("id"))
    d["id"] = otp_id
    d["_id"] = otp_id
    return OTPModel(**d)


class OTPRepository(BaseRepository):
    def __init__(self, db: Optional[Any] = None, session_factory: Optional[Any] = None):
        self.session_factory = session_factory or get_pg_session_factory()
    async def create(
        self,
        email: str,
        purpose: OTPPurpose,
        otp_hash: str,
        expire_minutes: int,
        max_attempts: int,
    ) -> OTPModel:
        now = datetime.now(timezone.utc)
        exp = now + timedelta(minutes=expire_minutes)
        clean_email = email.lower().strip()
        purp_str = purpose.value if hasattr(purpose, "value") else str(purpose)

        otp_id = gen_uuid_str()
        otp_inst = OTP(
            id=otp_id,
            email=clean_email,
            purpose=purp_str,
            otp_hash=otp_hash,
            attempts=0,
            max_attempts=max_attempts,
            consumed=False,
            created_at=now,
            expires_at=exp,
        )
        async with self.session_factory() as session:
            session.add(otp_inst)
            await session.commit()
            await session.refresh(otp_inst)
            return _otp_to_pydantic(otp_inst)

    async def invalidate_active(self, email: str, purpose: OTPPurpose) -> None:
        clean_email = email.lower().strip()
        purp_str = purpose.value if hasattr(purpose, "value") else str(purpose)

        async with self.session_factory() as session:
            stmt = (
                update(OTP)
                .where(
                    func.lower(OTP.email) == clean_email,
                    OTP.purpose == purp_str,
                    OTP.consumed == False,
                )
                .values(consumed=True)
            )
            await session.execute(stmt)
            await session.commit()
        return

    async def get_latest_active(self, email: str, purpose: OTPPurpose) -> Optional[OTPModel]:
        clean_email = email.lower().strip()
        purp_str = purpose.value if hasattr(purpose, "value") else str(purpose)

        async with self.session_factory() as session:
            stmt = (
                select(OTP)
                .where(
                    func.lower(OTP.email) == clean_email,
                    OTP.purpose == purp_str,
                    OTP.consumed == False,
                )
                .order_by(OTP.created_at.desc())
                .limit(1)
            )
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if row:
                return _otp_to_pydantic(row)
            return None

    async def count_recent(self, email: str, purpose: OTPPurpose, window_minutes: int = 60) -> int:
        clean_email = email.lower().strip()
        purp_str = purpose.value if hasattr(purpose, "value") else str(purpose)
        since = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)

        async with self.session_factory() as session:
            stmt = (
                select(func.count())
                .select_from(OTP)
                .where(
                    func.lower(OTP.email) == clean_email,
                    OTP.purpose == purp_str,
                    OTP.created_at >= since,
                )
            )
            res = await session.execute(stmt)
            return res.scalar() or 0

    async def increment_attempts(self, otp_id: str) -> None:
        if not otp_id:
            return

        async with self.session_factory() as session:
            stmt = update(OTP).where(OTP.id == str(otp_id)).values(attempts=OTP.attempts + 1)
            await session.execute(stmt)
            await session.commit()
        return

    async def mark_consumed(self, otp_id: str) -> bool:
        if not otp_id:
            return False

        async with self.session_factory() as session:
            stmt = (
                update(OTP)
                .where(OTP.id == str(otp_id), OTP.consumed == False)
                .values(consumed=True)
            )
            res = await session.execute(stmt)
            await session.commit()
            return res.rowcount > 0

    async def delete_all_for(self, email: str, purpose: OTPPurpose) -> None:
        clean_email = email.lower().strip()
        purp_str = purpose.value if hasattr(purpose, "value") else str(purpose)

        async with self.session_factory() as session:
            stmt = delete(OTP).where(
                func.lower(OTP.email) == clean_email,
                OTP.purpose == purp_str,
            )
            await session.execute(stmt)
            await session.commit()
        return

    async def atomic_consume_if_valid(
        self,
        email: str,
        purpose: OTPPurpose,
        now: datetime,
    ) -> Optional[OTPModel]:
        clean_email = email.lower().strip()
        purp_str = purpose.value if hasattr(purpose, "value") else str(purpose)

        async with self.session_factory() as session:
            # Find latest unconsumed and unexpired OTP
            find_stmt = (
                select(OTP)
                .where(
                    func.lower(OTP.email) == clean_email,
                    OTP.purpose == purp_str,
                    OTP.consumed == False,
                    OTP.expires_at > now,
                )
                .order_by(OTP.created_at.desc())
                .limit(1)
                .with_for_update()
            )
            find_res = await session.execute(find_stmt)
            row = find_res.scalar_one_or_none()
            if not row:
                return None

            pydantic_res = _otp_to_pydantic(row)
            row.consumed = True
            await session.commit()
            return pydantic_res
