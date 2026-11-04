"""
Phase A2 Security Verification Tests: JWT Lifecycle, Token Rotation & Revocation.
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock

from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_token,
)
from services.token_service import TokenService
from core.config import settings


def test_access_and_refresh_token_generation_and_jti():
    token = create_access_token("user_101", extra_claims={"tenant_id": "org_77"})
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "user_101"
    assert payload["type"] == "access"
    assert "jti" in payload
    assert payload["tenant_id"] == "org_77"

    ref_token = create_refresh_token("user_101", family_id="fam_99")
    ref_payload = decode_token(ref_token)
    assert ref_payload is not None
    assert ref_payload["type"] == "refresh"
    assert ref_payload["family_id"] == "fam_99"
    assert "jti" in ref_payload


def test_jwt_secret_rotation_support(monkeypatch):
    old_secret = "old_secret_key_with_at_least_32_characters_here_12345"
    new_secret = "new_secret_key_with_at_least_32_characters_here_67890"

    # Create token with old secret
    from jose import jwt
    payload = {"sub": "user_202", "type": "access", "exp": datetime.now(timezone.utc) + timedelta(minutes=15)}
    token_old = jwt.encode(payload, old_secret, algorithm="HS256")

    # Set system to use new secret with old secret in grace window
    monkeypatch.setattr(settings, "SECRET_KEY", new_secret)
    monkeypatch.setattr(settings, "JWT_PREVIOUS_SECRET_KEY", old_secret)
    monkeypatch.setattr(settings, "JWT_SECRET_ROTATION_ENABLED", True)

    decoded = decode_token(token_old)
    assert decoded is not None
    assert decoded["sub"] == "user_202"


@pytest.mark.asyncio
async def test_token_service_jti_revocation():
    jti_test = "test_jti_uuid_12345"
    await TokenService.revoke_jti(jti_test, reason="logout_test")

    # Cached in memory / db
    is_rev = await TokenService.is_jti_revoked(jti_test)
    assert is_rev is True


@pytest.mark.asyncio
async def test_refresh_token_rotation_and_reuse_detection(monkeypatch):
    from models.tables import RefreshToken, User
    from tests.conftest import MockAsyncSession, MockResult
    import config.db

    # 1. Simulate active unused refresh token
    ref_token = create_refresh_token("user_abc", family_id="family_xyz")
    ref_hash = hash_token(ref_token)

    stored_rt = RefreshToken(
        id="rec_1",
        token_hash=ref_hash,
        user_id="user_abc",
        family_id="family_xyz",
        used=False,
        revoked=False,
    )
    user_row = User(
        id="user_abc",
        role="recruiter",
        roles=["recruiter"],
        email="test.recruiter@example.com",
        tenant_id="tenant_1",
    )

    class CustomSession(MockAsyncSession):
        def __init__(self):
            super().__init__()
            self._items = [stored_rt, user_row]
        async def commit(self):
            pass

    monkeypatch.setattr("services.token_service.get_pg_session_factory", lambda: (lambda: CustomSession()))

    new_access, new_refresh, extra = await TokenService.rotate_refresh_token(ref_token)
    assert new_access is not None
    assert new_refresh is not None
    assert stored_rt.used is True

    # 2. Simulate REUSE of an already used token -> triggers family revocation!
    with pytest.raises(ValueError, match="Token reuse detected"):
        await TokenService.rotate_refresh_token(ref_token)
