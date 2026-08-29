"""
Comprehensive Automated Tests for AI Revenue Recovery System
-------------------------------------------------------------
Tests:
  1. Predictive Risk Scoring (Low, Medium, High)
  2. Failure Classifier Node
  3. Strict Business Guardrails (Discount capping <= 20%, retry limit <= 3, high-value)
  4. LangGraph Multi-Agent Workflow Execution
  5. Razorpay Webhook Signature Verification & Event Routing
  6. Conversational Hinglish Voice Recovery Service
  7. End-to-End Payment Recovery State Progression
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, AsyncMock, patch

from models.revenue_recovery_model import (
    RecoveryCaseModel,
    RecoveryStatus,
    RiskLevel,
    RecoveryStrategy,
    RecoveryChannel,
)
from services.risk_scoring_service import risk_scoring_service
from services.voice_recovery_service import voice_recovery_service
from services.razorpay_service import razorpay_service
from workflows.revenue_recovery_graph import (
    revenue_recovery_pipeline,
    MAX_DISCOUNT_PERCENT,
    MAX_AUTOMATED_ATTEMPTS,
    HIGH_VALUE_THRESHOLD_INR,
)


# ═══════════════════════════════════════════════════════════════════════════════
# 1. PREDICTIVE RISK SCORING TESTS
# ═══════════════════════════════════════════════════════════════════════════════

def test_risk_scoring_low_risk():
    """Active user with no failures and distant renewal should be LOW risk."""
    now = datetime.now(timezone.utc)
    res = risk_scoring_service.calculate_risk(
        user_dict={
            "id": "u_low",
            "last_login": now - timedelta(days=1),
            "total_ats_checks": 10,
            "total_resumes": 3,
        },
        gamification_data={"current_streak": 5, "longest_streak": 5},
        payment_history=[{"status": "paid", "amount": 299}],
        recent_failures_count=0,
        renewal_date=now + timedelta(days=25),
    )
    assert res["risk_score"] < 40
    assert res["risk_level"] == RiskLevel.LOW
    assert len(res["risk_factors"]) >= 1


def test_risk_scoring_medium_risk():
    """User with renewal within 3 days and 1 failure should be MEDIUM risk."""
    now = datetime.now(timezone.utc)
    res = risk_scoring_service.calculate_risk(
        user_dict={
            "id": "u_med",
            "last_login": now - timedelta(days=4),
            "total_ats_checks": 2,
        },
        gamification_data={"current_streak": 2, "longest_streak": 4},
        payment_history=[],
        recent_failures_count=1,
        renewal_date=now + timedelta(days=2),
    )
    assert 40 <= res["risk_score"] < 70
    assert res["risk_level"] == RiskLevel.MEDIUM
    assert any("failure" in f.lower() for f in res["risk_factors"])


def test_risk_scoring_high_risk():
    """User with 2 failures, dropped streak, and 15 days inactivity should be HIGH risk."""
    now = datetime.now(timezone.utc)
    res = risk_scoring_service.calculate_risk(
        user_dict={
            "id": "u_high",
            "last_login": now - timedelta(days=15),
            "total_ats_checks": 0,
            "total_resumes": 0,
        },
        gamification_data={"current_streak": 0, "longest_streak": 12},
        payment_history=[{"status": "failed", "amount": 999}],
        recent_failures_count=2,
        renewal_date=now + timedelta(days=1),
    )
    assert res["risk_score"] >= 70
    assert res["risk_level"] == RiskLevel.HIGH
    assert any("streak dropped" in f.lower() for f in res["risk_factors"])


def test_risk_scoring_timezone_compatibility():
    """Verify risk scoring handles both naive (MongoDB style) and aware datetimes seamlessly."""
    # Case 1: Naive datetime (typical MongoDB BSON deserialization)
    naive_login = datetime.utcnow() - timedelta(days=5)
    naive_renewal = datetime.utcnow() + timedelta(days=2)
    assert naive_login.tzinfo is None
    assert naive_renewal.tzinfo is None

    res_naive = risk_scoring_service.calculate_risk(
        user_dict={"last_login": naive_login},
        renewal_date=naive_renewal,
    )
    assert isinstance(res_naive["risk_score"], int)
    assert res_naive["risk_level"] in (RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH)

    # Case 2: Timezone-aware datetime (UTC)
    aware_login = datetime.now(timezone.utc) - timedelta(days=5)
    aware_renewal = datetime.now(timezone.utc) + timedelta(days=2)
    assert aware_login.tzinfo is not None

    res_aware = risk_scoring_service.calculate_risk(
        user_dict={"last_login": aware_login},
        renewal_date=aware_renewal,
    )
    assert res_naive["risk_score"] == res_aware["risk_score"]
    assert res_naive["risk_level"] == res_aware["risk_level"]

    # Case 3: Mixed ISO string format
    res_iso = risk_scoring_service.calculate_risk(
        user_dict={"last_login": "2026-08-24T12:00:00Z"},
        renewal_date=naive_renewal,
    )
    assert isinstance(res_iso["risk_score"], int)


# ═══════════════════════════════════════════════════════════════════════════════
# 2. FAILURE CLASSIFIER TESTS
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_failure_classification():
    from workflows.revenue_recovery_graph import failure_classifier_node

    res_funds = await failure_classifier_node({"failure_reason": "Insufficient balance in account", "failure_code": "insufficient_funds"})
    assert res_funds["failure_classification"] == "INSUFFICIENT_FUNDS"

    res_exp = await failure_classifier_node({"failure_reason": "Card expired", "failure_code": "card_expired"})
    assert res_exp["failure_classification"] == "EXPIRED_INSTRUMENT"

    res_net = await failure_classifier_node({"failure_reason": "Gateway bank timeout", "failure_code": "timeout"})
    assert res_net["failure_classification"] == "TRANSIENT_NETWORK"


# ═══════════════════════════════════════════════════════════════════════════════
# 3. STRICT BUSINESS GUARDRAIL TESTS
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_winback_discount_capped_at_20_percent():
    """LLM or caller requesting 50% discount MUST be clamped to MAX 20%."""
    from workflows.revenue_recovery_graph import winback_policy_node

    state = {
        "selected_strategy": RecoveryStrategy.WIN_BACK_OFFER.value,
        "amount": 1000.0,
        "plan": "pro",
        "offer": {"discount_pct": 50},  # Illegitimate high discount request
    }
    result = await winback_policy_node(state)
    offer = result["offer"]

    assert offer["discount_pct"] <= MAX_DISCOUNT_PERCENT
    assert offer["discount_pct"] == 20
    assert offer["discounted_amount"] == 800.0
    assert any("exceeds maximum allowed" in g for g in result["guardrail_violations"])


@pytest.mark.asyncio
async def test_max_attempts_escalates_to_human():
    """Exceeding max automated attempts (>=3) must halt automation and escalate to human."""
    from workflows.revenue_recovery_graph import strategy_selector_node

    state = {
        "attempt_count": 3,
        "risk_score": 85,
        "amount": 299.0,
        "failure_classification": "INSUFFICIENT_FUNDS",
    }
    res = await strategy_selector_node(state)

    assert res["selected_strategy"] == RecoveryStrategy.ESCALATE_TO_HUMAN.value
    assert res["human_review_required"] is True
    assert any("Exceeded max automated retry attempts" in g for g in res["guardrail_violations"])


@pytest.mark.asyncio
async def test_high_value_customer_triggers_human_review():
    """Customer subscription >= ₹999 must require human review."""
    from workflows.revenue_recovery_graph import strategy_selector_node

    state = {
        "attempt_count": 0,
        "risk_score": 60,
        "amount": 999.0,  # High value threshold
        "failure_classification": "INSUFFICIENT_FUNDS",
    }
    res = await strategy_selector_node(state)
    assert res["human_review_required"] is True


# ═══════════════════════════════════════════════════════════════════════════════
# 4. LANGGRAPH MULTI-AGENT WORKFLOW EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_langgraph_pipeline_execution():
    """Test full LangGraph graph execution from input to end state."""
    init_state = {
        "case_id": "REC-TEST-001",
        "user_id": "u_test_graph",
        "user_name": "Rahul Sharma",
        "user_email": "rahul@example.com",
        "plan": "pro",
        "amount": 299.0,
        "currency": "INR",
        "failure_reason": "Insufficient balance",
        "failure_code": "insufficient_funds",
        "attempt_count": 0,
        "simulation_mode": True,
        "renewal_date": datetime.now(timezone.utc) + timedelta(days=2),
    }

    final_state = await revenue_recovery_pipeline.ainvoke(init_state)

    assert "risk_score" in final_state
    assert "failure_classification" in final_state
    assert final_state["failure_classification"] == "INSUFFICIENT_FUNDS"
    assert "selected_strategy" in final_state
    assert "selected_channel" in final_state
    assert "audit_logs_to_append" in final_state
    assert len(final_state["audit_logs_to_append"]) >= 1


# ═══════════════════════════════════════════════════════════════════════════════
# 5. RAZORPAY WEBHOOK & SIGNATURE VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

def test_razorpay_webhook_signature_verification():
    import hmac
    import hashlib

    secret = "test_webhook_secret_key_123"
    body = '{"event": "payment.failed", "payload": {}}'
    sig = hmac.new(bytes(secret, 'utf-8'), bytes(body, 'utf-8'), hashlib.sha256).hexdigest()

    # Valid signature
    is_valid = razorpay_service.verify_webhook_signature(body, sig, webhook_secret=secret)
    assert is_valid is True

    # Invalid signature
    is_invalid = razorpay_service.verify_webhook_signature(body, "bad_signature", webhook_secret=secret)
    assert is_invalid is False


# ═══════════════════════════════════════════════════════════════════════════════
# 6. CONVERSATIONAL HINGLISH VOICE RECOVERY SERVICE
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_voice_recovery_dialogue():
    greeting = voice_recovery_service.generate_initial_greeting(
        user_name="Rahul Sharma",
        plan_name="pro",
        amount=999.0,
        failure_reason="Insufficient balance"
    )
    assert "Rahul" in greeting
    assert "CareerShala" in greeting
    assert "₹999" in greeting

    # User agrees to retry
    turn_agree = await voice_recovery_service.process_voice_turn(
        user_id="u_rahul",
        user_name="Rahul Sharma",
        plan_name="pro",
        amount=999.0,
        user_utterance="Haan, main payment retry karna chahta hoon.",
        conversation_history=[{"role": "agent", "text": greeting}],
    )
    assert turn_agree["intent"] == "AGREE_RETRY"
    assert turn_agree["should_retry_payment"] is True
    assert turn_agree["call_ended"] is True
    assert "link" in turn_agree["agent_reply"].lower() or "razorpay" in turn_agree["agent_reply"].lower()

    # User asks for discount
    turn_discount = await voice_recovery_service.process_voice_turn(
        user_id="u_rahul",
        user_name="Rahul Sharma",
        plan_name="pro",
        amount=999.0,
        user_utterance="Kuch discount mil sakta hai kya? Mehenga hai.",
        conversation_history=[{"role": "agent", "text": greeting}],
        discount_eligible=True,
        max_discount_pct=20,
    )
    assert turn_discount["intent"] == "REQUEST_DISCOUNT"
    assert turn_discount["offer_discount_pct"] <= 20
    assert "discount" in turn_discount["agent_reply"].lower() or "20%" in turn_discount["agent_reply"].lower()


# ═══════════════════════════════════════════════════════════════════════════════
# 7. REPOSITORY CRUD & PERSISTENCE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_recovery_case_model():
    """Verify RecoveryCaseModel validation and fields."""
    case = RecoveryCaseModel(
        case_id="REC-2026-00001",
        user_id="user_123",
        user_name="Pooja Sharma",
        user_email="pooja@example.com",
        plan="pro",
        amount=299.0,
        currency="INR",
        risk_score=75,
        risk_level=RiskLevel.HIGH,
        risk_factors=["Streak dropped to 0"],
        selected_strategy=RecoveryStrategy.SEND_EMAIL,
        selected_channel=RecoveryChannel.EMAIL,
        status=RecoveryStatus.RECOVERY_ACTIVE,
    )
    assert case.case_id == "REC-2026-00001"
    assert case.risk_level == RiskLevel.HIGH
    assert case.amount == 299.0
    assert case.max_attempts == 3
