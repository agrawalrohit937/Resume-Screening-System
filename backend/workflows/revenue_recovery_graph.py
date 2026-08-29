"""
LangGraph Multi-Agent Architecture for AI Revenue Recovery
-----------------------------------------------------------
Implements a stateful, explainable graph containing:
  - Risk Scorer Node
  - Failure Classifier Node
  - User Context Analyzer Node
  - Strategy Selector Node
  - Channel Selector Node
  - Win-Back Policy & Guardrail Node
  - Message Generator Node
  - Recovery Executor Node
  - Outcome Analyzer & Audit Logger Node
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, TypedDict
import structlog

from langgraph.graph import StateGraph, END

from models.revenue_recovery_model import (
    RecoveryStatus,
    RiskLevel,
    RecoveryStrategy,
    RecoveryChannel,
    ActorType,
)
from services.risk_scoring_service import risk_scoring_service
from services.email_service import EmailService
from services.voice_recovery_service import voice_recovery_service

logger = structlog.get_logger(__name__)


# ─── HARD POLICY CONSTANTS & GUARDRAILS ─────────────────────────────────────
MAX_AUTOMATED_ATTEMPTS = 3
MAX_RECOVERY_WINDOW_DAYS = 7
MAX_DISCOUNT_PERCENT = 20  # Strict business rule: never allow > 20%
MAX_WINBACK_OFFERS_COUNT = 1
HIGH_VALUE_THRESHOLD_INR = 999.0  # High value customers require human approval for offers/escalations


# ─── AGENT STATE DEFINITION ─────────────────────────────────────────────────
class RevenueRecoveryState(TypedDict, total=False):
    # Context inputs
    case_id: str
    user_id: str
    user_name: str
    user_email: str
    user_phone: Optional[str]
    plan: str
    amount: float
    currency: str
    renewal_date: Optional[datetime]
    failure_reason: Optional[str]
    failure_code: Optional[str]
    attempt_count: int
    user_dict: Optional[Dict[str, Any]]
    gamification_dict: Optional[Dict[str, Any]]
    payment_history: Optional[List[Dict[str, Any]]]
    communication_history: Optional[List[Dict[str, Any]]]
    simulation_mode: bool

    # Agent node outputs
    risk_score: int
    risk_level: str
    risk_factors: List[str]
    risk_explanation: str

    failure_classification: str  # "TRANSIENT_NETWORK", "INSUFFICIENT_FUNDS", "EXPIRED_INSTRUMENT", "AUTH_REJECTED", "USER_ABORTED"
    failure_severity: str

    user_engagement_summary: Dict[str, Any]

    selected_strategy: str
    strategy_reasoning: str

    selected_channel: str
    channel_reasoning: str

    offer: Optional[Dict[str, Any]]  # {discount_pct, promo_code, status, requires_human_approval}
    guardrail_violations: List[str]
    human_review_required: bool
    human_review_reason: Optional[str]

    generated_message_subject: Optional[str]
    generated_message_body: Optional[str]
    voice_script: Optional[str]

    execution_result: Dict[str, Any]
    recovery_status: str
    audit_logs_to_append: List[Dict[str, Any]]


# ─── NODE 1: RISK SCORER NODE ───────────────────────────────────────────────
async def risk_scorer_node(state: RevenueRecoveryState) -> Dict[str, Any]:
    """Calculates deterministic, multi-factor risk score and level."""
    res = risk_scoring_service.calculate_risk(
        user_dict=state.get("user_dict"),
        gamification_data=state.get("gamification_dict"),
        payment_history=state.get("payment_history"),
        recent_failures_count=state.get("attempt_count", 0),
        renewal_date=state.get("renewal_date"),
        communication_history=state.get("communication_history"),
    )
    return {
        "risk_score": res["risk_score"],
        "risk_level": res["risk_level"].value if hasattr(res["risk_level"], "value") else str(res["risk_level"]),
        "risk_factors": res["risk_factors"],
        "risk_explanation": res["explanation"],
    }


# ─── NODE 2: FAILURE CLASSIFIER NODE ────────────────────────────────────────
async def failure_classifier_node(state: RevenueRecoveryState) -> Dict[str, Any]:
    """Categorizes raw gateway failure codes and descriptions into operational classes."""
    reason = (state.get("failure_reason") or "").lower()
    code = (state.get("failure_code") or "").lower()

    if any(term in reason or term in code for term in ["insufficient", "balance", "funds", "limit"]):
        classification = "INSUFFICIENT_FUNDS"
        severity = "MEDIUM"
    elif any(term in reason or term in code for term in ["expired", "validity", "card_expired"]):
        classification = "EXPIRED_INSTRUMENT"
        severity = "HIGH"
    elif any(term in reason or term in code for term in ["timeout", "gateway", "network", "bank_error", "server_error"]):
        classification = "TRANSIENT_NETWORK"
        severity = "LOW"
    elif any(term in reason or term in code for term in ["otp", "auth", "authentication", "declined", "security"]):
        classification = "AUTH_REJECTED"
        severity = "MEDIUM"
    elif any(term in reason or term in code for term in ["cancel", "dismiss", "user_cancelled"]):
        classification = "USER_ABORTED"
        severity = "MEDIUM"
    else:
        classification = "UNKNOWN_GATEWAY_ERROR"
        severity = "MEDIUM"

    return {
        "failure_classification": classification,
        "failure_severity": severity,
    }


# ─── NODE 3: USER CONTEXT ANALYZER NODE ─────────────────────────────────────
async def user_context_analyzer_node(state: RevenueRecoveryState) -> Dict[str, Any]:
    """Aggregates behavioral loyalty, gamification status, and lifetime engagement."""
    u = state.get("user_dict") or {}
    g = state.get("gamification_dict") or {}

    engagement = {
        "plan": state.get("plan", "pro"),
        "amount": state.get("amount", 299),
        "total_ats_scans": u.get("total_ats_checks", 0),
        "total_resumes": u.get("total_resumes", 0),
        "current_streak": g.get("current_streak", 0),
        "longest_streak": g.get("longest_streak", 0),
        "is_high_value": state.get("amount", 299) >= HIGH_VALUE_THRESHOLD_INR,
    }
    return {"user_engagement_summary": engagement}


# ─── NODE 4: STRATEGY SELECTOR NODE ─────────────────────────────────────────
async def strategy_selector_node(state: RevenueRecoveryState) -> Dict[str, Any]:
    """Applies strict recovery strategy matrix with guardrail evaluation."""
    attempt_count = state.get("attempt_count", 0)
    risk_score = state.get("risk_score", 0)
    classification = state.get("failure_classification", "UNKNOWN_GATEWAY_ERROR")
    amount = state.get("amount", 299.0)
    guardrails = []

    # 1. Stop automation if retry limit exceeded
    if attempt_count >= MAX_AUTOMATED_ATTEMPTS:
        guardrails.append(f"Exceeded max automated retry attempts ({attempt_count}/{MAX_AUTOMATED_ATTEMPTS})")
        return {
            "selected_strategy": RecoveryStrategy.ESCALATE_TO_HUMAN.value,
            "strategy_reasoning": "Maximum automated retries reached. Escalate to human support team to prevent user fatigue.",
            "human_review_required": True,
            "human_review_reason": "Max automated retries (3) reached without payment success.",
            "guardrail_violations": guardrails,
        }

    # 2. High-value customer check
    if amount >= HIGH_VALUE_THRESHOLD_INR:
        human_req = True
        human_reason = f"High value subscription (₹{amount:.0f}) requiring high-touch oversight."
    else:
        human_req = False
        human_reason = None

    # 3. Strategy selection logic
    if classification == "TRANSIENT_NETWORK":
        strategy = RecoveryStrategy.RETRY_LATER.value
        reasoning = "Transient bank/network error detected. Scheduled delayed retry with notification."
    elif classification == "EXPIRED_INSTRUMENT":
        strategy = RecoveryStrategy.SEND_PAYMENT_UPDATE_REQUEST.value
        reasoning = "Card/payment method expired. User must update payment credentials."
    elif classification == "INSUFFICIENT_FUNDS":
        if attempt_count == 0:
            strategy = RecoveryStrategy.RETRY_LATER.value
            reasoning = "Insufficient funds detected on first attempt. Wait and notify user for retry."
        else:
            strategy = RecoveryStrategy.SEND_EMAIL.value
            reasoning = "Repeated balance failure. Direct notification with secure retry link."
    elif classification == "USER_ABORTED" and risk_score >= 70:
        strategy = RecoveryStrategy.WIN_BACK_OFFER.value
        reasoning = "High churn risk user voluntarily abandoned renewal. Trigger controlled win-back offer."
    elif risk_score >= 80:
        if attempt_count >= 1:
            strategy = RecoveryStrategy.VOICE_RECOVERY.value
            reasoning = "High risk user with previous unsuccessful contact. Escalating to proactive voice recovery."
        else:
            strategy = RecoveryStrategy.SEND_EMAIL.value
            reasoning = "Proactive high-urgency recovery outreach."
    else:
        strategy = RecoveryStrategy.SEND_EMAIL.value
        reasoning = "Standard automated recovery notification."

    return {
        "selected_strategy": strategy,
        "strategy_reasoning": reasoning,
        "human_review_required": human_req,
        "human_review_reason": human_reason,
        "guardrail_violations": guardrails,
    }


# ─── NODE 5: CHANNEL SELECTOR NODE ──────────────────────────────────────────
async def channel_selector_node(state: RevenueRecoveryState) -> Dict[str, Any]:
    """Selects the best communication channel based on historical engagement patterns."""
    strategy = state.get("selected_strategy", RecoveryStrategy.SEND_EMAIL.value)
    c_hist = state.get("communication_history") or []
    attempt = state.get("attempt_count", 0)

    # Direct mappings
    if strategy == RecoveryStrategy.VOICE_RECOVERY.value:
        return {
            "selected_channel": RecoveryChannel.VOICE.value,
            "channel_reasoning": "Voice channel selected for high-touch personal engagement after digital channel fatigue."
        }

    if strategy in (RecoveryStrategy.RETRY_NOW.value, RecoveryStrategy.STOP_RECOVERY.value):
        return {
            "selected_channel": RecoveryChannel.NONE.value,
            "channel_reasoning": "Direct backend execution without outreach channel."
        }

    # Adaptive behavior: check if email was previously ignored
    unopened_emails = sum(1 for c in c_hist if c.get("channel") == RecoveryChannel.EMAIL.value and not c.get("opened"))

    if unopened_emails >= 2 or (attempt >= 1 and strategy == RecoveryStrategy.VOICE_RECOVERY.value):
        channel = RecoveryChannel.VOICE.value
        reasoning = f"Email repeatedly unopened ({unopened_emails} times). Switched to Voice for immediate reach."
    elif state.get("user_dict", {}).get("total_ats_checks", 0) > 3 and attempt == 0:
        channel = RecoveryChannel.IN_APP.value
        reasoning = "User is highly active in-app. In-app banner prioritized."
    else:
        channel = RecoveryChannel.EMAIL.value
        reasoning = "Email selected as primary communication channel with rich action CTA."

    return {
        "selected_channel": channel,
        "channel_reasoning": reasoning,
    }


# ─── NODE 6: WIN-BACK POLICY & GUARDRAIL NODE ───────────────────────────────
async def winback_policy_node(state: RevenueRecoveryState) -> Dict[str, Any]:
    """Enforces strict, unbreakable business bounds on discounts and offers."""
    strategy = state.get("selected_strategy")
    amt = state.get("amount", 299.0)
    current_offer = state.get("offer") or {}
    guardrails = list(state.get("guardrail_violations") or [])

    if strategy == RecoveryStrategy.WIN_BACK_OFFER.value:
        requested_discount = current_offer.get("discount_pct", 20)

        # Enforce hard upper bound: MAX 20%
        if requested_discount > MAX_DISCOUNT_PERCENT:
            guardrails.append(f"Requested discount {requested_discount}% exceeds maximum allowed {MAX_DISCOUNT_PERCENT}%. Clamped to {MAX_DISCOUNT_PERCENT}%.")
            effective_discount = MAX_DISCOUNT_PERCENT
        else:
            effective_discount = min(MAX_DISCOUNT_PERCENT, max(5, requested_discount))

        discounted_amt = round(amt * (1.0 - (effective_discount / 100.0)), 2)
        valid_until = datetime.now(timezone.utc) + timedelta(days=7)

        # High value subscriptions require human approval before applying discount
        requires_approval = amt >= HIGH_VALUE_THRESHOLD_INR

        offer = {
            "offered": True,
            "discount_pct": effective_discount,
            "promo_code": f"WINBACK{effective_discount}_{state.get('plan', 'pro').upper()}",
            "original_amount": amt,
            "discounted_amount": discounted_amt,
            "valid_until": valid_until.isoformat(),
            "status": "pending_approval" if requires_approval else "offered",
            "requires_human_approval": requires_approval,
        }

        return {
            "offer": offer,
            "guardrail_violations": guardrails,
            "human_review_required": state.get("human_review_required") or requires_approval,
            "human_review_reason": (
                state.get("human_review_reason")
                or ("High-value winback discount requires human approval." if requires_approval else None)
            ),
        }

    return {"guardrail_violations": guardrails}


# ─── NODE 7: MESSAGE GENERATOR NODE ─────────────────────────────────────────
async def message_generator_node(state: RevenueRecoveryState) -> Dict[str, Any]:
    """Synthesizes professional, brand-aligned email and voice scripts."""
    user_name = state.get("user_name", "User")
    plan = state.get("plan", "pro").capitalize()
    amount = state.get("amount", 299.0)
    reason = state.get("failure_reason") or "Card or banking transaction failure"
    channel = state.get("selected_channel")

    subject = f"Action Required: Renew your CareerShala {plan} Plan"
    body = (
        f"Hi {user_name}, your recent {plan} renewal of ₹{amount:.0f} was unsuccessful due to {reason}. "
        f"Please update your payment method to keep uninterrupted access to unlimited mock interviews and ATS resume reviews."
    )

    # Voice script in natural Hinglish
    voice_script = voice_recovery_service.generate_initial_greeting(
        user_name=user_name,
        plan_name=plan,
        amount=amount,
        failure_reason=reason,
    )

    return {
        "generated_message_subject": subject,
        "generated_message_body": body,
        "voice_script": voice_script,
    }


# ─── NODE 8: RECOVERY EXECUTOR NODE ─────────────────────────────────────────
async def recovery_executor_node(state: RevenueRecoveryState) -> Dict[str, Any]:
    """Dispatches the recovery action across real Brevo, in-app, or voice infrastructure."""
    channel = state.get("selected_channel")
    email = state.get("user_email")
    user_name = state.get("user_name")
    plan = state.get("plan", "pro")
    amount = state.get("amount", 299.0)
    offer = state.get("offer")
    is_simulation = state.get("simulation_mode", False)

    execution_result: Dict[str, Any] = {"channel": channel, "timestamp": datetime.now(timezone.utc).isoformat()}

    # Check human-in-the-loop blocking
    if state.get("human_review_required") and not is_simulation:
        execution_result["status"] = "PENDING_HUMAN_APPROVAL"
        execution_result["message"] = "Execution paused for admin human-in-the-loop approval."
        return {
            "execution_result": execution_result,
            "recovery_status": RecoveryStatus.ESCALATED.value,
        }

    # 1. Email Execution via Brevo
    if channel == RecoveryChannel.EMAIL.value:
        email_svc = EmailService()
        if offer and offer.get("offered") and not offer.get("requires_human_approval"):
            # Send win-back discount offer email
            mail_res = await email_svc.send_winback_offer_email(
                to_email=email,
                full_name=user_name,
                plan_name=plan,
                discount_pct=offer.get("discount_pct", 20),
                promo_code=offer.get("promo_code", "SAVE20"),
                original_amount=amount,
                discounted_amount=offer.get("discounted_amount", amount * 0.8),
                valid_until_str="the next 7 days",
            )
        else:
            # Send standard recovery email
            mail_res = await email_svc.send_payment_recovery_email(
                to_email=email,
                full_name=user_name,
                plan_name=plan,
                amount=amount,
                failure_situation=state.get("failure_reason") or "Banking authorization issue",
            )

        execution_result["email_dispatch"] = mail_res
        execution_result["status"] = "EMAIL_DISPATCHED" if mail_res.get("sent") else "EMAIL_FAILED"

    # 2. In-App Notification Registration
    elif channel == RecoveryChannel.IN_APP.value:
        execution_result["status"] = "IN_APP_QUEUED"
        execution_result["notification"] = {
            "title": f"Payment Issue: {plan.capitalize()} Subscription",
            "message": f"Your ₹{amount:.0f} payment could not be processed. Tap here to retry safely.",
            "link": "/billing",
        }

    # 3. Voice Recovery Session Initialization
    elif channel == RecoveryChannel.VOICE.value:
        execution_result["status"] = "VOICE_READY"
        execution_result["initial_dialog"] = state.get("voice_script")

    else:
        execution_result["status"] = "SCHEDULED_RETRY"

    return {
        "execution_result": execution_result,
        "recovery_status": RecoveryStatus.CONTACTED.value,
    }


# ─── NODE 9: OUTCOME ANALYZER & AUDIT LOGGER NODE ───────────────────────────
async def audit_logger_node(state: RevenueRecoveryState) -> Dict[str, Any]:
    """Generates an auditable, explainable trace of the entire recovery decision."""
    now = datetime.now(timezone.utc)
    audit_entry = {
        "timestamp": now.isoformat(),
        "actor": ActorType.AI_AGENT.value,
        "actor_name": "CareerShala AI Revenue Recovery Agent",
        "action": f"STRATEGY_EXECUTED_{state.get('selected_strategy')}",
        "details": {
            "risk_score": state.get("risk_score"),
            "risk_level": state.get("risk_level"),
            "failure_classification": state.get("failure_classification"),
            "channel": state.get("selected_channel"),
            "attempt": state.get("attempt_count", 0) + 1,
            "human_review": state.get("human_review_required", False),
            "execution": state.get("execution_result", {}),
        },
        "reasoning": (
            f"Action: {state.get('selected_strategy')} via {state.get('selected_channel')}. "
            f"Diagnosis: {state.get('failure_classification')}. "
            f"Reason: {state.get('strategy_reasoning')} | {state.get('channel_reasoning')}"
        ),
    }

    return {
        "audit_logs_to_append": [audit_entry],
    }


# ─── GRAPH CONSTRUCTION ─────────────────────────────────────────────────────
def build_revenue_recovery_graph() -> StateGraph:
    """Builds and compiles the complete LangGraph StateGraph."""
    workflow = StateGraph(RevenueRecoveryState)

    # Register Nodes
    workflow.add_node("risk_scorer", risk_scorer_node)
    workflow.add_node("failure_classifier", failure_classifier_node)
    workflow.add_node("user_context_analyzer", user_context_analyzer_node)
    workflow.add_node("strategy_selector", strategy_selector_node)
    workflow.add_node("channel_selector", channel_selector_node)
    workflow.add_node("winback_policy", winback_policy_node)
    workflow.add_node("message_generator", message_generator_node)
    workflow.add_node("recovery_executor", recovery_executor_node)
    workflow.add_node("audit_logger", audit_logger_node)

    # Wire Edges
    workflow.set_entry_point("risk_scorer")
    workflow.add_edge("risk_scorer", "failure_classifier")
    workflow.add_edge("failure_classifier", "user_context_analyzer")
    workflow.add_edge("user_context_analyzer", "strategy_selector")
    workflow.add_edge("strategy_selector", "channel_selector")
    workflow.add_edge("channel_selector", "winback_policy")
    workflow.add_edge("winback_policy", "message_generator")
    workflow.add_edge("message_generator", "recovery_executor")
    workflow.add_edge("recovery_executor", "audit_logger")
    workflow.add_edge("audit_logger", END)

    return workflow.compile()


# Singleton compiled graph
revenue_recovery_pipeline = build_revenue_recovery_graph()
