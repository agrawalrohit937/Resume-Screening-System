"""
Deterministic NLP Extractor Module for ATS Resume Parsing.
Extracts canonical skills, experience years, education level, and contact info
directly from raw resume text using pattern matching and skill ontology cross-referencing.

Changelog (v2.1):
- "bonus"/"plus" removed from NEGATION_CUES (they mean nice-to-have, handled by criticality weighting).
- Clause splitting now also breaks on commas, colons and contrast words (but/however/although/though/while),
  so "No experience required, Python and SQL" no longer discards Python and SQL.
- Lookbehind/lookahead uses a fixed 120-char window: O(1) per match instead of O(n).
- extract_education_level: removed false positives ("MS Excel" -> Master's, "be" -> Bachelor's)
  and removed the free "Bachelor's Degree" fallback (returns None when nothing is found).
"""

from typing import Dict, List, Any, Set, Optional
import re
import structlog
from services.skill_ontology import (
    get_all_known_skills,
    normalize_skill,
    expand_skills,
)
from utils.nlp_utils import (
    extract_email,
    extract_phone,
    extract_urls,
    extract_years_of_experience,
)

logger = structlog.get_logger(__name__)


# Negation cues for skill extraction filtering.
# NOTE: "bonus", "plus", and "preferred" are intentionally NOT here:
# They signal nice-to-have/preferred competencies, handled by criticality weighting.
NEGATION_CUES: Set[str] = {
    "not", "no", "zero", "optional", "without",
    "never", "neither", "nor", "none", "unnecessary",
    "didn't", "don't", "hasn't", "haven't", "won't", "wouldn't", "couldn't",
    "didnt", "dont", "hasnt", "havent", "wont", "wouldnt", "couldnt",
    "lack", "lacks", "lacking", "excluding", "except", "non",
    "avoid", "avoiding", "avoids"
}

NICE_TO_HAVE_CUES: Set[str] = {
    "preferred", "plus", "bonus", "desirable", "ideally",
    "nice to have", "nice-to-have", "good to have", "good-to-have"
}

# Clause boundary: newline, sentence enders (a '.' only when followed by whitespace/end so that
# Node.js / .NET / Vue.js are not split), comma, colon, and contrast conjunctions.
_CLAUSE_SPLIT = re.compile(
    r"[\n\r!?;,]|\.(?=\s|$)|\b(?:but|however|although|though|while)\b",
    re.IGNORECASE,
)
_TOKEN_RE = re.compile(r"[a-zA-Z0-9']+")
_WINDOW = 120  # chars of context on each side of a match

_REQUIRED_WORDS = (
    "required", "needed", "necessary", "mandatory", "expected", "essential",
    "evaluated", "considered", "tested", "scored", "counted", "assessed",
)

_NEG_AFTER_REGEX = re.compile(
    r"\b(?:is|are|was|were|will|would|can|could|shall|should)?\s*(?:not|never|no longer)\s*(?:be\s*)?(?:required|needed|necessary|mandatory|evaluated|considered|tested|scored|counted|assessed|expected)\b",
    re.IGNORECASE,
)

_ZERO_EXP_PATTERN = re.compile(
    r"\b(fresher|freshers|entry[\s-]level|trainee|intern|internship|graduate|no\s+prior\s+experience|no\s+experience\s+required|no\s+experience\s+needed|zero\s+experience|0\s*(?:[-–]|to)\s*1\s*(?:years?|yrs?)|0\+?\s*(?:years?|yrs?)|0\s*(?:years?|yrs?)\s+experience)\b",
    re.IGNORECASE,
)


def extract_experience_requirement(text: str) -> float:
    """
    Extracts the required years of experience from job description or role text.
    Explicitly maps 'Fresher', '0-1 years', 'no prior experience', 'entry level' to 0.0 required years.
    Feeds directly into the S_exp = 1 - exp(-k * x) saturating experience formula.
    """
    if not text or not text.strip():
        return 0.0

    # 1. Check for explicit range starting from 0 (e.g. "0-1 years", "0 to 1 year") or zero-experience keyword
    has_zero_cue = bool(_ZERO_EXP_PATTERN.search(text))

    # 2. Check for higher senior experience requirements (e.g. "2+ years", "3-5 years")
    senior_patterns = [
        r"([2-9]|\d{2,})\s*\+\s*(?:years?|yrs?)",
        r"([2-9]|\d{2,})\s*(?:to|-|–)\s*\d+(?:\.\d+)?\s*(?:years?|yrs?)",
        r"minimum\s+(?:of\s+)?([2-9]|\d{2,})\s*(?:years?|yrs?)",
        r"at\s+least\s+([2-9]|\d{2,})\s*(?:years?|yrs?)",
        r"([2-9]|\d{2,})\s*(?:years?|yrs?)\s*(?:of\s+)?(?:relevant\s+|professional\s+|work\s+)?experience",
    ]
    max_senior_years = 0.0
    for pat in senior_patterns:
        for m in re.finditer(pat, text, re.IGNORECASE):
            # Check if preceded by a range like "0 to " or "0-"
            prefix = text[max(0, m.start() - 6):m.start()]
            if re.search(r"0\s*(?:[-–]|to)\s*$", prefix, re.IGNORECASE):
                continue
            try:
                val = float(m.group(1))
                max_senior_years = max(max_senior_years, val)
            except (ValueError, IndexError):
                pass

    if max_senior_years >= 2.0:
        return max_senior_years

    if has_zero_cue:
        return 0.0

    # 3. Standard experience pattern fallback (e.g. "1+ years")
    fallback_patterns = [
        r"(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)",
        r"(\d+(?:\.\d+)?)\s*(?:to|-|–)\s*\d+(?:\.\d+)?\s*(?:years?|yrs?)",
        r"minimum\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:years?|yrs?)",
        r"at\s+least\s+(\d+(?:\.\d+)?)\s*(?:years?|yrs?)",
        r"(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:of\s+)?(?:relevant\s+|professional\s+|work\s+)?experience",
    ]
    max_years = 0.0
    for pat in fallback_patterns:
        for m in re.finditer(pat, text, re.IGNORECASE):
            prefix = text[max(0, m.start() - 5):m.start()]
            if re.search(r"0\s*[-–to]\s*$", prefix):
                continue
            try:
                val = float(m.group(1))
                max_years = max(max_years, val)
            except (ValueError, IndexError):
                pass

    return max_years


def extract_skills_deterministic(raw_text: str) -> List[str]:
    """
    Scans raw resume/JD text against the ontology knowledge base using boundary-aware regex patterns.
    Applies contextual negation filtering (12-token lookbehind/lookahead window, bounded to the current
    clause) to discard negated or optional competencies (e.g. 'React is not required', 'No Docker needed',
    'Knowledge of frontend frameworks (like React) or other backend languages is not required and will not be evaluated').
    Normalizes and deduplicates valid matches into canonical skills.

    Complexity: O(S * M) where S = ontology size, M = matches per skill (each check is O(1), fixed window),
    plus O(S * n) for the regex scans themselves.
    """
    if not raw_text or not raw_text.strip():
        return []

    known_skills = get_all_known_skills()
    found_skills_raw = set()

    for skill in known_skills:
        # Ignore single-letter generic characters unless specific like 'c', 'r'
        if len(skill) <= 1 and skill.lower() not in ("c", "r"):
            continue

        # Regex boundary pattern accounting for technical special characters (+, #, ., /, -)
        escaped = re.escape(skill)
        left_boundary = r"(?<![a-zA-Z0-9])"
        if skill.endswith("+") or skill.endswith("#"):
            right_boundary = r"(?![a-zA-Z0-9+#])"
        else:
            right_boundary = r"(?![a-zA-Z0-9])"

        pattern = f"{left_boundary}{escaped}{right_boundary}"

        matches = list(re.finditer(pattern, raw_text, re.IGNORECASE))
        if not matches:
            continue

        # Contextual negation scan: A skill is kept only if at least one occurrence is non-negated
        has_valid_non_negated_match = False
        for m in matches:
            start_idx = m.start()
            end_idx = m.end()

            # Bound lookbehind and lookahead to the current clause (fixed-size window)
            clause_before = _CLAUSE_SPLIT.split(raw_text[max(0, start_idx - _WINDOW):start_idx])[-1]
            tokens_before = [t.lower() for t in _TOKEN_RE.findall(clause_before)][-12:]

            clause_after = _CLAUSE_SPLIT.split(raw_text[end_idx:end_idx + _WINDOW])[0]
            tokens_after = [t.lower() for t in _TOKEN_RE.findall(clause_after)][:12]

            is_negated = False

            # Check spaCy dependency parsing if FEATURE_DEP_NEGATION is active
            import core.feature_flags as ff
            if getattr(ff, "FEATURE_DEP_NEGATION", False):
                try:
                    import spacy
                    # Use lightweight English model or blank model with senter
                    nlp_spacy = getattr(extract_skills_deterministic, "_spacy_nlp", None)
                    if nlp_spacy is None:
                        try:
                            nlp_spacy = spacy.load("en_core_web_sm")
                        except Exception:
                            nlp_spacy = spacy.blank("en")
                        setattr(extract_skills_deterministic, "_spacy_nlp", nlp_spacy)

                    # Analyze sentence/clause window
                    snippet = raw_text[max(0, start_idx - 60):min(len(raw_text), end_idx + 60)]
                    doc = nlp_spacy(snippet)
                    for tok in doc:
                        if tok.text.lower() in skill.lower():
                            # Check token or head for negation children
                            has_neg = any(child.dep_ == "neg" or child.lemma_.lower() in NEGATION_CUES for child in tok.children)
                            has_head_neg = any(child.dep_ == "neg" or child.lemma_.lower() in NEGATION_CUES for child in tok.head.children)
                            if has_neg or has_head_neg:
                                is_negated = True
                                break
                except Exception:
                    pass

            # Fallback / primary rule-based negation cues
            if not is_negated:
                if any(cue in tokens_before for cue in NEGATION_CUES):
                    is_negated = True
                elif any(cue in tokens_after for cue in ("unnecessary", "optional")):
                    is_negated = True
                elif _NEG_AFTER_REGEX.search(clause_after):
                    is_negated = True
                elif "not" in tokens_after and any(w in tokens_after for w in _REQUIRED_WORDS):
                    is_negated = True

            if not is_negated:
                has_valid_non_negated_match = True
                break

        if has_valid_non_negated_match:
            found_skills_raw.add(skill)

    # Normalize all raw matches to canonical skills
    canonical_skills = set()
    for s in found_skills_raw:
        norm = normalize_skill(s)
        if norm:
            canonical_skills.add(norm)

    return sorted(list(canonical_skills))


def extract_skills_from_sections(resume_data: Any) -> List[str]:
    """
    Broadens skill extraction beyond the explicit 'Technical Skills' block to scan and parse
    technical keywords (like 'DSA', 'FastAPI', 'Docker', etc.) across:
    - 'Relevant Coursework' / 'Academic Coursework' / 'Subjects' / 'Courses'
    - 'Projects' / 'Academic Projects' (titles, descriptions, tech_stack)
    - 'Experience' / 'Work Experience' / 'Internships' (roles, descriptions, responsibilities)
    - 'Education' (degree fields, majors, coursework)
    - 'Certifications'
    - 'Summary' / 'Objective' / 'Raw Text'
    """
    if not resume_data:
        return []

    if isinstance(resume_data, str):
        return extract_skills_deterministic(resume_data)

    collected_texts: List[str] = []

    if isinstance(resume_data, dict):
        # 1. Direct explicit skills list
        direct_skills = resume_data.get("skills", []) or resume_data.get("technical_skills", []) or []
        if isinstance(direct_skills, list):
            for s in direct_skills:
                if isinstance(s, str) and s.strip():
                    collected_texts.append(s.strip())
        elif isinstance(direct_skills, str) and direct_skills.strip():
            collected_texts.append(direct_skills.strip())

        # 2. Raw Text
        raw_text = str(resume_data.get("raw_text") or "")
        if raw_text:
            collected_texts.append(raw_text)

        # 3. Relevant Coursework / Courses / Subjects
        coursework = (
            resume_data.get("relevant_coursework")
            or resume_data.get("coursework")
            or resume_data.get("courses")
            or resume_data.get("academic_coursework")
            or resume_data.get("subjects")
            or []
        )
        if isinstance(coursework, list):
            for cw in coursework:
                if isinstance(cw, str) and cw.strip():
                    collected_texts.append(cw.strip())
                elif isinstance(cw, dict):
                    collected_texts.append(" ".join(str(v) for v in cw.values() if v))
        elif isinstance(coursework, str) and coursework.strip():
            collected_texts.append(coursework.strip())

        # 4. Projects
        projects = resume_data.get("projects") or []
        if isinstance(projects, list):
            for proj in projects:
                if isinstance(proj, dict):
                    p_tech = " ".join(proj.get("technologies", []) or proj.get("tech_stack", []) or proj.get("tools", []) or [])
                    p_text = f"{proj.get('name', '')} {proj.get('title', '')} {proj.get('description', '')} {p_tech}"
                    collected_texts.append(p_text.strip())
                elif isinstance(proj, str) and proj.strip():
                    collected_texts.append(proj.strip())

        # 5. Work Experience / Internships
        experience = (
            resume_data.get("work_experience")
            or resume_data.get("experience")
            or resume_data.get("internships")
            or resume_data.get("employment_history")
            or []
        )
        if isinstance(experience, list):
            for exp in experience:
                if isinstance(exp, dict):
                    e_tech = " ".join(exp.get("technologies", []) or exp.get("tools", []) or [])
                    e_resp = " ".join(exp.get("responsibilities", []) or exp.get("highlights", []) or [])
                    e_text = f"{exp.get('title', '')} {exp.get('role', '')} {exp.get('company', '')} {exp.get('description', '')} {e_tech} {e_resp}"
                    collected_texts.append(e_text.strip())
                elif isinstance(exp, str) and exp.strip():
                    collected_texts.append(exp.strip())

        # 6. Education
        education = resume_data.get("education") or []
        if isinstance(education, list):
            for edu in education:
                if isinstance(edu, dict):
                    ed_cw = " ".join(edu.get("coursework", []) if isinstance(edu.get("coursework"), list) else [str(edu.get("coursework") or "")])
                    ed_text = f"{edu.get('degree', '')} {edu.get('field', '')} {edu.get('major', '')} {ed_cw} {edu.get('notes', '')}"
                    collected_texts.append(ed_text.strip())
                elif isinstance(edu, str) and edu.strip():
                    collected_texts.append(edu.strip())

        # 7. Certifications
        certs = resume_data.get("certifications") or []
        if isinstance(certs, list):
            for cert in certs:
                if isinstance(cert, dict):
                    collected_texts.append(str(cert.get("name") or cert.get("title") or ""))
                elif isinstance(cert, str) and cert.strip():
                    collected_texts.append(cert.strip())

        # 8. Summary / Objective
        summary = resume_data.get("summary") or resume_data.get("objective") or resume_data.get("profile") or ""
        if isinstance(summary, str) and summary.strip():
            collected_texts.append(summary.strip())

    combined_text = "\n".join(t for t in collected_texts if t)
    return extract_skills_deterministic(combined_text)


def extract_education_level(raw_text: str) -> Optional[str]:
    """
    Extracts candidate's highest degree.

    Ambiguous short forms (MS, BS, BE) are only accepted in unambiguous shapes
    ("M.S. in ...", "B.E."), so "MS Excel" / "MS Office" and the English word "be"
    do not produce a degree. Returns None when no degree evidence is found.
    """
    text = raw_text.lower()
    degrees = [
        ("Ph.D / Doctorate", [r"\bph\.?d\b", r"\bdoctorate\b", r"\bdoctor of philosophy\b"]),
        ("Master's Degree", [
            r"\bmaster'?s?\b",
            r"\bm\.s\.?(?=\s+(?:in|of)\b)",
            r"\bm\.?tech\b",
            r"\bmba\b",
            r"\bmca\b",
            r"\bm\.?sc\b",
        ]),
        ("Bachelor's Degree", [
            r"\bbachelor'?s?\b",
            r"\bb\.s\.?(?=\s+(?:in|of)\b)",
            r"\bb\.?tech\b",
            r"\bb\.e\.(?!\w)",
            r"\bbca\b",
            r"\bb\.?sc\b",
        ]),
        ("Diploma / Associate", [r"\bdiploma\b", r"\bassociate'?s?\b"]),
    ]
    for level_name, patterns in degrees:
        for pat in patterns:
            if re.search(pat, text):
                return level_name
    return None  # No degree evidence: do not grant free Bachelor's credit


def extract_resume_data_deterministic(raw_text: str) -> Dict[str, Any]:
    """
    Main entry point for Node 1: Deterministically parses raw resume text
    without calling any external LLMs.
    """
    skills = extract_skills_deterministic(raw_text)
    expansion = expand_skills(skills)
    total_exp = extract_years_of_experience(raw_text)
    education_level = extract_education_level(raw_text)
    email = extract_email(raw_text)
    phone = extract_phone(raw_text)
    urls = extract_urls(raw_text)

    # Return structured dict for graph state and downstream ATS services
    return {
        "skills": skills,
        "explicit_skills": list(expansion["explicit_skills"]),
        "implicit_concepts": list(expansion["implicit_concepts"]),
        "all_expanded_skills": list(expansion["all_expanded_skills"]),
        "total_experience_years": total_exp,
        "education_level": education_level,
        "contact_info": {
            "email": email,
            "phone": phone,
            "urls": urls,
        },
        "raw_text_length": len(raw_text),
    }