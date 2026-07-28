"""
User Profile Routes — profile photo upload/removal (Cloudinary storage)

Mount this router at prefix "/users" alongside your existing "/auth" router.
"""

import structlog
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from api.deps import get_current_user, get_user_repo
from models.user_model import UserModel
from repositories.user_repo import UserRepository
from schemas.user_schema import UserPublicResponse, UpdateProfileRequest, MessageResponse, SetPrimaryResumeRequest
from utils.image_utils import validate_and_save_profile_image, delete_profile_image

logger = structlog.get_logger(__name__)
router = APIRouter()


def _user_to_public(user: UserModel) -> UserPublicResponse:
    return UserPublicResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        status=user.status,
        profile_picture=user.profile_picture,
        phone=user.phone,
        linkedin_url=user.linkedin_url,
        github_username=user.github_username,
        total_resumes=user.total_resumes,
        total_ats_checks=user.total_ats_checks,
        last_login=user.last_login,
        created_at=user.created_at,
        provider=user.provider,
        email_verified=user.email_verified,
        google_picture=user.google_picture,           # 🚨 DEPRECATED
        display_picture=user.display_picture,
        college=user.college,
        degree=user.degree,
        graduation_year=user.graduation_year,
        location=user.location,
        bio=user.bio,
        github_url=user.github_url,
        portfolio_url=user.portfolio_url,
        profile_completion_percent=user.profile_completion_percent,
        # ✅ Add these
        plan=user.plan,
        subscription_active=user.subscription_active,
        plan_updated_at=user.plan_updated_at,
        # ── NEW multi-provider auth fields ─────────────────────────────────
        auth_methods=user.auth_methods or ([user.auth_method] if user.auth_method else []),
        last_login_method=user.last_login_method or user.auth_method,
        linked_accounts=user.linked_accounts or {},
        # ── Primary profile resume fields ──────────────────────────────────
        profile_resume_url=user.profile_resume_url,
        profile_resume_name=user.profile_resume_name,
    )


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
