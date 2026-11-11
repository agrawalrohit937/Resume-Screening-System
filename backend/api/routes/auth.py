"""
Auth Routes — composition root.

Core session/profile endpoints (refresh, me, change-password, deactivate,
logout) live directly here. Signup/OTP/login and each OAuth provider are
split into their own modules and mounted below, so this file stays a thin
router rather than a monolith covering every auth concern.
"""

import structlog

from typing import Any, Optional
import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from api.deps import get_current_user, get_optional_current_user, get_user_repo
from api.routes import auth_otp, auth_google, auth_linkedin, auth_github
from api.routes.auth_helpers import user_to_public, set_auth_cookies
from core.config import settings
from core.security import decode_token, verify_password_async, hash_password_async
from repositories.user_repo import UserRepository
from schemas.user_schema import (
    UserModel, UserStatus,
    RefreshTokenRequest, TokenResponse, UserPublicResponse,
    MessageResponse, ChangePasswordRequest, UpdateProfileRequest,
)
from services.token_service import TokenService

logger = structlog.get_logger(__name__)
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
):
    """Deactivate (soft delete) current user's account and cascade tenant if owner."""
    user_roles = [r.lower() for r in (getattr(current_user, "roles", []) or [getattr(current_user, "role", "")])]
    is_owner = any(r in ("executive", "exec", "employer", "admin", "platform_admin") for r in user_roles)
    tenant_id = getattr(current_user, "tenant_id", None)

    if is_owner and tenant_id and tenant_id != "default":
        from config.db import get_pg_session_factory
        from sqlalchemy import select, and_
        from models.tables import User
        async with get_pg_session_factory()() as session:
            stmt = select(User).where(
                and_(
                    User.id != str(current_user.id),
                    User.tenant_id == tenant_id,
                    User.status != "deleted",
                )
            )
            res = await session.execute(stmt)
            other_users = res.scalars().all()
            has_other_exec = any(
                any(r in ("executive", "exec", "admin", "platform_admin") for r in (u.roles or [u.role]))
                for u in other_users
            )
            if not has_other_exec:
                from services.multi_tenancy.tenant_cleanup import cascade_delete_tenant
                await cascade_delete_tenant(None, tenant_id=tenant_id, deleted_by_user_id=str(current_user.id))

    await user_repo.update(str(current_user.id), {"status": UserStatus.INACTIVE})
    await TokenService.revoke_all_user_tokens(str(current_user.id), reason="account_deactivation")
    return MessageResponse(message="Account deactivated successfully.")


@router.post("/logout")
async def logout(
    request: Request,
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    token = None
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    elif request.cookies.get("access_token"):
        token = request.cookies.get("access_token")

    if token:
        try:
            payload = decode_token(token)
            if payload and payload.get("jti"):
                await TokenService.revoke_jti(payload["jti"], reason="user_logout")
        except Exception as e:
            logger.warning("Failed to revoke access token JTI on logout", error=str(e))

    if current_user:
        try:
            await user_repo.update(str(current_user.id), {"refresh_token": None})
            await TokenService.revoke_all_user_tokens(str(current_user.id), reason="user_logout")
        except Exception as e:
            logger.warning("Failed to revoke user refresh tokens on logout", error=str(e))

    response = JSONResponse(content={"message": "Logged out successfully"})
    for key in ("access_token", "refresh_token", settings.TRUSTED_DEVICE_COOKIE_NAME):
        response.delete_cookie(key=key, path="/", httponly=True, samesite="lax")
        response.delete_cookie(key=key, path="/")
    return response