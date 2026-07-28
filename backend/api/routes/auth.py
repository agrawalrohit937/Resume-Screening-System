"""
Auth Routes — composition root.

Core session/profile endpoints (refresh, me, change-password, deactivate,
logout) live directly here. Signup/OTP/login and each OAuth provider are
split into their own modules and mounted below, so this file stays a thin
router rather than a monolith covering every auth concern.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from api.deps import get_current_user, get_user_repo
from core.security import decode_token, verify_password, verify_token_type, hash_password
from models.user_model import UserModel, UserStatus
from repositories.user_repo import UserRepository
from schemas.user_schema import (
    RefreshTokenRequest, TokenResponse, UserPublicResponse,
    MessageResponse, ChangePasswordRequest, UpdateProfileRequest,
)
from api.routes.auth_helpers import user_to_public, build_and_persist_tokens, set_auth_cookies
from api.routes import auth_otp, auth_google, auth_linkedin, auth_github

router = APIRouter()

# Mount the split-out modules under the same /auth prefix so the public API
# surface (URLs, methods, request/response shapes) is unchanged.
router.include_router(auth_otp.router)
router.include_router(auth_google.router)
router.include_router(auth_linkedin.router)
router.include_router(auth_github.router)


# ─── POST /auth/refresh ───────────────────────────────────────────────────────
@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    payload: RefreshTokenRequest,
    user_repo: UserRepository = Depends(get_user_repo),
):
    token_data = decode_token(payload.refresh_token)

    if not token_data or not verify_token_type(token_data, "refresh"):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = await user_repo.get_by_id(token_data["sub"])

    if not user or user.refresh_token != payload.refresh_token:
        raise HTTPException(status_code=401, detail="Invalid or reused refresh token")

    return await build_and_persist_tokens(user, user_repo)


# ─── GET /auth/me ─────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserPublicResponse)
async def get_me(current_user: UserModel = Depends(get_current_user)):
    """Get the currently authenticated user's profile."""
    return user_to_public(current_user)


# ─── PUT /auth/me ─────────────────────────────────────────────────────────────
@router.put("/me", response_model=UserPublicResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Update authenticated user's profile."""
    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update.")
    updated = await user_repo.update(str(current_user.id), update_data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user_to_public(updated)


# ─── POST /auth/change-password ───────────────────────────────────────────────
@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Change user password after verifying current password."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    new_hash = hash_password(payload.new_password)
    await user_repo.update(str(current_user.id), {"hashed_password": new_hash})
    return MessageResponse(message="Password changed successfully.")


# ─── DELETE /auth/me ──────────────────────────────────────────────────────────
@router.delete("/me", response_model=MessageResponse)
async def deactivate_account(
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Deactivate (soft delete) current user's account."""
    await user_repo.update(str(current_user.id), {"status": UserStatus.INACTIVE})
    return MessageResponse(message="Account deactivated successfully.")


@router.post("/logout")
async def logout(
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    await user_repo.update(str(current_user.id), {"refresh_token": None})

    response = JSONResponse(content={"message": "Logged out successfully"})
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return response