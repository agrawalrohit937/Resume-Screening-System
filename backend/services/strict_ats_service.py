"""
Strict ATS Service — deterministic, no-LLM "reality check" engine.

This is the dumb-but-honest counterpart to workflows/ats_graph.py. Real
corporate ATS software (Taleo, Workday, iCIMS, Greenhouse's basic filters,
etc.) mostly does NOT do semantic reasoning — it does regex/string matching
against raw text and hard knockout questions. This module simulates that
so students get a reality check alongside the AI's more generous read.

Nothing in this file calls an LLM. Everything is pure Python so it's fast,
free, and 100% deterministic/reproducible for a given input.
"""

from __future__ import annotations

import gc
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import structlog

logger = structlog.get_logger(__name__)


# ══════════════════════════════════════════════════════════════════════════
# 1. PARSING HEALTH — did the PDF/DOCX extractor actually get clean text?
# ══════════════════════════════════════════════════════════════════════════

# Section headers we'd expect pdfplumber/docx extraction to surface if the
# resume has a normal, ATS-readable structure. Missing all of these is a
# strong signal of a broken multi-column template rather than a genuinely
# section-less resume.
_EXPECTED_SECTION_HINTS = [
    r"experience", r"education", r"skills", r"projects", r"summary",
    r"objective", r"certifi", r"work history", r"employment",
]


@dataclass
class ParsingHealth:
    is_healthy: bool
    confidence: float  # 0.0 - 1.0, how much we'd trust this extraction
    warnings: List[str] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "is_healthy": self.is_healthy,
            "confidence": round(self.confidence, 2),
            "warnings": self.warnings,
            "metrics": self.metrics,
        }


def evaluate_parsing_health(raw_text: str) -> ParsingHealth:
    """
    Heuristic quality check on extracted resume text.

    Catches the classic failure mode: a visually nice 2-column Canva/Figma
    resume where pdfplumber reads left-to-right across columns and produces
    a soup of interleaved fragments. Real ATS parsers fail on these too —
    so surfacing this to the student is itself useful advice ("switch to a
    single-column template"), not just a debugging aid.
    """
    warnings: List[str] = []
    text = (raw_text or "").strip()

    words = text.split()
    word_count = len(words)

    if word_count == 0:
        return ParsingHealth(
            is_healthy=False,
            confidence=0.0,
            warnings=["No text could be extracted at all. The file may be a scanned image or a corrupted export."],
            metrics={"word_count": 0},
        )

    # 1. Extremely short extraction relative to what a real resume has
    too_short = word_count < 100

    # 2. Ratio of very short "word" tokens (1-2 chars). A healthy resume has
    #    plenty of normal words; a column-collapse produces lots of shredded
    #    fragments and stray single letters/numbers.
    short_tokens = sum(1 for w in words if len(re.sub(r"[^A-Za-z0-9]", "", w)) <= 2)
    short_token_ratio = short_tokens / word_count

    # 3. Alphabetic density — garbled encoding shows up as symbol soup
    alpha_chars = sum(1 for c in text if c.isalpha())
    alpha_ratio = alpha_chars / max(len(text), 1)

    # 4. Average word length — collapsed columns tend to fragment words,
    #    dragging the average down; wall-of-symbols does the same.
    clean_lengths = [len(re.sub(r"[^A-Za-z0-9]", "", w)) for w in words]
    clean_lengths = [l for l in clean_lengths if l > 0]
    avg_word_len = sum(clean_lengths) / len(clean_lengths) if clean_lengths else 0

    # 5. Do any expected resume section headers show up at all?
    lowered = text.lower()
    sections_found = sum(1 for pat in _EXPECTED_SECTION_HINTS if re.search(pat, lowered))

    if too_short:
        warnings.append(
            f"Only {word_count} words were extracted — that's unusually little for a resume. "
            "The PDF may be image-based, scanned, or using a template that doesn't export text cleanly."
        )

    if short_token_ratio > 0.35:
        warnings.append(
            "A large portion of the extracted text is broken into short fragments. "
            "This is the classic signature of a multi-column or heavily-designed template "
            "confusing text extraction — most corporate ATS software will have the exact same problem. "
            "Consider a single-column, text-based resume format."
        )

    if alpha_ratio < 0.55:
        warnings.append(
            "The extracted text contains a high ratio of symbols/whitespace to letters, "
            "suggesting encoding or layout issues during parsing."
        )

    if avg_word_len and avg_word_len < 3.2:
        warnings.append(
            "Extracted words are unusually short on average, which often means words got "
            "split apart during extraction (common with tables, icons, or column layouts)."
        )

    if sections_found == 0:
        warnings.append(
            "No standard resume section headers (Experience, Education, Skills, etc.) were "
            "detected in the extracted text. Either the resume uses non-standard headers, or "
            "the layout is preventing clean extraction — both are risky for real ATS software."
        )

    # Confidence score: start at 1.0, subtract for each red flag, floor at 0
    confidence = 1.0
    if too_short:
        confidence -= 0.4
    confidence -= min(short_token_ratio, 0.5)
    if alpha_ratio < 0.55:
        confidence -= 0.2
    if avg_word_len and avg_word_len < 3.2:
        confidence -= 0.15
    if sections_found == 0:
        confidence -= 0.2
    confidence = max(0.0, min(1.0, confidence))

    is_healthy = confidence >= 0.6 and not too_short

    return ParsingHealth(
        is_healthy=is_healthy,
        confidence=confidence,
        warnings=warnings,
        metrics={
            "word_count": word_count,
            "short_token_ratio": round(short_token_ratio, 3),
            "alpha_ratio": round(alpha_ratio, 3),
            "avg_word_len": round(avg_word_len, 2),
            "sections_found": sections_found,
        },
    )


# ══════════════════════════════════════════════════════════════════════════
# 2. KNOCKOUT RULES — hard requirements, no LLM judgment calls
# ══════════════════════════════════════════════════════════════════════════

_SOFT_LANGUAGE = re.compile(
    r"\b(preferred|nice[\s-]to[\s-]have|plus|bonus|desirable|a\s+plus|ideally|good\s+to\s+have)\b",
    re.IGNORECASE,
)
_HARD_LANGUAGE = re.compile(
    r"\b(required|must\s+have|minimum|at\s+least|essential|mandatory|must\s+possess|need\s+to\s+have)\b",
    re.IGNORECASE,
)

_YEARS_PATTERNS = [
    re.compile(r"(\d+)\s*\+\s*years?", re.IGNORECASE),
    re.compile(r"(\d+)\s*(?:to|-|–)\s*\d+\s*years?", re.IGNORECASE),
    re.compile(r"minimum\s+of\s+(\d+)\s*years?", re.IGNORECASE),
    re.compile(r"at\s+least\s+(\d+)\s*years?", re.IGNORECASE),
    re.compile(r"(\d+)\s*years?\s*(?:of\s+)?(?:relevant\s+|professional\s+|work\s+)?experience", re.IGNORECASE),
]

_DEGREE_RANK = {
    "high school": 1, "diploma": 1,
    "associate": 2,
    "bachelor": 3, "b.tech": 3, "btech": 3, "b.e.": 3, "be": 3, "b.s.": 3,
    "bs": 3, "b.a.": 3, "ba": 3, "bca": 3, "bsc": 3,
    "master": 4, "m.tech": 4, "mtech": 4, "m.s.": 4, "ms": 4, "m.a.": 4,
    "ma": 4, "mba": 4, "mca": 4, "msc": 4,
    "phd": 5, "ph.d.": 5, "doctorate": 5,
}

_DEGREE_WORD_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in sorted(_DEGREE_RANK, key=len, reverse=True)) + r")\b",
    re.IGNORECASE,
)

_PURSUING_PATTERN = re.compile(
    r"\b(pursuing|expected|anticipated|in\s+progress|currently\s+enrolled|final[\s-]year)\b",
    re.IGNORECASE,
)


@dataclass
class KnockoutResult:
    is_knockout: bool
    reasons: List[str] = field(default_factory=list)
    advisories: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "is_knockout": self.is_knockout,
            "reasons": self.reasons,
            "advisories": self.advisories,
        }


def _context_is_hard_requirement(jd_text: str, match_start: int, match_end: int, window: int = 90) -> bool:
    """Look at text around a match to decide if it reads as mandatory or as a preference."""
    lo = max(0, match_start - window)
    hi = min(len(jd_text), match_end + window)
    ctx = jd_text[lo:hi]
    if _SOFT_LANGUAGE.search(ctx):
        return False
    if _HARD_LANGUAGE.search(ctx):
        return True
    # Default: an explicit "X+ years" / degree mention without softening
    # language reads as a real requirement in most real-world JDs.
    return True


def _extract_years_requirement(jd_text: str) -> Optional[Tuple[float, bool]]:
    """Returns (min_years_required, is_hard_requirement) or None if not found."""
    best: Optional[Tuple[float, bool]] = None
    for pattern in _YEARS_PATTERNS:
        for m in pattern.finditer(jd_text):
            try:
                years = float(m.group(1))
            except (ValueError, IndexError):
                continue
            is_hard = _context_is_hard_requirement(jd_text, m.start(), m.end())
            # Keep the highest requirement found (strictest reading)
            if best is None or years > best[0]:
                best = (years, is_hard)
    return best


def _extract_degree_requirement(jd_text: str) -> Optional[Tuple[int, str, bool]]:
    """Returns (min_rank_required, matched_degree_label, is_hard_requirement) or None."""
    best: Optional[Tuple[int, str, bool]] = None
    for m in _DEGREE_WORD_PATTERN.finditer(jd_text):
        label = m.group(1).lower()
        rank = _DEGREE_RANK.get(label)
        if rank is None:
            continue
        is_hard = _context_is_hard_requirement(jd_text, m.start(), m.end())
        if best is None or rank > best[0]:
            best = (rank, label, is_hard)
    return best


def _candidate_max_degree_rank(extracted_data: dict) -> Tuple[int, bool]:
    """Returns (highest degree rank candidate holds, has_in_progress_higher_degree)."""
    education = extracted_data.get("education", []) or []
    max_rank = 0
    in_progress = False
    for edu in education:
        if hasattr(edu, "model_dump"):
            edu = edu.model_dump()
        elif hasattr(edu, "__dict__"):
            edu = edu.__dict__
        degree_str = str(edu.get("degree") or "")
        m = _DEGREE_WORD_PATTERN.search(degree_str)
        if not m:
            continue
        rank = _DEGREE_RANK.get(m.group(1).lower(), 0)
        # A missing/None end_year or "pursuing" language nearby suggests in-progress
        is_pursuing = bool(_PURSUING_PATTERN.search(degree_str)) or not edu.get("end_year")
        if rank > max_rank:
            max_rank = rank
            in_progress = is_pursuing
        elif rank == max_rank and is_pursuing:
            in_progress = True

    # Fallback to education_level field extracted by deterministic NLP parser
    if max_rank == 0 and extracted_data.get("education_level"):
        edu_level_str = str(extracted_data.get("education_level") or "")
        m = _DEGREE_WORD_PATTERN.search(edu_level_str)
        if m:
            max_rank = _DEGREE_RANK.get(m.group(1).lower(), 0)

    return max_rank, in_progress


def evaluate_knockout(extracted_data: dict, jd_text: str) -> KnockoutResult:
    """
    Pure-Python pass/fail check against hard JD requirements.

    Deliberately conservative about false-positives: we only fail a
    candidate when a requirement is genuinely absent, and we treat
    "currently pursuing the required degree" as an advisory rather than an
    automatic rejection, since plenty of real postings still accept
    final-year students even when the JD text doesn't spell that out.
    """
    reasons: List[str] = []
    advisories: List[str] = []

    if not jd_text or not jd_text.strip():
        return KnockoutResult(is_knockout=False, reasons=[], advisories=[])

    candidate_years = float(extracted_data.get("total_experience_years") or 0)
    years_req = _extract_years_requirement(jd_text)
    if years_req is not None:
        required_years, is_hard = years_req
        if candidate_years <= 0 and required_years > 0:
            msg = f"Requires {required_years:.0f}+ years of professional experience — none was detected on the resume."
            if is_hard:
                reasons.append(msg)
            else:
                advisories.append(msg + " (listed as preferred, not mandatory)")
        elif candidate_years < required_years:
            msg = (
                f"Requires {required_years:.0f}+ years of experience; resume shows "
                f"~{candidate_years:.1f} year(s)."
            )
            if is_hard and candidate_years < required_years * 0.5:
                # Only a hard knockout when the gap is large — small gaps are
                # a "weakness to flag" (handled by the AI engine), not a
                # binary corporate-bot rejection.
                reasons.append(msg)
            else:
                advisories.append(msg)

    degree_req = _extract_degree_requirement(jd_text)
    if degree_req is not None:
        required_rank, required_label, is_hard = degree_req
        candidate_rank, in_progress = _candidate_max_degree_rank(extracted_data)
        if candidate_rank == 0:
            msg = f"Requires a {required_label.title()}-level degree — no matching education entry was found on the resume."
            if is_hard:
                reasons.append(msg)
            else:
                advisories.append(msg + " (listed as preferred, not mandatory)")
        elif candidate_rank < required_rank:
            msg = f"Requires a {required_label.title()}-level degree; highest education on file ranks below that."
            if is_hard:
                reasons.append(msg)
            else:
                advisories.append(msg)
        elif in_progress:
            advisories.append(
                f"Meets the {required_label.title()}-level requirement with a degree currently in progress — "
                "confirm the JD's start date allows for your graduation timeline."
            )

    return KnockoutResult(
        is_knockout=len(reasons) > 0,
        reasons=reasons,
        advisories=advisories,
    )


# ══════════════════════════════════════════════════════════════════════════
# 3. EXACT KEYWORD MATCH — the "dumb bot" score
# ══════════════════════════════════════════════════════════════════════════

@dataclass
class StrictKeywordMatch:
    strict_ats_score: float
    matched_exact: List[str] = field(default_factory=list)
    missing_exact: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "strict_ats_score": self.strict_ats_score,
            "matched_exact": self.matched_exact,
            "missing_exact": self.missing_exact,
        }


def _flexible_pattern(skill: str) -> Optional[re.Pattern]:
    """
    Build a regex that matches a skill across spacing, hyphens, dots, newlines (\n),
    and carriage returns (\r) to handle PDF line-wrapping boundaries reliably.
    """
    cleaned = skill.strip()
    if not cleaned:
        return None
    
    parts = [p for p in re.split(r'[\s\-\.]+', cleaned) if p]
    if not parts:
        return None
        
    escaped_parts = [re.escape(part) for part in parts]
    regex_str = r"[\s\-\.\n\r]+".join(escaped_parts)
    
    try:
        return re.compile(r"(?<![A-Za-z0-9])" + regex_str + r"(?![A-Za-z0-9])", re.IGNORECASE)
    except re.error:
        return None


def evaluate_strict_keyword_match(raw_text: str, skill_universe: List[str]) -> StrictKeywordMatch:
    """
    Exact/literal keyword search of `skill_universe` against the raw resume
    text — no semantic reasoning, no synonym awareness. This is intentional:
    it simulates the naive keyword-count many real ATS filters still run.

    `skill_universe` should be the deduped union of whatever skills matter
    for this JD (e.g. explicit required_skills from the UI plus the AI
    evaluator's matched_skills + missing_skills), so the strict score is
    checked against the *same* skill list the AI score was judged against —
    making the two scores directly comparable.
    """
    text = raw_text or ""
    seen = set()
    universe = []
    for s in skill_universe:
        key = (s or "").strip().lower()
        if key and key not in seen:
            seen.add(key)
            universe.append(s.strip())

    if not universe:
        return StrictKeywordMatch(strict_ats_score=0.0, matched_exact=[], missing_exact=[])

    matched, missing = [], []
    for skill in universe:
        if "/" in skill:
            sub_skills = [sub.strip() for sub in skill.split("/") if sub.strip()]
        else:
            sub_skills = [skill]

        skill_matched = False
        for sub in sub_skills:
            pattern = _flexible_pattern(sub)
            if pattern and pattern.search(text):
                skill_matched = True
                break

        if skill_matched:
            matched.append(skill)
        else:
            missing.append(skill)

    total = len(matched) + len(missing)
    score = round((len(matched) / total) * 100, 1) if total > 0 else 0.0
    return StrictKeywordMatch(strict_ats_score=score, matched_exact=matched, missing_exact=missing)


# ══════════════════════════════════════════════════════════════════════════
# 4. VECTOR SEMANTIC SIMILARITY & KNOCKOUT MATH ENGINES
# ══════════════════════════════════════════════════════════════════════════

import os
import requests
from services.skill_ontology import evaluate_skill_fulfillment
from services.nlp_extractor import extract_skills_deterministic

# Hugging Face API Configuration (Zero Local RAM consumption)
HF_API_URL = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2"
HF_TOKEN = os.environ.get("HF_TOKEN")


def compute_vector_similarity(resume_text: str, jd_text: str) -> float:
    """
    Calculates semantic similarity using Hugging Face Inference API.
    Zero RAM consumption on the local server — prevents 512MB OOM crashes.
    Returns AI Match Score on a 0-100 percentage scale.
    """
    if not resume_text or not jd_text:
        return 0.0

    # 1. Hugging Face API Call (Primary - Accurate & Lightweight)
    if HF_TOKEN:
        headers = {"Authorization": f"Bearer {HF_TOKEN}"}
        payload = {
            "inputs": {
                "source_sentence": jd_text[:2500],  # Limit length for API efficiency
                "sentences": [resume_text[:2500]]
            }
        }
        try:
            response = requests.post(HF_API_URL, headers=headers, json=payload, timeout=12)
            if response.status_code == 200:
                similarity_score = response.json()[0]
                return max(0.0, min(100.0, round(float(similarity_score) * 100, 2)))
            else:
                logger.warning("HuggingFace API returned non-200 status", status=response.status_code, response=response.text)
        except Exception as e:
            logger.warning("HuggingFace API call failed, falling back to basic math similarity", error=str(e))

    # 2. Ultra-Lightweight Pure Python Fallback (No scikit-learn / numpy needed)
    # Uses Jaccard Word Overlap to save 100% of ML library RAM
    try:
        r_words = set(re.findall(r"\w+", resume_text.lower()))
        j_words = set(re.findall(r"\w+", jd_text.lower()))
        if not r_words or not j_words:
            return 0.0
        
        intersection = r_words.intersection(j_words)
        union = r_words.union(j_words)
        jaccard_sim = len(intersection) / len(union)
        
        # Scale Jaccard (usually lower than cosine) to a realistic 0-100 score
        return max(0.0, min(100.0, round((jaccard_sim * 2.5) * 100, 2)))
    except Exception:
        return 50.0
    finally:
        gc.collect()


def evaluate_knockout_math(extracted_data: dict, jd_text: str) -> Dict[str, Any]:
    """
    Calculates deterministic weighted scores:
    - Mandatory Skills (50%)
    - Experience (30%)
    - Education (20%)
    Evaluates required skills using Skill Ontology equivalence.
    """
    cand_skills = extracted_data.get("skills", [])
    jd_skills = extract_skills_deterministic(jd_text)

    matched_skills = []
    missing_skills = []

    if jd_skills:
        for req_skill in jd_skills:
            is_fulfilled, _ = evaluate_skill_fulfillment(req_skill, cand_skills)
            if is_fulfilled:
                matched_skills.append(req_skill)
            else:
                missing_skills.append(req_skill)
        skills_score = len(matched_skills) / len(jd_skills)
    else:
        skills_score = 0.8

    # Experience ratio
    cand_exp = float(extracted_data.get("total_experience_years") or 0.0)
    years_req = _extract_years_requirement(jd_text)
    required_exp = years_req[0] if years_req else 0.0
    exp_score = min(1.0, cand_exp / required_exp) if required_exp > 0 else 1.0

    # Education rank ratio
    degree_req = _extract_degree_requirement(jd_text)
    required_rank = degree_req[0] if degree_req else 1
    cand_rank, _ = _candidate_max_degree_rank(extracted_data)
    edu_score = 1.0 if cand_rank >= required_rank else cand_rank / max(required_rank, 1)

    math_score = (skills_score * 0.50) + (exp_score * 0.30) + (edu_score * 0.20)

    return {
        "skills_score": round(skills_score * 100, 2),
        "experience_score": round(exp_score * 100, 2),
        "education_score": round(edu_score * 100, 2),
        "knockout_math_score": round(math_score * 100, 2),
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
    }


# ══════════════════════════════════════════════════════════════════════════
# 5. ORCHESTRATOR
# ══════════════════════════════════════════════════════════════════════════

def run_strict_ats_check(
    raw_text: str,
    extracted_data: dict,
    jd_text: str,
    skill_universe: List[str],
) -> Dict[str, Any]:
    """
    Single entry point the route layer should call. Combines all
    deterministic checks and vector scoring into one dict.
    """
    parsing_health = evaluate_parsing_health(raw_text)
    knockout = evaluate_knockout(extracted_data or {}, jd_text or "")
    keyword_match = evaluate_strict_keyword_match(raw_text, skill_universe or [])
    math_result = evaluate_knockout_math(extracted_data or {}, jd_text or "")
    vector_score = compute_vector_similarity(raw_text or "", jd_text or "")

    # Dual-Stage Blended Score (70% Knockout Math + 30% Dense Vector Similarity)
    final_score = round((math_result["knockout_math_score"] * 0.70) + (vector_score * 0.30), 2)

    logger.info(
        "Strict ATS check complete",
        is_healthy=parsing_health.is_healthy,
        is_knockout=knockout.is_knockout,
        strict_score=keyword_match.strict_ats_score,
        vector_score=vector_score,
        final_score=final_score,
    )

    res = {
        "parsing_health": parsing_health.to_dict(),
        "knockout": knockout.to_dict(),
        "keyword_match": keyword_match.to_dict(),
        "math_result": math_result,
        "vector_score": vector_score,
        "final_score": final_score,
    }
    gc.collect()
    return res
