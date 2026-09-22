"""Enterprise Outbound Webhooks with HMAC SHA-256 Signatures.
CareerPilot ATS v2.0.0 - Enterprise ATS Ecosystem.
"""

import hmac
import hashlib
import json
import time
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
import structlog

from services.multi_tenancy.tenant_context import get_current_tenant_id

logger = structlog.get_logger(__name__)


class WebhookSubscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = "default"
    target_url: str
    secret_key: str
    events: List[str] = Field(default_factory=lambda: ["*"])  # e.g. ["candidate.scored", "application.status_changed"]
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class WebhookPayload(BaseModel):
    event_id: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex[:16]}")
    event_type: str
    tenant_id: str
    timestamp: int = Field(default_factory=lambda: int(time.time()))
    data: Dict[str, Any]


class WebhookDeliveryResult(BaseModel):
    subscription_id: str
    target_url: str
    event_type: str
    status_code: int
    success: bool
    signature_header: str
    delivered_at: datetime = Field(default_factory=datetime.utcnow)


def compute_webhook_signature(payload_json: str, secret: str) -> str:
    """Computes HMAC-SHA256 signature for payload verification."""
    mac = hmac.new(secret.encode("utf-8"), payload_json.encode("utf-8"), hashlib.sha256)
    return f"sha256={mac.hexdigest()}"


class WebhookService:
    def __init__(self, db, http_client=None):
        self.db = db
        self.http_client = http_client

    async def register_subscription(
        self,
        target_url: str,
        secret_key: str,
        events: Optional[List[str]] = None,
        tenant_id: Optional[str] = None
    ) -> WebhookSubscription:
        resolved_tenant = tenant_id or get_current_tenant_id()
        sub = WebhookSubscription(
            tenant_id=resolved_tenant,
            target_url=target_url,
            secret_key=secret_key,
            events=events or ["*"]
        )
        await self.db.webhook_subscriptions.insert_one(sub.dict())
        logger.info("Webhook subscription registered", target_url=target_url, tenant_id=resolved_tenant)
        return sub

    async def dispatch_event(
        self,
        event_type: str,
        data: Dict[str, Any],
        tenant_id: Optional[str] = None
    ) -> List[WebhookDeliveryResult]:
        resolved_tenant = tenant_id or get_current_tenant_id()
        cursor = self.db.webhook_subscriptions.find({
            "tenant_id": resolved_tenant,
            "is_active": True
        })
        subs_data = await cursor.to_list(length=50)
        subscriptions = [WebhookSubscription(**s) for s in subs_data]

        results: List[WebhookDeliveryResult] = []
        payload_obj = WebhookPayload(
            event_type=event_type,
            tenant_id=resolved_tenant,
            data=data
        )
        payload_json = json.dumps(payload_obj.dict(), default=str)

        for sub in subscriptions:
            # Check if subscribed to this event or wildcard
            if "*" not in sub.events and event_type not in sub.events:
                continue

            signature = compute_webhook_signature(payload_json, sub.secret_key)
            headers = {
                "Content-Type": "application/json",
                "X-CareerPilot-Signature": signature,
                "X-CareerPilot-Event": event_type,
                "X-CareerPilot-Delivery": payload_obj.event_id,
            }

            if self.http_client:
                try:
                    res = await self.http_client.post(sub.target_url, data=payload_json, headers=headers)
                    status_code = res.status_code
                    success = 200 <= status_code < 300
                except Exception as e:
                    logger.error("Webhook dispatch failed", target_url=sub.target_url, error=str(e))
                    status_code = 500
                    success = False
            else:
                # Functional mock dispatch
                status_code = 200
                success = True

            delivery = WebhookDeliveryResult(
                subscription_id=sub.id,
                target_url=sub.target_url,
                event_type=event_type,
                status_code=status_code,
                success=success,
                signature_header=signature
            )
            results.append(delivery)

            # Record delivery audit log
            await self.db.webhook_deliveries.insert_one(delivery.dict())

        logger.info("Dispatched webhook event", event_type=event_type, dispatched_count=len(results))
        return results
