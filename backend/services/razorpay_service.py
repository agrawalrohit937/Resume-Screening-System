from typing import Optional, Dict, Any
from fastapi import HTTPException
import razorpay
from core.config import settings

class RazorpayService:
    def __init__(self):
        self._init_client()

    def _init_client(self):
        self.key_id = getattr(settings, 'RAZORPAY_KEY_ID', None)
        self.key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', None)
        
        if self.key_id and self.key_secret:
            try:
                self.client = razorpay.Client(auth=(self.key_id, self.key_secret))
            except Exception:
                self.client = None
        else:
            self.client = None

    @property
    def is_configured(self) -> bool:
        # Re-check settings dynamically in case env vars were updated
        self.key_id = getattr(settings, 'RAZORPAY_KEY_ID', None)
        self.key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', None)
        if self.key_id and self.key_secret and not self.client:
            try:
                self.client = razorpay.Client(auth=(self.key_id, self.key_secret))
            except Exception:
                self.client = None
        return bool(self.key_id and self.key_secret and self.client)

    def create_order(self, plan: str, user_info: Optional[Dict[str, Any]] = None) -> dict:
        """
        Provisions a server-side order with Razorpay.
        Attaches user_info in notes so subsequent webhooks can always link back to the user.
        """
        if not self.is_configured:
            raise HTTPException(
                status_code=503,
                detail="Razorpay payment gateway is not configured on the server. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
            )

        import hashlib
        pricing = {
            "pro": 29900,
            "premium": 49900
        }
        
        amount = pricing.get(plan.lower())
        if not amount:
            raise HTTPException(status_code=400, detail="Invalid plan for paid checkout.")

        try:
            order_data = {
                "amount": amount,
                "currency": "INR",
                "receipt": f"receipt_plan_{plan}_{int(hashlib.sha256(plan.encode()).hexdigest(), 16) % 10**8}",
                "payment_capture": 1  # 1 indicates automatic capture upon authorization
            }

            if user_info:
                order_data["notes"] = {
                    "user_id": str(user_info.get("user_id", "")),
                    "email": str(user_info.get("email", "")),
                    "full_name": str(user_info.get("full_name", "")),
                    "plan": plan.lower(),
                }
            
            razorpay_order = self.client.order.create(data=order_data)
            
            return {
                "id": razorpay_order["id"],
                "amount": razorpay_order["amount"],
                "currency": razorpay_order["currency"],
                "razorpay_key_id": self.key_id
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to create Razorpay order: {str(e)}"
            )

    def verify_signature(self, razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str) -> bool:
        """
        Verifies checkout signatures using HMAC SHA256.
        """
        if not self.is_configured:
            return False

        try:
            self.client.utility.verify_payment_signature({
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            })
            return True
        except Exception:
            try:
                import hmac
                import hashlib
                msg = f"{razorpay_order_id}|{razorpay_payment_id}"
                generated_signature = hmac.new(
                    bytes(self.key_secret, 'utf-8'),
                    bytes(msg, 'utf-8'),
                    hashlib.sha256
                ).hexdigest()
                return hmac.compare_digest(generated_signature, razorpay_signature)
            except Exception:
                return False

    def verify_webhook_signature(self, webhook_body: str, webhook_signature: str, webhook_secret: Optional[str] = None) -> bool:
        """
        Verifies the authenticity of Razorpay Webhook payloads using HMAC SHA256.
        Tries RAZORPAY_WEBHOOK_SECRET, falling back to RAZORPAY_KEY_SECRET in case the developer
        used the key secret as their webhook secret in Razorpay Dashboard.
        """
        if not webhook_body or not webhook_signature:
            return False

        secret = webhook_secret or getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', None)
        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', None)
        secrets_to_try = [s for s in [secret, key_secret] if s]

        if not secrets_to_try:
            logger.warning("No webhook secret or key secret available to verify Razorpay webhook signature")
            return False

        import hmac
        import hashlib

        for candidate in secrets_to_try:
            try:
                if self.client and hasattr(self.client.utility, 'verify_webhook_signature'):
                    self.client.utility.verify_webhook_signature(webhook_body, webhook_signature, candidate)
                    return True
            except Exception:
                pass

            try:
                generated_signature = hmac.new(
                    bytes(candidate, 'utf-8'),
                    bytes(webhook_body, 'utf-8') if isinstance(webhook_body, str) else webhook_body,
                    hashlib.sha256
                ).hexdigest()
                if hmac.compare_digest(generated_signature, webhook_signature):
                    return True
            except Exception:
                pass

        logger.warning("Razorpay webhook signature verification failed with all candidate secrets")
        return False

    def create_recovery_order(self, plan: str, discount_pct: int = 0, user_id: Optional[str] = None) -> dict:
        """
        Creates a discounted or standard order for payment recovery retry.
        Bounded discount is applied if valid.
        """
        pricing = {
            "pro": 299,
            "premium": 499
        }
        base_amount = pricing.get(plan.lower(), 299)
        clamped_discount = max(0, min(20, discount_pct))  # Hard guardrail
        discounted_amount = base_amount * (1.0 - (clamped_discount / 100.0))
        amount_paisa = int(discounted_amount * 100)

        if not self.is_configured:
            # Safe mock fallback for test mode / local development
            import hashlib
            fake_id = f"order_rec_{plan}_{int(hashlib.sha256(f'{plan}_{user_id}_{amount_paisa}'.encode()).hexdigest(), 16) % 10**8}"
            return {
                "id": fake_id,
                "amount": amount_paisa,
                "currency": "INR",
                "razorpay_key_id": self.key_id or "rzp_test_mockkey",
                "discount_pct": clamped_discount,
                "discounted_amount": discounted_amount,
                "is_mock": True,
            }

        import hashlib
        try:
            order_data = {
                "amount": amount_paisa,
                "currency": "INR",
                "receipt": f"rec_{plan}_{int(hashlib.sha256(f'{plan}_{user_id}'.encode()).hexdigest(), 16) % 10**8}",
                "payment_capture": 1,
                "notes": {
                    "recovery_flow": "true",
                    "plan": plan,
                    "discount_pct": str(clamped_discount),
                    "user_id": str(user_id or ""),
                }
            }
            razorpay_order = self.client.order.create(data=order_data)
            return {
                "id": razorpay_order["id"],
                "amount": razorpay_order["amount"],
                "currency": razorpay_order["currency"],
                "razorpay_key_id": self.key_id,
                "discount_pct": clamped_discount,
                "discounted_amount": discounted_amount,
                "is_mock": False,
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create recovery order: {str(e)}")

# Singleton instance to prevent multiple client instantiations across routes
razorpay_service = RazorpayService()