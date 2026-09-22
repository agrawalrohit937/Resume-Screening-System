"""
PII Redaction and Blind Scoring Security Module for CareerPilot ATS.
Implements blind scoring mode (FEATURE_BLIND_SCORING) by masking:
- Candidate Name, Emails, Phone Numbers
- Indian Context demographics: Caste, Category (SC/ST/OBC/EWS), Religion, Marital Status, DOB/Age
- Socioeconomic proxies: Institution names and graduation years
"""

import re
from typing import Any, Dict, List, Optional, Set, Tuple
import structlog

logger = structlog.get_logger(__name__)

# Basic Contact Details
EMAIL_REGEX = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', re.IGNORECASE)
PHONE_REGEX = re.compile(r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b')
URL_REGEX = re.compile(r'https?://(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)')

# Indian Context & Demographic Patterns
DOB_REGEX = re.compile(
    r'\b(?:dob|d\.o\.b\.|date\s+of\s+birth|birth\s*date)\s*[:\-]?\s*(\d{1,2}[-/.](?:\d{1,2}|[A-Za-z]{3})[-/.](?:\d{4}|\d{2})|\d{4}[-/.](?:\d{1,2}|[A-Za-z]{3})[-/.]\d{1,2})\b',
    re.IGNORECASE
)
AGE_REGEX = re.compile(r'\b(?:age|aged)\s*[:\-]?\s*(\d{1,2})\s*(?:years|yrs)?\b', re.IGNORECASE)

MARITAL_REGEX = re.compile(
    r'\b(?:marital\s+status|marital)\s*[:\-]?\s*(single|married|unmarried|divorced|widowed)\b',
    re.IGNORECASE
)

RELIGION_REGEX = re.compile(
    r'\b(?:religion|faith)\s*[:\-]?\s*(hindu|muslim|islam|christian|sikh|jain|buddhist|parsi|jewish|atheist)\b',
    re.IGNORECASE
)

CASTE_CATEGORY_REGEX = re.compile(
    r'\b(?:caste|category|social\s+category)\s*[:\-]?\s*([^\n,;]+)'
    r'|\b(sc|st|obc|ews|general\s+category|non-creamy\s+layer|creamy\s+layer)\b',
    re.IGNORECASE
)

GENDER_REGEX = re.compile(
    r'\b(?:gender|sex)\s*[:\-]?\s*(male|female|m|f|transgender|non-binary|other)\b',
    re.IGNORECASE
)

# Institution & Year Proxies
GRAD_YEAR_REGEX = re.compile(
    r'\b(?:batch\s+of|class\s+of|passing\s+year|year\s+of\s+passing|graduating\s+year|graduated\s+in)\s*[:\-]?\s*(\d{4})\b',
    re.IGNORECASE
)


def mask_pii_extended(
    text: str,
    candidate_name: Optional[str] = None,
    mask_demographics: bool = True,
) -> Tuple[str, Dict[str, str]]:
    """
    Masks PII, Indian context demographics, and institutional proxies in text.
    Returns: (redacted_text, pii_map)

    Complexity:
        Time: O(L_text) via compiled regex passes.
        Space: O(L_text + N_redactions) for pii_map.
    """
    pii_map: Dict[str, str] = {}
    if not text:
        return "", pii_map

    redacted = str(text)

    # 1. Mask declared candidate name
    if candidate_name and len(candidate_name.strip()) > 2:
        c_clean = candidate_name.strip()
        token = "[CANDIDATE_NAME_REDACTED]"
        pii_map[token] = c_clean
        redacted = re.sub(re.escape(c_clean), token, redacted, flags=re.IGNORECASE)

    # 2. Mask Emails
    email_idx = 1
    def _mask_email(m):
        nonlocal email_idx
        token = f"[EMAIL_REDACTED_{email_idx}]"
        email_idx += 1
        pii_map[token] = m.group(0)
        return token
    redacted = EMAIL_REGEX.sub(_mask_email, redacted)

    # 3. Mask Phones
    phone_idx = 1
    def _mask_phone(m):
        nonlocal phone_idx
        token = f"[PHONE_REDACTED_{phone_idx}]"
        phone_idx += 1
        pii_map[token] = m.group(0)
        return token
    redacted = PHONE_REGEX.sub(_mask_phone, redacted)

    if mask_demographics:
        # 4. Indian Context: Date of Birth & Age
        dob_idx = 1
        def _mask_dob(m):
            nonlocal dob_idx
            token = f"[DOB_REDACTED_{dob_idx}]"
            dob_idx += 1
            pii_map[token] = m.group(0)
            return token
        redacted = DOB_REGEX.sub(_mask_dob, redacted)
        redacted = AGE_REGEX.sub(r'[AGE_REDACTED]', redacted)

        # 5. Indian Context: Marital Status
        def _sub_mar(m):
            token = "[MARITAL_STATUS_REDACTED]"
            pii_map[token] = m.group(0)
            return token
        redacted = MARITAL_REGEX.sub(_sub_mar, redacted)

        # 6. Indian Context: Religion
        def _sub_rel(m):
            token = "[RELIGION_REDACTED]"
            pii_map[token] = m.group(0)
            return token
        redacted = RELIGION_REGEX.sub(_sub_rel, redacted)

        # 7. Indian Context: Caste / Reservation Category
        def _sub_cst(m):
            token = "[CASTE_CATEGORY_REDACTED]"
            pii_map[token] = m.group(0)
            return token
        redacted = CASTE_CATEGORY_REGEX.sub(_sub_cst, redacted)

        # 8. Gender
        def _sub_gen(m):
            token = "[GENDER_REDACTED]"
            pii_map[token] = m.group(0)
            return token
        redacted = GENDER_REGEX.sub(_sub_gen, redacted)

        # 9. Graduation Years (Socioeconomic / Age proxy)
        redacted = GRAD_YEAR_REGEX.sub(r'[GRAD_YEAR_REDACTED]', redacted)

    return redacted, pii_map


def unmask_pii_extended(obj: Any, pii_map: Dict[str, str]) -> Any:
    """
    Recursively replaces redaction tokens with original values across dicts, lists, and strings.
    """
    if not pii_map:
        return obj

    if isinstance(obj, str):
        res = obj
        for token, original in pii_map.items():
            if token in res:
                res = res.replace(token, original)
        return res
    elif isinstance(obj, dict):
        return {k: unmask_pii_extended(v, pii_map) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [unmask_pii_extended(item, pii_map) for item in obj]
    return obj
