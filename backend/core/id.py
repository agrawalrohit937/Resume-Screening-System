"""
Primary Key & Unique Identifier Module for PostgreSQL Document & Relational Entities.
Uses standard Python libraries (secrets, time) with zero external C-dependencies.
Generates URL-safe and B-tree index-friendly 24-character hexadecimal identifiers.
"""

from __future__ import annotations
import secrets
import time
from typing import Any


class DocumentId(str):
    """
    24-character hexadecimal unique identifier compatible with string fields,
    PostgreSQL JSONB keys, and URL path parameters.
    """
    def __new__(cls, val: Any = None) -> DocumentId:
        if val is None or val == "":
            # 4-byte big-endian timestamp + 8-byte cryptographic random
            # Guarantees natural time-based sorting in PostgreSQL B-tree indexes
            t = int(time.time()).to_bytes(4, byteorder="big")
            r = secrets.token_bytes(8)
            val = (t + r).hex()
        elif isinstance(val, (bytes, bytearray)):
            val = val.hex()
        else:
            val = str(val).strip()
            if (val.startswith("'") and val.endswith("'")) or (val.startswith('"') and val.endswith('"')):
                val = val[1:-1].strip()

        return super().__new__(cls, val)

    @classmethod
    def is_valid(cls, val: Any) -> bool:
        if not val or not isinstance(val, (str, bytes)):
            return False
        s = str(val).strip().replace("-", "")
        # Accept 24-character hexadecimal IDs and 32/36-character UUIDs seamlessly
        return len(s) in (24, 32) and all(c in "0123456789abcdefABCDEF" for c in s)

    def __repr__(self) -> str:
        return f"DocumentId('{self}')"

    def __eq__(self, other: Any) -> bool:
        return str(self) == str(other)

    def __hash__(self) -> int:
        return hash(str(self))

    def __lt__(self, other: Any) -> bool:
        return str(self) < str(other)

    def __le__(self, other: Any) -> bool:
        return str(self) <= str(other)

    def __gt__(self, other: Any) -> bool:
        return str(self) > str(other)

    def __ge__(self, other: Any) -> bool:
        return str(self) >= str(other)


# Compatible drop-in alias
ObjectId = DocumentId

