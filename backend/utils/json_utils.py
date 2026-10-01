"""
Robust LLM JSON Parser Utility — 2-Tier Resilient JSON Extraction.

Features:
1. Primary: Fast direct json.loads(text)
2. Fallback 1: json_repair.loads(text) (repairs broken syntax, unescaped quotes, trailing commas, missing brackets, markdown code fences)
3. Fallback 2: Direct curated default bank / template fallback (zero useless regex overhead)
"""

from __future__ import annotations

import json
from typing import Any, Optional
import structlog

try:
    import json_repair
except ImportError:
    json_repair = None

logger = structlog.get_logger(__name__)


def parse_llm_json(raw_text: Any, default: Any = None) -> Any:
    """
    Safely extracts and parses JSON from raw LLM responses.
    1. Primary: Direct json.loads
    2. Fallback 1: json_repair.loads (handles markdown fences, trailing commas, unescaped quotes, missing brackets)
    3. Fallback 2: Directly returns default curated template (no redundant regex parsing)
    """
    if raw_text is None:
        return default

    if isinstance(raw_text, (dict, list)):
        return raw_text

    text_str = str(raw_text).strip()
    if not text_str:
        return default

    # 1. Primary: Fast direct json.loads
    try:
        return json.loads(text_str)
    except Exception:
        pass

    # 2. Fallback 1: json_repair auto-fixing
    if json_repair is not None:
        try:
            repaired = json_repair.loads(text_str)
            if repaired is not None and (isinstance(repaired, (dict, list)) or repaired != ""):
                return repaired
        except Exception:
            pass

    # 3. Fallback 2: Directly return curated default template
    logger.warning("LLM response could not be parsed into JSON via json_repair, applying default fallback", snippet=text_str[:200])
    return default
