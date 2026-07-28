"""GitHub OAuth login/signup."""

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


@router.post("/github")
async def github_auth(
    payload: dict,  # {"code": "...", "state": "...", "redirect_uri": "..."?}
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Authenticate via GitHub Authorization Code.
    
    Uses the multi-provider auth model:
    - Finds user by email
    - Links GitHub provider to existing account OR creates new user
    - Never creates duplicate accounts
    """
    code = payload.get("code")
    selected_role = payload.get("state") or payload.get("role") or "candidate"
    redirect_uri = payload.get("redirect_uri") or settings.GITHUB_REDIRECT_URI

    if not code:
        raise HTTPException(status_code=400, detail="GitHub authorization code is missing")

    token_url = "https://github.com/login/oauth/access_token"
    headers = {"Accept": "application/json"}
    data = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "client_secret": settings.GITHUB_CLIENT_SECRET,
        "code": code,
        "redirect_uri": redirect_uri,
    }

    async with httpx.AsyncClient() as client:
        try:
            token_response = await client.post(token_url, data=data, headers=headers)
            token_json = token_response.json()

            if token_response.status_code != 200 or "error" in token_json:
                logger.error("GitHub Token Exchange Failed", error=token_json)
                raise HTTPException(status_code=401, detail="Failed to exchange GitHub code")

            github_access_token = token_json.get("access_token")

            user_url = "https://api.github.com/user"
            user_headers = {
                "Authorization": f"token {github_access_token}",
                "Accept": "application/json",
            }

            user_response = await client.get(user_url, headers=user_headers)
            user_info = user_response.json()

            if user_response.status_code != 200:
                logger.error("GitHub Profile Fetch Failed", error=user_info)
                raise HTTPException(status_code=401, detail="Failed to fetch GitHub profile")

            # GitHub emails can be null if private, so explicitly fetch verified emails if needed
            email = user_info.get("email")
            if not email:
                email_url = "https://api.github.com/user/emails"
                email_response = await client.get(email_url, headers=user_headers)
                email_list = email_response.json()
                for email_obj in email_list:
                    if email_obj.get("primary") or email_obj.get("verified"):
                        email = email_obj.get("email")
                        break

        except HTTPException:
            raise
        except Exception as e:
            logger.error("GitHub Authentication Exception", error=str(e))
            raise HTTPException(status_code=500, detail=f"Internal OAuth Error: {str(e)}")

    if not email:
        raise HTTPException(status_code=400, detail="Primary email is required from GitHub account")

    email = email.lower()
    full_name = user_info.get("name") or user_info.get("login")
    profile_pic = user_info.get("avatar_url")
    github_username = user_info.get("login")
    github_id = str(user_info.get("id", ""))

    # Build provider data for linked_accounts.github
    provider_data = build_provider_data(
        provider="github",
        provider_id=github_id,
        email=email,
        picture=profile_pic,
        username=github_username,
    )

    user = await link_or_create_user(
        email=email,
        full_name=full_name,
        provider="github",
        provider_data=provider_data,
        user_repo=user_repo,
        role=selected_role,
        user_updates={"profile_picture": profile_pic} if profile_pic else None,
    )

    # Ensure github_username is set (even for existing users — idempotent)
    if github_username:
        user_data = {"github_username": github_username}
        # Only set if not already set
        if not getattr(user, 'github_username', None):
            await user_repo.update(str(user.id), user_data)

    logger.info("GitHub auth successful", user_id=str(user.id), email=email)
    return await build_and_persist_tokens(user, user_repo)
