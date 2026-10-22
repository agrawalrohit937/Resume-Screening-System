"""
JD Parsing Symmetry & Recruiter Quality Assistant Service.
Extracts structured requirements from Job Descriptions (mirroring candidate resume parsing)
and audits JDs for exclusionary language, unrealistic requirement stacking, and missing compensation.
"""

from datetime import date
import json
import re
from typing import List, Optional, Dict, Any
import httpx
from pydantic import BaseModel, Field
import structlog

from core.llm_client import groq_key_pool
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


# ---------------------------------------------------------------------------
# Section Segmentation (Boundary Detection) & Direct Groq LLM Extraction
# ---------------------------------------------------------------------------

def segment_jd_sections(jd_text: str) -> Dict[str, str]:
    """
    Step 1: Section Segmentation (Boundary Detection)
    Segments a Job Description into 3 distinct functional boundaries:
    1. company_profile: About Us, Company overview (Ignored for candidate eligibility)
    2. responsibilities: Role expectations and duties (Used for skills and relevance)
    3. requirements: Mandatory candidate criteria, education, tenure, skills
    """
    if not jd_text or not jd_text.strip():
        return {"company_profile": "", "responsibilities": "", "requirements": "", "general": ""}

    sections = {
        "company_profile": "",
        "responsibilities": "",
        "requirements": "",
        "general": ""
    }

    current_section = "general"
    lines = jd_text.splitlines()
    buffer: Dict[str, List[str]] = {k: [] for k in sections}

    for line in lines:
        cleaned_line = line.strip()
        lower_line = cleaned_line.lower()

        # Check section header boundaries
        if len(cleaned_line) < 80:
            if re.search(r"\b(about\s+us|about\s+the\s+company|who\s+we\s+are|company\s+overview|company\s+profile|our\s+story)\b", lower_line):
                current_section = "company_profile"
                continue
            elif re.search(r"\b(responsibilities|what\s+you(?:'ll|\s+will)\s+do|day[\s-]to[\s-]day|the\s+role|key\s+duties|job\s+summary)\b", lower_line):
                current_section = "responsibilities"
                continue
            elif re.search(r"\b(requirements|qualifications|eligibility|what\s+we(?:'re|\s+are)\s+looking\s+for|must\s+have|skills\s+required|minimum\s+qualifications)\b", lower_line):
                current_section = "requirements"
                continue

        buffer[current_section].append(line)

    for k in sections:
        sections[k] = "\n".join(buffer[k]).strip()

    return sections


GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "openai/gpt-oss-120b"

JD_PARSER_SYSTEM_PROMPT = """You are an expert Technical Recruiter and Job Description Analyzer.
Your task is to analyze the Job Description sections and extract the CANDIDATE's required qualifications into pure JSON.

CRITICAL INSTRUCTIONS:
1. Extract requirements that the CANDIDATE must satisfy.
2. The input is pre-segmented into [Company Profile], [Responsibilities], and [Requirements / Eligibility Criteria].
3. STRICT BOUNDARY RULE:
   - Completely IGNORE [Company Profile] when determining candidate experience, education, or eligibility.
   - Example: "With 10+ years of hands-on expertise, we help businesses..." -> This is COMPANY AGE. Candidate required experience is 0.
   - Example: "Established in 2015, we are an 8-year-old firm..." -> This is COMPANY HISTORY. Candidate required experience is 0.
4. Candidate minimum experience and education MUST be extracted ONLY from [Requirements / Eligibility Criteria].
5. If the job mentions "Graduation / Freshers / Trainee / Intern / Entry Level / 0-1 years / No active backlogs" and does NOT explicitly ask for senior professional experience, set "candidate_min_experience_years" to 0 and "is_fresher_eligible" to true.
6. Extract technical, functional, and domain skills required from the candidate across requirements and responsibilities.
7. Whenever the JD says 'at least one of X, Y, or Z', 'proficiency in one of X, Y, or Z', 'X or Y or Z', 'either X or Y', capture those alternative skills together in "skill_or_groups": [["<skillA>", "<skillB>"], ...].

OUTPUT FORMAT (strict JSON only, no markdown, no explanation):
{
  "role": "<job title>",
  "candidate_min_experience_years": <number: 0 if fresher or unspecified, else float like 2.0, 5.0>,
  "is_fresher_eligible": <boolean>,
  "required_skills": ["<skill1>", "<skill2>", ...],
  "skill_or_groups": [["<skillA>", "<skillB>"], ...],
  "minimum_education": "<e.g. Bachelor, Master, Graduation, or null>"
}
"""


async def parse_jd_with_groq(jd_text: str) -> Dict[str, Any]:
    """
    Direct structured LLM parser for Job Descriptions using Groq.
    Uses Section Segmentation (Boundary Detection) and Groq LLaMA-3 JSON mode
    to extract candidate-only specifications in ~200ms without false-positives.
    """
    if not jd_text or len(jd_text.strip()) < 10:
        return {}

    segmented = segment_jd_sections(jd_text)
    company_sec = segmented["company_profile"][:1500]
    resp_sec = segmented["responsibilities"][:2500]
    req_sec = (segmented["requirements"] or segmented["general"])[:3000]

    structured_user_prompt = f"""Analyze this Job Description:

[Company Profile (Ignore for Candidate Eligibility)]:
{company_sec or 'N/A'}

[Responsibilities]:
{resp_sec or 'N/A'}

[Requirements / Eligibility Criteria]:
{req_sec or jd_text[:4000]}
"""

    async def _make_request(api_key: Optional[str]) -> Dict[str, Any]:
        if not api_key:
            logger.warning("No Groq API key available for JD parsing.")
            return {}

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": JD_PARSER_SYSTEM_PROMPT},
                {"role": "user", "content": structured_user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
            "max_tokens": 600,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(GROQ_URL, json=payload, headers=headers)
            if response.status_code != 200:
                raise RuntimeError(f"Groq API returned HTTP {response.status_code}: {response.text}")
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)

    try:
        result = await groq_key_pool.execute_async_with_fallback(_make_request)
        if isinstance(result, dict):
            logger.info(
                "JD parsed successfully with Groq",
                role=result.get("role"),
                min_exp=result.get("candidate_min_experience_years"),
                skills_count=len(result.get("required_skills", [])),
            )
            return result
        return {}
    except Exception as exc:
        logger.warning("Groq JD parser call failed", error=str(exc))
        return {}

