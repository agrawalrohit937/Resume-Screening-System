"""
JD Parsing Symmetry & Recruiter Quality Assistant Service.
Extracts structured requirements from Job Descriptions (mirroring candidate resume parsing)
and audits JDs for exclusionary language, unrealistic requirement stacking, and missing compensation.
"""

from datetime import date
import re
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import structlog

from services.ontology.graph import get_ontology_graph

logger = structlog.get_logger(__name__)

# Exclusionary or biased terms catalog
EXCLUSIONARY_TERMS: Dict[str, Dict[str, str]] = {
    # Gendered & aggressive stereotypes
    "rockstar": {"category": "gender_bias", "severity": "warning", "suggestion": "Use 'accomplished engineer' or 'proven professional' instead."},
    "ninja": {"category": "gender_bias", "severity": "warning", "suggestion": "Use 'specialist' or 'expert' instead."},
    "guru": {"category": "gender_bias", "severity": "warning", "suggestion": "Use 'senior subject matter expert' instead."},
    "work hard play hard": {"category": "workplace_culture", "severity": "warning", "suggestion": "May signal burnout culture; specify actual working hours."},
    "aggressive": {"category": "gender_bias", "severity": "warning", "suggestion": "Use 'proactive' or 'results-driven' instead."},
    "dominant": {"category": "gender_bias", "severity": "warning", "suggestion": "Use 'leading' or 'influential' instead."},
    
    # Age bias
    "young and energetic": {"category": "age_bias", "severity": "high", "suggestion": "Discriminatory against older candidates. Use 'motivated' or 'dynamic'."},
    "recent grad only": {"category": "age_bias", "severity": "medium", "suggestion": "Specify entry-level competencies rather than age or graduation date."},
    "digital native": {"category": "age_bias", "severity": "high", "suggestion": "Discriminatory proxy for age. Use 'tech-savvy' or 'proficient with digital tools'."},
    
    # Nationality / origin bias
    "native english speaker": {"category": "nationality_bias", "severity": "high", "suggestion": "Discriminatory under global hiring laws. Use 'fluent in professional English' or 'CEFR C1/C2'."},
    "native speaker": {"category": "nationality_bias", "severity": "high", "suggestion": "Use 'bilingual fluency' or 'high operational proficiency' instead."},
}

# Technologies with their release years to detect impossible experience stacking
TECH_RELEASE_YEARS: Dict[str, int] = {
    "fastapi": 2018,
    "kubernetes": 2014,
    "k8s": 2014,
    "flutter": 2017,
    "react native": 2015,
    "rust": 2015,
    "swift": 2014,
    "kotlin": 2016,
    "next.js": 2016,
    "nextjs": 2016,
    "tailwind": 2017,
    "tailwindcss": 2017,
    "pytorch": 2016,
    "langchain": 2022,
    "huggingface": 2016,
}


class StructuredRequirement(BaseModel):
    """Normalized structured requirement from a Job Description."""
    text: str
    skill_canonical: Optional[str] = None
    criticality: str = "preferred"  # "must_have", "preferred", "bonus"
    years: Optional[float] = None
    credential: Optional[str] = None
    education_isced: Optional[int] = None
    location_constraint: Optional[str] = None
    is_must_have: bool = False


class QualityIssue(BaseModel):
    """An issue or warning identified in a Job Description."""
    term: str
    category: str  # gender_bias, age_bias, nationality_bias, unrealistic_requirement, missing_compensation
    severity: str  # high, medium, warning
    message: str
    suggestion: str


class JobQualityReport(BaseModel):
    """Audit report produced by the Recruiter Quality Assistant."""
    overall_score: float = 100.0
    inclusive_language_score: float = 100.0
    realism_score: float = 100.0
    compensation_score: float = 100.0
    issues: List[QualityIssue] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)


def map_job_title_to_occupation(title: str) -> Optional[str]:
    """Resolves a free-text job title to a canonical ESCO/NCO/SOC occupation code."""
    if not title:
        return None
    graph = get_ontology_graph()
    occ = graph.find_occupation(title)
    if occ:
        return occ.code
    return None


def parse_structured_job_requirements(jd_text: str, title: str = "") -> List[StructuredRequirement]:
    """
    Extracts structured requirements from JD text, categorizing criticality,
    canonical skill names, years of experience, and must-have status.
    """
    if not jd_text:
        return []

    graph = get_ontology_graph()
    requirements: List[StructuredRequirement] = []
    lines = [line.strip() for line in jd_text.splitlines() if line.strip()]

    current_section_must_have = False

    for line in lines:
        lower_line = line.lower()

        # Section header detection
        if re.search(r"\b(must have|required|requirements|mandatory|qualifications|minimum requirements)\b", lower_line) and len(line) < 60:
            current_section_must_have = True
            continue
        elif re.search(r"\b(preferred|nice to have|good to have|bonus|plus|optional)\b", lower_line) and len(line) < 60:
            current_section_must_have = False
            continue

        # Bullet point or line item
        clean_item = re.sub(r"^[\s*•\-\d\.)]+", "", line).strip()
        if len(clean_item) < 4:
            continue

        # Criticality determination
        is_must = current_section_must_have or bool(
            re.search(r"\b(must have|required|mandatory|essential|minimum)\b", lower_line)
        )
        if re.search(r"\b(preferred|plus|bonus|optional|nice to have)\b", lower_line):
            is_must = False

        # Years of experience extraction
        years: Optional[float] = None
        yr_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:\+|-\s*\d+)?\s*(?:years?|yrs?)\b", lower_line)
        if yr_match:
            try:
                years = float(yr_match.group(1))
            except ValueError:
                pass

        # Skill canonical resolution via graph
        matched_skill = None
        for word in re.findall(r"\b[A-Za-z0-9#+.]+\b", clean_item):
            if len(word) > 1 and not word.isdigit():
                norm = graph.normalize_skill(word, record_pending=False)
                if norm and (norm.lower() in graph.canonical_nodes or norm.lower() in graph.exact_canonicals):
                    matched_skill = norm
                    break

        requirements.append(
            StructuredRequirement(
                text=clean_item,
                skill_canonical=matched_skill,
                criticality="must_have" if is_must else "preferred",
                years=years,
                is_must_have=is_must
            )
        )

    return requirements


def audit_job_description(
    jd_text: str,
    title: str = "",
    requirements: Optional[List[StructuredRequirement]] = None
) -> JobQualityReport:
    """
    Audits a Job Description for exclusionary language, unrealistic requirements,
    and missing compensation, computing quality scores and actionable suggestions.
    """
    if not jd_text:
        return JobQualityReport(overall_score=0.0)

    issues: List[QualityIssue] = []
    suggestions: List[str] = []
    lower_jd = jd_text.lower()
    current_year = date.today().year

    # 1. Check exclusionary language
    inclusive_score = 100.0
    for term, meta in EXCLUSIONARY_TERMS.items():
        pattern = r"\b" + re.escape(term) + r"\b"
        if re.search(pattern, lower_jd):
            deduction = 15.0 if meta["severity"] == "high" else 8.0
            inclusive_score = max(0.0, inclusive_score - deduction)
            issues.append(
                QualityIssue(
                    term=term,
                    category=meta["category"],
                    severity=meta["severity"],
                    message=f"Contains potentially exclusionary wording: '{term}'",
                    suggestion=meta["suggestion"]
                )
            )

    # 2. Check unrealistic requirement stacking
    realism_score = 100.0
    reqs = requirements if requirements is not None else parse_structured_job_requirements(jd_text, title)
    must_haves = [r for r in reqs if r.is_must_have]

    # Check impossible tech years
    for tech, rel_year in TECH_RELEASE_YEARS.items():
        pattern = r"(\d+)\+?\s*(?:years?|yrs?).*?\b" + re.escape(tech) + r"\b|\b" + re.escape(tech) + r"\b.*?(\d+)\+?\s*(?:years?|yrs?)"
        match = re.search(pattern, lower_jd)
        if match:
            claimed_years = int(match.group(1) or match.group(2))
            max_possible = current_year - rel_year
            if claimed_years > max_possible:
                realism_score = max(0.0, realism_score - 25.0)
                issues.append(
                    QualityIssue(
                        term=f"{claimed_years}+ years {tech}",
                        category="unrealistic_requirement",
                        severity="high",
                        message=f"Impossible requirement: '{tech}' was released in {rel_year} ({max_possible} years ago), but job demands {claimed_years}+ years.",
                        suggestion=f"Lower requirement to at most {max_possible} years."
                    )
                )

    # Check excessive must-haves for junior/entry roles
    is_entry_or_junior = any(k in title.lower() for k in ("junior", "entry", "intern", "associate", "trainee"))
    if is_entry_or_junior and len(must_haves) > 6:
        realism_score = max(0.0, realism_score - 20.0)
        issues.append(
            QualityIssue(
                term=f"{len(must_haves)} must-haves for junior role",
                category="unrealistic_requirement",
                severity="medium",
                message=f"Junior role specifies {len(must_haves)} mandatory requirements. This severely suppresses qualified applicant pools.",
                suggestion="Cap junior mandatory requirements to at most 4-5 core competencies."
            )
        )
    elif len(must_haves) > 12:
        realism_score = max(0.0, realism_score - 15.0)
        issues.append(
            QualityIssue(
                term=f"{len(must_haves)} must-haves",
                category="unrealistic_requirement",
                severity="medium",
                message=f"Job specifies {len(must_haves)} mandatory requirements. High requirement counts disproportionately deter diverse candidates.",
                suggestion="Move non-essential requirements to 'Preferred' or 'Nice to have'."
            )
        )

    # 3. Check compensation transparency
    compensation_score = 100.0
    has_comp = bool(re.search(r"(\$|₹|£|€|lpa|lakh|crore|salary|compensation|package|aed|sgd)\b", lower_jd))
    if not has_comp:
        compensation_score = 50.0
        issues.append(
            QualityIssue(
                term="missing_compensation",
                category="missing_compensation",
                severity="warning",
                message="No salary or compensation range detected.",
                suggestion="Add explicit salary/LPA range to improve candidate response rates by up to 40%."
            )
        )

    # Aggregate overall score
    overall = round((inclusive_score * 0.4) + (realism_score * 0.4) + (compensation_score * 0.2), 1)

    # Deduplicated suggestions
    for issue in issues:
        if issue.suggestion and issue.suggestion not in suggestions:
            suggestions.append(issue.suggestion)

    return JobQualityReport(
        overall_score=overall,
        inclusive_language_score=round(inclusive_score, 1),
        realism_score=round(realism_score, 1),
        compensation_score=round(compensation_score, 1),
        issues=issues,
        suggestions=suggestions
    )
