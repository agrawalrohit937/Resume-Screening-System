"""Outbound Webhooks API Routes.
CareerPilot ATS v2.0.0 - Enterprise ATS Ecosystem.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from api.deps import get_database, get_current_user
from models.user_model import UserModel
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
    db: Any = Depends(get_database),
):
    """Registers an enterprise outbound webhook endpoint with HMAC secret key."""
    service = WebhookService(db)
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
    db: Any = Depends(get_database),
):
    """Lists registered outbound webhook subscriptions for the active tenant."""
    tenant_id = getattr(current_user, "tenant_id", "default")
    cursor = db.webhook_subscriptions.find({"tenant_id": tenant_id})
    docs = await cursor.to_list(length=50)
    return [WebhookSubscription(**d) for d in docs]


@router.post("/dispatch-test", response_model=List[WebhookDeliveryResult])
async def dispatch_test_webhook_route(
    payload: DispatchTestPayload,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """Dispatches a test webhook event signed with HMAC-SHA256."""
    service = WebhookService(db)
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.dispatch_event(
        event_type=payload.event_type,
        data=payload.data,
        tenant_id=tenant_id,
    )
