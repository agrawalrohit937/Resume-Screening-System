"""
Shared helpers for all auth route modules: response shaping, token/cookie
assembly, and OTP verify+consume. Keeping these here means auth.py,
auth_google.py, auth_linkedin.py, auth_github.py, and auth_otp.py all stay
in sync automatically instead of drifting.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from core.config import settings
from core.security import create_access_token, create_refresh_token
from models.user_model import UserModel, UserRole, UserStatus, AuthProvider
from models.otp_model import OTPPurpose
from repositories.user_repo import UserRepository
from repositories.otp_repo import OTPRepository
from services.otp_service import OTPService
from schemas.user_schema import TokenResponse, UserPublicResponse

COOKIE_SETTINGS = {"httponly": True, "secure": False, "samesite": "lax"}


def user_to_public(user: UserModel) -> UserPublicResponse:
    return UserPublicResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        roles=user.roles or [user.role],
        tenant_id=user.tenant_id,
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
        plan=user.plan,
        subscription_active=user.subscription_active,
        plan_updated_at=user.plan_updated_at,
        # ── NEW multi-provider fields ──────────────────────────────────────
        auth_methods=user.auth_methods or ([user.auth_method] if user.auth_method else []),
        last_login_method=user.last_login_method or user.auth_method,
        linked_accounts=user.linked_accounts or {},
        # ── Primary profile resume fields ──────────────────────────────────
        profile_resume_url=user.profile_resume_url,
        profile_resume_name=user.profile_resume_name,
        has_password=bool(user.hashed_password),
    )


def build_token_response(user: UserModel) -> TokenResponse:
    user_roles = [r.value if hasattr(r, "value") else str(r) for r in (user.roles or [user.role])]
    extra = {
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "roles": user_roles,
        "tenant_id": user.tenant_id,
        "email": user.email,
    }
    access_token = create_access_token(str(user.id), extra_claims=extra)
    refresh_token = create_refresh_token(str(user.id))
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_to_public(user),
    )


def set_auth_cookies(response: JSONResponse, token_data: TokenResponse) -> None:
    response.set_cookie(key="access_token", value=token_data.access_token, **COOKIE_SETTINGS)
    response.set_cookie(key="refresh_token", value=token_data.refresh_token, **COOKIE_SETTINGS)


def set_trusted_device_cookie(response: JSONResponse, device_id_plain: str) -> None:
    response.set_cookie(
        key=settings.TRUSTED_DEVICE_COOKIE_NAME,
        value=device_id_plain,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.TRUSTED_DEVICE_EXPIRE_DAYS * 24 * 3600,
    )


import asyncio
import uuid
from services.token_service import TokenService
from core.security import decode_token

async def build_and_persist_tokens(
    user: UserModel,
    user_repo: UserRepository,
    trusted_device_id_plain: str | None = None,
) -> JSONResponse:
    """Builds tokens, persists the refresh token for rotation, registers with TokenService concurrently,
    and returns a JSONResponse with auth cookies already set."""
    user_roles = [r.value if hasattr(r, "value") else str(r) for r in (user.roles or [user.role])]
    extra = {
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "roles": user_roles,
        "tenant_id": user.tenant_id,
        "email": user.email,
    }
    access_token = create_access_token(str(user.id), extra_claims=extra)
    family_id = str(uuid.uuid4())
    refresh_token = create_refresh_token(str(user.id), family_id=family_id)

    token_data = TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_to_public(user),
    )

    # Persist refresh token to user document and token service concurrently
    await asyncio.gather(
        user_repo.update(str(user.id), {"refresh_token": token_data.refresh_token}),
        TokenService.store_refresh_token(
            raw_token=token_data.refresh_token,
            user_id=str(user.id),
            tenant_id=user.tenant_id or "default",
            family_id=family_id,
            jti="",
        ),
    )

    response = JSONResponse(content=jsonable_encoder(token_data))
    set_auth_cookies(response, token_data)
    if trusted_device_id_plain:
        set_trusted_device_cookie(response, trusted_device_id_plain)
    return response


async def verify_otp_and_consume(
    email: str,
    purpose: OTPPurpose,
    otp_input: str,
    otp_service: OTPService,
    otp_repo: OTPRepository,
) -> None:
    """Verifies the OTP (raises HTTPException on failure) then deletes all
    records for this email+purpose so the code can't be replayed. Used by
    verify-email, verify-login-otp, and verify-reset-otp."""
    await otp_service.verify(email, purpose, otp_input)
    await otp_repo.delete_all_for(email, purpose)


# ── NEW: Multi-provider OAuth helpers ──────────────────────────────────────

def build_provider_data(
    provider: str,
    provider_id: Optional[str] = None,
    email: Optional[str] = None,
    picture: Optional[str] = None,
    username: Optional[str] = None,
    **extra: Any,
) -> Dict[str, Any]:
    """Build a provider data dict for linked_accounts.<provider>.

    Ensures consistent structure across all OAuth providers.
    """
    now = datetime.now(timezone.utc)
    data: Dict[str, Any] = {
        "linked_at": now,
        "last_login": now,
    }
    if provider_id:
        data["provider_id"] = provider_id
    if email:
        data["email"] = email
    if picture:
        data["picture"] = picture
    if username:
        data["username"] = username
    # Merge any extra fields
    data.update(extra)
    return data


def build_new_user_data(
    email: str,
    full_name: str,
    provider: str,
    role: str = "candidate",
    profile_picture: Optional[str] = None,
    **extra: Any,
) -> Dict[str, Any]:
    """Build user_data dict for creating a new user with the new multi-provider schema.

    New users always get:
    - auth_methods = [provider]
    - last_login_method = provider
    - linked_accounts = { provider: {...} }
    - provider enum set appropriately
    - email_verified = True (OAuth providers verify email)
    """
    now = datetime.now(timezone.utc)

    provider_enum_map = {
        "google": AuthProvider.GOOGLE,
        "github": AuthProvider.GITHUB,
        "linkedin": AuthProvider.LINKEDIN,
        "password": AuthProvider.EMAIL,
    }
    provider_enum = provider_enum_map.get(provider, AuthProvider.EMAIL)

    user_data: Dict[str, Any] = {
        "email": email.lower(),
        "full_name": full_name,
        "role": role,
        "status": UserStatus.ACTIVE,
        "provider": provider_enum,
        "email_verified": True,
        "auth_methods": [provider],
        "last_login_method": provider,
        "linked_accounts": {},
        "total_resumes": 0,
        "total_ats_checks": 0,
    }
    # Set deprecated fields for backward compat
    user_data["auth_method"] = provider

    if profile_picture:
        user_data["profile_picture"] = None   # never set profile_picture from OAuth
        # Store it in the provider's linked_accounts
        now_iso = now.isoformat()
        user_data["linked_accounts"][provider] = {
            "picture": profile_picture,
            "linked_at": now_iso,
            "last_login": now_iso,
        }
        # Also keep google_picture for backward compat
        if provider == "google":
            user_data["google_picture"] = profile_picture

    # Apply extra fields (e.g. github_username, linkedin_url)
    user_data.update(extra)

    return user_data


async def link_or_create_user(
    email: str,
    full_name: str,
    provider: str,
    provider_data: Dict[str, Any],
    user_repo: UserRepository,
    role: str = "candidate",
    user_updates: Optional[Dict[str, Any]] = None,
) -> UserModel:
    """Core logic for OAuth login: find by email → link existing OR create new.

    This is the single source of truth for all OAuth flows (Google, GitHub, LinkedIn).

    Args:
        email: User's email (lowercased).
        full_name: Display name from the provider.
        provider: One of "google", "github", "linkedin".
        provider_data: Data to store in linked_accounts.<provider>.
        user_repo: Repository instance.
        role: User role for new users.
        user_updates: Optional fields to set on existing user (e.g. non-None profile_picture).

    Returns:
        The UserModel (existing or newly created).
    """
    # Before linking, check if existing user already has a profile picture
    existing_user = await user_repo.get_by_email(email)
    
    # If user exists and already has a profile_picture set, strip profile_picture from updates
    # so we never overwrite an existing user photo with an OAuth provider picture on subsequent logins
    clean_updates = user_updates.copy() if user_updates else None
    if existing_user and clean_updates and existing_user.profile_picture:
        clean_updates.pop("profile_picture", None)
        clean_updates.pop("profile_picture_public_id", None)

    # STEP 1: Try to link existing user atomically
    existing = await user_repo.find_by_email_and_update_linked(
        email=email,
        provider=provider,
        provider_data=provider_data,
        user_data=clean_updates,
    )

    if existing:
        return existing

    # STEP 2: No existing user — create a new one
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # Build linked_accounts entry
    linked_accounts_entry = {
        **provider_data,
        "linked_at": now_iso,
        "last_login": now_iso,
    }

    provider_enum_rev = {
        "google": AuthProvider.GOOGLE,
        "github": AuthProvider.GITHUB,
        "linkedin": AuthProvider.LINKEDIN,
        "password": AuthProvider.EMAIL,
    }

    picture = provider_data.get("picture")

    r_val = str(role).lower() if role else "candidate"
    if r_val in ("employer", "recruiter", "executive", "exec"):
        roles_list = [UserRole.EXECUTIVE.value]
        primary_role = UserRole.EXECUTIVE.value
    elif r_val:
        roles_list = [r_val]
        primary_role = r_val
    else:
        roles_list = [UserRole.CANDIDATE.value]
        primary_role = UserRole.CANDIDATE.value

    resolved_tenant = "default"
    if any(r in ("executive", "exec", "employer", "recruiter", "hiring_manager") for r in roles_list) and "@" in email:
        domain = email.split("@")[1].split(".")[0].lower()
        common = {"gmail", "yahoo", "hotmail", "outlook", "icloud", "proton", "mail", "aol"}
        if domain not in common:
            resolved_tenant = domain

    user_data: Dict[str, Any] = {
        "email": email.lower(),
        "full_name": full_name,
        "role": primary_role,
        "roles": roles_list,
        "tenant_id": resolved_tenant,
        "status": UserStatus.ACTIVE,
        "provider": provider_enum_rev.get(provider, AuthProvider.EMAIL),
        "email_verified": True,
        "auth_methods": [provider],
        "last_login_method": provider,
        "linked_accounts": {provider: linked_accounts_entry},
        "auth_method": provider,         # DEPRECATED — backward compat
        "profile_picture": picture,      # ✅ Auto-set provider picture as default profile picture
        "total_resumes": 0,
        "total_ats_checks": 0,
    }

    # Store picture for backward compat
    if provider == "google" and picture:
        user_data["google_picture"] = picture

    # Apply any additional user fields from the provider
    if provider == "github":
        username = provider_data.get("username")
        if username:
            user_data["github_username"] = username
    elif provider == "linkedin":
        li_url = provider_data.get("url")
        if li_url:
            user_data["linkedin_url"] = li_url

    user = await user_repo.create(user_data)
    return user
