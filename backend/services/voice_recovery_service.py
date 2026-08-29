"""
Voice Recovery Service — Conversational Hinglish AI agent for phone/voice recovery interactions.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import structlog
from core.llm_client import get_groq_client

logger = structlog.get_logger(__name__)


class VoiceRecoveryService:
    """Conversational Hinglish AI Agent for voice-based subscription recovery."""

    def generate_initial_greeting(
        self,
        user_name: str,
        plan_name: str,
        amount: float,
        failure_reason: Optional[str] = None
    ) -> str:
        """Generates natural Hinglish greeting for the voice agent call."""
        first_name = (user_name or "sir").split()[0].title()
        amt_str = f"₹{amount:.0f}"
        return (
            f"Namaste {first_name} ji, CareerShala team se call hai. "
            f"Aapke {plan_name.capitalize()} subscription ka {amt_str} ka renewal payment complete nahi ho paya hai. "
            f"Kya aap isse retry karna chahenge?"
        )

    async def process_voice_turn(
        self,
        *,
        user_id: str,
        user_name: str,
        plan_name: str,
        amount: float,
        user_utterance: str,
        conversation_history: List[Dict[str, str]],
        discount_eligible: bool = True,
        max_discount_pct: int = 20,
    ) -> Dict[str, Any]:
        """
        Processes a conversational turn from the user during a voice call.
        Returns:
            - agent_reply: str (in natural Hinglish)
            - intent: str (AGREE_RETRY | INQUIRE_REASON | REQUEST_DISCOUNT | RESCHEDULE | CANCEL | UNKNOWN)
            - should_retry_payment: bool
            - offer_discount_pct: int (bounded <= 20)
            - call_ended: bool
        """
        first_name = (user_name or "sir").split()[0].title()
        amt_str = f"₹{amount:.0f}"
        discounted_amt = f"₹{(amount * (100 - max_discount_pct) / 100):.0f}"
        utt_lower = user_utterance.strip().lower()

        # Deterministic fast-path regex/keyword intent classification
        discount_words = ["discount", "mehenga", "expensive", "kam karo", "paisa", "offer", "budget", "reduce", "chhoot", "kam"]
        cancel_words = ["cancel", "nahi chahiye", "don't want", "stop", "unsubscribe", "band kar do", "mat karo"]
        reschedule_words = ["baad me", "later", "busy", "driving", "meeting", "call later", "kal", "shaam"]
        reason_words = ["kyun", "why", "fail", "reason", "kya hua", "problem"]
        agree_words = ["haan", "yes", "bilkul", "sure", "theek hai", "thik hai", "kar do", "retry", "ok", "okay", "send link", "karo"]

        # Fast intent detection — check specific objections/requests first
        if any(w in utt_lower for w in cancel_words):
            return {
                "agent_reply": (
                    f"Samajh gaya {first_name} ji. Humne aapke feedback ko note kar liya hai aur automation pause kar diya hai. "
                    f"Aap kisi bhi time CareerShala support team se connect kar sakte hain. Dhanyawaad!"
                ),
                "intent": "CANCEL",
                "should_retry_payment": False,
                "offer_discount_pct": 0,
                "call_ended": True,
            }

        if any(w in utt_lower for w in discount_words):
            if discount_eligible and max_discount_pct > 0:
                return {
                    "agent_reply": (
                        f"{first_name} ji, hum aapke career growth ko support karna chahte hain! "
                        f"CareerShala ki taraf se hum aapko special {max_discount_pct}% discount de rahe hain, "
                        f"jisse aapko {amt_str} ke badle sirf {discounted_amt} pay karna hoga. Kya main aapke liye yeh offer activate kar doon?"
                    ),
                    "intent": "REQUEST_DISCOUNT",
                    "should_retry_payment": False,
                    "offer_discount_pct": max_discount_pct,
                    "call_ended": False,
                }
            else:
                return {
                    "agent_reply": (
                        f"{first_name} ji, yeh subscription already best discounted rate par hai. "
                        f"Isme aapko unlimited AI interviews aur verified certificates milte hain. Kya aap payment complete karna chahenge?"
                    ),
                    "intent": "REQUEST_DISCOUNT",
                    "should_retry_payment": False,
                    "offer_discount_pct": 0,
                    "call_ended": False,
                }

        if any(w in utt_lower for w in agree_words):
            return {
                "agent_reply": (
                    f"Bahut badhiya {first_name} ji! Maine aapke dashboard aur email par secure 1-click Razorpay retry link bhej diya hai. "
                    f"Aap turant payment complete karke unlimited mock interviews continue kar sakte hain. Dhanyawaad!"
                ),
                "intent": "AGREE_RETRY",
                "should_retry_payment": True,
                "offer_discount_pct": 0,
                "call_ended": True,
            }

        if any(w in utt_lower for w in reschedule_words):
            return {
                "agent_reply": (
                    f"Bilkul {first_name} ji, koi baat nahi. Hum aapko WhatsApp aur in-app notification bhej dete hain. "
                    f"Aap jab chahein wahan se conveniently renew kar sakte hain. Shubh din!"
                ),
                "intent": "RESCHEDULE",
                "should_retry_payment": False,
                "offer_discount_pct": 0,
                "call_ended": True,
            }

        if any(w in utt_lower for w in cancel_words):
            return {
                "agent_reply": (
                    f"Samajh gaya {first_name} ji. Humne aapke feedback ko note kar liya hai aur automation pause kar diya hai. "
                    f"Aap kisi bhi time CareerShala support team se connect kar sakte hain. Dhanyawaad!"
                ),
                "intent": "CANCEL",
                "should_retry_payment": False,
                "offer_discount_pct": 0,
                "call_ended": True,
            }

        if any(w in utt_lower for w in reason_words):
            return {
                "agent_reply": (
                    f"{first_name} ji, bank ki taraf se temporary transaction limit ya insufficient balance ka issue aaya tha. "
                    f"Aap UPI ya doosre card se retry kar sakte hain. Kya main retry link trigger karoon?"
                ),
                "intent": "INQUIRE_REASON",
                "should_retry_payment": False,
                "offer_discount_pct": 0,
                "call_ended": False,
            }

        # LLM-assisted conversational fallback
        try:
            llm = get_groq_client(temperature=0.3)
            prompt = f"""You are 'Priya', a polite and professional AI retention and revenue recovery specialist for CareerShala in India.
You are on a phone call with user '{user_name}' regarding their failed {plan_name} renewal payment of {amt_str}.

Conversation History:
{conversation_history}

User said: "{user_utterance}"

Instructions:
1. Respond in natural, polite Hinglish (Hindi written in Roman script, like everyday conversation).
2. Keep response to 1-2 concise spoken sentences.
3. Be helpful, respectful, and guide user towards payment retry or answering their doubt.
4. Do not offer discounts exceeding {max_discount_pct}%.

Output ONLY the Hinglish response text."""

            resp = await llm.ainvoke(prompt)
            reply = resp.content.strip().replace('"', '')
            return {
                "agent_reply": reply,
                "intent": "CONVERSATIONAL",
                "should_retry_payment": False,
                "offer_discount_pct": 0,
                "call_ended": False,
            }
        except Exception as e:
            logger.warning("Voice LLM turn fallback error", error=str(e))
            return {
                "agent_reply": (
                    f"{first_name} ji, kya aap secure UPI ya card ke through {amt_str} ka payment retry karna chahenge?"
                ),
                "intent": "UNKNOWN",
                "should_retry_payment": False,
                "offer_discount_pct": 0,
                "call_ended": False,
            }


# Singleton instance
voice_recovery_service = VoiceRecoveryService()
