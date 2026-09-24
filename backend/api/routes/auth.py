"""
Auth Routes — composition root.

Core session/profile endpoints (refresh, me, change-password, deactivate,
logout) live directly here. Signup/OTP/login and each OAuth provider are
split into their own modules and mounted below, so this file stays a thin
router rather than a monolith covering every auth concern.
"""

import structlog

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from api.deps import get_current_user, get_user_repo, get_database

logger = structlog.get_logger(__name__)
from core.config import settings
from core.security import decode_token, verify_password, verify_password_async, verify_token_type, hash_password, hash_password_async
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


from services.token_service import TokenService

# ─── POST /auth/refresh ───────────────────────────────────────────────────────
@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    payload: RefreshTokenRequest,
    user_repo: UserRepository = Depends(get_user_repo),
):
    try:
        new_access_token, new_refresh_token, extra_claims = await TokenService.rotate_refresh_token(
            payload.refresh_token
        )
    except ValueError as e:
        logger.warning("Refresh token rotation failed", error=str(e))
        raise HTTPException(status_code=401, detail=str(e))

    token_data_raw = decode_token(new_access_token) or {}
    user_id = token_data_raw.get("sub")
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User associated with token no longer exists")

    await user_repo.update(str(user.id), {"refresh_token": new_refresh_token})

    token_resp = TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_to_public(user),
    )
    response = JSONResponse(content=jsonable_encoder(token_resp))
    set_auth_cookies(response, token_resp)
    return response


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
    if not current_user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account is connected via social login (Google/GitHub/LinkedIn) and does not use a direct password.",
        )

    if not (await verify_password_async(payload.current_password, current_user.hashed_password)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from your current password.",
        )

    new_hash = await hash_password_async(payload.new_password)
    await user_repo.update(str(current_user.id), {"hashed_password": new_hash})
    await TokenService.revoke_all_user_tokens(str(current_user.id), reason="password_change")
    logger.info("Password changed successfully", user_id=str(current_user.id))
    return MessageResponse(message="Password changed successfully.")


# ─── DELETE /auth/me ──────────────────────────────────────────────────────────
@router.delete("/me", response_model=MessageResponse)
async def deactivate_account(
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
    db: Any = Depends(get_database),
):
    """Deactivate (soft delete) current user's account and cascade tenant if owner."""
    user_roles = [r.lower() for r in (getattr(current_user, "roles", []) or [getattr(current_user, "role", "")])]
    is_owner = any(r in ("executive", "exec", "employer", "admin", "platform_admin") for r in user_roles)
    tenant_id = getattr(current_user, "tenant_id", None)

    if is_owner and tenant_id and tenant_id != "default":
        from bson import ObjectId
        other_exec = await db.users.find_one({
            "_id": {"$ne": ObjectId(current_user.id)},
            "tenant_id": tenant_id,
            "status": {"$ne": "deleted"},
            "roles": {"$in": ["executive", "exec", "admin", "platform_admin"]},
        })
        if not other_exec:
            from services.multi_tenancy.tenant_cleanup import cascade_delete_tenant
            await cascade_delete_tenant(db, tenant_id=tenant_id, deleted_by_user_id=str(current_user.id))

    await user_repo.update(str(current_user.id), {"status": UserStatus.INACTIVE})
    await TokenService.revoke_all_user_tokens(str(current_user.id), reason="account_deactivation")
    return MessageResponse(message="Account deactivated successfully.")


@router.post("/logout")
async def logout(
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    await user_repo.update(str(current_user.id), {"refresh_token": None})
    await TokenService.revoke_all_user_tokens(str(current_user.id), reason="user_logout")

    response = JSONResponse(content={"message": "Logged out successfully"})
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return response