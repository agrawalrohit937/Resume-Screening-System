"""Outbound Webhooks API Routes.
CareerShala ATS v2.0.0 - Enterprise ATS Ecosystem.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from api.deps import get_current_user
from schemas.user_schema import UserModel
from services.integrations.webhooks import WebhookService, WebhookSubscription, WebhookDeliveryResult

router = APIRouter()


class RegisterSubscriptionPayload(BaseModel):
    target_url: str
    secret_key: str
    events: Optional[List[str]] = None


class DispatchTestPayload(BaseModel):
    event_type: str = "candidate.scored"
    data: Dict[str, Any] = {"score": 95.0, "status": "shortlisted"}


@router.post("/subscriptions", response_model=WebhookSubscription, status_code=status.HTTP_201_CREATED)
async def register_webhook_subscription_route(
    payload: RegisterSubscriptionPayload,
    current_user: UserModel = Depends(get_current_user),
):
    """Registers an enterprise outbound webhook endpoint with HMAC secret key."""
    service = WebhookService()
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.register_subscription(
        target_url=payload.target_url,
        secret_key=payload.secret_key,
        events=payload.events,
        tenant_id=tenant_id,
    )


@router.get("/subscriptions", response_model=List[WebhookSubscription])
async def list_webhook_subscriptions_route(
    current_user: UserModel = Depends(get_current_user),
):
    """Lists registered outbound webhook subscriptions for the active tenant."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    from config.db import get_pg_session_factory
    from sqlalchemy import select
    from models.tables import WebhookSubscription as WebhookTable
    async with get_pg_session_factory()() as session:
        stmt = select(WebhookTable).where(WebhookTable.tenant_id == tenant_id).limit(50)
        rows = (await session.execute(stmt)).scalars().all()
        return [
            WebhookSubscription(
                id=r.id,
                tenant_id=r.tenant_id,
                target_url=getattr(r, "url", getattr(r, "target_url", "")),
                events=r.events or [],
                secret_key=getattr(r, "secret", getattr(r, "secret_key", "")),
                is_active=getattr(r, "status", "active") == "active",
                created_at=r.created_at,
            )
            for r in rows
        ]


@router.post("/dispatch-test", response_model=List[WebhookDeliveryResult])
async def dispatch_test_webhook_route(
    payload: DispatchTestPayload,
    current_user: UserModel = Depends(get_current_user),
):
    """Dispatches a test webhook event signed with HMAC-SHA256."""
    service = WebhookService()
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.dispatch_event(
        event_type=payload.event_type,
        data=payload.data,
        tenant_id=tenant_id,
    )
