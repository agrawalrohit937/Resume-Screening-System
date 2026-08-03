"""LinkedIn OAuth login/signup (OpenID Connect)."""

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException

from api.deps import get_user_repo
from core.config import settings
from repositories.user_repo import UserRepository
from api.routes.auth_helpers import (
    build_and_persist_tokens,
    build_provider_data,
    link_or_create_user,
)

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post("/linkedin")
async def linkedin_auth(
    payload: dict,  # {"code": "...", "role": "..."}
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Authenticate via LinkedIn Authorization Code (OpenID Connect).
    
    Uses the multi-provider auth model:
    - Finds user by email
    - Links LinkedIn provider to existing account OR creates new user
    - Never creates duplicate accounts
    """
    code = payload.get("code")
    selected_role = payload.get("state") or payload.get("role") or "candidate"
    redirect_uri = payload.get("redirect_uri") or settings.LINKEDIN_REDIRECT_URI

    if not code:
        raise HTTPException(status_code=400, detail="LinkedIn authorization code is missing")

    token_url = "https://www.linkedin.com/oauth/v2/accessToken"
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": settings.LINKEDIN_CLIENT_ID,
        "client_secret": settings.LINKEDIN_CLIENT_SECRET,
        "redirect_uri": redirect_uri,
    }

    async with httpx.AsyncClient() as client:
        try:
            token_response = await client.post(token_url, data=data)
            token_json = token_response.json()

            if token_response.status_code != 200:
                logger.error("LinkedIn Token Exchange Failed", error=token_json)
                raise HTTPException(status_code=401, detail="Failed to exchange LinkedIn code")

            linkedin_access_token = token_json.get("access_token")

            userinfo_url = "https://api.linkedin.com/v2/userinfo"
            headers = {"Authorization": f"Bearer {linkedin_access_token}"}

            userinfo_response = await client.get(userinfo_url, headers=headers)
            user_info = userinfo_response.json()

            if userinfo_response.status_code != 200:
                logger.error("LinkedIn Profile Fetch Failed", error=user_info)
                raise HTTPException(status_code=401, detail="Failed to fetch LinkedIn profile")

        except HTTPException:
            raise
        except Exception as e:
            logger.error("LinkedIn Authentication Exception", error=str(e))
            raise HTTPException(status_code=500, detail=f"Internal OAuth Error: {str(e)}")

    email = user_info.get("email", "").lower() if user_info.get("email") else ""
    full_name = user_info.get("name", "")
    profile_pic = user_info.get("picture")
    linkedin_sub = user_info.get("sub", "")

    if not email:
        raise HTTPException(status_code=400, detail="Email permission is required from LinkedIn")

    # Build provider data for linked_accounts.linkedin
    provider_data = build_provider_data(
        provider="linkedin",
        provider_id=linkedin_sub,
        email=email,
        picture=profile_pic,
    )

    user = await link_or_create_user(
        email=email,
        full_name=full_name,
        provider="linkedin",
        provider_data=provider_data,
        user_repo=user_repo,
        role=selected_role,
        user_updates={"profile_picture": profile_pic} if profile_pic else None,
    )

    logger.info("LinkedIn auth successful", user_id=str(user.id), email=email)
    return await build_and_persist_tokens(user, user_repo)
