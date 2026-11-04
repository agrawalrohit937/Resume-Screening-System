"""
User Repository — Dual Engine (PostgreSQL via SQLAlchemy 2.0 / PostgreSQL Primary)
Automatically routes queries to PostgreSQL when settings.DATABASE_URL is set,
with graceful fallback to document collection when running in standalone mode.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
import structlog
from sqlalchemy import select, update, delete, func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from core.config import settings
from config.db import get_pg_session_factory
from models import User, gen_uuid_str
from models.user_model import UserModel, UserRole, UserStatus
from repositories.base_repo import BaseRepository

logger = structlog.get_logger(__name__)


def _user_to_pydantic(user_row: User) -> UserModel:
    """Helper to convert SQLAlchemy User model instance to Pydantic UserModel."""
    d = {c.name: getattr(user_row, c.name) for c in User.__table__.columns}
    d["_id"] = d.pop("id")
    return UserModel(**d)


class UserRepository(BaseRepository):
    def __init__(self, db: Optional[Any] = None, session_factory: Optional[Any] = None):
        self.session_factory = session_factory or get_pg_session_factory()

    # ─── Create ───────────────────────────────────────────────────────────────
    async def create(self, user_data: dict) -> UserModel:
        data = dict(user_data)
        u_id = str(data.pop("_id", None) or data.pop("id", None) or gen_uuid_str())
        roles = data.get("roles") or ([data.get("role")] if data.get("role") else ["candidate"])
        if not isinstance(roles, list):
            roles = [str(roles)]

        now = datetime.now(timezone.utc)
        user_vals = {
            "id": u_id,
            "email": str(data.get("email", "")).lower().strip(),
            "hashed_password": data.get("hashed_password"),
            "full_name": data.get("full_name", "User"),
            "role": str(data.get("role", "candidate")),
            "roles": roles,
            "status": str(data.get("status", "active")),
            "tenant_id": data.get("tenant_id"),
            "is_invited_staff": bool(data.get("is_invited_staff", False)),
            "invited_by": data.get("invited_by"),
            "company_name": data.get("company_name"),
            "plan": data.get("plan", "free"),
            "subscription_active": bool(data.get("subscription_active", False)),
            "subscription_status": data.get("subscription_status", "expired"),
            "subscription_start_date": data.get("subscription_start_date"),
            "subscription_end_date": data.get("subscription_end_date"),
            "plan_updated_at": data.get("plan_updated_at") or now,
            "payment_history": data.get("payment_history") or [],
            "profile_picture": data.get("profile_picture"),
            "profile_picture_public_id": data.get("profile_picture_public_id"),
            "phone": data.get("phone"),
            "linkedin_url": data.get("linkedin_url"),
            "github_username": data.get("github_username"),
            "total_resumes": int(data.get("total_resumes") or 0),
            "total_ats_checks": int(data.get("total_ats_checks") or 0),
            "last_login": data.get("last_login"),
            "refresh_token": data.get("refresh_token"),
            "gmail_access_token": data.get("gmail_access_token"),
            "gmail_refresh_token": data.get("gmail_refresh_token"),
            "gmail_token_expiry": data.get("gmail_token_expiry"),
            "auth_method": data.get("auth_method"),
            "provider": str(data.get("provider", "email")),
            "email_verified": bool(data.get("email_verified", False)),
            "google_picture": data.get("google_picture"),
            "auth_methods": data.get("auth_methods") or [],
            "last_login_method": data.get("last_login_method"),
            "linked_accounts": data.get("linked_accounts") or {},
            "college": data.get("college"),
            "degree": data.get("degree"),
            "graduation_year": data.get("graduation_year"),
            "location": data.get("location"),
            "bio": data.get("bio"),
            "github_url": data.get("github_url"),
            "portfolio_url": data.get("portfolio_url"),
            "portfolio_slug": data.get("portfolio_slug"),
            "is_portfolio_published": bool(data.get("is_portfolio_published", False)),
            "profile_resume_url": data.get("profile_resume_url"),
            "profile_resume_name": data.get("profile_resume_name"),
            "trusted_devices": data.get("trusted_devices") or [],
            "created_at": data.get("created_at") or now,
            "updated_at": data.get("updated_at") or now,
        }

        async with self.session_factory() as session:
            user_instance = User(**user_vals)
            session.add(user_instance)
            await session.commit()
            await session.refresh(user_instance)
            return _user_to_pydantic(user_instance)

    async def get_by_id(self, user_id: str) -> Optional[UserModel]:
        if not user_id:
            return None

        async with self.session_factory() as session:
            stmt = select(User).where(User.id == str(user_id))
            res = await session.execute(stmt)
            user_row = res.scalar_one_or_none()
            if user_row:
                return _user_to_pydantic(user_row)
            return None

    async def get_by_email(self, email: str) -> Optional[UserModel]:
        if not email:
            return None

        clean_email = email.lower().strip()
        async with self.session_factory() as session:
            stmt = select(User).where(func.lower(User.email) == clean_email)
            res = await session.execute(stmt)
            user_row = res.scalar_one_or_none()
            if user_row:
                return _user_to_pydantic(user_row)
            return None

    async def update(self, user_id: str, update_data: dict) -> Optional[UserModel]:
        if not user_id:
            return None

        now = datetime.now(timezone.utc)
        clean_update = dict(update_data)
        clean_update["updated_at"] = now

        # Flatten $set dictionary if passed
        if "$set" in clean_update:
            clean_update = dict(clean_update["$set"])
            clean_update["updated_at"] = now

        # Filter only valid table columns
        valid_cols = {c.name for c in User.__table__.columns}
        filtered_update = {k: v for k, v in clean_update.items() if k in valid_cols}

        async with self.session_factory() as session:
            stmt = (
                update(User)
                .where(User.id == str(user_id))
                .values(**filtered_update)
                .returning(User)
            )
            res = await session.execute(stmt)
            await session.commit()
            updated_row = res.scalar_one_or_none()
            if updated_row:
                return _user_to_pydantic(updated_row)
            return None

    async def update_last_login(self, user_id: str) -> None:
        if not user_id:
            return
        now = datetime.now(timezone.utc)

        async with self.session_factory() as session:
            stmt = update(User).where(User.id == str(user_id)).values(last_login=now, updated_at=now)
            await session.execute(stmt)
            await session.commit()
        return

    async def increment_counter(self, user_id: str, field: str, amount: int = 1) -> None:
        if not user_id:
            return

        col = getattr(User, field, None)
        if col is not None:
            async with self.session_factory() as session:
                stmt = update(User).where(User.id == str(user_id)).values({field: col + amount})
                await session.execute(stmt)
                await session.commit()
        return

    async def add_payment_history(self, user_id: str, payment_entry: dict) -> None:
        if not user_id:
            return

        async with self.session_factory() as session:
            stmt = select(User.payment_history).where(User.id == str(user_id))
            res = await session.execute(stmt)
            history = list(res.scalar_one_or_none() or [])
            history.append(payment_entry)
            upd_stmt = update(User).where(User.id == str(user_id)).values(payment_history=history)
            await session.execute(upd_stmt)
            await session.commit()
        return

    async def delete(self, user_id: str) -> bool:
        if not user_id:
            return False

        async with self.session_factory() as session:
            stmt = delete(User).where(User.id == str(user_id))
            res = await session.execute(stmt)
            await session.commit()
            return res.rowcount > 0

    async def list_users(
        self,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[List[UserModel], int]:
        async with self.session_factory() as session:
            filters = []
            if role:
                filters.append(User.role == (role.value if hasattr(role, "value") else str(role)))
            if status:
                filters.append(User.status == (status.value if hasattr(status, "value") else str(status)))

            # Count total
            count_stmt = select(func.count()).select_from(User)
            if filters:
                count_stmt = count_stmt.where(*filters)
            count_res = await session.execute(count_stmt)
            total = count_res.scalar() or 0

            # Fetch rows
            rows_stmt = select(User)
            if filters:
                rows_stmt = rows_stmt.where(*filters)
            rows_stmt = rows_stmt.order_by(User.created_at.desc()).offset(skip).limit(limit)
            rows_res = await session.execute(rows_stmt)
            users = [_user_to_pydantic(r) for r in rows_res.scalars().all()]
            return users, total

    async def email_exists(self, email: str) -> bool:
        if not email:
            return False

        clean_email = email.lower().strip()
        async with self.session_factory() as session:
            stmt = select(func.count()).select_from(User).where(func.lower(User.email) == clean_email)
            res = await session.execute(stmt)
            return (res.scalar() or 0) > 0

    async def get_platform_user_stats(self) -> dict:
        async with self.session_factory() as session:
            stmt = select(
                User.role,
                func.count().label("total"),
                func.count().filter(User.status == "active").label("active")
            ).group_by(User.role)
            res = await session.execute(stmt)
            stats = {}
            for r in res.fetchall():
                stats[r[0]] = {"total": r[1], "active": r[2]}
            tot_res = await session.execute(select(func.count()).select_from(User))
            total = tot_res.scalar() or 0
            return {"by_role": stats, "total_users": total}

    async def add_trusted_device(self, user_id: str, device_doc: dict) -> None:
        if not user_id:
            return

        async with self.session_factory() as session:
            stmt = select(User.trusted_devices).where(User.id == str(user_id))
            res = await session.execute(stmt)
            devices = list(res.scalar_one_or_none() or [])
            devices.append(device_doc)
            upd_stmt = update(User).where(User.id == str(user_id)).values(trusted_devices=devices)
            await session.execute(upd_stmt)
            await session.commit()
        return

    async def touch_trusted_device(self, user_id: str, device_hash: str) -> None:
        if not user_id or not device_hash:
            return
        now = datetime.now(timezone.utc)

        async with self.session_factory() as session:
            stmt = select(User.trusted_devices).where(User.id == str(user_id))
            res = await session.execute(stmt)
            devices = list(res.scalar_one_or_none() or [])
            updated = False
            for d in devices:
                if d.get("device_hash") == device_hash:
                    d["last_used_at"] = now.isoformat()
                    updated = True
            if updated:
                upd_stmt = update(User).where(User.id == str(user_id)).values(trusted_devices=devices)
                await session.execute(upd_stmt)
                await session.commit()
        return

    async def is_device_trusted(self, user: UserModel, device_hash: str) -> bool:
        now = datetime.now(timezone.utc)
        for d in user.trusted_devices:
            if d.device_hash == device_hash:
                expires_at = d.expires_at
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at > now:
                    return True
        return False

    async def prune_expired_devices(self, user_id: str) -> None:
        now = datetime.now(timezone.utc)

        async with self.session_factory() as session:
            stmt = select(User.trusted_devices).where(User.id == str(user_id))
            res = await session.execute(stmt)
            devices = list(res.scalar_one_or_none() or [])
            valid_devices = []
            for d in devices:
                exp = d.get("expires_at")
                if isinstance(exp, str):
                    try:
                        exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
                        if exp_dt.tzinfo is None:
                            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                        if exp_dt >= now:
                            valid_devices.append(d)
                    except Exception:
                        valid_devices.append(d)
                elif isinstance(exp, datetime):
                    if exp.tzinfo is None:
                        exp = exp.replace(tzinfo=timezone.utc)
                    if exp >= now:
                        valid_devices.append(d)
                else:
                    valid_devices.append(d)

            upd_stmt = update(User).where(User.id == str(user_id)).values(trusted_devices=valid_devices)
            await session.execute(upd_stmt)
            await session.commit()
        return

    async def add_auth_method(self, user_id: str, method: str) -> None:
        if not user_id:
            return

        async with self.session_factory() as session:
            stmt = select(User.auth_methods).where(User.id == str(user_id))
            res = await session.execute(stmt)
            methods = list(res.scalar_one_or_none() or [])
            if method not in methods:
                methods.append(method)
                upd_stmt = update(User).where(User.id == str(user_id)).values(auth_methods=methods)
                await session.execute(upd_stmt)
                await session.commit()
        return

    async def update_last_login_method(self, user_id: str, method: str) -> None:
        if not user_id:
            return

        async with self.session_factory() as session:
            stmt = update(User).where(User.id == str(user_id)).values(last_login_method=method)
            await session.execute(stmt)
            await session.commit()
        return

    async def upsert_linked_account(
        self, user_id: str, provider: str, provider_data: Dict[str, Any]
    ) -> None:
        if not user_id:
            return

        async with self.session_factory() as session:
            stmt = select(User.linked_accounts).where(User.id == str(user_id))
            res = await session.execute(stmt)
            linked = dict(res.scalar_one_or_none() or {})
            # Serialize any datetime inside provider_data
            clean_pdata = {}
            for k, v in provider_data.items():
                if isinstance(v, datetime):
                    clean_pdata[k] = v.isoformat()
                else:
                    clean_pdata[k] = v
            linked[provider] = clean_pdata
            upd_stmt = update(User).where(User.id == str(user_id)).values(linked_accounts=linked)
            await session.execute(upd_stmt)
            await session.commit()
        return

    async def link_oauth_provider(
        self, user_id: str, provider: str, provider_data: Dict[str, Any]
    ) -> None:
        now = datetime.now(timezone.utc)
        clean_pdata = dict(provider_data)
        clean_pdata.setdefault("linked_at", now.isoformat())
        clean_pdata.setdefault("last_login", now.isoformat())
        for k, v in clean_pdata.items():
            if isinstance(v, datetime):
                clean_pdata[k] = v.isoformat()

        async with self.session_factory() as session:
            stmt = select(User.auth_methods, User.linked_accounts).where(User.id == str(user_id))
            res = await session.execute(stmt)
            row = res.fetchone()
            if row:
                methods = list(row[0] or [])
                if provider not in methods:
                    methods.append(provider)
                linked = dict(row[1] or {})
                linked[provider] = clean_pdata
                upd_stmt = (
                    update(User)
                    .where(User.id == str(user_id))
                    .values(
                        auth_methods=methods,
                        linked_accounts=linked,
                        last_login_method=provider,
                        last_login=now,
                        updated_at=now,
                    )
                )
                await session.execute(upd_stmt)
                await session.commit()
        return

    async def find_by_email_and_update_linked(
        self, email: str, provider: str, provider_data: Dict[str, Any],
        user_data: Optional[Dict[str, Any]] = None
    ) -> Optional[UserModel]:
        now = datetime.now(timezone.utc)
        clean_pdata = dict(provider_data)
        clean_pdata.setdefault("linked_at", now.isoformat())
        clean_pdata.setdefault("last_login", now.isoformat())
        for k, v in clean_pdata.items():
            if isinstance(v, datetime):
                clean_pdata[k] = v.isoformat()

        clean_email = email.lower().strip()
        async with self.session_factory() as session:
            stmt = select(User).where(func.lower(User.email) == clean_email)
            res = await session.execute(stmt)
            user_row = res.scalar_one_or_none()
            if not user_row:
                return None

            methods = list(user_row.auth_methods or [])
            if provider not in methods:
                methods.append(provider)
            linked = dict(user_row.linked_accounts or {})
            linked[provider] = clean_pdata

            vals = {
                "auth_methods": methods,
                "linked_accounts": linked,
                "last_login_method": provider,
                "last_login": now,
                "updated_at": now,
            }
            if user_data:
                for k, v in user_data.items():
                    if v is not None and hasattr(User, k):
                        vals[k] = v

            upd_stmt = update(User).where(User.id == user_row.id).values(**vals).returning(User)
            upd_res = await session.execute(upd_stmt)
            await session.commit()
            return _user_to_pydantic(upd_res.scalar_one())

    async def save_gmail_tokens(
        self,
        user_id: str,
        access_token: str,
        refresh_token: str,
        expiry: datetime,
    ) -> None:
        if not user_id:
            return
        now = datetime.now(timezone.utc)

        async with self.session_factory() as session:
            stmt = (
                update(User)
                .where(User.id == str(user_id))
                .values(
                    gmail_access_token=access_token,
                    gmail_refresh_token=refresh_token,
                    gmail_token_expiry=expiry,
                    updated_at=now,
                )
            )
            await session.execute(stmt)
            await session.commit()
        return

    async def update_gmail_access_token(
        self,
        user_id: str,
        access_token: str,
        expiry: datetime,
    ) -> None:
        if not user_id:
            return
        now = datetime.now(timezone.utc)

        async with self.session_factory() as session:
            stmt = (
                update(User)
                .where(User.id == str(user_id))
                .values(
                    gmail_access_token=access_token,
                    gmail_token_expiry=expiry,
                    updated_at=now,
                )
            )
            await session.execute(stmt)
            await session.commit()
        return

    async def get_gmail_tokens(self, user_id: str) -> Optional[dict]:
        if not user_id:
            return None

        async with self.session_factory() as session:
            stmt = select(
                User.gmail_access_token,
                User.gmail_refresh_token,
                User.gmail_token_expiry
            ).where(User.id == str(user_id))
            res = await session.execute(stmt)
            row = res.fetchone()
            if not row or not row[1]:
                return None
            return {
                "access_token": row[0],
                "refresh_token": row[1],
                "expiry": row[2],
            }

    async def get_by_portfolio_slug(self, slug: str) -> Optional[UserModel]:
        if not slug:
            return None
        clean_slug = slug.lower().strip()

        async with self.session_factory() as session:
            stmt = select(User).where(func.lower(User.portfolio_slug) == clean_slug)
            res = await session.execute(stmt)
            user_row = res.scalar_one_or_none()
            if user_row:
                return _user_to_pydantic(user_row)
            return None

    async def slug_exists(self, slug: str, exclude_user_id: Optional[str] = None) -> bool:
        if not slug:
            return False
        clean_slug = slug.lower().strip()

        async with self.session_factory() as session:
            stmt = select(func.count()).select_from(User).where(func.lower(User.portfolio_slug) == clean_slug)
            if exclude_user_id:
                stmt = stmt.where(User.id != str(exclude_user_id))
            res = await session.execute(stmt)
            return (res.scalar() or 0) > 0

    async def set_portfolio_slug(self, user_id: str, slug: str) -> UserModel:
        clean_slug = slug.lower().strip()
        updated = await self.update(user_id, {"portfolio_slug": clean_slug})
        if not updated:
            raise ValueError("User not found to update portfolio slug")
        return updated

    async def publish_portfolio(self, user_id: str, is_published: bool) -> UserModel:
        updated = await self.update(user_id, {"is_portfolio_published": is_published})
        if not updated:
            raise ValueError("User not found to update portfolio publish state")
        return updated
