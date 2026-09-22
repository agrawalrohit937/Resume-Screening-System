"""
CareerShala Enterprise Outbound Webhook Dispatcher with HMAC-SHA256 Signing.

Provides:
- Outbound event dispatching with HMAC-SHA256 request signatures (X-CareerShala-Signature).
- Standard headers: X-CareerShala-Event, X-CareerShala-Delivery, X-CareerShala-Timestamp.
- Exponential backoff retry mechanism with configurable retry policy.
- Per-tenant isolation for subscriptions and delivery audit logs.
- Signature verification helper for downstream receivers.
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
    events: List[str] = Field(default_factory=lambda: ["*"])  # e.g. ["job.published", "candidate.hired"]
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
    event_id: str
    tenant_id: str
    status_code: int
    success: bool
    attempts: int
    signature_header: str
    error: Optional[str] = None
    delivered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def compute_webhook_signature(payload_bytes_or_str: Union[bytes, str], secret: str) -> str:
    """
    Computes HMAC-SHA256 signature for outbound request payload.
    Format: 'sha256=<hex_digest>'
    """
    if isinstance(payload_bytes_or_str, str):
        payload_bytes = payload_bytes_or_str.encode("utf-8")
    else:
        payload_bytes = payload_bytes_or_str

    mac = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256)
    return f"sha256={mac.hexdigest()}"


def verify_webhook_signature(payload_bytes_or_str: Union[bytes, str], secret: str, signature_header: str) -> bool:
    """
    Verifies that an incoming webhook signature matches the expected HMAC-SHA256 digest using constant-time comparison.
    """
    if not signature_header:
        return False

    expected_sig = compute_webhook_signature(payload_bytes_or_str, secret)
    return hmac.compare_digest(expected_sig, signature_header.strip())


class WebhookDispatcher:
    """
    Dispatches outbound webhooks with exponential retry, HMAC signing, and tenant isolation.
    """

    def __init__(self, db: Any = None, http_client: Optional[httpx.AsyncClient] = None):
        self.db = db
        self._http_client = http_client

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
        """Registers a new webhook subscriber for an organization."""
        resolved_tenant = tenant_id or get_current_tenant_id()
        sub = WebhookSubscription(
            tenant_id=resolved_tenant,
            target_url=target_url,
            secret_key=secret_key,
            events=events or ["*"],
            description=description or "",
        )

        coll = self._get_coll("webhook_subscriptions")
        if coll is not None:
            sub_dict = sub.model_dump() if hasattr(sub, "model_dump") else sub.dict()
            res = coll.insert_one(sub_dict)
            if hasattr(res, "__await__"):
                await res

        logger.info(
            "Webhook subscription registered",
            subscription_id=sub.id,
            target_url=target_url,
            tenant_id=resolved_tenant,
            events=sub.events,
        )
        return sub

    async def get_subscriptions(self, tenant_id: Optional[str] = None) -> List[WebhookSubscription]:
        """Lists active subscriptions for a tenant."""
        resolved_tenant = tenant_id or get_current_tenant_id()
        coll = self._get_coll("webhook_subscriptions")
        if coll is None:
            return []

        cursor = coll.find({"tenant_id": resolved_tenant, "is_active": True})
        if hasattr(cursor, "to_list"):
            docs = await cursor.to_list(length=100)
        else:
            docs = list(cursor)

        return [WebhookSubscription(**d) for d in docs]

    async def dispatch_event(
        self,
        event_type: str,
        data: Dict[str, Any],
        tenant_id: Optional[str] = None,
        max_retries: int = 3,
        base_backoff_sec: float = 0.5,
    ) -> List[WebhookDeliveryResult]:
        """
        Dispatches an event to all matching active subscriber endpoints for the tenant.
        Executes HTTP delivery with exponential backoff on network/server failures.
        """
        resolved_tenant = tenant_id or get_current_tenant_id()
        subscriptions = await self.get_subscriptions(tenant_id=resolved_tenant)

        payload_obj = WebhookPayload(
            event_type=event_type,
            tenant_id=resolved_tenant,
            data=data,
        )
        payload_dict = payload_obj.model_dump() if hasattr(payload_obj, "model_dump") else payload_obj.dict()
        payload_json = json.dumps(payload_dict, default=str)
        payload_bytes = payload_json.encode("utf-8")

        results: List[WebhookDeliveryResult] = []

        for sub in subscriptions:
            # Check wildcard or explicit event subscription
            if "*" not in sub.events and event_type not in sub.events:
                continue

            signature = compute_webhook_signature(payload_bytes, sub.secret_key)
            headers = {
                "Content-Type": "application/json",
                "X-CareerShala-Signature": signature,
                "X-CareerShala-Event": event_type,
                "X-CareerShala-Delivery": payload_obj.event_id,
                "X-CareerShala-Timestamp": str(payload_obj.timestamp),
                "X-CareerShala-Tenant": resolved_tenant,
                # Backwards-compatibility header
                "X-CareerPilot-Signature": signature,
            }

            delivery = await self._deliver_with_retry(
                subscription=sub,
                event_type=event_type,
                event_id=payload_obj.event_id,
                payload_json=payload_json,
                headers=headers,
                signature=signature,
                tenant_id=resolved_tenant,
                max_retries=max_retries,
                base_backoff_sec=base_backoff_sec,
            )
            results.append(delivery)

            # Persist delivery log
            coll = self._get_coll("webhook_deliveries")
            if coll is not None:
                try:
                    del_dict = delivery.model_dump() if hasattr(delivery, "model_dump") else delivery.dict()
                    ins = coll.insert_one(del_dict)
                    if hasattr(ins, "__await__"):
                        await ins
                except Exception as db_err:
                    logger.warning("Failed to record webhook delivery audit", error=str(db_err))

        logger.info(
            "Dispatched webhook event",
            event_type=event_type,
            tenant_id=resolved_tenant,
            subscriber_count=len(results),
        )
        return results

    async def _deliver_with_retry(
        self,
        subscription: WebhookSubscription,
        event_type: str,
        event_id: str,
        payload_json: str,
        headers: Dict[str, str],
        signature: str,
        tenant_id: str,
        max_retries: int = 3,
        base_backoff_sec: float = 0.5,
    ) -> WebhookDeliveryResult:
        """Delivers single payload to subscriber URL with exponential backoff."""
        attempts = 0
        last_error = None
        status_code = 0
        success = False

        client_to_use = self._http_client

        while attempts < max_retries:
            attempts += 1
            try:
                if client_to_use is not None:
                    res = await client_to_use.post(
                        subscription.target_url,
                        content=payload_json,
                        headers=headers,
                        timeout=10.0,
                    )
                    status_code = res.status_code
                    success = 200 <= status_code < 300
                else:
                    async with httpx.AsyncClient() as client:
                        res = await client.post(
                            subscription.target_url,
                            content=payload_json,
                            headers=headers,
                            timeout=10.0,
                        )
                        status_code = res.status_code
                        success = 200 <= status_code < 300

                if success:
                    break

                last_error = f"HTTP status {status_code}"
            except Exception as exc:
                last_error = str(exc)
                status_code = 500
                success = False

            if attempts < max_retries:
                backoff = base_backoff_sec * (2 ** (attempts - 1))
                await asyncio.sleep(backoff)

        return WebhookDeliveryResult(
            subscription_id=subscription.id,
            target_url=subscription.target_url,
            event_type=event_type,
            event_id=event_id,
            tenant_id=tenant_id,
            status_code=status_code,
            success=success,
            attempts=attempts,
            signature_header=signature,
            error=None if success else last_error,
        )


# Global singleton instance
webhook_dispatcher = WebhookDispatcher()
