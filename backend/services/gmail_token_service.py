"""
Gmail Token Service — Silent token refresh for the Google Gmail API.

This service is the heart of the "offline access" OAuth pattern:
- Loads the user's stored Google OAuth refresh_token from MongoDB.
- Checks if the current access_token is expired (with a 5-minute safety buffer).
- If expired, silently calls Google's token endpoint to get a new access_token.
- Saves the refreshed token back to MongoDB.
- Returns a fully-initialised google.oauth2.credentials.Credentials object
  ready for use with the Gmail API client — no user interaction required.

The user only sees Google's consent screen once (during the initial connection).
All subsequent sends are completely silent and automatic.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
import structlog
from fastapi import HTTPException, status
from google.oauth2.credentials import Credentials

from core.config import settings
from repositories.user_repo import UserRepository

logger = structlog.get_logger(__name__)

# Google's token exchange endpoint
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

# Refresh access token this many minutes before it actually expires,
# to avoid edge-case failures on slow networks or clock skew.
EXPIRY_BUFFER_MINUTES = 5


class GmailTokenService:
    """Provides auto-refreshing Google OAuth credentials for the Gmail API."""

    def __init__(self, user_repo: UserRepository) -> None:
        self._user_repo = user_repo

    def _is_token_expired(self, expiry: Optional[datetime]) -> bool:
        """Return True if the access token is expired or about to expire."""
        if expiry is None:
            # No expiry stored → treat as expired to force a refresh
            return True
        # Normalise to UTC regardless of whether expiry has tzinfo
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        threshold = datetime.now(timezone.utc) + timedelta(minutes=EXPIRY_BUFFER_MINUTES)
        return expiry <= threshold

    async def _refresh_access_token(self, refresh_token: str, user_id: str) -> str:
        """Exchange the stored refresh_token for a new access_token via Google's endpoint.

        Updates the DB with the new access_token + expiry and returns it.
        Raises HTTPException(503) if Google's token endpoint is unreachable.
        Raises HTTPException(401) if Google rejects the refresh_token (revoked).
        """
        if not settings.GOOGLE_CLIENT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "GOOGLE_CLIENT_SECRET is not configured on the server. "
                    "Add it to your .env file to enable silent Gmail token refresh."
                ),
            )

        logger.info("Refreshing Gmail access token", user_id=user_id)

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.post(
                    GOOGLE_TOKEN_URL,
                    data={
                        "grant_type": "refresh_token",
                        "client_id": settings.GOOGLE_CLIENT_ID,
                        "client_secret": settings.GOOGLE_CLIENT_SECRET,
                        "refresh_token": refresh_token,
                    },
                )
            except httpx.RequestError as exc:
                logger.error("Google token refresh network error", user_id=user_id, error=str(exc))
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Could not reach Google's token endpoint. Please try again.",
                )

        if response.status_code == 400:
            # Typically means the refresh_token was revoked or expired by the user.
            body = response.json()
            logger.warning(
                "Gmail refresh token rejected by Google",
                user_id=user_id,
                error=body.get("error"),
                description=body.get("error_description"),
            )
            # Clear stored tokens so the frontend prompts re-authorization
            await self._user_repo.save_gmail_tokens(
                user_id=user_id,
                access_token="",
                refresh_token="",
                expiry=datetime.now(timezone.utc),
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    "Your Gmail authorization has been revoked. "
                    "Please reconnect your Gmail account from the Apply Assistant page."
                ),
            )

        if response.status_code != 200:
            logger.error(
                "Unexpected error from Google token endpoint",
                user_id=user_id,
                status_code=response.status_code,
                body=response.text,
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to refresh Gmail access token. Please try again.",
            )

        token_data = response.json()
        new_access_token: str = token_data["access_token"]
        # Google returns expires_in in seconds from now
        expires_in_seconds: int = token_data.get("expires_in", 3600)
        new_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds)

        # Persist the new access_token and its expiry — refresh_token stays unchanged
        await self._user_repo.update_gmail_access_token(
            user_id=user_id,
            access_token=new_access_token,
            expiry=new_expiry,
        )

        logger.info(
            "Gmail access token refreshed successfully",
            user_id=user_id,
            expires_at=new_expiry.isoformat(),
        )
        return new_access_token

    async def get_valid_credentials(self, user_id: str) -> Credentials:
        """Return a valid, ready-to-use google.oauth2.credentials.Credentials object
        for the given user.

        Flow:
        1. Load tokens from DB.
        2. If no refresh_token → raise 428 (user must connect Gmail first).
        3. If access_token is expired → silently refresh via Google's endpoint.
        4. Return Credentials(token=...) with client_id/secret for further auto-refresh.

        This is the single entry point for all Gmail API calls.
        """
        tokens = await self._user_repo.get_gmail_tokens(user_id)

        if not tokens or not tokens.get("refresh_token"):
            raise HTTPException(
                status_code=status.HTTP_428_PRECONDITION_REQUIRED,
                detail=(
                    "Gmail not connected. Please click 'Connect Gmail' on the "
                    "Apply Assistant page to authorize once."
                ),
            )

        refresh_token: str = tokens["refresh_token"]
        access_token: Optional[str] = tokens.get("access_token")
        expiry: Optional[datetime] = tokens.get("expiry")

        # Auto-refresh if needed
        if self._is_token_expired(expiry) or not access_token:
            access_token = await self._refresh_access_token(
                refresh_token=refresh_token,
                user_id=user_id,
            )

        # Build a Credentials object. Providing client_id/secret/refresh_token
        # allows the google-api-python-client to auto-refresh internally as well.
        creds = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri=GOOGLE_TOKEN_URL,
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
        )
        return creds

    async def is_gmail_connected(self, user_id: str) -> bool:
        """Check whether this user has a stored Gmail refresh token (i.e. has consented)."""
        tokens = await self._user_repo.get_gmail_tokens(user_id)
        return bool(tokens and tokens.get("refresh_token"))
