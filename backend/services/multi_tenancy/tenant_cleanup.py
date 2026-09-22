"""
Tenant & Organization Cascade Deletion Service.

Handles complete purging of organization/tenant data, logos (Cloudinary & local),
and prevents reviving orphaned tenant profiles upon onboarding.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
import structlog
from bson import ObjectId

from services.cloudinary_service import delete_file as cloudinary_delete, extract_public_id_from_url

logger = structlog.get_logger(__name__)


async def cleanup_logo_file(logo_url: Optional[str]) -> None:
    """
    Deletes an uploaded logo file from Cloudinary or local storage.
    """
    if not logo_url or not isinstance(logo_url, str):
        return

    clean_url = logo_url.strip()
    if not clean_url or clean_url.startswith("data:"):
        # Base64 data urls don't need external storage cleanup
        return

    # 1. Cloudinary Cleanup
    if "cloudinary" in clean_url or "res.cloudinary.com" in clean_url:
        pid = extract_public_id_from_url(clean_url)
        if pid:
            try:
                await cloudinary_delete(pid, resource_type="image")
                logger.info("Deleted company logo from Cloudinary", public_id=pid)
            except Exception as e:
                logger.warning("Failed to delete company logo from Cloudinary", public_id=pid, error=str(e))
        return

    # 2. Local File Storage Cleanup (e.g. /uploads/logos/..., uploads/logos/...)
    potential_paths = [
        clean_url,
        os.path.join(".", clean_url.lstrip("/\\")),
        os.path.join("uploads", "logos", os.path.basename(clean_url)),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "logos", os.path.basename(clean_url)),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), clean_url.lstrip("/\\")),
    ]
    for p in potential_paths:
        try:
            if os.path.isfile(p):
                os.remove(p)
                logger.info("Deleted local company logo file", path=p)
                break
        except Exception as e:
            logger.warning("Failed to delete local logo file", path=p, error=str(e))


async def cascade_delete_tenant(
    db: Any,
    tenant_id: str,
    deleted_by_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Completely purges all data associated with an organization / tenant:
    - Company profile in db.companies
    - Uploaded logo & cover files (Cloudinary / local)
    - Any db.tenants document
    - Jobs in db.jobs
    - Team invites in db.team_invites
    - Requisitions in db.requisitions
    - Interview kits in db.interview_kits
    - Scorecards in db.scorecards
    - Talent pools in db.talent_pools
    - Webhook subscriptions in db.webhook_subscriptions
    - EEO records in db.eeo_responses
    - Reverts remaining team members in db.users to candidate role & clears tenant_id
    """
    if not tenant_id or tenant_id == "default":
        return {"success": False, "message": "Cannot delete default system tenant."}

    logger.info("Starting cascade deletion for tenant", tenant_id=tenant_id, initiator=deleted_by_user_id)

    # 1. Fetch company document to retrieve logo_url and cover_url
    company_docs = await db.companies.find({"tenant_id": tenant_id}).to_list(10)
    for comp in company_docs:
        logo_url = comp.get("logo_url")
        if logo_url:
            await cleanup_logo_file(logo_url)
        cover_url = comp.get("cover_url")
        if cover_url:
            await cleanup_logo_file(cover_url)

    # Also check jobs for any custom logo URLs attached to this tenant
    jobs_cursor = db.jobs.find({"tenant_id": tenant_id})
    async for job in jobs_cursor:
        job_logo = job.get("company_logo")
        if job_logo:
            await cleanup_logo_file(job_logo)

    # 2. Delete database records across collections
    await db.companies.delete_many({"tenant_id": tenant_id})
    if hasattr(db, "tenants"):
        await db.tenants.delete_many({"$or": [{"tenant_id": tenant_id}, {"_id": tenant_id}]})
    await db.jobs.delete_many({"tenant_id": tenant_id})
    await db.team_invites.delete_many({"tenant_id": tenant_id})
    await db.requisitions.delete_many({"tenant_id": tenant_id})
    await db.interview_kits.delete_many({"tenant_id": tenant_id})
    await db.scorecards.delete_many({"tenant_id": tenant_id})
    await db.talent_pools.delete_many({"tenant_id": tenant_id})
    await db.webhook_subscriptions.delete_many({"tenant_id": tenant_id})
    await db.eeo_responses.delete_many({"tenant_id": tenant_id})

    # 3. Reset any remaining users that belonged to this tenant
    user_filter: Dict[str, Any] = {"tenant_id": tenant_id}
    if deleted_by_user_id:
        try:
            user_filter["_id"] = {"$ne": ObjectId(deleted_by_user_id)}
        except Exception:
            pass

    await db.users.update_many(
        user_filter,
        {
            "$set": {
                "tenant_id": None,
                "company_name": None,
                "role": "candidate",
                "roles": ["candidate"],
            }
        },
    )

    logger.info("Successfully completed cascade deletion for tenant", tenant_id=tenant_id)
    return {
        "success": True,
        "tenant_id": tenant_id,
        "message": f"Tenant '{tenant_id}' and all associated organization data successfully deleted.",
    }


async def purge_orphaned_tenant_if_needed(
    db: Any,
    tenant_id: str,
    excluding_user_id: Optional[str] = None,
) -> bool:
    """
    Onboarding check:
    Checks if a tenant document / company profile exists but has NO active users.
    If orphaned, completely purges the stale company profile & logo files so the new user starts fresh.
    Returns True if an orphaned tenant was purged, False otherwise.
    """
    if not tenant_id or tenant_id == "default":
        return False

    # Check if there are any active users for this tenant
    query: Dict[str, Any] = {
        "tenant_id": tenant_id,
        "status": {"$ne": "deleted"},
    }
    if excluding_user_id:
        try:
            query["_id"] = {"$ne": ObjectId(excluding_user_id)}
        except Exception:
            pass

    active_user = await db.users.find_one(query)
    if not active_user:
        # No active users for this tenant! It is an orphaned tenant.
        orphaned_comp = await db.companies.find_one({"tenant_id": tenant_id})
        if orphaned_comp:
            logger.info("Purging orphaned company profile and logo before fresh onboarding", tenant_id=tenant_id)
            await cascade_delete_tenant(db, tenant_id=tenant_id)
            return True

    return False
