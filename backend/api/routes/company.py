"""
Company Profile & Employer Branding API Routes (Multi-Tenant RBAC)
Enterprise Phase 5.1:
- GET /api/v1/company: Retrieves the global CompanyProfile for the authenticated user's tenant_id.
- PATCH /api/v1/company: Strictly allows EXECUTIVE / ADMIN to update branding. Rejects non-EXEC with 403.
- PUT /api/v1/company: Alias for PATCH.
"""

from datetime import datetime, timezone
from typing import Any, Dict

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import get_current_user, get_company_repo, get_job_repo
from schemas.job_schema import CompanyProfilePayload
from schemas.user_schema import UserModel, UserRole
from repositories.company_repo import CompanyRepository
from repositories.job_repo import JobRepository

logger = structlog.get_logger(__name__)
router = APIRouter()

ENTERPRISE_VIEW_ROLES = {
    UserRole.PLATFORM_ADMIN,
    UserRole.EXECUTIVE,
    UserRole.RECRUITER,
    UserRole.INTERVIEWER,
}

MANAGE_ROLES = {
    UserRole.PLATFORM_ADMIN,
    UserRole.EXECUTIVE,
    "executive",
    "exec",
    "admin",
    "platform_admin",
}


def _is_exec_or_admin(user: UserModel) -> bool:
    """Checks if the user possesses company executive privileges."""
    user_role = str(getattr(user, "role", "") or "").lower().strip()
    if user_role in {"executive", "exec", "platform_admin", "admin"}:
        return True
    if hasattr(user, "has_role") and user.has_role(*MANAGE_ROLES):
        return True
    return False


@router.get("")
async def get_company_profile(
    current_user: UserModel = Depends(get_current_user),
    company_repo: CompanyRepository = Depends(get_company_repo),
):
    """
    Retrieves the CompanyProfile for the authenticated user's organization tenant.
    Accessible to all enterprise tenant roles (Executive, Recruiter, Hiring Manager, Interviewer).
    Returns company profile along with an `is_read_only` RBAC enforcement flag.
    """
    if not current_user.has_role(*ENTERPRISE_VIEW_ROLES):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Enterprise role required to access organization company profile.",
        )

    tenant_id = current_user.tenant_id or "default"
    company_doc = None

    # 1. Primary lookup by tenant_id
    if tenant_id and tenant_id != "default":
        company_doc = await company_repo.get_by_tenant_id(tenant_id)

    # 2. Secondary lookup by company_name if tenant_id match not found
    if not company_doc and getattr(current_user, "company_name", None):
        company_name_clean = current_user.company_name.strip()
        company_doc = await company_repo.get_by_name(company_name_clean)

    # 3. Clean empty template if no profile created yet
    if not company_doc:
        default_name = getattr(current_user, "company_name", None) or (
            tenant_id.replace("-", " ").title() if tenant_id != "default" else ""
        )
        company_doc = {
            "tenant_id": tenant_id,
            "company_name": default_name or "",
            "tagline": "",
            "logo_url": None,
            "cover_url": None,
            "website": "",
            "location": "",
            "industry": "",
            "team_size": "",
            "about": "",
            "perks": [],
            "linkedin": None,
            "github": None,
            "twitter": None,
        }

    is_read_only = not _is_exec_or_admin(current_user)

    return {
        "success": True,
        "company_profile": company_doc,
        "tenant_id": tenant_id,
        "is_read_only": is_read_only,
    }


@router.patch("")
@router.put("")
async def update_company_profile(
    payload: CompanyProfilePayload,
    current_user: UserModel = Depends(get_current_user),
    company_repo: CompanyRepository = Depends(get_company_repo),
    job_repo: JobRepository = Depends(get_job_repo),
):
    """
    Updates or creates the global organization CompanyProfile.
    STRICT RBAC: Only EXECUTIVE and ADMIN roles are authorized.
    Invited team members (Recruiters, Interviewers, Hiring Managers) receive 403 Forbidden.
    """
    if not _is_exec_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Company profile is read-only for invited team members. Only Executive/Admin can update company branding.",
        )

    clean_name = payload.company_name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company name is required.",
        )

    tenant_id = current_user.tenant_id or "default"
    now = datetime.now(timezone.utc)

    existing_doc = await company_repo.get_by_tenant_id(tenant_id)
    new_logo = payload.logo_url.strip() if payload.logo_url else None
    if new_logo and new_logo.startswith("data:image/"):
        from services.cloudinary_service import upload_base64_company_logo
        uploaded_url = await upload_base64_company_logo(new_logo, company_id=tenant_id)
        if uploaded_url:
            new_logo = uploaded_url

    if existing_doc:
        old_logo = existing_doc.get("logo_url")
        if old_logo and old_logo != new_logo and not old_logo.startswith("data:image/"):
            from services.multi_tenancy.tenant_cleanup import cleanup_logo_file
            await cleanup_logo_file(old_logo)

    profile_dict = {
        "tenant_id": tenant_id,
        "company_name": clean_name,
        "tagline": payload.tagline.strip() if payload.tagline else None,
        "about": payload.about.strip() if payload.about else None,
        "logo_url": new_logo,
        "cover_url": payload.cover_url.strip() if payload.cover_url else None,
        "website": payload.website.strip() if payload.website else None,
        "location": payload.location.strip() if payload.location else "Remote",
        "industry": payload.industry.strip() if payload.industry else "Technology",
        "team_size": payload.team_size.strip() if payload.team_size else "50-200 employees",
        "perks": [p.strip() for p in payload.perks if p and p.strip()],
        "linkedin": payload.linkedin.strip() if payload.linkedin else None,
        "github": payload.github.strip() if payload.github else None,
        "twitter": payload.twitter.strip() if payload.twitter else None,
        "updated_at": now,
    }

    saved = await company_repo.upsert(tenant_id, profile_dict)

    # Synchronize company_name, logo, website, and about across jobs and users for this tenant
    update_job_fields: Dict[str, Any] = {"company_name": clean_name}
    if profile_dict.get("logo_url"):
        update_job_fields["company_logo"] = profile_dict["logo_url"]
    if profile_dict.get("website"):
        update_job_fields["company_website"] = profile_dict["website"]
    if profile_dict.get("about"):
        update_job_fields["company_about"] = profile_dict["about"]

    from sqlalchemy import update, or_
    from models import Job, User
    from config.db import get_pg_session_factory
    session_factory = get_pg_session_factory()
    async with session_factory() as session:
        if tenant_id and tenant_id != "default":
            job_stmt = update(Job).where(or_(Job.tenant_id == tenant_id, Job.created_by == str(current_user.id))).values(**update_job_fields)
            user_stmt = update(User).where(or_(User.tenant_id == tenant_id, User.id == str(current_user.id))).values(company_name=clean_name)
        else:
            job_stmt = update(Job).where(Job.created_by == str(current_user.id)).values(**update_job_fields)
            user_stmt = update(User).where(User.id == str(current_user.id)).values(company_name=clean_name)
        await session.execute(job_stmt)
        await session.execute(user_stmt)
        await session.commit()

    current_user.company_name = clean_name

    logger.info(
        "Company profile updated successfully",
        tenant_id=tenant_id,
        company=clean_name,
        user_id=str(current_user.id),
    )

    return {
        "success": True,
        "message": "Company profile updated successfully.",
        "profile": saved,
        "is_read_only": False,
    }


@router.delete("")
async def delete_company_profile(
    current_user: UserModel = Depends(get_current_user),
):
    """
    Deletes the organization CompanyProfile and cleans up all associated branding/logo assets.
    STRICT RBAC: Only EXECUTIVE and ADMIN roles are authorized.
    """
    if not _is_exec_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only Executive/Admin can delete company profile and branding.",
        )

    tenant_id = current_user.tenant_id or "default"
    if tenant_id == "default":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete default organization profile.",
        )

    from services.multi_tenancy.tenant_cleanup import cascade_delete_tenant
    result = await cascade_delete_tenant(tenant_id=tenant_id, deleted_by_user_id=str(current_user.id))

    return {
        "success": True,
        "message": "Company profile and organization assets deleted successfully.",
        "details": result,
    }
