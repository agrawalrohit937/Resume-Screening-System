"""
Input Validators — reusable validation helpers
"""

import re
from typing import Any


def is_valid_document_id(value: Any) -> bool:
    """Validate 24-character hexadecimal IDs and 32/36-character UUIDs."""
    if not value or not isinstance(value, (str, bytes)):
        return False
    s = str(value).strip().replace("-", "")
    return len(s) in (24, 32) and all(c in "0123456789abcdefABCDEF" for c in s)


class DocumentId:
    @staticmethod
    def is_valid(value: Any) -> bool:
        return is_valid_document_id(value)


ObjectId = DocumentId
is_valid_object_id = is_valid_document_id


def validate_document_id(value: str, field_name: str = "ID") -> str:
    if not is_valid_document_id(value):
        raise ValueError(f"Invalid {field_name}: '{value}' is not a valid document ID")
    return value


validate_object_id = validate_document_id


def is_valid_github_username(username: str) -> bool:
    pattern = r"^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$"
    return bool(re.match(pattern, username))


def is_valid_url(url: str) -> bool:
    pattern = r"https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+"
    return bool(re.match(pattern, url))


def clamp(value: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    return max(min_val, min(max_val, value))


def normalize_score(score: float) -> float:
    return round(clamp(score), 4)


def score_to_label(score: float) -> str:
    if score >= 0.80:
        return "strong_match"
    elif score >= 0.65:
        return "good_match"
    elif score >= 0.45:
        return "partial_match"
    else:
        return "poor_match"


def score_to_grade(score: float) -> str:
    if score >= 0.90:
        return "A+"
    elif score >= 0.80:
        return "A"
    elif score >= 0.70:
        return "B"
    elif score >= 0.60:
        return "C"
    elif score >= 0.50:
        return "D"
    else:
        return "F"
