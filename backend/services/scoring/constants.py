"""
Scoring Constants and Graded Skill Credit Definitions.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Any
import os
import json

@dataclass(frozen=True)
class SkillMatch:
    """
    Graded skill match result between a required job skill and candidate skills/evidence.
    Replaces binary pass/fail fulfillment.
    """
    required: str            # canonical
    credit: float            # 0.0 - 1.0
    match_type: str          # EXACT | ALIAS | VERSION_VARIANT | TAXONOMY_PARENT
                             # | TAXONOMY_SIBLING | EMBEDDING_NEIGHBOR | NONE
    evidence: List[str] = field(default_factory=list)  # candidate skills / spans that produced match
    bucket: str = "missing"  # matched | transferable | missing

    def __iter__(self):
        """Enable tuple unpacking (is_fulfilled, match_type) for backward compatibility."""
        yield self.credit >= 0.9
        yield self.match_type

    def __getitem__(self, index: int):
        """Enable index access match[0] -> is_fulfilled, match[1] -> match_type."""
        if index == 0:
            return self.credit >= 0.9
        elif index == 1:
            return self.match_type
        raise IndexError("SkillMatch index out of range (supported: 0, 1)")


DEFAULT_SKILL_CREDIT_TABLE: Dict[str, Dict[str, Any]] = {
    "EXACT": {"credit": 1.00, "bucket": "matched"},
    "ALIAS": {"credit": 1.00, "bucket": "matched"},
    "VERSION_VARIANT": {"credit": 1.00, "bucket": "matched"},
    "TAXONOMY_PARENT": {"credit": 0.90, "bucket": "matched"},
    "TAXONOMY_SIBLING": {"credit": 0.40, "bucket": "transferable"},
    "EMBEDDING_NEIGHBOR": {"credit": 0.30, "bucket": "transferable"},
    "NONE": {"credit": 0.00, "bucket": "missing"},
}


def get_skill_credit_table() -> Dict[str, Dict[str, Any]]:
    """
    Returns the active skill credit table, allowing environment variable overrides.
    Time: O(1). Space: O(1).
    """
    env_override = os.getenv("SKILL_CREDIT_TABLE_JSON")
    if env_override:
        try:
            parsed = json.loads(env_override)
            table = dict(DEFAULT_SKILL_CREDIT_TABLE)
            for k, v in parsed.items():
                if k in table and isinstance(v, dict):
                    table[k] = {**table[k], **v}
            return table
        except Exception:
            pass
    return DEFAULT_SKILL_CREDIT_TABLE
