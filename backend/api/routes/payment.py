import uuid
import structlog
from config.db import get_pg_session_factory
from sqlalchemy import select, update
from models.tables import Company, User, UserGamification
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from api.deps import get_current_user, get_user_repo
from schemas.user_schema import UserModel, MessageResponse
from services.razorpay_service import razorpay_service

logger = structlog.get_logger(__name__)

router = APIRouter()

# --- Request/Response Schemas ---

class ChoosePlanRequest(BaseModel):
    plan: str = Field(..., description="Plan to activate: free | pro | premium")

class CancelSubscriptionRequest(BaseModel):
    reason: Optional[str] = Field(default=None, description="Optional cancellation reason")
    feedback: Optional[str] = Field(default=None, description="Optional feedback details")

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


# --- Helper Functions & Pricing Map ---

VALID_PLANS = {
    'free',
    'pro',
    'premium',
    'candidate_pro',
    'candidate_premium',
    'recruiter_pro',
    'recruiter_enterprise',
    'growth',
    'enterprise',
}

PLAN_PRICING_INR = {
    'free': 0,
    'pro': 199,
    'candidate_pro': 199,
    'premium': 399,
    'candidate_premium': 399,
    'recruiter_pro': 999,
    'growth': 999,
    'recruiter_enterprise': 2499,
    'enterprise': 2499,
}

def _normalize(plan: str) -> str:
    p = (plan or '').strip().lower()
    if p in VALID_PLANS:
        return p
    raise HTTPException(status_code=400, detail='Invalid plan. Select a valid Candidate or Recruiter plan.')


async def activate_user_subscription(
    user_repo: Any,
    user_id: str,
    plan_name: str,
    days: int = 90,
) -> Optional[UserModel]:
    """
    Bulletproof activation engine for user subscriptions (Default 3 Months / 90 Days):
    - Normalizes plan name.
    - If plan is 'free', downgrades account and resets active subscription states.
    - If paid, checks if user currently has active time remaining on their subscription:
      * Early renewal: appends `days` (90 days) to their existing `subscription_end_date`.
      * Fresh activation or expired: sets start_date = now and end_date = now + timedelta(days=days).
    - Transitions subscription_status = 'active', subscription_active = True.
    - Persists updates and returns updated UserModel.
    """
    user = await user_repo.get_by_id(user_id)
    if not user:
        return None

    normalized_plan = (plan_name or "free").strip().lower()
    now = datetime.now(timezone.utc)

    if normalized_plan == "free":
        updates = {
            "plan": "free",
            "subscription_active": False,
            "subscription_status": "expired",
            "subscription_end_date": None,
            "plan_updated_at": now,
        }
        return await user_repo.update(user_id, updates)

    def _normalize_dt(val: Any) -> Optional[datetime]:
        if not val:
            return None
        if isinstance(val, str):
            try:
                val = datetime.fromisoformat(val.replace("Z", "+00:00"))
            except Exception:
                return None
        if isinstance(val, datetime):
            return val.replace(tzinfo=timezone.utc) if val.tzinfo is None else val.astimezone(timezone.utc)
        return None

    # Paid plan: 'pro' or 'premium'
    user_end_date = _normalize_dt(user.subscription_end_date)

    has_future_expiry = (
        user.subscription_active
        and user_end_date is not None
        and user_end_date > now
    )

    if has_future_expiry:
        user_start_date = _normalize_dt(user.subscription_start_date)
        is_same_recent_activation = (
            user_start_date is not None 
            and abs((now - user_start_date).total_seconds()) < 900
        )
        if is_same_recent_activation:
            # Duplicate activation within 15 minutes (e.g. webhook + frontend verify): do NOT double-extend days!
            start_date = user_start_date
            end_date = user_end_date
        else:
            # Genuine early renewal: preserve remaining days and extend
            start_date = user_start_date or now
            end_date = user_end_date + timedelta(days=days)
    else:
        # Fresh activation or renewal after expiration
        start_date = now
        end_date = now + timedelta(days=days)

    updates = {
        "plan": normalized_plan,
        "subscription_active": True,
        "subscription_status": "active",
        "subscription_start_date": start_date,
        "subscription_end_date": end_date,
        "plan_updated_at": now,
    }

    res = await user_repo.update(user_id, updates)

    # 🏢 Automatic Company & Team Member Subscription Inheritance:
    # If the user is an Executive / belongs to a company tenant and activates a plan,
    # propagate the subscription immediately to ALL team members (recruiters, interviewers) under that company!
    tenant_id = getattr(user, "tenant_id", None)
    if tenant_id and tenant_id != "default":
        try:
            async with get_pg_session_factory()() as session:
                comp_stmt = select(Company).where(Company.tenant_id == tenant_id)
                comp = (await session.execute(comp_stmt)).scalar_one_or_none()
                if not comp:
                    new_comp = Company(
                        id=str(uuid.uuid4()),
                        tenant_id=tenant_id,
                        company_name=tenant_id.replace("-", " ").title(),
                        created_at=now,
                        updated_at=now,
                    )
                    session.add(new_comp)

                await session.execute(
                    update(User)
                    .where(User.tenant_id == tenant_id)
                    .values(
                        plan=normalized_plan,
                        subscription_active=True,
                        subscription_status="active",
                        subscription_start_date=start_date,
                        subscription_end_date=end_date,
                        plan_updated_at=now,
                    )
                )
                await session.commit()
                logger.info(
                    "Propagated company subscription to team members",
                    tenant_id=tenant_id,
                    plan=normalized_plan,
                )
        except Exception as e:
            logger.error("Failed to propagate company subscription to team members", error=str(e))

    return res


# --- Routes ---

@router.post('/cancel', response_model=MessageResponse)
async def cancel_subscription(
    payload: Optional[CancelSubscriptionRequest] = None,
    current_user: UserModel = Depends(get_current_user),
    user_repo=Depends(get_user_repo),
):
    """
    Cancels the user's active paid subscription, reverts their account to the Free tier,
    and records the cancellation in their payment history.
    """
    if current_user.plan == 'free' and not current_user.subscription_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You do not have an active paid subscription to cancel."
        )

    prev_plan = current_user.plan or 'pro'
    reason = payload.reason if payload and payload.reason else "User initiated cancellation"
    feedback = payload.feedback if payload else None

    updates = {
        'plan': 'free',
        'subscription_active': False,
        'subscription_status': 'cancelled',
        'subscription_end_date': None,
        'plan_updated_at': datetime.now(timezone.utc),
    }

    updated = await user_repo.update(str(current_user.id), updates)
    if not updated:
        raise HTTPException(status_code=404, detail='User not found')

    # Append cancellation event into user's payment history
    cancel_record = {
        'order_id': 'sub_cancellation',
        'payment_id': 'cancelled',
        'plan': f"Cancelled {prev_plan.capitalize()}",
        'amount': 0,
        'status': 'cancelled',
        'reason': reason,
        'feedback': feedback,
        'date': datetime.now(timezone.utc).isoformat(),
    }
    await user_repo.add_payment_history(str(current_user.id), cancel_record)

    # 🏢 Propagate cancellation to tenant members
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id and tenant_id != "default":
        try:
            now_dt = datetime.now(timezone.utc)
            async with get_pg_session_factory()() as session:
                await session.execute(
                    update(User)
                    .where(User.tenant_id == tenant_id)
                    .values(
                        plan="free",
                        subscription_active=False,
                        subscription_status="cancelled",
                        subscription_end_date=None,
                        plan_updated_at=now_dt,
                    )
                )
                await session.commit()
                logger.info("Propagated subscription cancellation to tenant members", tenant_id=tenant_id)
        except Exception as e:
            logger.error("Failed to propagate subscription cancellation to tenant members", error=str(e))

    return MessageResponse(message="Subscription cancelled successfully. Your plan has been reverted to Free.")


@router.post('/choose', response_model=MessageResponse)
async def choose_plan(
    payload: ChoosePlanRequest,
    current_user: UserModel = Depends(get_current_user),
    user_repo=Depends(get_user_repo),
):
    plan = _normalize(payload.plan)
    days = 0 if plan == 'free' else 90
    updated = await activate_user_subscription(user_repo, str(current_user.id), plan, days=days)
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
        
    order_details = razorpay_service.create_order(
        plan,
        user_info={
            "user_id": str(current_user.id),
            "email": current_user.email,
            "full_name": current_user.full_name,
        }
    )
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

    # Idempotency check: if this payment has already been verified and recorded, return successfully
    existing_pids = [p.get("payment_id") for p in (getattr(current_user, "payment_history", []) or [])]
    if payload.razorpay_payment_id in existing_pids:
        return MessageResponse(message=f"Payment already verified. Plan is active.")
        
    # Apply database persistence changes for the active tier upgrade via bulletproof activation engine (90 days / 3 months)
    updated = await activate_user_subscription(user_repo, str(current_user.id), plan, days=90)
    if not updated:
        raise HTTPException(status_code=404, detail='User not found')

    paid_amount = PLAN_PRICING_INR.get(plan, 199 if 'pro' in plan else 399)
    payment_record = {
        'order_id': payload.razorpay_order_id,
        'payment_id': payload.razorpay_payment_id,
        'plan': plan.replace('_', ' ').title(),
        'amount': paid_amount,
        'duration': '3 months (90 days)',
        'status': 'paid',
        'date': datetime.now(timezone.utc).isoformat(),
    }
    await user_repo.add_payment_history(str(current_user.id), payment_record)

    return MessageResponse(message=f"Payment verified. Successfully upgraded to {plan}!")


# --- Webhook & Failure Reporting Endpoints ---

class ReportFailureRequest(BaseModel):
    plan: str
    order_id: Optional[str] = None
    failure_reason: str
    failure_code: Optional[str] = "user_or_gateway_failed"


@router.post('/report-failure', response_model=MessageResponse)
async def report_payment_failure(
    payload: ReportFailureRequest,
    current_user: UserModel = Depends(get_current_user),
    user_repo=Depends(get_user_repo),
):
    """
    Client failure report endpoint. Records payment failure for troubleshooting.
    """
    logger.warning(
        "Payment failure reported",
        user_id=str(current_user.id),
        plan=payload.plan,
        reason=payload.failure_reason,
        order_id=payload.order_id,
    )
    return MessageResponse(message="Payment failure recorded.")


@router.post('/webhook')
async def razorpay_webhook(
    request: Request,
):
    """
    Razorpay Webhook listener.
    Cryptographically verifies the Razorpay signature and routes failure or success events.
    """
    signature = request.headers.get("X-Razorpay-Signature") or request.headers.get("x-razorpay-signature")
    body_bytes = await request.body()
    body_str = body_bytes.decode("utf-8")

    # Cryptographically verify webhook signature strictly using RAZORPAY_WEBHOOK_SECRET
    if not signature:
        raise HTTPException(status_code=400, detail="Missing X-Razorpay-Signature header")

    valid = razorpay_service.verify_webhook_signature(body_str, signature)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    import json
    try:
        data = json.loads(body_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = data.get("event", "")
    payload_obj = data.get("payload", {})
    payment_entity = payload_obj.get("payment", {}).get("entity", {})

    from repositories.user_repo import UserRepository
    user_repo = UserRepository()

    # 1. Handle Payment Failure Events
    if event in ("payment.failed", "subscription.halted", "subscription.charge_failed"):
        notes = payment_entity.get("notes") or {}
        user_email = payment_entity.get("email") or notes.get("email") or ""
        error_desc = payment_entity.get("error_description") or "Gateway charge failed"
        order_id = payment_entity.get("order_id")

        logger.warning(
            "Razorpay payment failure event received",
            user_email=user_email,
            order_id=order_id,
            error=error_desc,
        )
        return {"status": "processed", "event": event}

    # 2. Handle Payment Success Events
    elif event in ("payment.captured", "order.paid"):
        notes = payment_entity.get("notes") or {}
        user_email = payment_entity.get("email") or notes.get("email")
        notes_user_id = notes.get("user_id")

        user_doc = None
        if notes_user_id:
            user_doc = await user_repo.get_by_id(notes_user_id)
        if not user_doc and user_email:
            user_doc = await user_repo.get_by_email(user_email)

        if user_doc:
            payment_id = payment_entity.get("id")
            order_id = payment_entity.get("order_id")
            existing_pids = [p.get("payment_id") for p in (user_doc.payment_history or [])]
            if payment_id and payment_id in existing_pids:
                return {"status": "already_processed", "event": event}

            # Map plan from notes, or infer from amount
            plan_from_notes = notes.get("plan")
            if plan_from_notes:
                resolved_plan = plan_from_notes.strip().lower()
            else:
                amount_val = float(payment_entity.get("amount", 29900)) / 100.0
                resolved_plan = "premium" if amount_val >= 499.0 else "pro"

            await activate_user_subscription(user_repo, str(user_doc.id), resolved_plan, days=90)

            # Record in payment_history if not already present
            if payment_id:
                payment_record = {
                    "order_id": order_id or "webhook_order",
                    "payment_id": payment_id,
                    "plan": resolved_plan.replace('_', ' ').title(),
                    "amount": int(payment_entity.get("amount", 29900)) / 100.0,
                    "duration": "3 months (90 days)",
                    "status": "paid",
                    "date": datetime.now(timezone.utc).isoformat(),
                    "source": "razorpay_webhook",
                }
                await user_repo.add_payment_history(str(user_doc.id), payment_record)

            active_case = await recovery_repo.get_active_case_for_user(str(user_doc.id))
            if active_case:
                await recovery_repo.update_case(active_case.case_id, {
                    "status": RecoveryStatus.RECOVERED.value,
                    "recovered_at": datetime.now(timezone.utc),
                    "payment_id": payment_entity.get("id"),
                })
                await recovery_repo.add_audit_log(
                    case_id=active_case.case_id,
                    action="PAYMENT_RECOVERED_WEBHOOK",
                    actor=ActorType.SYSTEM,
                    actor_name="Razorpay Webhook",
                    details={"payment_id": payment_entity.get("id"), "event": event, "plan": resolved_plan},
                    reasoning=f"Webhook event '{event}' confirmed payment settlement and provisioned {resolved_plan} plan."
                )

        return {"status": "processed", "event": event}

    return {"status": "ignored", "event": event}