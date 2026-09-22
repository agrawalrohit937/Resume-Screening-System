"""
Compensation Normalization and Compatibility Service for Universal ATS.
Handles multi-currency conversions, Indian formats (LPA, Lakhs, Crores, ₹),
global formats ($k, €k, £), periodicities (annual, monthly, hourly),
and compatibility matching between candidate expectations and job budgets.
"""

import re
from typing import Optional, Tuple, Dict
from pydantic import BaseModel, Field
import structlog

logger = structlog.get_logger(__name__)

# FX Conversion Rates (Base: USD)
# Default dated FX rates table
FX_RATES_TO_USD: Dict[str, float] = {
    "USD": 1.0,
    "INR": 0.012,       # ~83.33 INR/USD
    "EUR": 1.087,       # ~0.92 EUR/USD
    "GBP": 1.266,       # ~0.79 GBP/USD
    "SGD": 0.741,       # ~1.35 SGD/USD
    "AED": 0.272,       # ~3.67 AED/USD
    "CAD": 0.735,
    "AUD": 0.655,
}

USD_TO_CURR: Dict[str, float] = {
    "USD": 1.0,
    "INR": 83.33,
    "EUR": 0.92,
    "GBP": 0.79,
    "SGD": 1.35,
    "AED": 3.67,
    "CAD": 1.36,
    "AUD": 1.53,
}


class CompensationRange(BaseModel):
    """Normalized compensation range entity."""
    raw: str
    currency: str = "INR"
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    period: str = "annual"  # annual, monthly, hourly
    annualized_min: Optional[float] = None
    annualized_max: Optional[float] = None
    annualized_min_usd: Optional[float] = None
    annualized_max_usd: Optional[float] = None


def convert_currency(amount: float, from_currency: str, to_currency: str) -> float:
    """Converts an amount from one currency to another using dated FX rates."""
    from_c = from_currency.upper().strip()
    to_c = to_currency.upper().strip()

    if from_c == to_c:
        return amount

    # Convert to USD first
    rate_to_usd = FX_RATES_TO_USD.get(from_c, 1.0)
    usd_amount = amount * rate_to_usd

    # Convert from USD to target
    rate_from_usd = USD_TO_CURR.get(to_c, 1.0)
    return round(usd_amount * rate_from_usd, 2)


def parse_compensation(text: str, default_currency: str = "INR") -> Optional[CompensationRange]:
    """
    Parses compensation text into a normalized CompensationRange.
    Supports:
    - '18-24 LPA', '18 - 24 lpa', '12 LPA'
    - '₹15,00,000 - ₹25,00,000', 'Rs. 15,00,000'
    - '15-20 Lakhs', '1.2 - 1.5 Crores', '1.5 Cr'
    - '$120k - $160k', '$120,000 - $160,000 / year'
    - '£60k - £80k', '€70k - €90k'
    - '₹80,000/month', '5000 AED / month'
    """
    if not text or not isinstance(text, str):
        return None

    raw = text.strip()
    clean = raw.replace(",", "").strip()

    # Detect currency
    currency = default_currency.upper()
    if any(s in raw for s in ["₹", "INR", "Rs.", "Rs", "rs", "inr"]) or "lpa" in raw.lower() or "lakh" in raw.lower() or "crore" in raw.lower():
        currency = "INR"
    elif "$" in raw or "USD" in raw.upper():
        currency = "USD"
    elif "€" in raw or "EUR" in raw.upper():
        currency = "EUR"
    elif "£" in raw or "GBP" in raw.upper():
        currency = "GBP"
    elif "SGD" in raw.upper():
        currency = "SGD"
    elif "AED" in raw.upper():
        currency = "AED"

    # Detect periodicity
    period = "annual"
    lower_raw = raw.lower()
    if re.search(r"\b(per month|monthly|p\.m\.)\b|/\s*(?:month|mo)\b", lower_raw):
        period = "monthly"
    elif re.search(r"\b(per hour|hourly|p\.h\.)\b|/\s*(?:hour|hr)\b", lower_raw):
        period = "hourly"
    elif re.search(r"\b(per annum|annually|annual|p\.a\.|lpa)\b|/\s*(?:year|yr|a)\b", lower_raw):
        period = "annual"

    # Pattern 1: LPA format (e.g., "18-24 LPA", "18.5 - 22 LPA", "15 LPA")
    lpa_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*lpa", clean, re.IGNORECASE)
    if lpa_match:
        val1 = float(lpa_match.group(1)) * 100000.0
        val2 = float(lpa_match.group(2)) * 100000.0 if lpa_match.group(2) else val1
        min_amt = min(val1, val2)
        max_amt = max(val1, val2)
        return _build_range(raw, "INR", min_amt, max_amt, "annual")

    # Pattern 2: Lakhs format (e.g., "15 - 20 Lakhs", "15 Lakh")
    lakh_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*(?:lakhs?|lac|lacs)", clean, re.IGNORECASE)
    if lakh_match:
        val1 = float(lakh_match.group(1)) * 100000.0
        val2 = float(lakh_match.group(2)) * 100000.0 if lakh_match.group(2) else val1
        min_amt = min(val1, val2)
        max_amt = max(val1, val2)
        return _build_range(raw, "INR", min_amt, max_amt, period)

    # Pattern 3: Crores format (e.g., "1.2 - 1.5 Crores", "1.5 Cr")
    cr_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*(?:crores?|cr)", clean, re.IGNORECASE)
    if cr_match:
        val1 = float(cr_match.group(1)) * 10000000.0
        val2 = float(cr_match.group(2)) * 10000000.0 if cr_match.group(2) else val1
        min_amt = min(val1, val2)
        max_amt = max(val1, val2)
        return _build_range(raw, "INR", min_amt, max_amt, period)

    # Pattern 4: K format (e.g., "$120k - $160k", "120K")
    k_match = re.search(r"[\$€£]?\s*(\d+(?:\.\d+)?)\s*[kK]\s*(?:-|to)?\s*[\$€£]?\s*(\d+(?:\.\d+)?)?\s*[kK]?", clean)
    if k_match and ("k" in clean.lower() or "k" in (k_match.group(0) or "").lower()):
        val1 = float(k_match.group(1)) * 1000.0
        val2 = float(k_match.group(2)) * 1000.0 if k_match.group(2) else val1
        min_amt = min(val1, val2)
        max_amt = max(val1, val2)
        return _build_range(raw, currency, min_amt, max_amt, period)

    # Pattern 5: Plain numbers or formatted currency (e.g., "1500000 - 2000000", "₹15,00,000")
    num_matches = re.findall(r"\b(\d+(?:\.\d+)?)\b", clean)
    if num_matches:
        numbers = [float(n) for n in num_matches if float(n) > 100]  # ignore tiny numbers like 40 hours
        if len(numbers) >= 2:
            min_amt = min(numbers[0], numbers[1])
            max_amt = max(numbers[0], numbers[1])
            return _build_range(raw, currency, min_amt, max_amt, period)
        elif len(numbers) == 1:
            return _build_range(raw, currency, numbers[0], numbers[0], period)

    return None


def _build_range(
    raw: str,
    currency: str,
    min_amt: float,
    max_amt: float,
    period: str
) -> CompensationRange:
    """Helper to calculate annualized amounts in local currency and USD."""
    multiplier = 1.0
    if period == "monthly":
        multiplier = 12.0
    elif period == "hourly":
        multiplier = 2080.0  # 40 hrs/wk * 52 wks

    ann_min = round(min_amt * multiplier, 2)
    ann_max = round(max_amt * multiplier, 2)

    ann_min_usd = convert_currency(ann_min, currency, "USD")
    ann_max_usd = convert_currency(ann_max, currency, "USD")

    return CompensationRange(
        raw=raw,
        currency=currency,
        min_amount=round(min_amt, 2),
        max_amount=round(max_amt, 2),
        period=period,
        annualized_min=ann_min,
        annualized_max=ann_max,
        annualized_min_usd=ann_min_usd,
        annualized_max_usd=ann_max_usd
    )


def compensation_compatibility(
    candidate_comp: Optional[CompensationRange],
    job_comp: Optional[CompensationRange],
    tolerance_pct: float = 0.15
) -> Tuple[bool, float, str]:
    """
    Evaluates compatibility between candidate compensation expectations and job budget.
    Returns: (is_compatible, match_score 0.0-1.0, explanation)
    """
    if not job_comp or not job_comp.annualized_max_usd:
        return True, 1.0, "Job does not specify strict compensation budget."

    if not candidate_comp or not candidate_comp.annualized_min_usd:
        return True, 1.0, "Candidate compensation expectation not provided."

    cand_min_usd = candidate_comp.annualized_min_usd
    job_max_usd = job_comp.annualized_max_usd
    job_min_usd = job_comp.annualized_min_usd or (job_max_usd * 0.75)

    # Candidate expectation is well within budget
    if cand_min_usd <= job_max_usd:
        # Check overlap quality
        overlap_score = 1.0
        if cand_min_usd < job_min_usd * 0.6:
            # Overqualified or significantly under expectations
            overlap_score = 0.9
            msg = f"Candidate expectation (${cand_min_usd:,.0f} USD) is under job budget (${job_min_usd:,.0f}-${job_max_usd:,.0f} USD)."
        else:
            msg = f"Candidate expectation (${cand_min_usd:,.0f} USD) aligns with job budget (${job_min_usd:,.0f}-${job_max_usd:,.0f} USD)."
        return True, overlap_score, msg

    # Candidate expectation exceeds job max, but within leeway/tolerance (e.g., 15%)
    max_with_leeway = job_max_usd * (1.0 + tolerance_pct)
    if cand_min_usd <= max_with_leeway:
        pct_over = ((cand_min_usd - job_max_usd) / job_max_usd) * 100
        msg = f"Candidate expectation is slightly above budget by {pct_over:.1f}%, within acceptable {tolerance_pct*100:.0f}% negotiation window."
        return True, 0.75, msg

    # Exceeds budget beyond tolerance
    pct_over = ((cand_min_usd - job_max_usd) / job_max_usd) * 100
    msg = f"Candidate expectation (${cand_min_usd:,.0f} USD) exceeds job budget limit (${job_max_usd:,.0f} USD) by {pct_over:.1f}%."
    return False, 0.2, msg
