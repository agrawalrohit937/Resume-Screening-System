"""
Revenue Recovery API Routes — Unified endpoints for AI-driven revenue recovery,
voice interactions, admin queue management, and analytics.
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
import structlog

from api.deps import get_admin_user, get_current_user, get_db
from models.user_model import UserModel
from models.revenue_recovery_model import (
    RecoveryCaseModel,
    RecoveryStatus,
    RiskLevel,
    RecoveryStrategy,
    RecoveryChannel,
    ActorType,
)
from repositories.revenue_recovery_repo import RevenueRecoveryRepository
from repositories.user_repo import UserRepository
from services.risk_scoring_service import risk_scoring_service
from services.voice_recovery_service import voice_recovery_service
from services.email_service import EmailService
from workflows.revenue_recovery_graph import revenue_recovery_pipeline

logger = structlog.get_logger(__name__)

router = APIRouter()


# ── Request / Response Schemas ──────────────────────────────────────────────

class VoiceTurnRequest(BaseModel):
    case_id: Optional[str] = None
    user_utterance: str
    conversation_history: List[Dict[str, str]] = Field(default_factory=list)
    plan: Optional[str] = "pro"
    amount: Optional[float] = 999.0
    user_name: Optional[str] = "Rahul"


class ApproveCaseRequest(BaseModel):
    admin_note: Optional[str] = None
    override_discount_pct: Optional[int] = None  # Enforced <= 20%


class TriggerChannelRequest(BaseModel):
    channel: str = Field(..., description="EMAIL | IN_APP | VOICE")
    custom_message: Optional[str] = None


class PayRecoveredRequest(BaseModel):
    case_id: str
    razorpay_payment_id: str
    razorpay_order_id: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# USER-FACING ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/voice/interact")
async def process_voice_turn(
    payload: VoiceTurnRequest,
    current_user: Optional[UserModel] = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Stateful Hinglish voice recovery conversational turn.
    Processes user speech and returns contextual AI Hinglish dialogue.
    """
    recovery_repo = RevenueRecoveryRepository(db)
    user_name = current_user.full_name if current_user else payload.user_name
    user_id = str(current_user.id) if current_user else (payload.case_id or "anonymous")

    turn_res = await voice_recovery_service.process_voice_turn(
        user_id=user_id,
        user_name=user_name,
        plan_name=payload.plan,
        amount=payload.amount,
        user_utterance=payload.user_utterance,
        conversation_history=payload.conversation_history,
        discount_eligible=True,
        max_discount_pct=20,
    )

    # If case_id provided, append voice interaction transcript
    if payload.case_id:
        try:
            case = await recovery_repo.get_by_id(payload.case_id)
            if case:
                v_data = case.voice_data.model_dump() if hasattr(case.voice_data, "model_dump") else case.voice_data.dict()
                v_data["voice_attempted"] = True
                v_data["timestamp"] = datetime.now(timezone.utc)
                v_data.setdefault("transcript", [])
                v_data["transcript"].append({"role": "user", "text": payload.user_utterance, "timestamp": datetime.now(timezone.utc)})
                v_data["transcript"].append({"role": "agent", "text": turn_res["agent_reply"], "timestamp": datetime.now(timezone.utc)})
                v_data["user_response"] = turn_res["intent"]

                updates = {
                    "voice_data": v_data,
                    "status": RecoveryStatus.CONTACTED.value if not turn_res.get("should_retry_payment") else RecoveryStatus.RETRY_SCHEDULED.value,
                }
                await recovery_repo.update_case(payload.case_id, updates)
                await recovery_repo.add_audit_log(
                    case_id=payload.case_id,
                    action="VOICE_DIALOGUE_TURN",
                    actor=ActorType.USER,
                    actor_name=user_name,
                    details={"utterance": payload.user_utterance, "intent": turn_res["intent"], "reply": turn_res["agent_reply"]},
                    reasoning=f"User responded: '{payload.user_utterance}'. AI recognized intent: {turn_res['intent']}."
                )
        except Exception as e:
            logger.warning("Failed to record voice turn to case", error=str(e))

    return turn_res


@router.post("/pay-recovered")
async def pay_recovered(
    payload: PayRecoveredRequest,
    current_user: Optional[UserModel] = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Marks a recovery case as successfully paid and updates the user's plan.
    """
    recovery_repo = RevenueRecoveryRepository(db)
    user_repo = UserRepository(db)

    case = await recovery_repo.get_by_id(payload.case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")

    recovered_at = datetime.now(timezone.utc)
    payment_id = payload.razorpay_payment_id or f"pay_rec_{int(datetime.now().timestamp())}"

    # Update case status
    await recovery_repo.update_case(case.case_id, {
        "status": RecoveryStatus.RECOVERED.value,
        "recovered_at": recovered_at,
        "payment_id": payment_id,
        "human_review_required": False,
    })

    # Add audit log
    await recovery_repo.add_audit_log(
        case_id=case.case_id,
        action="PAYMENT_RECOVERY_SUCCESS",
        actor=ActorType.USER if current_user else ActorType.SYSTEM,
        actor_name=current_user.full_name if current_user else "Direct Payment Gateway",
        details={"payment_id": payment_id, "amount_recovered": case.amount, "plan": case.plan},
        reasoning=f"Successfully recovered ₹{case.amount:.0f} revenue for {case.plan.capitalize()} subscription."
    )

    # Upgrade user if valid user ID
    if case.user_id and case.user_id not in ("anonymous", "unlinked_customer"):
        try:
            await user_repo.update(case.user_id, {
                "plan": case.plan.lower(),
                "subscription_active": True,
                "plan_updated_at": recovered_at,
            })
            await user_repo.add_payment_history(case.user_id, {
                "payment_id": payment_id,
                "plan": case.plan.capitalize(),
                "amount": case.amount,
                "status": "paid (recovered)",
                "date": recovered_at.isoformat(),
            })
        except Exception as e:
            logger.warning("Could not update user record after recovery", error=str(e))

    return {
        "status": "success",
        "case_id": case.case_id,
        "amount_recovered": case.amount,
        "message": f"Payment successfully recovered! Account upgraded to {case.plan.capitalize()}."
    }


@router.get("/my-recovery-banner")
async def get_my_recovery_banner(
    current_user: UserModel = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Returns active recovery notification or bounded discount offer for current user banner.
    """
    recovery_repo = RevenueRecoveryRepository(db)
    active_case = await recovery_repo.get_active_case_for_user(str(current_user.id))
    if not active_case:
        return {"has_active_recovery": False}

    return {
        "has_active_recovery": True,
        "case_id": active_case.case_id,
        "plan": active_case.plan,
        "amount": active_case.amount,
        "risk_level": active_case.risk_level.value,
        "status": active_case.status.value,
        "offer": active_case.offer.model_dump() if hasattr(active_case.offer, "model_dump") else active_case.offer.dict(),
        "message": active_case.message_content or f"Your {active_case.plan.capitalize()} renewal is pending.",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN REVENUE RECOVERY DASHBOARD & MANAGEMENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/revenue-recovery/overview")
@router.get("/admin/overview")
@router.get("/overview")
async def get_admin_overview(
    admin: UserModel = Depends(get_admin_user),
    db=Depends(get_db),
):
    """
    Aggregates KPIs, conversion funnels, channel performance, and time-series for the admin dashboard.
    """
    recovery_repo = RevenueRecoveryRepository(db)
    return await recovery_repo.get_overview_analytics()


@router.get("/admin/revenue-recovery/cases")
@router.get("/admin/cases")
@router.get("/cases")
async def list_admin_cases(
    status: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    plan: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    human_review: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: UserModel = Depends(get_admin_user),
    db=Depends(get_db),
):
    """
    Search, filter, and paginate recovery cases.
    """
    recovery_repo = RevenueRecoveryRepository(db)
    skip = (page - 1) * page_size
    cases, total = await recovery_repo.list_cases(
        status=status,
        risk_level=risk_level,
        channel=channel,
        plan=plan,
        search=search,
        human_review=human_review,
        skip=skip,
        limit=page_size,
    )
    total_pages = (total + page_size - 1) // page_size
    return {
        "cases": [c.model_dump() if hasattr(c, "model_dump") else c.dict() for c in cases],
        "pagination": {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        }
    }


@router.get("/admin/revenue-recovery/cases/{case_id}")
@router.get("/admin/cases/{case_id}")
@router.get("/cases/{case_id}")
async def get_admin_case_detail(
    case_id: str,
    admin: UserModel = Depends(get_admin_user),
    db=Depends(get_db),
):
    """
    Detailed explainability view for a recovery case including complete audit trail and voice logs.
    """
    recovery_repo = RevenueRecoveryRepository(db)
    case = await recovery_repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")
    return case.model_dump() if hasattr(case, "model_dump") else case.dict()


@router.post("/admin/revenue-recovery/cases/{case_id}/retry")
@router.post("/admin/cases/{case_id}/retry")
@router.post("/cases/{case_id}/retry")
async def trigger_case_retry(
    case_id: str,
    admin: UserModel = Depends(get_admin_user),
    db=Depends(get_db),
):
    """
    Manually re-evaluates the case through the LangGraph recovery workflow.
    """
    recovery_repo = RevenueRecoveryRepository(db)
    case = await recovery_repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")

    new_attempt = case.attempt_count + 1

    # Run LangGraph pipeline
    init_state = {
        "case_id": case.case_id,
        "user_id": case.user_id,
        "user_name": case.user_name,
        "user_email": case.user_email,
        "user_phone": case.user_phone,
        "plan": case.plan,
        "amount": case.amount,
        "currency": case.currency,
        "failure_reason": case.failure_reason,
        "failure_code": case.failure_code,
        "attempt_count": new_attempt,
        "simulation_mode": False,
    }

    graph_res = await revenue_recovery_pipeline.ainvoke(init_state)

    updates = {
        "attempt_count": new_attempt,
        "status": graph_res.get("recovery_status", RecoveryStatus.RECOVERY_ACTIVE.value),
        "selected_strategy": graph_res.get("selected_strategy", case.selected_strategy.value),
        "selected_channel": graph_res.get("selected_channel", case.selected_channel.value),
        "agent_reasoning": graph_res.get("strategy_reasoning"),
    }
    updated_case = await recovery_repo.update_case(case.case_id, updates)

    await recovery_repo.add_audit_log(
        case_id=case.case_id,
        action="ADMIN_MANUAL_RETRY_TRIGGERED",
        actor=ActorType.ADMIN,
        actor_name=admin.full_name,
        details={"attempt": new_attempt, "strategy": updates["selected_strategy"], "channel": updates["selected_channel"]},
        reasoning=f"Admin {admin.full_name} triggered manual recovery workflow re-evaluation."
    )

    return updated_case.model_dump() if hasattr(updated_case, "model_dump") else updated_case.dict()


@router.post("/admin/revenue-recovery/cases/{case_id}/approve")
@router.post("/admin/cases/{case_id}/approve")
@router.post("/cases/{case_id}/approve")
async def approve_case_escalation(
    case_id: str,
    payload: ApproveCaseRequest,
    admin: UserModel = Depends(get_admin_user),
    db=Depends(get_db),
):
    """
    Approve human-review required case or custom bounded discount offer.
    """
    recovery_repo = RevenueRecoveryRepository(db)
    case = await recovery_repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")

    offer_dict = case.offer.model_dump() if hasattr(case.offer, "model_dump") else case.offer.dict()
    if payload.override_discount_pct is not None:
        # Enforce max 20% discount guardrail
        discount = max(0, min(20, payload.override_discount_pct))
        offer_dict["discount_pct"] = discount
        offer_dict["discounted_amount"] = round(case.amount * (1.0 - (discount / 100.0)), 2)

    offer_dict["status"] = "offered"
    offer_dict["requires_human_approval"] = False
    offer_dict["approved_by_admin"] = admin.full_name

    updates = {
        "human_review_required": False,
        "status": RecoveryStatus.CONTACTED.value,
        "offer": offer_dict,
    }
    updated = await recovery_repo.update_case(case.case_id, updates)

    # Send approved win-back email
    if offer_dict.get("discount_pct", 0) > 0 and case.user_email:
        try:
            email_svc = EmailService()
            await email_svc.send_winback_offer_email(
                to_email=case.user_email,
                full_name=case.user_name,
                plan_name=case.plan,
                discount_pct=offer_dict["discount_pct"],
                promo_code=offer_dict.get("promo_code", "SAVE20"),
                original_amount=case.amount,
                discounted_amount=offer_dict["discounted_amount"],
                valid_until_str="the next 7 days",
            )
        except Exception as e:
            logger.warning("Could not dispatch approved win-back email", error=str(e))

    await recovery_repo.add_audit_log(
        case_id=case.case_id,
        action="ADMIN_APPROVED_ESCALATION",
        actor=ActorType.ADMIN,
        actor_name=admin.full_name,
        details={"note": payload.admin_note, "discount_pct": offer_dict.get("discount_pct")},
        reasoning=f"Admin {admin.full_name} approved escalation. Note: {payload.admin_note or 'No notes provided.'}"
    )

    return updated.model_dump() if hasattr(updated, "model_dump") else updated.dict()


@router.post("/admin/revenue-recovery/cases/{case_id}/reject")
@router.post("/admin/cases/{case_id}/reject")
@router.post("/cases/{case_id}/reject")
async def reject_case_escalation(
    case_id: str,
    admin: UserModel = Depends(get_admin_user),
    db=Depends(get_db),
):
    """
    Reject escalation and halt recovery automation for this case.
    """
    recovery_repo = RevenueRecoveryRepository(db)
    case = await recovery_repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")

    updates = {
        "human_review_required": False,
        "status": RecoveryStatus.STOPPED.value,
    }
    updated = await recovery_repo.update_case(case.case_id, updates)

    await recovery_repo.add_audit_log(
        case_id=case.case_id,
        action="ADMIN_REJECTED_CASE",
        actor=ActorType.ADMIN,
        actor_name=admin.full_name,
        details={"status": RecoveryStatus.STOPPED.value},
        reasoning=f"Admin {admin.full_name} rejected escalation and stopped recovery outreach."
    )

    return updated.model_dump() if hasattr(updated, "model_dump") else updated.dict()


@router.post("/admin/revenue-recovery/cases/{case_id}/close")
@router.post("/admin/cases/{case_id}/close")
@router.post("/cases/{case_id}/close")
async def close_case(
    case_id: str,
    admin: UserModel = Depends(get_admin_user),
    db=Depends(get_db),
):
    """
    Close case permanently.
    """
    recovery_repo = RevenueRecoveryRepository(db)
    case = await recovery_repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")

    updates = {
        "human_review_required": False,
        "status": RecoveryStatus.STOPPED.value,
    }
    updated = await recovery_repo.update_case(case.case_id, updates)

    await recovery_repo.add_audit_log(
        case_id=case.case_id,
        action="ADMIN_CLOSED_CASE",
        actor=ActorType.ADMIN,
        actor_name=admin.full_name,
        details={},
        reasoning=f"Admin {admin.full_name} marked case as closed."
    )

    return updated.model_dump() if hasattr(updated, "model_dump") else updated.dict()


@router.post("/admin/revenue-recovery/cases/{case_id}/trigger-channel")
@router.post("/admin/cases/{case_id}/trigger-channel")
@router.post("/cases/{case_id}/trigger-channel")
async def trigger_channel_outreach(
    case_id: str,
    payload: TriggerChannelRequest,
    admin: UserModel = Depends(get_admin_user),
    db=Depends(get_db),
):
    """
    Admin manually dispatches Email, in-app notification, or sets up Voice recovery.
    """
    recovery_repo = RevenueRecoveryRepository(db)
    case = await recovery_repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")

    ch = payload.channel.upper()
    email_res = None

    if ch == "EMAIL" and case.user_email:
        email_svc = EmailService()
        email_res = await email_svc.send_payment_recovery_email(
            to_email=case.user_email,
            full_name=case.user_name,
            plan_name=case.plan,
            amount=case.amount,
            failure_situation=payload.custom_message or case.failure_reason or "Card authentication declined",
        )

    updates = {
        "selected_channel": ch,
        "status": RecoveryStatus.CONTACTED.value,
        "last_contacted_at": datetime.now(timezone.utc),
    }
    updated = await recovery_repo.update_case(case.case_id, updates)

    await recovery_repo.add_audit_log(
        case_id=case.case_id,
        action=f"ADMIN_TRIGGERED_{ch}_OUTREACH",
        actor=ActorType.ADMIN,
        actor_name=admin.full_name,
        details={"channel": ch, "custom_message": payload.custom_message, "email_response": email_res},
        reasoning=f"Admin {admin.full_name} manually triggered {ch} outreach."
    )

    return updated.model_dump() if hasattr(updated, "model_dump") else updated.dict()

