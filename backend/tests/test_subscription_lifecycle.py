import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId
from fastapi import HTTPException

from api.routes.payment import activate_user_subscription
from api.deps import _check_and_apply_lazy_expiration, require_plan
from scheduler.subscription_expiry import expire_overdue_subscriptions
from models.user_model import UserModel


@pytest.fixture
def mock_user_repo():
    repo = AsyncMock()
    return repo


@pytest.mark.asyncio
async def test_activate_user_subscription_fresh(mock_user_repo):
    user_id = str(ObjectId())
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
    user_id = str(ObjectId())
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
    user_id = str(ObjectId())
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
    user_id = str(ObjectId())
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
    user_id = str(ObjectId())
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
        id=str(ObjectId()),
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
        id=str(ObjectId()),
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
        id=str(ObjectId()),
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
        id=str(ObjectId()),
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
    now = datetime.now(timezone.utc)
    mock_db = MagicMock()
    mock_raw_db = MagicMock()
    mock_db._raw_db = mock_raw_db

    expired_user_id = ObjectId()
    legacy_user_id = ObjectId()

    expired_docs = [
        {"_id": expired_user_id, "email": "exp@example.com", "plan": "pro"},
        {"_id": legacy_user_id, "email": "legacy@example.com", "plan": "pro"},
    ]

    mock_find_cursor = MagicMock()
    mock_find_cursor.to_list = AsyncMock(return_value=expired_docs)
    mock_raw_db.users.find.return_value = mock_find_cursor

    mock_update_result = MagicMock()
    mock_update_result.modified_count = 2
    mock_raw_db.users.update_many = AsyncMock(return_value=mock_update_result)

    res = await expire_overdue_subscriptions(mock_db)

    assert res["expired_count"] == 2
    mock_raw_db.users.find.assert_called_once()
    filter_arg = mock_raw_db.users.find.call_args[0][0]

    # Verify query includes both tracked expiration and legacy cutoff
    assert filter_arg["subscription_active"] is True
    assert "$or" in filter_arg

    # Verify update payload contains subscription_status = 'expired'
    update_arg = mock_raw_db.users.update_many.call_args[0][1]
    assert update_arg["$set"]["plan"] == "free"
    assert update_arg["$set"]["subscription_active"] is False
    assert update_arg["$set"]["subscription_status"] == "expired"
    assert update_arg["$set"]["subscription_end_date"] is None
