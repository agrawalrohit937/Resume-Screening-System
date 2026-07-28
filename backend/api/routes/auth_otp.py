"""
Signup + OTP verification + login (with trusted-device challenge) +
forgot/reset password. Grouped together because they all share the
OTPService/OTPRepository dependency and the challenge-token pattern.
"""

from datetime import datetime, timedelta, timezone

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse

from api.deps import get_user_repo, get_otp_service, get_otp_repo
from core.config import settings
from core.security import (
    decode_token,
    verify_password,
    hash_password,
    generate_device_id,
    hash_device_id,
    verify_device_id,
    generate_challenge_token,
)
from models.user_model import UserModel, UserStatus, AuthProvider, TrustedDevice
from models.otp_model import OTPPurpose
from repositories.user_repo import UserRepository
from repositories.otp_repo import OTPRepository
from services.otp_service import OTPService
from schemas.user_schema import SignupRequest, LoginRequest
from schemas.otp_schema import (
    VerifyEmailRequest, ResendOtpRequest, ForgotPasswordRequest,
    VerifyResetOtpRequest, ResetPasswordRequest, VerifyLoginOtpRequest,
    LoginChallengeResponse, OtpMessageResponse,
)
from schemas.user_schema import MessageResponse
from api.routes.auth_helpers import build_and_persist_tokens, verify_otp_and_consume

logger = structlog.get_logger(__name__)
router = APIRouter()


# ─── POST /auth/signup ────────────────────────────────────────────────────────
@router.post("/signup", status_code=status.HTTP_201_CREATED, response_model=OtpMessageResponse)
async def signup(
    payload: SignupRequest,
    user_repo: UserRepository = Depends(get_user_repo),
    otp_service: OTPService = Depends(get_otp_service),
):
    """
    Register a new account — DOES NOT activate it or issue tokens yet (FEATURE 1).
    Creates the user as PENDING_VERIFICATION, emails a 6-digit OTP, and expects the
    frontend to call POST /auth/verify-email next.

    NOTE — contract change from the old signup endpoint: this used to return
    TokenResponse (tokens + user) immediately. It now returns {success, message, email}
    and the frontend must navigate to /verify-email.
    """
    email = payload.email.lower()

    existing = await user_repo.get_by_email(email)
    if existing and existing.email_verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    if existing and not existing.email_verified:
        # Re-signup attempt with an unverified account — refresh password & resend OTP
        await user_repo.update(str(existing.id), {
            "hashed_password": hash_password(payload.password),
            "full_name": payload.full_name,
            "role": payload.role,
            "phone": payload.phone,
            "linkedin_url": payload.linkedin_url,
            "github_username": payload.github_username,
        })
        await otp_service.issue(email, payload.full_name, OTPPurpose.SIGNUP_VERIFICATION)
        return OtpMessageResponse(message="Verification code sent to your email.", email=email)

    now = datetime.now(timezone.utc)
    user_data = {
        "email": email,
        "hashed_password": hash_password(payload.password),
        "full_name": payload.full_name,
        "role": payload.role,
        "phone": payload.phone,
        "linkedin_url": payload.linkedin_url,
        "github_username": payload.github_username,
        "status": UserStatus.PENDING_VERIFICATION,
        "provider": AuthProvider.EMAIL,
        "email_verified": False,
        "auth_methods": ["password"],                        # NEW: multi-provider
        "last_login_method": "password",                     # NEW
        "linked_accounts": {                                 # NEW
            "password": {
                "linked_at": now,
                "last_login": now,
            }
        },
        "auth_method": "password",                           # DEPRECATED — backward compat
        "total_resumes": 0,
        "total_ats_checks": 0,
    }

    user = await user_repo.create(user_data)
    logger.info("New user pending verification", user_id=str(user.id), email=user.email)

    await otp_service.issue(email, payload.full_name, OTPPurpose.SIGNUP_VERIFICATION)

    return OtpMessageResponse(message="Verification code sent to your email.", email=email)


# ─── POST /auth/verify-email ──────────────────────────────────────────────────
@router.post("/verify-email")
async def verify_email(
    payload: VerifyEmailRequest,
    user_repo: UserRepository = Depends(get_user_repo),
    otp_service: OTPService = Depends(get_otp_service),
    otp_repo: OTPRepository = Depends(get_otp_repo),
):
    """Verifies signup OTP, activates the account, deletes the OTP, and logs the user in."""
    email = payload.email.lower()
    user = await user_repo.get_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")

    await verify_otp_and_consume(email, OTPPurpose.SIGNUP_VERIFICATION, payload.otp, otp_service, otp_repo)

    user = await user_repo.update(str(user.id), {
        "email_verified": True,
        "status": UserStatus.ACTIVE,
    })

    return await build_and_persist_tokens(user, user_repo)


# ─── POST /auth/resend-otp ─────────────────────────────────────────────────────
@router.post("/resend-otp", response_model=OtpMessageResponse)
async def resend_otp(
    payload: ResendOtpRequest,
    user_repo: UserRepository = Depends(get_user_repo),
    otp_service: OTPService = Depends(get_otp_service),
):
    """Resend an OTP for signup verification, login verification, or password reset."""
    email = payload.email.lower()
    try:
        purpose = OTPPurpose(payload.purpose)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid OTP purpose.")

    user = await user_repo.get_by_email(email)
    if not user:
        # Don't leak whether the email exists for password_reset; for signup it's fine either way
        return OtpMessageResponse(message="If an account exists, a new code has been sent.", email=email)

    await otp_service.issue(email, user.full_name, purpose, is_resend=True)
    return OtpMessageResponse(message="A new code has been sent to your email.", email=email)


# ─── POST /auth/login ─────────────────────────────────────────────────────────
@router.post("/login")
async def login(
    request: Request,
    payload: LoginRequest,
    background_tasks: BackgroundTasks,
    user_repo: UserRepository = Depends(get_user_repo),
    otp_service: OTPService = Depends(get_otp_service),
):
    """
    Authenticate user and return JWT tokens.
    FEATURE 4 — if this browser/device hasn't been trusted before, an email OTP
    challenge is issued instead of tokens (requires_otp: true + challenge_token).
    Complete the login via POST /auth/verify-login-otp.
    """
    user = await user_repo.get_by_email(payload.email.lower())
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if user.status == UserStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account suspended. Contact support.",
        )

    if user.status == UserStatus.PENDING_VERIFICATION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in.",
        )

    # ── Secure login / trusted device check (FEATURE 4) ────────────────────
    if settings.REQUIRE_OTP_FOR_NEW_DEVICE:
        device_cookie = request.cookies.get(settings.TRUSTED_DEVICE_COOKIE_NAME)
        trusted = False
        matched_hash = None
        if device_cookie:
            for d in user.trusted_devices:
                if verify_device_id(device_cookie, d.device_hash):
                    trusted = True
                    matched_hash = d.device_hash
                    break
                # verify_device_id can't reverse a hash to compare directly if we hashed a
                # random per-login salt; since we hash the raw cookie value itself here it's
                # a straight bcrypt/argon2 verify, so this loop is correct and O(devices).

        if trusted:
            await user_repo.touch_trusted_device(str(user.id), matched_hash)
        else:
            # Untrusted device — issue login OTP challenge instead of tokens
            await otp_service.issue(user.email, user.full_name, OTPPurpose.LOGIN_VERIFICATION)
            challenge_token = generate_challenge_token(
                subject=str(user.id),
                purpose="login_verification",
                expires_minutes=settings.LOGIN_CHALLENGE_EXPIRE_MINUTES,
            )
            return LoginChallengeResponse(challenge_token=challenge_token)

    background_tasks.add_task(user_repo.update_last_login, str(user.id))
    # Track last_login_method for password login
    background_tasks.add_task(user_repo.update_last_login_method, str(user.id), "password")
    # Ensure "password" is in auth_methods
    background_tasks.add_task(user_repo.add_auth_method, str(user.id), "password")
    logger.info("User logged in", user_id=str(user.id), email=user.email)

    return await build_and_persist_tokens(user, user_repo)


# ─── POST /auth/verify-login-otp ──────────────────────────────────────────────
@router.post("/verify-login-otp")
async def verify_login_otp(
    request: Request,
    payload: VerifyLoginOtpRequest,
    background_tasks: BackgroundTasks,
    user_repo: UserRepository = Depends(get_user_repo),
    otp_service: OTPService = Depends(get_otp_service),
    otp_repo: OTPRepository = Depends(get_otp_repo),
):
    """Completes a challenged login: verifies the OTP, trusts this device, and issues tokens."""
    challenge = decode_token(payload.challenge_token)
    if not challenge or challenge.get("type") != "challenge" or challenge.get("purpose") != "login_verification":
        raise HTTPException(status_code=401, detail="Invalid or expired login challenge. Please log in again.")

    user_id = challenge.get("sub")
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    await verify_otp_and_consume(user.email, OTPPurpose.LOGIN_VERIFICATION, payload.otp, otp_service, otp_repo)

    # Trust this device going forward
    device_id_plain = generate_device_id()
    device_doc = TrustedDevice(
        device_hash=hash_device_id(device_id_plain),
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.TRUSTED_DEVICE_EXPIRE_DAYS),
    ).model_dump()
    await user_repo.add_trusted_device(str(user.id), device_doc)
    await user_repo.prune_expired_devices(str(user.id))

    background_tasks.add_task(user_repo.update_last_login, str(user.id))

    return await build_and_persist_tokens(user, user_repo, trusted_device_id_plain=device_id_plain)


# ─── POST /auth/forgot-password ───────────────────────────────────────────────
@router.post("/forgot-password", response_model=OtpMessageResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    user_repo: UserRepository = Depends(get_user_repo),
    otp_service: OTPService = Depends(get_otp_service),
):
    """Sends a password-reset OTP. Always returns success to avoid leaking account existence."""
    email = payload.email.lower()
    user = await user_repo.get_by_email(email)
    if user:
        await otp_service.issue(email, user.full_name, OTPPurpose.PASSWORD_RESET)
    return OtpMessageResponse(message="If an account exists for this email, a reset code has been sent.", email=email)


# ─── POST /auth/verify-reset-otp ──────────────────────────────────────────────
@router.post("/verify-reset-otp")
async def verify_reset_otp(
    payload: VerifyResetOtpRequest,
    user_repo: UserRepository = Depends(get_user_repo),
    otp_service: OTPService = Depends(get_otp_service),
):
    """Verifies the reset OTP and returns a short-lived reset_token for POST /auth/reset-password."""
    email = payload.email.lower()
    user = await user_repo.get_by_email(email)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid code or email.")

    # NOTE: verify() marks the OTP consumed (prevents replay of the *same* code) but we
    # deliberately do NOT delete_all_for here — the reset_token below is the single-use
    # artifact for the reset step, kept separate from OTP verification via auth_helpers.
    await otp_service.verify(email, OTPPurpose.PASSWORD_RESET, payload.otp)

    reset_token = generate_challenge_token(subject=email, purpose="password_reset", expires_minutes=10)
    return {"success": True, "message": "Code verified.", "reset_token": reset_token}


# ─── POST /auth/reset-password ────────────────────────────────────────────────
@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    payload: ResetPasswordRequest,
    user_repo: UserRepository = Depends(get_user_repo),
    otp_repo: OTPRepository = Depends(get_otp_repo),
):
    """Sets a new password after a verified reset_token from /auth/verify-reset-otp."""
    claims = decode_token(payload.reset_token)
    if not claims or claims.get("type") != "challenge" or claims.get("purpose") != "password_reset":
        raise HTTPException(status_code=401, detail="Invalid or expired reset session. Please start over.")

    email = claims.get("sub", "").lower()
    if email != payload.email.lower():
        raise HTTPException(status_code=400, detail="Email mismatch for this reset session.")

    user = await user_repo.get_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")

    new_hash = hash_password(payload.new_password)
    await user_repo.update(str(user.id), {"hashed_password": new_hash})
    await otp_repo.delete_all_for(email, OTPPurpose.PASSWORD_RESET)

    logger.info("Password reset via OTP flow", user_id=str(user.id))
    return MessageResponse(message="Password updated successfully. Please log in.")