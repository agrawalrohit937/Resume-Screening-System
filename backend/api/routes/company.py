"""
Company Profile & Employer Branding API Routes (Multi-Tenant RBAC)
Enterprise Phase 5.1:
- GET /api/v1/company: Retrieves the global CompanyProfile for the authenticated user's tenant_id.
- PATCH /api/v1/company: Strictly allows EXECUTIVE / ADMIN to update branding. Rejects non-EXEC with 403.
- PUT /api/v1/company: Alias for PATCH.
"""

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import structlog
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import get_current_user, get_database
from models.job import CompanyProfilePayload
from models.user_model import UserModel, UserRole

logger = structlog.get_logger(__name__)
router = APIRouter()

ENTERPRISE_VIEW_ROLES = {
    UserRole.PLATFORM_ADMIN,
    UserRole.ADMIN,
    UserRole.EXECUTIVE,
    UserRole.EXEC,
    UserRole.EMPLOYER,
    UserRole.RECRUITER,
    UserRole.HIRING_MANAGER,
    UserRole.INTERVIEWER,
}

MANAGE_ROLES = {
    UserRole.PLATFORM_ADMIN,
    UserRole.ADMIN,
    UserRole.EXECUTIVE,
    UserRole.EXEC,
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
    db: Any = Depends(get_database),
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
        from services.multi_tenancy.tenant_cleanup import purge_orphaned_tenant_if_needed
        await purge_orphaned_tenant_if_needed(db, tenant_id, excluding_user_id=str(current_user.id))
        company_doc = await db.companies.find_one({"tenant_id": tenant_id})

    # 2. Secondary lookup by company_name if tenant_id match not found
    if not company_doc and getattr(current_user, "company_name", None):
        company_name_clean = current_user.company_name.strip()
        company_doc = await db.companies.find_one(
            {"company_name": {"$regex": f"^{re.escape(company_name_clean)}$", "$options": "i"}}
        )

    # 3. Fallback placeholder if no profile created yet
    if not company_doc:
        default_name = getattr(current_user, "company_name", None) or (
            tenant_id.replace("-", " ").title() if tenant_id != "default" else "CareerPilot Technologies"
        )
        company_doc = {
            "tenant_id": tenant_id,
            "company_name": default_name,
            "tagline": "Empowering talent with precision AI",
            "logo_url": None,
            "cover_url": None,
            "website": None,
            "location": "Remote",
            "industry": "Technology",
            "team_size": "50-200 employees",
            "about": "Building the next generation career and talent acquisition intelligence platform.",
            "perks": ["Flexible Hours", "Health Insurance", "Remote Work"],
            "linkedin": None,
            "github": None,
            "twitter": None,
        }

    # Format MongoDB ObjectId
    if "_id" in company_doc:
        company_doc["id"] = str(company_doc["_id"])
        del company_doc["_id"]

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
    db: Any = Depends(get_database),
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

    # Check for existing profile to clean up old logos if changed
    query = {"tenant_id": tenant_id} if tenant_id != "default" else {
        "company_name": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"}
    }
    existing_doc = await db.companies.find_one(query)
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
        "updated_by": str(current_user.id),
        "updated_at": now,
    }

    await db.companies.update_one(
        query,
        {
            "$set": profile_dict,
            "$setOnInsert": {
                "created_at": now,
                "created_by": str(current_user.id),
            },
        },
        upsert=True,
    )

    # Synchronize logo, website, and about across open jobs for this tenant / company
    update_job_fields: Dict[str, Any] = {}
    if profile_dict["logo_url"]:
        update_job_fields["company_logo"] = profile_dict["logo_url"]
    if profile_dict["website"]:
        update_job_fields["company_website"] = profile_dict["website"]
    if profile_dict["about"]:
        update_job_fields["company_about"] = profile_dict["about"]

    if update_job_fields:
        job_filter = {"tenant_id": tenant_id} if tenant_id != "default" else {
            "company_name": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"}
        }
        await db.jobs.update_many(job_filter, {"$set": update_job_fields})

    logger.info(
        "Company profile updated successfully",
        tenant_id=tenant_id,
        company=clean_name,
        user_id=str(current_user.id),
    )

    return {
        "success": True,
        "message": "Company profile updated successfully.",
        "profile": profile_dict,
        "is_read_only": False,
    }


@router.delete("")
async def delete_company_profile(
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
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
    result = await cascade_delete_tenant(db, tenant_id=tenant_id, deleted_by_user_id=str(current_user.id))

    return {
        "success": True,
        "message": "Company profile and organization assets deleted successfully.",
        "details": result,
    }
