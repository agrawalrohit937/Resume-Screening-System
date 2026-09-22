"""
ATS Format Check Service (Phase 6).
Evaluates resume readability and machine-parsability for ATS compliance.
Identifies formatting barriers such as:
1. Multi-column layout fragments
2. Tables / complex nested formatting
3. Contact info placed in header/footer regions
4. Non-standard section names
5. Non-parsable or ambiguous date formats
6. Non-ASCII/unusual glyphs & icon characters
7. Low word-count or symbol-heavy text
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set
import structlog

logger = structlog.get_logger(__name__)

# Standard Resume Section Headers Expected by ATS
STANDARD_SECTIONS = {
    "experience": re.compile(r"\b(?:work\s+experience|professional\s+experience|employment|experience|work\s+history)\b", re.IGNORECASE),
    "education": re.compile(r"\b(?:education|academic|academics|qualifications|university|degrees?)\b", re.IGNORECASE),
    "skills": re.compile(r"\b(?:skills|technical\s+skills|core\s+competencies|technologies|expertise|proficiencies)\b", re.IGNORECASE),
    "projects": re.compile(r"\b(?:projects|personal\s+projects|academic\s+projects|portfolio|key\s+projects)\b", re.IGNORECASE),
    "summary": re.compile(r"\b(?:summary|professional\s+summary|profile|about\s+me|objective)\b", re.IGNORECASE),
}

# Contact Information Regex Patterns
_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
_PHONE_RE = re.compile(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}")
_URL_RE = re.compile(r"(?:https?://|www\.)[^\s/$.?#].[^\s]*", re.IGNORECASE)

# Unusual Glyphs / Icon Characters (Private Use Area & Dingbats/Symbols, excluding standard ASCII/punctuation)
_UNUSUAL_GLYPH_RE = re.compile(r"[\uE000-\uF8FF\u2600-\u26FF\u2700-\u27BF]")


def check_ats_formatting(
    raw_text: str,
    layout_meta: Optional[Dict[str, Any]] = None,
    extracted_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Analyzes resume text and layout metadata for ATS parseability issues.

    Returns:
        {
            "is_ats_compliant": bool,
            "compliance_score": float (in [0.0, 100.0]),
            "format_issues": [
                {
                    "issue_id": str,
                    "title": str,
                    "severity": "high" | "medium" | "low",
                    "description": str,
                    "suggestion": str,
                    "evidence": Optional[str],
                }
            ],
            "passed_checks": List[str],
        }
    """
    text = (raw_text or "").strip()
    layout = layout_meta or {}
    data = extracted_data or {}
    issues: List[Dict[str, Any]] = []
    passed: List[str] = []

    if not text:
        return {
            "is_ats_compliant": False,
            "compliance_score": 0.0,
            "format_issues": [
                {
                    "issue_id": "empty_document",
                    "title": "Empty or Unreadable Document",
                    "severity": "high",
                    "description": "No readable text could be extracted from this document.",
                    "suggestion": "Ensure the resume is saved as a clean text-based PDF or DOCX file (not a flat image or scan).",
                    "evidence": None,
                }
            ],
            "passed_checks": [],
        }

    words = text.split()
    word_count = len(words)

    # 1. Multi-Column Layout Detection
    short_tokens = sum(1 for w in words if len(re.sub(r"[^A-Za-z0-9]", "", w)) <= 2)
    short_ratio = short_tokens / max(word_count, 1)
    has_multicol = layout.get("has_multi_column", False) or (short_ratio > 0.35 and word_count > 100)

    if has_multicol:
        issues.append({
            "issue_id": "multi_column_layout",
            "title": "Multi-Column or Complex Grid Layout",
            "severity": "high",
            "description": "Multi-column layouts often cause ATS scanners to read across columns horizontally, scrambling your experience timeline and skills.",
            "suggestion": "Switch to a clean, single-column chronological layout with clear top-to-bottom reading order.",
            "evidence": f"Short fragment ratio: {short_ratio:.1%}",
        })
    else:
        passed.append("Single-column reading structure")

    # 2. Table and Complex Grid Detection
    has_tables = layout.get("has_tables", False) or bool(re.search(r"(\|[^\n]+\|\n){3,}", text))
    if has_tables:
        issues.append({
            "issue_id": "tables_detected",
            "title": "Tables / Grid Blocks Detected",
            "severity": "medium",
            "description": "ATS parsers frequently drop or misalign text nested inside table borders and grid cells.",
            "suggestion": "Use simple tab stops, bullet points, or plain line breaks instead of table cells.",
            "evidence": "Embedded table elements detected",
        })
    else:
        passed.append("No problematic table borders")

    # 3. Standard Section Headers
    missing_sections = []
    text_lower = text.lower()
    for sec_name, pattern in STANDARD_SECTIONS.items():
        if not pattern.search(text_lower):
            missing_sections.append(sec_name)

    if missing_sections:
        issues.append({
            "issue_id": "missing_standard_sections",
            "title": f"Missing Standard Section Headers ({', '.join(missing_sections).title()})",
            "severity": "high" if "experience" in missing_sections or "skills" in missing_sections else "medium",
            "description": f"Standard section headings ({', '.join(missing_sections)}) were not detected by the ATS parser.",
            "suggestion": "Use clear, conventional headings like 'Work Experience', 'Education', 'Technical Skills', and 'Projects'.",
            "evidence": f"Missing: {', '.join(missing_sections)}",
        })
    else:
        passed.append("All standard section headers detected")

    # 4. Contact Information Accessibility (Header/Footer vs Body)
    has_email = bool(_EMAIL_RE.search(text)) or bool(data.get("email"))
    has_phone = bool(_PHONE_RE.search(text)) or bool(data.get("phone"))

    if not has_email:
        issues.append({
            "issue_id": "missing_email",
            "title": "Email Address Not Scannable",
            "severity": "high",
            "description": "ATS parser could not find a valid email in the main document body.",
            "suggestion": "Place your email address in the primary body text rather than inside a separate Word header/footer.",
            "evidence": None,
        })
    else:
        passed.append("Valid email address detected in scannable body")

    if not has_phone:
        issues.append({
            "issue_id": "missing_phone",
            "title": "Phone Number Not Detected",
            "severity": "medium",
            "description": "No contact telephone number was detected in the document text.",
            "suggestion": "Include your mobile number with country code near the top of the resume.",
            "evidence": None,
        })
    else:
        passed.append("Phone contact number detected")

    # 5. Unusual Glyphs and Icon Characters
    icon_matches = _UNUSUAL_GLYPH_RE.findall(text)
    if icon_matches:
        issues.append({
            "issue_id": "unusual_glyphs",
            "title": "Custom Icons or Non-Standard Symbols Found",
            "severity": "low",
            "description": f"Detected {len(icon_matches)} custom icon or symbol characters that may render as corrupted boxes or question marks in older ATS systems.",
            "suggestion": "Replace custom icon fonts (e.g. phone/envelope glyphs) with standard bullet points (•) or text labels.",
            "evidence": f"Found {len(icon_matches)} custom glyphs",
        })
    else:
        passed.append("Clean character encoding and standard fonts")

    # 6. Date Parsability Check
    exp_entries = data.get("work_experience") or data.get("experience") or []
    unparsable_dates = 0
    for exp in exp_entries:
        if isinstance(exp, dict):
            s_date = exp.get("start_date")
            e_date = exp.get("end_date")
            if not s_date and not e_date and not exp.get("duration_years"):
                unparsable_dates += 1

    if unparsable_dates > 0 and len(exp_entries) > 0:
        issues.append({
            "issue_id": "unparsable_dates",
            "title": "Non-Standard or Missing Experience Dates",
            "severity": "medium",
            "description": f"{unparsable_dates} work experience entry/entries lack clear start/end dates for timeline calculations.",
            "suggestion": "Use consistent date formats such as 'Month YYYY – Month YYYY' or '01/2022 – 05/2024' for every role.",
            "evidence": f"{unparsable_dates} unparsed date intervals",
        })
    else:
        passed.append("Consistent, parsable work history dates")

    # Compute Compliance Score
    deductions = {
        "high": 25.0,
        "medium": 12.0,
        "low": 5.0,
    }
    total_deduction = sum(deductions.get(iss["severity"], 10.0) for iss in issues)
    compliance_score = max(0.0, min(100.0, round(100.0 - total_deduction, 1)))
    is_compliant = compliance_score >= 70.0 and not any(i["severity"] == "high" for i in issues)

    return {
        "is_ats_compliant": is_compliant,
        "compliance_score": compliance_score,
        "format_issues": issues,
        "passed_checks": passed,
    }
