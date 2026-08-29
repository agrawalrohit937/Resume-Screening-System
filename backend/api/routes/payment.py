from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
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
    gamification_profile = await db.gamification_profiles.find_one({"user_id": str(current_user.id)}) or {}

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
    webhook_secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', None)
    if webhook_secret or razorpay_service.is_configured:
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
        user_email = payment_entity.get("email") or ""
        amount = float(payment_entity.get("amount", 29900)) / 100.0
        error_desc = payment_entity.get("error_description") or "Gateway charge failed"
        error_code = payment_entity.get("error_code") or "payment_failed"
        order_id = payment_entity.get("order_id")

        user_doc = await user_repo.get_by_email(user_email) if user_email else None
        user_id = str(user_doc.id) if user_doc else "unlinked_customer"
        user_name = user_doc.full_name if user_doc else "Valued Learner"

        existing_case = await recovery_repo.get_active_case_for_user(user_id) if user_doc else None
        attempt_count = (existing_case.attempt_count + 1) if existing_case else 0

        gamification_profile = (await db.gamification_profiles.find_one({"user_id": user_id})) or {}

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
        user_email = payment_entity.get("email")
        if user_email:
            user_doc = await user_repo.get_by_email(user_email)
            if user_doc:
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
                        details={"payment_id": payment_entity.get("id"), "event": event},
                        reasoning=f"Webhook event '{event}' confirmed payment settlement."
                    )

        return {"status": "processed", "event": event}

    return {"status": "ignored", "event": event}