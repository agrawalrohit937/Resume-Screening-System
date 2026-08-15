from fastapi import HTTPException
import razorpay
# Import the settings class instance directly from your core config module
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

    def create_order(self, plan: str) -> dict:
        """
        Creates a new order instance on the Razorpay gateway servers.
        Note: Amounts must be calculated in Paisa (e.g., ₹299 = 29900 Paise).
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
        Mathematically verifies the authenticity of incoming payment tokens using HMAC SHA256.
        """
        if not self.is_configured:
            return False

        try:
            # Try Razorpay SDK verify utility first
            params_dict = {
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            }
            self.client.utility.verify_payment_signature(params_dict)
            return True
        except Exception:
            # Fallback to direct HMAC SHA256 check
            import hmac
            import hashlib
            try:
                msg = f"{razorpay_order_id}|{razorpay_payment_id}"
                generated_signature = hmac.new(
                    bytes(self.key_secret, 'utf-8'),
                    bytes(msg, 'utf-8'),
                    hashlib.sha256
                ).hexdigest()
                return hmac.compare_digest(generated_signature, razorpay_signature)
            except Exception:
                return False

# Singleton instance to prevent multiple client instantiations across routes
razorpay_service = RazorpayService()