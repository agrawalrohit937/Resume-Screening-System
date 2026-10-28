from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from api.deps import get_current_user, get_user_repo
from models.user_model import UserModel
from schemas.user_schema import MessageResponse
from services.razorpay_service import razorpay_service

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
    # propagate the subscription immediately to the company profile and ALL team members (recruiters, interviewers) under that company!
    tenant_id = getattr(user, "tenant_id", None)
    if tenant_id and tenant_id != "default":
        try:
            from config.db import get_database as _get_raw_db
            raw_db = _get_raw_db()
            await raw_db.companies.update_one(
                {"tenant_id": tenant_id},
                {"$set": {
                    "plan": normalized_plan,
                    "subscription_active": True,
                    "subscription_status": "active",
                    "subscription_start_date": start_date,
                    "subscription_end_date": end_date,
                    "subscribed_by": str(user.id),
                    "updated_at": now,
                }},
                upsert=True,
            )
            # Instantly unlock premium for all recruiters, interviewers, and team members of this company!
            await raw_db.users.update_many(
                {"tenant_id": tenant_id},
                {"$set": {
                    "plan": normalized_plan,
                    "subscription_active": True,
                    "subscription_status": "active",
                    "subscription_start_date": start_date,
                    "subscription_end_date": end_date,
                    "company_subscription": True,
                    "plan_updated_at": now,
                }}
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

    # 🏢 Propagate cancellation to tenant company profile and members
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id and tenant_id != "default":
        try:
            from config.db import get_database as _get_raw_db
            raw_db = _get_raw_db()
            now_dt = datetime.now(timezone.utc)
            await raw_db.companies.update_one(
                {"tenant_id": tenant_id},
                {"$set": {
                    "plan": "free",
                    "subscription_active": False,
                    "subscription_status": "cancelled",
                    "subscription_end_date": None,
                    "updated_at": now_dt,
                }}
            )
            await raw_db.users.update_many(
                {"tenant_id": tenant_id},
                {"$set": {
                    "plan": "free",
                    "subscription_active": False,
                    "subscription_status": "cancelled",
                    "subscription_end_date": None,
                    "plan_updated_at": now_dt,
                }}
            )
        except Exception:
            pass

    # If user had an active recovery case, close it as churned
    try:
        from config.db import get_database
        from repositories.revenue_recovery_repo import RevenueRecoveryRepository
        from models.revenue_recovery_model import RecoveryStatus, ActorType
        db = get_database()
        recovery_repo = RevenueRecoveryRepository(db)
        active_case = await recovery_repo.get_active_case_for_user(str(current_user.id))
        if active_case:
            await recovery_repo.update_case(active_case.case_id, {
                "status": RecoveryStatus.CHURNED.value,
                "closed_at": datetime.now(timezone.utc),
            })
            await recovery_repo.add_audit_log(
                case_id=active_case.case_id,
                action="SUBSCRIPTION_CANCELLED_BY_USER",
                actor=ActorType.USER,
                actor_name=current_user.full_name,
                details={"reason": reason, "prev_plan": prev_plan},
                reasoning="User cancelled subscription directly from billing page."
            )
    except Exception:
        pass

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

    # If user had an active recovery case, close it as recovered
    try:
        from config.db import get_database
        from repositories.revenue_recovery_repo import RevenueRecoveryRepository
        from models.revenue_recovery_model import RecoveryStatus, ActorType
        db = get_database()
        recovery_repo = RevenueRecoveryRepository(db)
        active_case = await recovery_repo.get_active_case_for_user(str(current_user.id))
        if active_case:
            await recovery_repo.update_case(active_case.case_id, {
                "status": RecoveryStatus.RECOVERED.value,
                "recovered_at": datetime.now(timezone.utc),
                "payment_id": payload.razorpay_payment_id,
            })
            await recovery_repo.add_audit_log(
                case_id=active_case.case_id,
                action="PAYMENT_RECOVERED_SUCCESS",
                actor=ActorType.USER,
                actor_name=current_user.full_name,
                details={"order_id": payload.razorpay_order_id, "payment_id": payload.razorpay_payment_id, "plan": plan},
                reasoning="Payment successfully verified through gateway checkout."
            )
    except Exception as e:
        pass
        
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
    Client or gateway failure report endpoint.
    Initializes or updates a recovery case and triggers the LangGraph recovery workflow.
    """
    plan = _normalize(payload.plan)
    amount = 299.0 if plan == 'pro' else 499.0

    from config.db import get_database
    from repositories.revenue_recovery_repo import RevenueRecoveryRepository
    from workflows.revenue_recovery_graph import revenue_recovery_pipeline
    from models.revenue_recovery_model import RecoveryStatus, ActorType

    db = get_database()
    recovery_repo = RevenueRecoveryRepository(db)

    # Check for existing active recovery case
    existing_case = await recovery_repo.get_active_case_for_user(str(current_user.id))
    attempt_count = (existing_case.attempt_count + 1) if existing_case else 0

    # Fetch user gamification and profile
    gamification_profile = await db.user_gamification.find_one({"user_id": str(current_user.id)}) or {}

    # Run LangGraph pipeline
    init_state = {
        "case_id": existing_case.case_id if existing_case else "",
        "user_id": str(current_user.id),
        "user_name": current_user.full_name,
        "user_email": current_user.email,
        "user_phone": current_user.phone,
        "plan": plan,
        "amount": amount,
        "currency": "INR",
        "renewal_date": datetime.now(timezone.utc),
        "failure_reason": payload.failure_reason,
        "failure_code": payload.failure_code,
        "attempt_count": attempt_count,
        "user_dict": current_user.model_dump() if hasattr(current_user, "model_dump") else current_user.dict(),
        "gamification_dict": gamification_profile,
        "payment_history": current_user.payment_history or [],
        "communication_history": [],
        "simulation_mode": False,
    }

    graph_result = await revenue_recovery_pipeline.ainvoke(init_state)

    case_updates = {
        "user_id": str(current_user.id),
        "user_name": current_user.full_name,
        "user_email": current_user.email,
        "user_phone": current_user.phone,
        "plan": plan,
        "amount": amount,
        "currency": "INR",
        "order_id": payload.order_id,
        "failure_reason": payload.failure_reason,
        "failure_code": payload.failure_code,
        "failed_at": datetime.now(timezone.utc),
        "risk_score": graph_result.get("risk_score", 50),
        "risk_level": graph_result.get("risk_level", "MEDIUM"),
        "risk_factors": graph_result.get("risk_factors", []),
        "explanation": graph_result.get("risk_explanation", ""),
        "selected_strategy": graph_result.get("selected_strategy", "SEND_EMAIL"),
        "selected_channel": graph_result.get("selected_channel", "EMAIL"),
        "status": graph_result.get("recovery_status", RecoveryStatus.RECOVERY_ACTIVE.value),
        "attempt_count": attempt_count,
        "human_review_required": graph_result.get("human_review_required", False),
        "human_review_reason": graph_result.get("human_review_reason"),
        "offer": graph_result.get("offer", {}),
        "message_subject": graph_result.get("generated_message_subject"),
        "message_content": graph_result.get("generated_message_body"),
        "agent_reasoning": graph_result.get("strategy_reasoning"),
    }

    if existing_case:
        await recovery_repo.update_case(existing_case.case_id, case_updates)
        case_id = existing_case.case_id
    else:
        created = await recovery_repo.create_case(case_updates)
        case_id = created.case_id

    # Append audit log
    for audit in graph_result.get("audit_logs_to_append", []):
        await recovery_repo.add_audit_log(
            case_id=case_id,
            action=audit.get("action", "AI_ACTION_EXECUTED"),
            actor=ActorType.AI_AGENT,
            details=audit.get("details", {}),
            reasoning=audit.get("reasoning")
        )

    return MessageResponse(message=f"Payment failure registered. Recovery case {case_id} is active.")


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

    from config.db import get_database
    from repositories.revenue_recovery_repo import RevenueRecoveryRepository
    from repositories.user_repo import UserRepository
    from workflows.revenue_recovery_graph import revenue_recovery_pipeline
    from models.revenue_recovery_model import RecoveryStatus, ActorType

    db = get_database()
    recovery_repo = RevenueRecoveryRepository(db)
    user_repo = UserRepository(db)

    # 1. Handle Payment Failure Events
    if event in ("payment.failed", "subscription.halted", "subscription.charge_failed"):
        notes = payment_entity.get("notes") or {}
        user_email = payment_entity.get("email") or notes.get("email") or ""
        notes_user_id = notes.get("user_id")
        notes_full_name = notes.get("full_name")

        amount = float(payment_entity.get("amount", 29900)) / 100.0
        error_desc = payment_entity.get("error_description") or "Gateway charge failed"
        error_code = payment_entity.get("error_code") or "payment_failed"
        order_id = payment_entity.get("order_id")

        user_doc = None
        if notes_user_id:
            user_doc = await user_repo.get_by_id(notes_user_id)
        if not user_doc and user_email:
            user_doc = await user_repo.get_by_email(user_email)

        user_id = str(user_doc.id) if user_doc else (notes_user_id or "unlinked_customer")
        user_name = user_doc.full_name if user_doc else (notes_full_name or "Valued Learner")
        if not user_email and user_doc:
            user_email = user_doc.email

        logger.info(
            "Handling Razorpay payment failure event",
            user_id=user_id,
            user_email=user_email,
            order_id=order_id,
            error=error_desc,
        )

        existing_case = await recovery_repo.get_active_case_for_user(user_id) if user_doc else None
        attempt_count = (existing_case.attempt_count + 1) if existing_case else 0

        gamification_profile = (await db.user_gamification.find_one({"user_id": user_id})) or {}

        init_state = {
            "case_id": existing_case.case_id if existing_case else "",
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user_email,
            "plan": "pro" if amount < 400 else "premium",
            "amount": amount,
            "currency": "INR",
            "renewal_date": datetime.now(timezone.utc),
            "failure_reason": error_desc,
            "failure_code": error_code,
            "attempt_count": attempt_count,
            "user_dict": user_doc.model_dump() if user_doc else {},
            "gamification_dict": gamification_profile,
            "payment_history": user_doc.payment_history if user_doc else [],
            "communication_history": [],
            "simulation_mode": False,
        }

        graph_result = await revenue_recovery_pipeline.ainvoke(init_state)

        case_data = {
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user_email,
            "plan": "pro" if amount < 400 else "premium",
            "amount": amount,
            "order_id": order_id,
            "failure_reason": error_desc,
            "failure_code": error_code,
            "failed_at": datetime.now(timezone.utc),
            "risk_score": graph_result.get("risk_score", 70),
            "risk_level": graph_result.get("risk_level", "HIGH"),
            "risk_factors": graph_result.get("risk_factors", []),
            "explanation": graph_result.get("risk_explanation", ""),
            "selected_strategy": graph_result.get("selected_strategy", "SEND_EMAIL"),
            "selected_channel": graph_result.get("selected_channel", "EMAIL"),
            "status": graph_result.get("recovery_status", RecoveryStatus.RECOVERY_ACTIVE.value),
            "attempt_count": attempt_count,
            "human_review_required": graph_result.get("human_review_required", False),
            "human_review_reason": graph_result.get("human_review_reason"),
            "offer": graph_result.get("offer", {}),
            "agent_reasoning": graph_result.get("strategy_reasoning"),
        }

        if existing_case:
            await recovery_repo.update_case(existing_case.case_id, case_data)
            cid = existing_case.case_id
        else:
            c = await recovery_repo.create_case(case_data)
            cid = c.case_id

        for audit in graph_result.get("audit_logs_to_append", []):
            await recovery_repo.add_audit_log(
                case_id=cid,
                action=audit.get("action", "WEBHOOK_FAILURE_PROCESSED"),
                actor=ActorType.AI_AGENT,
                details=audit.get("details", {}),
                reasoning=audit.get("reasoning")
            )

        return {"status": "processed", "event": event, "case_id": cid}

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