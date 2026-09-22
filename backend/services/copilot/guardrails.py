"""
Copilot Guardrails & Observability Module
=========================================
Implements Phase 5 Safety & Observability controls:
1. Prompt Injection Guard (sanitizes untrusted text and wraps in XML delimiters)
2. PII Redaction (redacts emails and phone numbers from user messages before logging)
3. Output Grounding Guardrail (verifies cited scores/percentages against grounded context)
4. Telemetry Token & Cost Calculations
"""

import re
from typing import List, Tuple, Set

# Regex patterns for Prompt Injection and Jailbreak attempts
INJECTION_PATTERNS = [
    re.compile(r"(?i)^\s*(system|assistant|admin|developer)\s*:", re.MULTILINE),
    re.compile(r"(?i)ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules|commands|constraints)", re.IGNORECASE),
    re.compile(r"(?i)disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)", re.IGNORECASE),
    re.compile(r"(?i)you\s+are\s+now\s+(a|an\s+)?(unrestricted|evil|dan|jailbreak)", re.IGNORECASE),
    re.compile(r"(?i)do\s+anything\s+now", re.IGNORECASE),
    re.compile(r"(?i)output\s+(the\s+)?(system|initial|base)\s+prompt", re.IGNORECASE),
    re.compile(r"(?i)repeat\s+(the\s+)?(words\s+above|prompt\s+above)", re.IGNORECASE),
    re.compile(r"(?i)override\s+(all\s+)?(safety|system|guardrail)", re.IGNORECASE),
]

# Regex patterns for PII detection
EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_REGEX = re.compile(r"(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b")

# Regex pattern for percentage or score claims (e.g., '85%', '92%')
PERCENTAGE_REGEX = re.compile(r"\b(\d{1,3})%(?!\w)")


def sanitize_untrusted_text(text: str) -> str:
    """
    Strips prompt injection lines and jailbreak attempts from uploaded documents (resumes, JDs, user input).
    """
    if not text:
        return ""
    
    cleaned = text
    for pattern in INJECTION_PATTERNS:
        cleaned = pattern.sub("[FILTERED_INSTRUCTION]", cleaned)
    
    return cleaned


def wrap_user_data(tag: str, content: str, sanitize: bool = True) -> str:
    """
    Wraps untrusted user/document text in explicit XML tags labeled as data-not-instructions.
    """
    body = sanitize_untrusted_text(content) if sanitize else content
    return (
        f'<user_data type="{tag}">\n'
        f"{body.strip()}\n"
        f"</user_data>"
    )


def redact_pii(text: str) -> str:
    """
    Redacts emails and phone numbers from user messages before structlog logging.
    """
    if not text:
        return ""
    redacted = EMAIL_REGEX.sub("[EMAIL_REDACTED]", text)
    redacted = PHONE_REGEX.sub("[PHONE_REDACTED]", redacted)
    return redacted


def verify_output_grounding(
    response_text: str,
    grounded_context_str: str,
    disclaimer: str = "\n\n*Note: Specific percentage figures or match scores cited above are model estimates unless verified against an official ATS scan report.*"
) -> str:
    """
    Output Guardrail: Checks if the LLM output contains any specific percentage or score (e.g., '85%').
    If cited percentages do not appear in the grounded tool outputs or retrieved context,
    appends a transparent disclaimer.
    """
    if not response_text:
        return ""
    
    found_percentages = PERCENTAGE_REGEX.findall(response_text)
    if not found_percentages:
        return response_text
    
    # Check if all found percentages appear in grounded context
    unverified = []
    for pct in found_percentages:
        claim_str = f"{pct}%"
        if claim_str not in grounded_context_str and pct not in grounded_context_str:
            unverified.append(claim_str)
            
    if unverified and disclaimer not in response_text:
        return response_text.rstrip() + disclaimer
        
    return response_text


def calculate_cost_usd(prompt_tokens: int, completion_tokens: int, provider: str = "groq", model: str = "default") -> float:
    """
    Calculates estimated USD cost based on token counts across model providers.
    Average blended rate: $0.50 per 1M tokens ($0.0000005 per token).
    """
    try:
        from core.metrics import record_copilot_tokens
        record_copilot_tokens(model=model, provider=provider, prompt_tokens=prompt_tokens, completion_tokens=completion_tokens)
    except Exception:
        pass
    total_tokens = prompt_tokens + completion_tokens
    # $0.50 per 1,000,000 tokens
    return round((total_tokens / 1_000_000) * 0.50, 6)
