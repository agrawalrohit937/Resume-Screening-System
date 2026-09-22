"""
Universal Work Authorization, Locale Date Parsing, and Phone Normalization Service.
Ensures work authorization is strictly evaluated via explicit declaration
(never inferred from candidate name, origin, or location),
and provides locale-sensitive E.164 phone and DD/MM vs MM/DD date parsing.
"""

from datetime import date, datetime
import re
from typing import List, Optional, Tuple, Dict
from pydantic import BaseModel, Field
import structlog

logger = structlog.get_logger(__name__)

# Standard country calling codes for E.164 formatting
COUNTRY_CALLING_CODES: Dict[str, str] = {
    "IN": "+91",
    "US": "+1",
    "CA": "+1",
    "GB": "+44",
    "DE": "+49",
    "FR": "+33",
    "SG": "+65",
    "AE": "+971",
    "AU": "+61",
}


class WorkAuthorizationRecord(BaseModel):
    """Declared work authorization entity for a candidate."""
    country_iso2: str
    status: str = "citizen"  # "citizen", "permanent_resident", "work_visa", "student_visa", "authorized"
    expires_on: Optional[date] = None
    requires_sponsorship: bool = False

    def is_valid(self, reference_date: Optional[date] = None) -> bool:
        ref = reference_date or date.today()
        if self.expires_on and self.expires_on < ref:
            return False
        return True


def evaluate_work_authorization(
    candidate_records: List[WorkAuthorizationRecord],
    required_countries: List[str],
    sponsorship_available: bool = False,
    reference_date: Optional[date] = None
) -> Tuple[bool, str]:
    """
    Evaluates whether a candidate satisfies the work authorization requirements.
    CRITICAL INVARIANT: Work authorization is NEVER inferred from name, location, or school.
    It MUST be evaluated solely from explicit declarations.
    """
    if not required_countries:
        return True, "No specific country work authorization required by the job."

    ref = reference_date or date.today()
    req_upper = [c.upper().strip() for c in required_countries]

    valid_authorized_countries = set()
    expired_countries = set()
    needs_sponsorship_countries = set()

    for rec in candidate_records:
        c_code = rec.country_iso2.upper().strip()
        if not rec.is_valid(ref):
            expired_countries.add(c_code)
            continue
        if rec.requires_sponsorship:
            needs_sponsorship_countries.add(c_code)
        else:
            valid_authorized_countries.add(c_code)

    # Check if any required country is satisfied
    for req in req_upper:
        if req in valid_authorized_countries:
            return True, f"Candidate holds valid, unexpired work authorization for {req}."
        if req in needs_sponsorship_countries and sponsorship_available:
            return True, f"Candidate requires sponsorship for {req}, and employer provides sponsorship."

    # Failure cases
    if any(req in expired_countries for req in req_upper):
        return False, f"Candidate's work authorization for {req_upper} has expired as of {ref.isoformat()}."

    if any(req in needs_sponsorship_countries for req in req_upper) and not sponsorship_available:
        return False, f"Candidate requires sponsorship for {req_upper}, but employer does not offer sponsorship."

    return False, f"Candidate does not hold declared, valid work authorization for {req_upper}."


def format_e164_phone(phone_raw: str, default_country_iso2: str = "IN") -> str:
    """
    Cleans and formats a phone number into international E.164 format (+[country code][number]).
    """
    if not phone_raw or not isinstance(phone_raw, str):
        return ""

    raw = phone_raw.strip()
    digits = re.sub(r"[^\d+]", "", raw)

    if digits.startswith("+"):
        return digits

    # Handle leading 00 (international prefix)
    if digits.startswith("00"):
        return "+" + digits[2:]

    # Handle Indian numbers with leading 0
    if default_country_iso2.upper() == "IN" and digits.startswith("0") and len(digits) == 11:
        return "+91" + digits[1:]

    # Prepend default calling code
    calling_code = COUNTRY_CALLING_CODES.get(default_country_iso2.upper(), "+91")
    # If digits already starts with the calling code without +
    code_digits = calling_code.replace("+", "")
    if digits.startswith(code_digits) and len(digits) > len(code_digits) + 7:
        return "+" + digits

    return f"{calling_code}{digits}"


def parse_localized_date(date_str: str, country_iso2: str = "IN") -> Optional[date]:
    """
    Parses dates with locale sensitivity to resolve DD/MM vs MM/DD ambiguity.
    - US: interprets 04/05/2023 as April 5, 2023 (MM/DD/YYYY)
    - IN, GB, EU, SG, AE: interprets 04/05/2023 as 4 May 2023 (DD/MM/YYYY)
    Also supports ISO format (YYYY-MM-DD), YYYY/MM/DD, and Month Name formats.
    """
    if not date_str or not isinstance(date_str, str):
        return None

    clean = date_str.strip()

    # ISO format: YYYY-MM-DD or YYYY/MM/DD
    iso_match = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$", clean)
    if iso_match:
        y, m, d = int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))
        try:
            return date(y, m, d)
        except ValueError:
            return None

    # Textual month format: 15 Aug 2023, August 15, 2023
    for fmt in ("%d %b %Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y", "%b %Y", "%B %Y"):
        try:
            dt = datetime.strptime(clean, fmt)
            return dt.date()
        except ValueError:
            continue

    # Ambiguous slash/dot format: XX/XX/XXXX
    ambig_match = re.match(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$", clean)
    if ambig_match:
        val1 = int(ambig_match.group(1))
        val2 = int(ambig_match.group(2))
        year = int(ambig_match.group(3))

        is_us = country_iso2.upper() == "US"

        # If one number is > 12, unambiguous
        if val1 > 12:
            # val1 must be day, val2 must be month
            day, month = val1, val2
        elif val2 > 12:
            # val2 must be day, val1 must be month
            month, day = val1, val2
        else:
            # Ambiguous: rely on country convention
            if is_us:
                month, day = val1, val2
            else:
                day, month = val1, val2

        try:
            return date(year, month, day)
        except ValueError:
            return None

    return None
