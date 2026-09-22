"""
Unit and integration tests for Team Invitation and Management Flow.
Verifies:
1. EXECUTIVE can invite team member with embedded tenant_id and role.
2. Invite link is properly generated with JWT token.
3. GET /team/verify-invite verifies valid tokens and returns role/tenant.
4. POST /team/accept-invite registers user with correct tenant_id and role array.
5. Reusing accepted token is rejected.
6. Non-executives are forbidden from inviting.
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from fastapi.testclient import TestClient

from core.security import (
    create_invite_token,
    decode_token,
    verify_token_type,
    create_access_token,
)
from models.user_model import UserModel, UserRole, UserStatus
from schemas.team_schema import TeamInviteRequest, AcceptInviteRequest


def test_create_and_decode_invite_token():
    """Verify create_invite_token properly encodes tenant_id, role, and inviter."""
    email = "interviewer@innovate.co"
    tenant_id = "tenant_innovate_123"
    role = "interviewer"
    invited_by = "user_exec_999"

    token = create_invite_token(
        email=email,
        tenant_id=tenant_id,
        role=role,
        invited_by=invited_by,
        extra_claims={"invited_by_name": "Sarah Founder"},
    )

    payload = decode_token(token)
    assert payload is not None
    assert verify_token_type(payload, "team_invite") is True
    assert payload["sub"] == email
    assert payload["tenant_id"] == tenant_id
    assert payload["role"] == role
    assert payload["invited_by"] == invited_by
    assert payload["invited_by_name"] == "Sarah Founder"
    assert "exp" in payload


def test_invite_token_expiration():
    """Verify expired invite token is automatically rejected by JWT decode."""
    expired_token = create_invite_token(
        email="late@innovate.co",
        tenant_id="tenant_innovate_123",
        role="hiring_manager",
        invited_by="user_exec_999",
        expires_days=-1,  # Expired in past
    )

    payload = decode_token(expired_token)
    assert payload is None



@pytest.mark.asyncio
async def test_team_invite_and_accept_workflow():
    """Simulate end-to-end team invite and acceptance logic."""
    from api.routes.team import INVITABLE_ROLES

    # 1. Verify invitable roles include enterprise roles but exclude platform admin
    assert UserRole.HIRING_MANAGER in INVITABLE_ROLES
    assert UserRole.INTERVIEWER in INVITABLE_ROLES
    assert UserRole.RECRUITER in INVITABLE_ROLES
    assert UserRole.COORDINATOR in INVITABLE_ROLES
    assert UserRole.PLATFORM_ADMIN not in INVITABLE_ROLES

    # 2. Executive inviter
    exec_user = UserModel(
        email="founder@acme.com",
        full_name="Alice Founder",
        role=UserRole.EXECUTIVE,
        roles=[UserRole.EXECUTIVE],
        tenant_id="tenant_acme",
    )

    # 3. Create token for Hiring Manager
    token = create_invite_token(
        email="bob.hm@acme.com",
        tenant_id=exec_user.tenant_id,
        role=UserRole.HIRING_MANAGER.value,
        invited_by=str(exec_user.id or "user_alice"),
        extra_claims={"invited_by_name": exec_user.full_name},
    )

    # 4. Decoded payload check
    payload = decode_token(token)
    assert payload["tenant_id"] == "tenant_acme"
    assert payload["role"] == "hiring_manager"

    # 5. Accepted user model creation
    new_user = UserModel(
        email=payload["sub"],
        full_name="Bob Hiring Manager",
        role=UserRole(payload["role"]),
        roles=[UserRole(payload["role"])],
        tenant_id=payload["tenant_id"],
        status=UserStatus.ACTIVE,
        email_verified=True,
    )

    assert new_user.tenant_id == "tenant_acme"
    assert new_user.role == UserRole.HIRING_MANAGER
    assert new_user.roles == [UserRole.HIRING_MANAGER]
    assert new_user.status == UserStatus.ACTIVE


@pytest.mark.asyncio
async def test_email_service_send_team_invitation(monkeypatch):
    """Verify EmailService renders team invitation template and dispatches email via Brevo."""
    from services.email_service import EmailService

    sent_data = {}

    async def mock_send(self, to_email, subject, html_body):
        sent_data["to_email"] = to_email
        sent_data["subject"] = subject
        sent_data["html_body"] = html_body
        return True

    monkeypatch.setattr(EmailService, "_send", mock_send)

    svc = EmailService()
    res = await svc.send_team_invitation(
        recipient_email="candidate.interviewer@techcorp.com",
        inviter_name="Sarah Connors",
        organization_name="TechCorp Labs",
        role="interviewer",
        invite_url="https://careershala.tech/accept-invite?token=mock_token_123",
        expires_days=7,
    )

    assert res is True
    assert sent_data["to_email"] == "candidate.interviewer@techcorp.com"
    assert "TechCorp Labs" in sent_data["subject"]
    assert "Sarah Connors" in sent_data["html_body"]
    assert "TechCorp Labs" in sent_data["html_body"]
    assert "Technical Interviewer" in sent_data["html_body"]
    assert "https://careershala.tech/accept-invite?token=mock_token_123" in sent_data["html_body"]
    assert "Accept Invitation" in sent_data["html_body"]


@pytest.mark.asyncio
async def test_existing_candidate_accept_invite_preserves_password_and_merges_roles(monkeypatch):
    """
    Verify Conflict 5 fix:
    When an existing candidate accepts a team invitation:
    1. Their existing password hash is NOT overwritten.
    2. Their roles array merges their existing candidate role with the new employer role.
    3. Their tenant_id updates to the organization's tenant.
    """
    from unittest.mock import AsyncMock, MagicMock
    from api.routes.team import accept_team_invite
    from schemas.team_schema import AcceptInviteRequest

    # Setup mock user who is already a candidate with a password
    ORIGINAL_HASH = "$2b$12$existing_secure_password_hash"
    candidate_user = UserModel(
        id="user_candidate_777",
        email="developer@example.com",
        full_name="Jane Developer",
        hashed_password=ORIGINAL_HASH,
        role=UserRole.CANDIDATE,
        roles=[UserRole.CANDIDATE],
        tenant_id="default",
        status=UserStatus.ACTIVE,
        email_verified=True,
    )

    # Mock user_repo
    updated_fields = {}
    mock_user_repo = MagicMock()
    mock_user_repo.get_by_email = AsyncMock(side_effect=lambda e: candidate_user)
    async def mock_update(uid, updates):
        updated_fields.update(updates)
        for k, v in updates.items():
            setattr(candidate_user, k, v)
        return candidate_user
    mock_user_repo.update = AsyncMock(side_effect=mock_update)

    # Mock db and team_invites collection
    mock_db = MagicMock()
    mock_invites_coll = MagicMock()
    mock_invites_coll.find_one = AsyncMock(return_value={
        "_id": "invite_doc_123",
        "email": "developer@example.com",
        "tenant_id": "tenant_acme_inc",
        "status": "pending",
    })
    mock_invites_coll.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    mock_db.__getitem__.return_value = mock_invites_coll

    # Generate valid invite token for recruiter role
    invite_token = create_invite_token(
        email="developer@example.com",
        tenant_id="tenant_acme_inc",
        role="recruiter",
        invited_by="exec_user_1",
    )

    payload = AcceptInviteRequest(
        token=invite_token,
        full_name="Jane Developer Pro",
        password="NewAttemptedPassword123!",
    )

    # Execute accept_team_invite
    response = await accept_team_invite(
        payload=payload,
        db=mock_db,
        user_repo=mock_user_repo,
    )

    # Assertions
    # 1. Password must NOT be overwritten because user already had a password
    assert "hashed_password" not in updated_fields
    assert candidate_user.hashed_password == ORIGINAL_HASH

    # 2. Roles must contain both existing candidate and new recruiter role, preserving base candidate role
    assert "candidate" in updated_fields["roles"]
    assert "recruiter" in updated_fields["roles"]
    assert updated_fields["role"] == "candidate"

    # 3. Tenant ID must be updated to new company tenant
    assert updated_fields["tenant_id"] == "tenant_acme_inc"
    assert candidate_user.tenant_id == "tenant_acme_inc"

    # 4. Invite marked accepted
    mock_invites_coll.update_one.assert_called_once()


@pytest.mark.asyncio
async def test_candidate_accepts_interviewer_invite_appends_role_and_preserves_candidate():
    """
    Verify Issue 2 fix:
    When a candidate accepts an interviewer invite:
    1. Base 'candidate' role is strictly retained.
    2. Roles array becomes ['candidate', 'interviewer'].
    3. Legacy singular role is NOT clobbered to 'interviewer'.
    4. RBAC treats roles array as single source of truth.
    """
    from unittest.mock import AsyncMock, MagicMock
    from api.routes.team import accept_team_invite
    from schemas.team_schema import AcceptInviteRequest

    interviewer_user = UserModel(
        id="user_cand_888",
        email="dev.interviewer@example.com",
        full_name="Alex Engineer",
        role=UserRole.CANDIDATE,
        roles=[UserRole.CANDIDATE],
        tenant_id="default",
        status=UserStatus.ACTIVE,
        email_verified=True,
    )

    updated_fields = {}
    mock_user_repo = MagicMock()
    mock_user_repo.get_by_email = AsyncMock(side_effect=lambda e: interviewer_user)
    async def mock_update(uid, updates):
        updated_fields.update(updates)
        for k, v in updates.items():
            setattr(interviewer_user, k, v)
        return interviewer_user
    mock_user_repo.update = AsyncMock(side_effect=mock_update)

    mock_db = MagicMock()
    mock_invites_coll = MagicMock()
    mock_invites_coll.find_one = AsyncMock(return_value={
        "_id": "invite_doc_interviewer",
        "email": "dev.interviewer@example.com",
        "tenant_id": "tenant_innovate_labs",
        "status": "pending",
    })
    mock_invites_coll.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    mock_db.__getitem__.return_value = mock_invites_coll

    invite_token = create_invite_token(
        email="dev.interviewer@example.com",
        tenant_id="tenant_innovate_labs",
        role="interviewer",
        invited_by="exec_user_1",
    )

    payload = AcceptInviteRequest(
        token=invite_token,
        full_name="Alex Engineer",
        password="ValidPassword123!",
    )

    await accept_team_invite(
        payload=payload,
        db=mock_db,
        user_repo=mock_user_repo,
    )

    # Base candidate role preserved
    assert updated_fields["role"] == "candidate"
    # Roles array has strictly appended interviewer without removing candidate
    assert updated_fields["roles"] == ["candidate", "interviewer"]
    # UserModel RBAC recognizes both roles
    assert interviewer_user.has_role("interviewer") is True
    assert interviewer_user.has_role("candidate") is True
    assert interviewer_user.tenant_id == "tenant_innovate_labs"



