"""Google OAuth login/signup."""

from fastapi import APIRouter, Depends, HTTPException
import structlog
import httpx

from api.deps import get_user_repo
from repositories.user_repo import UserRepository
from api.routes.auth_helpers import (
    build_and_persist_tokens,
    build_provider_data,
    link_or_create_user,
)

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post("/google")
async def google_auth(
    payload: dict,  # {"token": "...", "role": "..."}
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Authenticate via Google Access Token.
    
    Uses the multi-provider auth model:
    - Finds user by email
    - Links Google provider to existing account OR creates new user
    - Never creates duplicate accounts
    - Never overwrites custom uploaded profile_picture
    """
    google_token = payload.get("token")
    selected_role = payload.get("role", "candidate")

    if not google_token:
        raise HTTPException(status_code=400, detail="Google token is missing")

    # 1. Fetch user info from Google using the access token
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {google_token}"}
        )

    # 2. Check if the token was valid
    if response.status_code != 200:
        logger.error("Google token verification failed", status_code=response.status_code, text=response.text)
        raise HTTPException(status_code=401, detail="Invalid Google Access Token")

    idinfo = response.json()

    # 3. Extract the user data
    email = idinfo.get("email", "").lower()
    full_name = idinfo.get("name", "")
    profile_pic = idinfo.get("picture")
    google_sub = idinfo.get("sub")
    
    if not email:
        raise HTTPException(status_code=400, detail="Google account does not have an email address associated with it")

    # Build provider data for linked_accounts.google
    provider_data = build_provider_data(
        provider="google",
        provider_id=google_sub,
        email=email,
        picture=profile_pic,
    )

    # Build user_updates — auto-set profile_picture from provider if user hasn't uploaded custom pic
    user_updates = {}
    if profile_pic:
        user_updates["google_picture"] = profile_pic          # DEPRECATED backward compat
        user_updates["profile_picture"] = profile_pic         # ✅ Auto-set as default profile picture

    user = await link_or_create_user(
        email=email,
        full_name=full_name,
        provider="google",
        provider_data=provider_data,
        user_repo=user_repo,
        role=selected_role,
        user_updates=user_updates if user_updates else None,
    )

    logger.info("Google auth successful", user_id=str(user.id), email=email)
    return await build_and_persist_tokens(user, user_repo)