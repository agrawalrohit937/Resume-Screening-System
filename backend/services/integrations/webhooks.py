"""Enterprise Outbound Webhooks with HMAC SHA-256 Signatures & Delivery Retries.
CareerShala ATS v2.0.0 - Enterprise ATS Ecosystem.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

import httpx
import structlog
from pydantic import BaseModel, Field

from services.multi_tenancy.tenant_context import get_current_tenant_id

logger = structlog.get_logger(__name__)


class WebhookSubscription(BaseModel):
    """Configuration for an outbound webhook subscriber."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = "default"
    target_url: str
    secret_key: str
    events: List[str] = Field(default_factory=lambda: ["*"])  # e.g. ["candidate.scored", "job.published"]
    is_active: bool = True
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WebhookPayload(BaseModel):
    """Standardized event envelope dispatched to subscriber endpoints."""
    event_id: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex[:16]}")
    event_type: str
    tenant_id: str
    timestamp: int = Field(default_factory=lambda: int(time.time()))
    data: Dict[str, Any]


class WebhookDeliveryResult(BaseModel):
    """Audit record for a webhook delivery attempt."""
    delivery_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    subscription_id: str
    target_url: str
    event_type: str
    event_id: Optional[str] = None
    tenant_id: str = "default"
    status_code: int
    success: bool
    attempts: int = 1
    signature_header: str
    error: Optional[str] = None
    delivered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def compute_webhook_signature(payload_bytes_or_str: Union[bytes, str], secret: str) -> str:
    """Computes HMAC-SHA256 signature for outbound request payload. Format: 'sha256=<hex_digest>'"""
    if isinstance(payload_bytes_or_str, str):
        payload_bytes = payload_bytes_or_str.encode("utf-8")
    else:
        payload_bytes = payload_bytes_or_str

    mac = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256)
    return f"sha256={mac.hexdigest()}"


def verify_webhook_signature(payload_bytes_or_str: Union[bytes, str], secret: str, signature_header: str) -> bool:
    """Verifies that an incoming webhook signature matches the expected HMAC-SHA256 digest using constant-time comparison."""
    if not signature_header:
        return False
    expected_sig = compute_webhook_signature(payload_bytes_or_str, secret)
    return hmac.compare_digest(expected_sig, signature_header.strip())


class WebhookService:
    """Enterprise Outbound Webhook Dispatcher with retry loops, HMAC signing, and tenant isolation."""

    def __init__(self, db: Any = None, http_client: Optional[httpx.AsyncClient] = None, max_retries: int = 3):
        self.db = db
        self._http_client = http_client
        self.max_retries = max_retries

    def _get_coll(self, name: str) -> Any:
        if self.db is None:
            return None
        if hasattr(self.db, name):
            return getattr(self.db, name)
        try:
            return self.db[name]
        except Exception:
            return None

    async def register_subscription(
        self,
        target_url: str,
        secret_key: str,
        events: Optional[List[str]] = None,
        tenant_id: Optional[str] = None,
        description: Optional[str] = None,
    ) -> WebhookSubscription:
        resolved_tenant = tenant_id or get_current_tenant_id()
        sub = WebhookSubscription(
            tenant_id=resolved_tenant,
            target_url=target_url,
            secret_key=secret_key,
            events=events or ["*"],
            description=description,
        )
        coll = self._get_coll("webhook_subscriptions")
        if coll is not None:
            await coll.insert_one(sub.dict())
        logger.info("Webhook subscription registered", target_url=target_url, tenant_id=resolved_tenant)
        return sub

    async def dispatch_event(
        self,
        event_type: str,
        data: Dict[str, Any],
        tenant_id: Optional[str] = None,
        max_retries: Optional[int] = None,
        base_backoff_sec: float = 0.5,
    ) -> List[WebhookDeliveryResult]:
        resolved_tenant = tenant_id or get_current_tenant_id()
        retries_limit = max_retries if max_retries is not None else self.max_retries
        subscriptions: List[WebhookSubscription] = []

        coll = self._get_coll("webhook_subscriptions")
        if coll is not None:
            cursor = coll.find({
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
            if "*" not in sub.events and event_type not in sub.events:
                continue

            signature = compute_webhook_signature(payload_json, sub.secret_key)
            headers = {
                "Content-Type": "application/json",
                "X-CareerShala-Signature": signature,
                "X-CareerShala-Event": event_type,
                "X-CareerShala-Delivery": payload_obj.event_id,
                "X-CareerShala-Tenant": resolved_tenant,
                "X-CareerPilot-Signature": signature,
            }

            status_code = 500
            success = False
            last_error = None
            attempts = 0

            if self._http_client:
                for attempt in range(1, retries_limit + 1):
                    attempts = attempt
                    try:
                        res = await self._http_client.post(sub.target_url, content=payload_json, headers=headers)
                        status_code = res.status_code
                        if 200 <= status_code < 300:
                            success = True
                            break
                        last_error = f"HTTP {status_code}: {res.text[:100]}"
                    except Exception as e:
                        last_error = str(e)
                        logger.warn("Webhook dispatch attempt failed", target_url=sub.target_url, attempt=attempt, error=str(e))
                    if attempt < retries_limit:
                        await asyncio.sleep(base_backoff_sec * (2 ** (attempt - 1)))
            else:
                status_code = 200
                success = True
                attempts = 1

            delivery = WebhookDeliveryResult(
                subscription_id=sub.id,
                target_url=sub.target_url,
                event_type=event_type,
                event_id=payload_obj.event_id,
                tenant_id=resolved_tenant,
                status_code=status_code,
                success=success,
                attempts=attempts,
                signature_header=signature,
                error=last_error
            )
            results.append(delivery)

            deliv_coll = self._get_coll("webhook_deliveries")
            if deliv_coll is not None:
                await deliv_coll.insert_one(delivery.dict())

        logger.info("Dispatched webhook event", event_type=event_type, dispatched_count=len(results))
        return results


# WebhookDispatcher alias for full backward compatibility
WebhookDispatcher = WebhookService
