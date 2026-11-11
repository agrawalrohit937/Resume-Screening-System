import pytest
from datetime import datetime, timedelta, timezone
import uuid
from unittest.mock import AsyncMock
from fastapi import HTTPException

from api.routes.payment import activate_user_subscription
from api.deps import _check_and_apply_lazy_expiration, require_plan
from scheduler.subscription_expiry import expire_overdue_subscriptions
from schemas.user_schema import UserModel


@pytest.fixture
def mock_user_repo():
    repo = AsyncMock()
    return repo


@pytest.mark.asyncio
async def test_activate_user_subscription_fresh(mock_user_repo):
    user_id = uuid.uuid4().hex
    user = UserModel(
        id=user_id,
        email="fresh@example.com",
        full_name="Fresh User",
        plan="free",
        subscription_active=False,
        subscription_status="expired",
        subscription_start_date=None,
        subscription_end_date=None,
    )
    mock_user_repo.get_by_id.return_value = user

    async def fake_update(uid, updates):
        for k, v in updates.items():
            setattr(user, k, v)
        return user

    mock_user_repo.update.side_effect = fake_update

    now = datetime.now(timezone.utc)
    updated_user = await activate_user_subscription(mock_user_repo, user_id, "pro", days=30)

    assert updated_user is not None
    assert updated_user.plan == "pro"
    assert updated_user.subscription_active is True
    assert updated_user.subscription_status == "active"
    assert updated_user.subscription_start_date is not None
    assert updated_user.subscription_end_date is not None

    # End date should be ~30 days in the future
    diff = updated_user.subscription_end_date - now
    assert 29 <= diff.days <= 30


@pytest.mark.asyncio
async def test_activate_user_subscription_early_renewal(mock_user_repo):
    user_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    existing_end = now + timedelta(days=15)
    existing_start = now - timedelta(days=15)

    user = UserModel(
        id=user_id,
        email="renewal@example.com",
        full_name="Renewal User",
        plan="pro",
        subscription_active=True,
        subscription_status="active",
        subscription_start_date=existing_start,
        subscription_end_date=existing_end,
    )
    mock_user_repo.get_by_id.return_value = user

    async def fake_update(uid, updates):
        for k, v in updates.items():
            setattr(user, k, v)
        return user

    mock_user_repo.update.side_effect = fake_update

    updated_user = await activate_user_subscription(mock_user_repo, user_id, "pro", days=30)

    assert updated_user is not None
    assert updated_user.plan == "pro"
    assert updated_user.subscription_active is True
    # The new end date should be existing_end + 30 days = ~45 days from now
    diff = updated_user.subscription_end_date - existing_end
    assert diff.days == 30

    total_from_now = updated_user.subscription_end_date - now
    assert 44 <= total_from_now.days <= 46


@pytest.mark.asyncio
async def test_activate_user_subscription_free_downgrade(mock_user_repo):
    user_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc)

    user = UserModel(
        id=user_id,
        email="cancel@example.com",
        full_name="Cancel User",
        plan="pro",
        subscription_active=True,
        subscription_status="active",
        subscription_start_date=now - timedelta(days=10),
        subscription_end_date=now + timedelta(days=20),
    )
    mock_user_repo.get_by_id.return_value = user

    async def fake_update(uid, updates):
        for k, v in updates.items():
            setattr(user, k, v)
        return user

    mock_user_repo.update.side_effect = fake_update

    updated_user = await activate_user_subscription(mock_user_repo, user_id, "free", days=0)

    assert updated_user is not None
    assert updated_user.plan == "free"
    assert updated_user.subscription_active is False
    assert updated_user.subscription_status == "expired"
    assert updated_user.subscription_end_date is None


@pytest.mark.asyncio
async def test_lazy_expiration_past_end_date(mock_user_repo):
    user_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    expired_end = now - timedelta(hours=2)

    user = UserModel(
        id=user_id,
        email="expired@example.com",
        full_name="Expired User",
        plan="pro",
        subscription_active=True,
        subscription_status="active",
        subscription_start_date=now - timedelta(days=31),
        subscription_end_date=expired_end,
    )

    async def fake_update(uid, updates):
        for k, v in updates.items():
            setattr(user, k, v)
        return user

    mock_user_repo.update.side_effect = fake_update

    evaluated_user = await _check_and_apply_lazy_expiration(user, mock_user_repo)

    # Must be downgraded immediately
    assert evaluated_user.plan == "free"
    assert evaluated_user.subscription_active is False
    assert evaluated_user.subscription_status == "expired"
    assert evaluated_user.subscription_end_date is None
    mock_user_repo.update.assert_awaited_once()


@pytest.mark.asyncio
async def test_lazy_expiration_unexpired_remains_active(mock_user_repo):
    user_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    future_end = now + timedelta(days=10)

    user = UserModel(
        id=user_id,
        email="active@example.com",
        full_name="Active User",
        plan="pro",
        subscription_active=True,
        subscription_status="active",
        subscription_start_date=now - timedelta(days=20),
        subscription_end_date=future_end,
    )

    evaluated_user = await _check_and_apply_lazy_expiration(user, mock_user_repo)

    assert evaluated_user.plan == "pro"
    assert evaluated_user.subscription_active is True
    assert evaluated_user.subscription_status == "active"
    mock_user_repo.update.assert_not_awaited()


@pytest.mark.asyncio
async def test_require_plan_guard():
    pro_guard = require_plan("pro")
    premium_guard = require_plan("premium")

    # 1. Pro user with active subscription
    pro_user = UserModel(
        id=uuid.uuid4().hex,
        email="pro@example.com",
        full_name="Pro User",
        plan="pro",
        subscription_active=True,
        roles=["candidate"]
    )
    result = await pro_guard(current_user=pro_user)
    assert result == pro_user

    # 2. Pro user trying to access premium -> 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        await premium_guard(current_user=pro_user)
    assert exc_info.value.status_code == 403
    assert "premium" in exc_info.value.detail

    # 3. Free user trying to access pro -> 403 Forbidden
    free_user = UserModel(
        id=uuid.uuid4().hex,
        email="free@example.com",
        full_name="Free User",
        plan="free",
        subscription_active=False,
        roles=["candidate"]
    )
    with pytest.raises(HTTPException) as exc_info:
        await pro_guard(current_user=free_user)
    assert exc_info.value.status_code == 403

    # 4. User marked pro but subscription_active is False (expired) -> 403 Forbidden
    expired_pro = UserModel(
        id=uuid.uuid4().hex,
        email="expired_pro@example.com",
        full_name="Expired User",
        plan="pro",
        subscription_active=False,
        roles=["candidate"]
    )
    with pytest.raises(HTTPException) as exc_info:
        await pro_guard(current_user=expired_pro)
    assert exc_info.value.status_code == 403

    # 5. Platform Admin bypasses guard
    admin_user = UserModel(
        id=uuid.uuid4().hex,
        email="admin@example.com",
        full_name="Admin User",
        plan="free",
        subscription_active=False,
        roles=["platform_admin"]
    )
    admin_result = await premium_guard(current_user=admin_user)
    assert admin_result == admin_user


@pytest.mark.asyncio
async def test_expire_overdue_subscriptions_sweep():
    """Verify PostgreSQL-based subscription sweep downgrades expired users to Free."""
    from unittest.mock import patch
    from models.tables import User as UserT
    from tests.conftest import MockAsyncSession

    now = datetime.now(timezone.utc)
    expired_user = UserT(
        id="user_exp_1",
        email="exp@example.com",
        plan="pro",
        subscription_active=True,
        subscription_end_date=now - timedelta(days=2),
    )
    legacy_user = UserT(
        id="user_legacy_2",
        email="legacy@example.com",
        plan="pro",
        subscription_active=True,
        subscription_end_date=None,
        plan_updated_at=now - timedelta(days=45),
    )

    mock_session = MockAsyncSession([expired_user, legacy_user])
    with patch("scheduler.subscription_expiry.get_pg_session_factory", return_value=lambda: mock_session):
        res = await expire_overdue_subscriptions()

    assert res["expired_count"] == 2
    assert "user_exp_1" in res["downgraded_ids"]
    assert "user_legacy_2" in res["downgraded_ids"]
