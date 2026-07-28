"""
Gmail OAuth — Server-side Authorization Code Flow endpoints.

Two endpoints implement the industry-standard "offline access" pattern:

  GET /auth/gmail/authorize
    → Builds the Google consent URL with access_type=offline and prompt=consent,
      then returns it to the frontend so it can redirect the user.
      The user sees Google's consent screen exactly ONCE ever.

  POST /auth/gmail/callback
    → Called by the frontend's /gmail-callback page after Google redirects back
      with an authorization code. Exchanges the code for access + refresh tokens,
      then saves both to MongoDB against the authenticated user.

After this flow completes, every Gmail send is fully automatic:
the GmailTokenService silently refreshes the access token as needed.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from api.deps import get_current_user, get_user_repo
from core.config import settings
from models.user_model import UserModel
from repositories.user_repo import UserRepository

logger = structlog.get_logger(__name__)
router = APIRouter()

# Gmail send-only scope — least privilege principle
GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "openid",
    "email",
]

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


# ─── Schema ──────────────────────────────────────────────────────────────────

class GmailCallbackPayload(BaseModel):
    code: str         # The authorization code from Google
    state: Optional[str] = None  # CSRF state token (validated by frontend)


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/gmail/authorize")
async def get_gmail_authorize_url(
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Return the Google OAuth consent URL for the Gmail send scope.

    The frontend should open this URL (redirect or new tab). Google will
    redirect back to GOOGLE_GMAIL_REDIRECT_URI after the user consents.

    Requires access_type=offline and prompt=consent to guarantee a
    refresh_token is issued — even if the user has previously consented.
    """
    if not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "GOOGLE_CLIENT_SECRET is not set. "
                "Add it to your .env file (from Google Cloud Console)."
            ),
        )

    # Check if already connected — skip the consent screen
    tokens = await user_repo.get_gmail_tokens(str(current_user.id))
    already_connected = bool(tokens and tokens.get("refresh_token"))

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_GMAIL_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(GMAIL_SCOPES),
        # CRITICAL: access_type=offline is what makes Google issue a refresh_token
        "access_type": "offline",
        # CRITICAL: prompt=consent forces the refresh_token to be re-issued
        # even if the user has previously authorized this app.
        # Without this, repeat logins WON'T get a new refresh_token.
        "prompt": "consent",
        # Embed the user_id in state so the callback can associate the code
        # with the right user without relying on session state.
        "state": str(current_user.id),
    }

    authorize_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    logger.info(
        "Gmail OAuth authorize URL generated",
        user_id=str(current_user.id),
        already_connected=already_connected,
    )

    return {
        "authorize_url": authorize_url,
        "already_connected": already_connected,
    }


@router.post("/gmail/callback")
async def handle_gmail_callback(
    payload: GmailCallbackPayload,
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Exchange the authorization code returned by Google for access + refresh tokens.

    Called by the frontend's /gmail-callback page, which reads `code` from the
    URL query parameters and POSTs it here. The backend exchanges it for tokens
    using the client secret (never exposed to the browser) and saves them to DB.
    """
    if not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GOOGLE_CLIENT_SECRET is not configured on the server.",
        )

    logger.info("Gmail OAuth callback received", user_id=str(current_user.id))

    # Exchange authorization code for tokens
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": payload.code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": settings.GOOGLE_GMAIL_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )
        except httpx.RequestError as exc:
            logger.error("Gmail code exchange network error", error=str(exc))
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not reach Google's token endpoint. Please try again.",
            )

    if response.status_code != 200:
        body = response.json()
        logger.error(
            "Gmail code exchange failed",
            user_id=str(current_user.id),
            status_code=response.status_code,
            error=body.get("error"),
            description=body.get("error_description"),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google token exchange failed: {body.get('error_description', 'Unknown error')}",
        )

    token_data = response.json()
    access_token: str = token_data.get("access_token", "")
    refresh_token: str = token_data.get("refresh_token", "")
    expires_in: int = token_data.get("expires_in", 3600)
    expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    if not refresh_token:
        # This can happen if prompt=consent was omitted or the user already
        # authorized and Google silently returned only an access_token.
        logger.warning(
            "Gmail code exchange returned no refresh_token — "
            "this usually means prompt=consent was not set or was bypassed.",
            user_id=str(current_user.id),
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Google did not return a refresh token. "
                "Please revoke app access in your Google Account settings and try again."
            ),
        )

    # Persist both tokens securely in MongoDB
    await user_repo.save_gmail_tokens(
        user_id=str(current_user.id),
        access_token=access_token,
        refresh_token=refresh_token,
        expiry=expiry,
    )

    logger.info(
        "Gmail OAuth tokens saved successfully",
        user_id=str(current_user.id),
        expires_at=expiry.isoformat(),
    )

    return {
        "success": True,
        "message": "Gmail connected successfully. Future email sends will be fully automatic.",
        "expires_at": expiry.isoformat(),
    }


@router.get("/gmail/status")
async def get_gmail_connection_status(
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Return whether the current user has a connected Gmail account.

    Used by the frontend to show/hide the 'Connect Gmail' CTA.
    """
    tokens = await user_repo.get_gmail_tokens(str(current_user.id))
    is_connected = bool(tokens and tokens.get("refresh_token"))
    return {"is_connected": is_connected}


@router.delete("/gmail/disconnect")
async def disconnect_gmail(
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Revoke and clear the user's stored Gmail tokens.

    After this, the user will need to re-authorize to send applications via Gmail.
    """
    # Revoke the token with Google first (best-effort)
    tokens = await user_repo.get_gmail_tokens(str(current_user.id))
    if tokens and tokens.get("refresh_token"):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    "https://oauth2.googleapis.com/revoke",
                    params={"token": tokens["refresh_token"]},
                )
        except Exception:
            pass  # Revocation failure is non-fatal; we still clear from DB

    # Clear tokens from DB
    await user_repo.update(
        str(current_user.id),
        {
            "gmail_access_token": None,
            "gmail_refresh_token": None,
            "gmail_token_expiry": None,
        },
    )

    logger.info("Gmail disconnected", user_id=str(current_user.id))
    return {"success": True, "message": "Gmail account disconnected."}



