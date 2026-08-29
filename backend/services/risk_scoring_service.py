"""
Predictive Risk Scoring Service — Deterministic, explainable subscription churn & payment failure risk scoring.
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
import structlog

from models.revenue_recovery_model import RiskLevel
from models.user_model import UserModel

logger = structlog.get_logger(__name__)


def _normalize_to_utc(val: Any) -> Optional[datetime]:
    """
    Normalizes naive or timezone-aware datetime objects and ISO strings
    to a consistent timezone-aware UTC datetime.
    """
    if not val:
        return None
    if isinstance(val, str):
        try:
            val = datetime.fromisoformat(val.replace("Z", "+00:00"))
        except Exception:
            return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val.astimezone(timezone.utc)
    return None


class RiskScoringService:
    """Computes deterministic risk score (0-100), risk level, factors, and explanations."""

    def calculate_risk(
        self,
        user: Optional[UserModel] = None,
        user_dict: Optional[Dict[str, Any]] = None,
        gamification_data: Optional[Dict[str, Any]] = None,
        payment_history: Optional[List[Dict[str, Any]]] = None,
        recent_failures_count: int = 0,
        renewal_date: Optional[datetime] = None,
        last_login_date: Optional[datetime] = None,
        communication_history: Optional[List[Dict[str, Any]]] = None,
        explicit_overrides: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Deterministic scoring function.
        Total Score is bounded between 0 and 100.
        """
        score = 0
        factors: List[str] = []
        now = datetime.now(timezone.utc)

        # Extract user information from object or dict
        if user:
            u_dict = user.model_dump() if hasattr(user, "model_dump") else user.dict()
        else:
            u_dict = user_dict or {}

        # 1. Renewal proximity evaluation
        r_raw = renewal_date or u_dict.get("subscription_end_date") or u_dict.get("renewal_date")
        r_date = _normalize_to_utc(r_raw)
        if r_date:
            days_until_renewal = (r_date - now).total_seconds() / 86400.0
            if days_until_renewal <= 1:
                score += 30
                factors.append("Renewal is due within 24 hours")
            elif days_until_renewal <= 3:
                score += 25
                factors.append(f"Renewal in {max(1, int(days_until_renewal))} days")
            elif days_until_renewal <= 7:
                score += 15
                factors.append(f"Renewal approaching in {int(days_until_renewal)} days")

        # 2. Payment Failure History
        p_history = payment_history if payment_history is not None else u_dict.get("payment_history", [])
        failed_payments = [p for p in p_history if str(p.get("status", "")).lower() in ("failed", "failure", "cancelled")]
        total_fails = recent_failures_count + len(failed_payments)

        if total_fails >= 3:
            score += 45
            factors.append(f"{total_fails} previous payment failure attempts recorded")
        elif total_fails == 2:
            score += 30
            factors.append("2 previous payment failures")
        elif total_fails == 1:
            score += 15
            factors.append("1 recent payment failure recorded")

        # 3. Inactivity & Login Gap
        l_raw = last_login_date or u_dict.get("last_login")
        l_login = _normalize_to_utc(l_raw)
        if l_login:
            days_inactive = max(0, int((now - l_login).total_seconds() / 86400.0))
            if days_inactive >= 14:
                score += 25
                factors.append(f"Inactivity: {days_inactive} days since last login")
            elif days_inactive >= 7:
                score += 15
                factors.append(f"Low recent login frequency ({days_inactive} days ago)")
            elif days_inactive <= 2:
                score = max(0, score - 5)  # Recent active login reduces risk slightly
        else:
            score += 10
            factors.append("No recent login record found")

        # 4. Gamification, Streak & Engagement Drop
        g_data = gamification_data or {}
        current_streak = g_data.get("current_streak", 0)
        longest_streak = g_data.get("longest_streak", 0)
        recent_xp = g_data.get("recent_xp", 0)

        if longest_streak >= 5 and current_streak == 0:
            score += 15
            factors.append(f"Practice streak dropped from {longest_streak} days to 0")
        elif current_streak >= 3:
            score = max(0, score - 10)  # Active learner discount

        # Total ATS checks / usage engagement
        ats_checks = u_dict.get("total_ats_checks", 0)
        total_resumes = u_dict.get("total_resumes", 0)
        if ats_checks == 0 and total_resumes == 0:
            score += 10
            factors.append("Zero ATS or resume activity recorded")
        elif ats_checks >= 5:
            score = max(0, score - 5)

        # 5. Communication History (Ignored emails or calls)
        c_history = communication_history or []
        unopened_emails = sum(1 for c in c_history if c.get("channel") == "EMAIL" and not c.get("opened"))
        if unopened_emails >= 2:
            score += 15
            factors.append(f"User ignored {unopened_emails} previous recovery emails")

        # Apply explicit overrides if provided (for testing or specific triggers)
        if explicit_overrides:
            if "score" in explicit_overrides:
                score = explicit_overrides["score"]
            if "factors" in explicit_overrides:
                factors = explicit_overrides["factors"]

        # Clamp between 0 and 100
        final_score = max(0, min(100, score))

        # Determine Risk Level
        if final_score >= 70:
            risk_level = RiskLevel.HIGH
        elif final_score >= 40:
            risk_level = RiskLevel.MEDIUM
        else:
            risk_level = RiskLevel.LOW

        # Generate structured explanation
        if not factors:
            factors = ["Account has active engagement and regular login cadence", "No payment anomalies detected"]
            explanation = "User displays healthy usage patterns with standard low renewal risk."
        else:
            explanation = (
                f"Risk evaluated as {risk_level.value} (Score {final_score}/100) due to "
                + "; ".join(factors[:3]) + "."
            )

        logger.info(
            "Predictive Risk Score Computed",
            user_id=str(u_dict.get("id") or u_dict.get("_id") or "anonymous"),
            score=final_score,
            risk_level=risk_level.value,
            factor_count=len(factors)
        )

        return {
            "risk_score": final_score,
            "risk_level": risk_level,
            "risk_factors": factors,
            "explanation": explanation,
        }


# Singleton instance
risk_scoring_service = RiskScoringService()
