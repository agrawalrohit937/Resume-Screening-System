"""
Team Management & Invitation Routes for Multi-Tenant SaaS.
Enterprise Phase 5:
- POST /api/v1/team/invite: Generates secure JWT token embedding tenant_id and assigned role.
- POST /api/v1/team/accept-invite: Decodes token, creates/updates user, assigns tenant_id and role.
- GET /api/v1/team/verify-invite: Verifies token validity and returns invite details.
- GET /api/v1/team/members: Lists tenant team members and pending invites.
- DELETE /api/v1/team/invite/{invite_id}: Revokes an unaccepted invite.
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from bson import ObjectId
import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse

from api.deps import get_database, get_current_user, get_user_repo, get_email_service
from services.email_service import EmailService
from core.config import settings
from core.security import (
    create_invite_token,
    decode_token,
    verify_token_type,
    hash_password,
)
from models.user_model import UserModel, UserRole, UserStatus
from repositories.user_repo import UserRepository
from schemas.team_schema import (
    TeamInviteRequest,
    TeamInviteResponse,
    AcceptInviteRequest,
    VerifyInviteResponse,
    TeamListResponse,
    TeamMemberItem,
    PendingInviteItem,
)
from api.routes.auth_helpers import build_and_persist_tokens

logger = structlog.get_logger(__name__)
router = APIRouter()

INVITABLE_ROLES = {
    UserRole.RECRUITER,
    UserRole.HIRING_MANAGER,
    UserRole.INTERVIEWER,
    UserRole.COORDINATOR,
    UserRole.EXECUTIVE,
}


def _ensure_can_manage_team(user: UserModel):
    """Ensure the user is a company owner (EXECUTIVE) or PLATFORM_ADMIN."""
    if not user.has_role(UserRole.EXECUTIVE, UserRole.EXEC, UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company Executives and Admins can manage team members and invites.",
        )


@router.post("/invite", response_model=TeamInviteResponse, status_code=status.HTTP_201_CREATED)
async def invite_team_member(
    payload: TeamInviteRequest,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
    email_service: EmailService = Depends(get_email_service),
):
    """
    Generate a secure JWT invite token embedding the inviter's tenant_id and assigned role.
    Dispatches transactional invitation email via Brevo and returns the invite link.
    """
    _ensure_can_manage_team(current_user)

    invitee_email = payload.email.lower().strip()
    assigned_role = payload.role

    if assigned_role not in INVITABLE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{assigned_role}' cannot be assigned via team invitation.",
        )

    tenant_id = current_user.tenant_id or "default"
    if tenant_id == "default" and not current_user.has_role(UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your organization must have an active tenant ID to invite team members.",
        )

    # Check if a user with this email is already a member of this tenant
    users_coll = db["users"]
    existing_member = await users_coll.find_one({"email": invitee_email, "tenant_id": tenant_id})
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User '{invitee_email}' is already an active member of this organization.",
        )

    invites_coll = db["team_invites"]

    # Generate token
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    token = create_invite_token(
        email=invitee_email,
        tenant_id=tenant_id,
        role=assigned_role.value if hasattr(assigned_role, "value") else str(assigned_role),
        invited_by=str(current_user.id),
        extra_claims={
            "invited_by_name": current_user.full_name,
            "invited_by_email": current_user.email,
        },
        expires_days=7,
    )

    frontend_base = settings.FRONTEND_URL.rstrip("/")
    invite_link = f"{frontend_base}/accept-invite?token={token}"

    invite_doc = {
        "email": invitee_email,
        "tenant_id": tenant_id,
        "role": assigned_role.value if hasattr(assigned_role, "value") else str(assigned_role),
        "invited_by": str(current_user.id),
        "invited_by_name": current_user.full_name,
        "invited_by_email": current_user.email,
        "token": token,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "expires_at": expires_at,
    }

    # Upsert pending invite for this email + tenant
    res = await invites_coll.update_one(
        {"email": invitee_email, "tenant_id": tenant_id, "status": "pending"},
        {"$set": invite_doc},
        upsert=True,
    )

    invite_id = str(res.upserted_id) if res.upserted_id else ""
    if not invite_id:
        existing = await invites_coll.find_one({"email": invitee_email, "tenant_id": tenant_id, "status": "pending"})
        invite_id = str(existing["_id"]) if existing else "invite_saved"

    org_name = getattr(current_user, "company_name", None) or tenant_id
    role_str = assigned_role.value if hasattr(assigned_role, "value") else str(assigned_role)

    # Dispatch Brevo transactional email in background
    background_tasks.add_task(
        email_service.send_team_invitation,
        recipient_email=invitee_email,
        inviter_name=current_user.full_name,
        organization_name=org_name,
        role=role_str,
        invite_url=invite_link,
        expires_days=7,
    )

    logger.info(
        "Team invite generated and email queued via Brevo",
        email=invitee_email,
        role=role_str,
        tenant_id=tenant_id,
        invited_by=current_user.email,
    )

    return TeamInviteResponse(
        message=f"Invitation sent successfully to {invitee_email}.",
        invite_id=invite_id,
        email=invitee_email,
        role=role_str,
        tenant_id=tenant_id,
        invite_link=invite_link,
        token=token,
        expires_at=expires_at,
    )



@router.get("/verify-invite", response_model=VerifyInviteResponse)
async def verify_invite(
    token: str = Query(..., description="The team invite JWT token"),
    db: Any = Depends(get_database),
):
    """
    Decodes and validates an invite token for preview on the frontend Accept Invite screen.
    """
    payload = decode_token(token)
    if not payload or not verify_token_type(payload, "team_invite"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or malformed invitation link.",
        )

    exp = payload.get("exp")
    if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has expired. Please ask your administrator to send a new invite.",
        )

    email = payload.get("sub")
    tenant_id = payload.get("tenant_id")
    role = payload.get("role")

    invites_coll = db["team_invites"]
    invite_record = await invites_coll.find_one({"email": email, "tenant_id": tenant_id, "status": "pending"})
    if not invite_record:
        # Check if already accepted
        accepted = await invites_coll.find_one({"email": email, "tenant_id": tenant_id, "status": "accepted"})
        if accepted:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This invitation has already been accepted. Please log in directly.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found or has been revoked.",
        )

    return VerifyInviteResponse(
        valid=True,
        email=email,
        role=role,
        tenant_id=tenant_id,
        invited_by_name=payload.get("invited_by_name") or invite_record.get("invited_by_name"),
        invited_by_email=payload.get("invited_by_email") or invite_record.get("invited_by_email"),
        expires_at=datetime.fromtimestamp(exp, tz=timezone.utc) if exp else datetime.now(timezone.utc) + timedelta(days=7),
    )


@router.post("/accept-invite")
async def accept_team_invite(
    payload: AcceptInviteRequest,
    db: Any = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repo),
):
    """
    Decodes the invitation token, registers/updates the user with the embedded
    tenant_id and role, marks the invitation accepted, and returns auth session tokens.
    """
    token_payload = decode_token(payload.token)
    if not token_payload or not verify_token_type(token_payload, "team_invite"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired invitation token.",
        )

    exp = token_payload.get("exp")
    if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has expired. Please ask your team administrator to resend it.",
        )

    email = token_payload.get("sub")
    tenant_id = token_payload.get("tenant_id")
    assigned_role_str = token_payload.get("role")

    if not email or not tenant_id or not assigned_role_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed invitation claims.",
        )

    invites_coll = db["team_invites"]
    invite_doc = await invites_coll.find_one({"email": email, "tenant_id": tenant_id, "status": "pending"})
    if not invite_doc:
        accepted = await invites_coll.find_one({"email": email, "tenant_id": tenant_id, "status": "accepted"})
        if accepted:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This invitation has already been accepted. Please log in directly.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found or has been revoked.",
        )

    try:
        assigned_role_enum = UserRole(assigned_role_str)
    except ValueError:
        assigned_role_enum = UserRole.RECRUITER

    # Fetch tenant's established company profile if available
    company_doc = await db["companies"].find_one({"tenant_id": tenant_id})
    company_name = company_doc.get("company_name") if company_doc else None

    # Check if user already exists
    existing_user = await user_repo.get_by_email(email)

    if existing_user:
        # Gracefully adopt employer roles within the new tenant while preserving existing roles
        raw_current_roles = existing_user.roles or [existing_user.role]
        current_roles = [r.value if hasattr(r, "value") else str(r).lower() for r in raw_current_roles]
        assigned_role_val = assigned_role_enum.value.lower()

        # Strict requirement: ensure base 'candidate' role is strictly retained, never removed
        if "candidate" not in current_roles:
            current_roles.insert(0, "candidate")

        # Append newly assigned employer role if not already present
        if assigned_role_val not in current_roles:
            current_roles.append(assigned_role_val)

        merged_roles = list(dict.fromkeys(current_roles))

        # Preserve legacy base singular role (e.g. 'candidate') without overwriting it with employer role
        legacy_role = "candidate" if "candidate" in merged_roles else (
            existing_user.role.value if hasattr(existing_user.role, "value") else str(existing_user.role).lower()
        )

        updates: Dict[str, Any] = {
            "tenant_id": tenant_id,
            "roles": merged_roles,
            "role": legacy_role,
            "status": UserStatus.ACTIVE.value,
            "email_verified": True,
            "is_invited_staff": True,
            "invited_by": invite_doc.get("invited_by_id") or invite_doc.get("invited_by_email"),
            "updated_at": datetime.now(timezone.utc),
        }

        if company_name and not getattr(existing_user, "company_name", None):
            updates["company_name"] = company_name

        # Preserve full name if already set, or update if provided in payload
        if payload.full_name and payload.full_name.strip():
            updates["full_name"] = payload.full_name.strip()
        elif existing_user.full_name:
            updates["full_name"] = existing_user.full_name

        # Do NOT overwrite user's password unconditionally if they already have one set.
        # Only set password if the account has no password yet (e.g. OAuth-only signup).
        if not getattr(existing_user, "hashed_password", None) and payload.password:
            updates["hashed_password"] = hash_password(payload.password)

        await user_repo.update(str(existing_user.id), updates)
        user = await user_repo.get_by_email(email)
    else:
        # Create brand-new user with embedded tenant_id and dual roles: base candidate + assigned enterprise role
        hashed = hash_password(payload.password)
        assigned_role_val = assigned_role_enum.value.lower()
        new_roles = ["candidate", assigned_role_val] if assigned_role_val != "candidate" else ["candidate"]
        new_user_data = {
            "email": email,
            "full_name": payload.full_name,
            "hashed_password": hashed,
            "role": "candidate",
            "roles": new_roles,
            "tenant_id": tenant_id,
            "company_name": company_name,
            "is_invited_staff": True,
            "invited_by": invite_doc.get("invited_by_id") or invite_doc.get("invited_by_email"),
            "status": UserStatus.ACTIVE.value,
            "email_verified": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "auth_methods": ["password"],
            "last_login_method": "password",
            "linked_accounts": {
                "password": {
                    "linked_at": datetime.now(timezone.utc),
                    "last_login": datetime.now(timezone.utc),
                }
            },
            "auth_method": "password",
            "total_resumes": 0,
            "total_ats_checks": 0,
        }
        user = await user_repo.create(new_user_data)

    # Mark invite accepted
    await invites_coll.update_one(
        {"_id": invite_doc["_id"]},
        {
            "$set": {
                "status": "accepted",
                "accepted_at": datetime.now(timezone.utc),
                "accepted_by_user_id": str(user.id),
            }
        },
    )

    logger.info(
        "Team invitation accepted successfully",
        email=email,
        tenant_id=tenant_id,
        role=assigned_role_enum.value,
        user_id=str(user.id),
    )

    # Issue full auth tokens and cookies so the user is immediately logged in
    return await build_and_persist_tokens(user, user_repo)


@router.get("/members", response_model=TeamListResponse)
async def list_team_members(
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """
    Lists active team members and pending invitations for the current user's tenant.
    """
    tenant_id = current_user.tenant_id or "default"
    users_coll = db["users"]
    invites_coll = db["team_invites"]

    # Active members with matching tenant_id
    cursor = users_coll.find(
        {"tenant_id": tenant_id, "status": {"$ne": "deleted"}},
        {"hashed_password": 0, "payment_history": 0, "refresh_token": 0},
    ).sort("created_at", -1)
    raw_members = await cursor.to_list(length=100)

    members: List[TeamMemberItem] = []
    for m in raw_members:
        r_list = m.get("roles") or ([m.get("role")] if m.get("role") else ["candidate"])
        members.append(
            TeamMemberItem(
                id=str(m.get("_id")),
                email=m.get("email", ""),
                full_name=m.get("full_name", ""),
                role=str(m.get("role", "candidate")),
                roles=[str(r) for r in r_list],
                tenant_id=m.get("tenant_id", tenant_id),
                status=str(m.get("status", "active")),
                created_at=m.get("created_at"),
                last_login=m.get("last_login"),
                profile_picture=m.get("profile_picture"),
            )
        )

    # Pending invitations
    inv_cursor = invites_coll.find({"tenant_id": tenant_id, "status": "pending"}).sort("created_at", -1)
    raw_invites = await inv_cursor.to_list(length=100)

    pending_invites: List[PendingInviteItem] = []
    frontend_base = settings.FRONTEND_URL.rstrip("/")

    for inv in raw_invites:
        token = inv.get("token", "")
        invite_link = f"{frontend_base}/accept-invite?token={token}" if token else None
        pending_invites.append(
            PendingInviteItem(
                id=str(inv.get("_id")),
                email=inv.get("email", ""),
                role=inv.get("role", ""),
                tenant_id=inv.get("tenant_id", tenant_id),
                status=inv.get("status", "pending"),
                created_at=inv.get("created_at", datetime.now(timezone.utc)),
                expires_at=inv.get("expires_at", datetime.now(timezone.utc)),
                invited_by_name=inv.get("invited_by_name"),
                invited_by_email=inv.get("invited_by_email"),
                invite_link=invite_link,
            )
        )

    return TeamListResponse(
        tenant_id=tenant_id,
        members=members,
        pending_invites=pending_invites,
    )


@router.delete("/invite/{invite_id}", status_code=status.HTTP_200_OK)
async def revoke_team_invite(
    invite_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """
    Revoke a pending team invite so the token can no longer be used.
    """
    _ensure_can_manage_team(current_user)
    tenant_id = current_user.tenant_id or "default"
    invites_coll = db["team_invites"]

    try:
        oid = ObjectId(invite_id)
        query = {"_id": oid, "tenant_id": tenant_id}
    except Exception:
        query = {"id": invite_id, "tenant_id": tenant_id}

    res = await invites_coll.update_one(query, {"$set": {"status": "revoked", "revoked_at": datetime.now(timezone.utc)}})
    if res.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending invite not found or already processed.",
        )

    return {"message": "Invitation revoked successfully."}


@router.delete("/members/{user_id}", status_code=status.HTTP_200_OK)
async def remove_team_member(
    user_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """
    Remove an existing team member from the organization (tenant isolation revocation).
    - Strictly enforces RBAC: requester must be an EXECUTIVE, EXEC, or ADMIN.
    - Prevents self-lockout: cannot remove own account.
    - Preserves candidate data: resets tenant_id, company_name, and reverts roles to ['candidate'].
    """
    _ensure_can_manage_team(current_user)

    if str(current_user.id) == str(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove yourself from the organization.",
        )

    tenant_id = current_user.tenant_id or "default"
    users_coll = db["users"]

    try:
        target_oid = ObjectId(user_id)
        user_query = {"_id": target_oid}
    except Exception:
        user_query = {"_id": user_id}

    target_user = await users_coll.find_one(user_query)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found.",
        )

    # Verify target belongs to the same tenant (unless platform admin)
    if target_user.get("tenant_id") != tenant_id and not current_user.has_role(UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member does not belong to your organization.",
        )

    # Disconnect user from organization and revert roles to default candidate
    updates = {
        "tenant_id": None,
        "company_name": None,
        "company_id": None,
        "is_invited_staff": False,
        "roles": ["candidate"],
        "role": "candidate",
        "updated_at": datetime.now(timezone.utc),
    }

    await users_coll.update_one(user_query, {"$set": updates})

    logger.info(
        "Team member removed from organization",
        removed_user_id=str(user_id),
        removed_user_email=target_user.get("email"),
        tenant_id=tenant_id,
        removed_by=str(current_user.id),
    )

    return {
        "message": f"Member {target_user.get('full_name') or target_user.get('email')} successfully removed from organization.",
        "user_id": str(user_id),
    }
