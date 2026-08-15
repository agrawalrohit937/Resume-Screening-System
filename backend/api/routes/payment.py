from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.deps import get_current_user, get_user_repo
from models.user_model import UserModel
from schemas.user_schema import MessageResponse
from services.razorpay_service import razorpay_service

router = APIRouter()

# --- Request/Response Schemas ---

class ChoosePlanRequest(BaseModel):
    plan: str = Field(..., description="Plan to activate: free | pro | premium")

class CheckoutRequest(BaseModel):
    plan: str = Field(..., description="Plan to checkout: pro | premium")

class CheckoutResponse(BaseModel):
    id: str
    amount: int
    currency: str
    razorpay_key_id: str

class VerifyPaymentRequest(BaseModel):
    plan: str = Field(..., description="The plan user is paying for")
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# --- Helper Function ---

def _normalize(plan: str) -> str:
    p = (plan or '').strip().lower()
    if p in ('free', 'pro', 'premium'):
        return p
    raise HTTPException(status_code=400, detail='Invalid plan. Use free | pro | premium')


# --- Routes ---

@router.post('/choose', response_model=MessageResponse)
async def choose_plan(
    payload: ChoosePlanRequest,
    current_user: UserModel = Depends(get_current_user),
    user_repo=Depends(get_user_repo),
):
    plan = _normalize(payload.plan)

    updates = {
        'plan': plan,
        'subscription_active': (plan != 'free'),
        'plan_updated_at': datetime.now(timezone.utc),
    }

    updated = await user_repo.update(str(current_user.id), updates)
    if not updated:
        raise HTTPException(status_code=404, detail='User not found')

    return MessageResponse(message=f'Plan updated to {plan}')


@router.post('/checkout', response_model=CheckoutResponse)
async def create_checkout(
    payload: CheckoutRequest,
    current_user: UserModel = Depends(get_current_user)
):
    """
    Step 1: Frontend triggers this endpoint when a user requests a paid plan.
    It provisions a secure order with Razorpay and returns the payload tracking references.
    """
    plan = _normalize(payload.plan)
    if plan == 'free':
        raise HTTPException(status_code=400, detail="Free plan does not require checkout.")
        
    order_details = razorpay_service.create_order(plan)
    return order_details


@router.post('/verify', response_model=MessageResponse)
async def verify_payment(
    payload: VerifyPaymentRequest,
    current_user: UserModel = Depends(get_current_user),
    user_repo=Depends(get_user_repo),
):
    """
    Step 2: Frontend passes gateway handshake parameters here after successful authorization.
    If validation hashes match, database variables are transitioned to the new premium status.
    """
    plan = _normalize(payload.plan)
    
    # Run cryptographic check against the provided digital signatures
    is_valid = razorpay_service.verify_signature(
        razorpay_order_id=payload.razorpay_order_id,
        razorpay_payment_id=payload.razorpay_payment_id,
        razorpay_signature=payload.razorpay_signature
    )
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment verification failed. Invalid signature."
        )
        
    # Apply database persistence changes for the active tier upgrade
    updates = {
        'plan': plan,
        'subscription_active': True,
        'plan_updated_at': datetime.now(timezone.utc),
    }
    
    updated = await user_repo.update(str(current_user.id), updates)
    if not updated:
        raise HTTPException(status_code=404, detail='User not found')

    payment_record = {
        'order_id': payload.razorpay_order_id,
        'payment_id': payload.razorpay_payment_id,
        'plan': plan.capitalize(),
        'amount': 299 if plan == 'pro' else 499,
        'status': 'paid',
        'date': datetime.now(timezone.utc).isoformat(),
    }
    await user_repo.add_payment_history(str(current_user.id), payment_record)
        
    return MessageResponse(message=f"Payment verified. Successfully upgraded to {plan}!")