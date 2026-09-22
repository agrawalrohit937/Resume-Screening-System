"""
User Profile Routes — profile photo upload/removal (Cloudinary storage)

Mount this router at prefix "/users" alongside your existing "/auth" router.
"""

from datetime import datetime, timezone
from typing import Any
from bson import ObjectId
import structlog
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from api.deps import get_current_user, get_user_repo, get_db
from models.user_model import UserModel
from repositories.user_repo import UserRepository
from schemas.user_schema import UserPublicResponse, UpdateProfileRequest, MessageResponse, SetPrimaryResumeRequest
from services.cloudinary_service import delete_file, extract_public_id_from_url
from utils.image_utils import validate_and_save_profile_image, delete_profile_image

from api.routes.auth_helpers import user_to_public as _user_to_public

logger = structlog.get_logger(__name__)
router = APIRouter()


# ─── GET /users/me ─────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserPublicResponse)
async def get_my_profile(current_user: UserModel = Depends(get_current_user)):
    return _user_to_public(current_user)


# ─── PUT /users/me ─────────────────────────────────────────────────────────────
@router.put("/me", response_model=UserPublicResponse)
async def update_my_profile(
    payload: UpdateProfileRequest,
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update.")
    updated = await user_repo.update(str(current_user.id), update_data)
    return _user_to_public(updated)


# ─── POST /users/profile-photo ─────────────────────────────────────────────────
@router.post("/profile-photo", response_model=UserPublicResponse)
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    """
    Uploads a new profile photo to Cloudinary,
    deletes the previous custom image (Google picture is left untouched),
    and saves the Cloudinary URL + public_id in MongoDB.
    """
    secure_url, public_id, _size = await validate_and_save_profile_image(file, str(current_user.id))

    # Delete the old *custom* Cloudinary image only — never touch google_picture
    old_public_id = getattr(current_user, "profile_picture_public_id", None)
    if old_public_id:
        await delete_profile_image(old_public_id)

    updated = await user_repo.update(str(current_user.id), {
        "profile_picture": secure_url,
        "profile_picture_public_id": public_id,
    })
    logger.info("Profile photo updated", user_id=str(current_user.id), url=secure_url)
    return _user_to_public(updated)


# ─── DELETE /users/profile-photo ───────────────────────────────────────────────
@router.delete("/profile-photo", response_model=UserPublicResponse)
async def remove_profile_photo(
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    """
    Removes the custom uploaded photo from Cloudinary and MongoDB.
    Falls back to Google picture (if provider=google) or initials avatar.
    """
    old_public_id = getattr(current_user, "profile_picture_public_id", None)
    if old_public_id:
        await delete_profile_image(old_public_id)
    elif current_user.profile_picture and current_user.profile_picture.startswith("http"):
        # Legacy: stored as URL only — no public_id available, skip Cloudinary delete
        pass

    updated = await user_repo.update(str(current_user.id), {
        "profile_picture": None,
        "profile_picture_public_id": None,
    })
    logger.info("Profile photo removed", user_id=str(current_user.id))
    return _user_to_public(updated)


# ─── PUT /users/me/set-primary-resume ─────────────────────────────────────────
@router.put("/me/set-primary-resume", response_model=UserPublicResponse)
async def set_primary_resume(
    payload: SetPrimaryResumeRequest,
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    """
    Set a resume as the primary profile resume by saving its URL and name
    on the User document's profile_resume_url and profile_resume_name fields.
    """
    updated = await user_repo.update(str(current_user.id), {
        "profile_resume_url": payload.resume_url,
        "profile_resume_name": payload.resume_name,
    })
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    logger.info(
        "Primary resume updated",
        user_id=str(current_user.id),
        resume_name=payload.resume_name,
    )
    return _user_to_public(updated)


# ─── DELETE /users/me ─────────────────────────────────────────────────────────
@router.delete("/me")
async def delete_my_account(
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_db),
):
    """
    Cascading user account deletion.
    - Purges user's uploaded resumes from Cloudinary and removes them from MongoDB.
    - Purges user's ATS results from MongoDB.
    - Anonymizes user's job applications (redacts name, email, and resume snapshots
      while preserving scores and stages for recruiter analytics).
    - Cleans up custom profile photo from Cloudinary.
    - Deletes user record from MongoDB and records an audit log entry.
    """
    user_id_str = str(current_user.id)
    user_oid = ObjectId(current_user.id)
    now = datetime.now(timezone.utc)

    # 1. Cloudinary and MongoDB resume deletion
    resumes_cursor = db.resumes.find({"user_id": user_id_str})
    async for resume_doc in resumes_cursor:
        pid = resume_doc.get("cloudinary_public_id")
        if not pid and resume_doc.get("file_url"):
            pid = extract_public_id_from_url(resume_doc["file_url"])
        if pid:
            try:
                await delete_file(pid, resource_type="raw")
            except Exception as e:
                logger.warning("Failed to delete resume from Cloudinary during account cascade", public_id=pid, error=str(e))

    await db.resumes.delete_many({"user_id": user_id_str})

    # 2. Delete candidate ATS results
    await db.results.delete_many({"user_id": user_id_str})

    # 3. Anonymize applications (candidate_id matches user_id)
    await db.applications.update_many(
        {"candidate_id": user_id_str},
        {
            "$set": {
                "candidate_name": "[Deleted User]",
                "candidate_email": None,
                "resume_snapshot.file_url": None,
                "resume_snapshot.cloudinary_public_id": None,
                "resume_snapshot.parsed_data": None,
                "updated_at": now,
            }
        }
    )

    # 4. Remove custom profile photo from Cloudinary
    old_photo_id = getattr(current_user, "profile_picture_public_id", None)
    if old_photo_id:
        try:
            await delete_profile_image(old_photo_id)
        except Exception as e:
            logger.warning("Failed to delete profile picture during account cascade", public_id=old_photo_id, error=str(e))

    # 5. Organization / Tenant Cascade Cleanup (if user is organization owner/executive)
    user_roles = [r.lower() for r in (getattr(current_user, "roles", []) or [getattr(current_user, "role", "")])]
    is_owner = any(r in ("executive", "exec", "employer", "admin", "platform_admin") for r in user_roles)
    tenant_id = getattr(current_user, "tenant_id", None)

    if is_owner and tenant_id and tenant_id != "default":
        # Check if there are other active executives in this tenant
        other_exec = await db.users.find_one({
            "_id": {"$ne": user_oid},
            "tenant_id": tenant_id,
            "status": {"$ne": "deleted"},
            "roles": {"$in": ["executive", "exec", "admin", "platform_admin"]},
        })
        if not other_exec:
            from services.multi_tenancy.tenant_cleanup import cascade_delete_tenant
            await cascade_delete_tenant(db, tenant_id=tenant_id, deleted_by_user_id=user_id_str)

    # 6. Delete user document from users collection
    await db.users.delete_one({"_id": user_oid})

    # 7. Audit log entry
    await db.audit_logs.insert_one({
        "action": "user_account_deleted",
        "user_id": user_id_str,
        "email": current_user.email,
        "role": current_user.role,
        "timestamp": now,
    })

    logger.info("User account successfully deleted and cascaded", user_id=user_id_str)
    return {
        "success": True,
        "message": "Account successfully deleted and personal data anonymized.",
    }
