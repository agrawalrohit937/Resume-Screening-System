"""
Dependency Injection — Auth guards, DB access, service instances
"""

from typing import Annotated, Optional

import structlog
from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config.db import get_database as _get_raw_database
from core.config import settings
from core.security import decode_token, verify_token_type
from models.user_model import UserModel, UserRole
from repositories.user_repo import UserRepository
from repositories.resume_repo import ResumeRepository
from repositories.result_repo import ResultRepository
from repositories.otp_repo import OTPRepository
from repositories.copilot_repo import CopilotRepository
from services.parser_service import ParserService
from services.skill_service import SkillService
from services.ai_interview_service import AIInterviewService
from services.github_service import GitHubService
from services.pdf_generator_service import PDFGeneratorService
from services.email_service import EmailService
from services.otp_service import OTPService
from services.token_service import TokenService
from services.multi_tenancy.tenant_context import (
    get_current_tenant_id,
    set_current_tenant_id,
    set_platform_admin,
    is_platform_admin,
)
from services.multi_tenancy.tenant_repository import TenantScopedDatabase

logger = structlog.get_logger(__name__)
security = HTTPBearer(auto_error=False)


# ─── Database ─────────────────────────────────────────────────────────────────
def get_database():
    raw = _get_raw_database()
    return TenantScopedDatabase(raw)


def get_db():
    return get_database()


def get_current_tenant() -> str:
    return get_current_tenant_id()


# ─── Repositories ─────────────────────────────────────────────────────────────
def get_user_repo(db=Depends(get_db)) -> UserRepository:
    return UserRepository(db)


def get_resume_repo(db=Depends(get_db)) -> ResumeRepository:
    return ResumeRepository(db)


def get_result_repo(db=Depends(get_db)) -> ResultRepository:
    return ResultRepository(db)


def get_otp_repo(db=Depends(get_db)) -> OTPRepository:
    return OTPRepository(db)


def get_copilot_repo(db=Depends(get_db)) -> CopilotRepository:
    return CopilotRepository(db)


# ─── Services ─────────────────────────────────────────────────────────────────
def get_parser_service() -> ParserService:
    return ParserService()


def get_skill_service() -> SkillService:
    return SkillService()


def get_interview_service() -> AIInterviewService:
    return AIInterviewService()


def get_github_service() -> GitHubService:
    return GitHubService()


def get_pdf_service() -> PDFGeneratorService:
    return PDFGeneratorService()


def get_email_service() -> EmailService:
    return EmailService()


def get_otp_service(
    otp_repo: OTPRepository = Depends(get_otp_repo),
    email_service: EmailService = Depends(get_email_service),
) -> OTPService:
    return OTPService(otp_repo, email_service)


# ─── Auth ─────────────────────────────────────────────────────────────────────

async def get_current_user(
    request: Request,
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    user_repo: UserRepository = Depends(get_user_repo),
) -> UserModel:

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication credentials",
    )

    token = None

    # 1. Header takes precedence if explicitly provided (API clients / Mobile / Swagger)
    if credentials:
        token = credentials.credentials
    # 2. Fallback to cookie (Web frontend)
    elif request.cookies.get("access_token"):
        token = request.cookies.get("access_token")

    if not token:
        raise credentials_exception

    payload = decode_token(token)

    if not payload or not verify_token_type(payload, "access"):
        raise credentials_exception

    # Check JTI revocation denylist
    jti = payload.get("jti")
    if jti and await TokenService.is_jti_revoked(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exception

    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.status != "active":
        raise HTTPException(
            status_code=403,
            detail=f"Account is {user.status}. Contact support.",
        )

    user_roles = [r.value if hasattr(r, "value") else str(r).lower() for r in (user.roles or [user.role])]
    is_root_admin = "platform_admin" in user_roles or "admin" in user_roles
    set_platform_admin(is_root_admin)

    if is_root_admin:
        header_tenant = request.headers.get("x-tenant-id") or request.headers.get("X-Tenant-ID")
        set_current_tenant_id(header_tenant or user.tenant_id or "default")
    else:
        set_current_tenant_id(user.tenant_id or "default")

    return user

async def get_current_active_user(
    current_user: Annotated[UserModel, Depends(get_current_user)]
) -> UserModel:
    return current_user


async def get_optional_current_user(
    request: Request,
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    user_repo: UserRepository = Depends(get_user_repo),
) -> Optional[UserModel]:
    """
    Optional authentication guard: returns the UserModel if a valid Bearer token
    or cookie is present and user is active, otherwise returns None without raising 401.
    """
    token = None
    if credentials:
        token = credentials.credentials
    elif request.cookies.get("access_token"):
        token = request.cookies.get("access_token")

    if not token:
        return None

    try:
        payload = decode_token(token)
        if not payload or not verify_token_type(payload, "access"):
            return None

        if payload.get("jti") and await TokenService.is_jti_revoked(payload.get("jti")):
            return None

        user_id = payload.get("sub")
        if not user_id:
            return None

        user = await user_repo.get_by_id(user_id)
        if not user or user.status != "active":
            return None

        user_roles = [r.value if hasattr(r, "value") else str(r).lower() for r in (user.roles or [user.role])]
        is_root_admin = "platform_admin" in user_roles or "admin" in user_roles
        set_platform_admin(is_root_admin)

        if is_root_admin:
            header_tenant = request.headers.get("x-tenant-id") or request.headers.get("X-Tenant-ID")
            set_current_tenant_id(header_tenant or user.tenant_id or "default")
        else:
            set_current_tenant_id(user.tenant_id or "default")

        return user
    except Exception:
        return None



# ─── Role Guards ──────────────────────────────────────────────────────────────
def require_role(*roles: UserRole):
    async def _check(current_user: UserModel = Depends(get_current_user)) -> UserModel:
        user_roles = {r.value if hasattr(r, "value") else str(r).lower() for r in (current_user.roles or [current_user.role])}
        # PLATFORM_ADMIN root bypasses all role checks
        if "platform_admin" in user_roles or "admin" in user_roles:
            return current_user

        # EXECUTIVE inherits full company tenant permissions
        if "executive" in user_roles or "exec" in user_roles:
            return current_user

        required_values = {r.value if hasattr(r, "value") else str(r).lower() for r in roles}
        if not user_roles.intersection(required_values):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {[r.value if hasattr(r, 'value') else str(r) for r in roles]}",
            )
        return current_user
    return _check


def get_admin_user(current_user: UserModel = Depends(get_current_user)) -> UserModel:
    user_roles = {r.value if hasattr(r, "value") else str(r).lower() for r in (current_user.roles or [current_user.role])}
    if "platform_admin" not in user_roles and "admin" not in user_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def get_recruiter_or_admin(current_user: UserModel = Depends(get_current_user)) -> UserModel:
    user_roles = {r.value if hasattr(r, "value") else str(r).lower() for r in (current_user.roles or [current_user.role])}
    allowed = {"recruiter", "hiring_manager", "platform_admin", "admin", "executive", "exec"}
    if not user_roles.intersection(allowed):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Recruiter access required")
    return current_user




# ─── Pagination ───────────────────────────────────────────────────────────────
class PaginationParams:
    def __init__(
        self,
        page: int = Query(default=1, ge=1, description="Page number"),
        page_size: int = Query(default=settings.DEFAULT_PAGE_SIZE, ge=1, le=settings.MAX_PAGE_SIZE),
    ):
        self.page = page
        self.page_size = page_size
        self.skip = (page - 1) * page_size

    def to_response_meta(self, total: int) -> dict:
        total_pages = (total + self.page_size - 1) // self.page_size
        return {
            "total": total,
            "page": self.page,
            "page_size": self.page_size,
            "total_pages": total_pages,
            "has_next": self.page < total_pages,
            "has_prev": self.page > 1,
        }