"""
Job Description Parsing & Candidate Qualification Extraction Service.
Segments Job Descriptions into boundaries and extracts structured requirements
using Groq LLM (JSON Mode) for high-precision ATS matching.
"""

import hashlib
import json
import os
import re
from typing import List, Optional, Dict, Any, Tuple
import httpx
import structlog

from core.llm_client import groq_key_pool

logger = structlog.get_logger(__name__)

PROMPT_VERSION = "2.4.0-hard-soft-grounded"
_JD_CACHE: Dict[str, Dict[str, Any]] = {}
_MAX_CACHE_SIZE = 500

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.getenv("GROQ_JD_MODEL", "openai/gpt-oss-20b")

# Pure adjectives, personality traits, and generic buzzwords that must NEVER be treated as hard skills
ADJECTIVE_NOISE_TOKENS = {
    "analytical", "strong", "excellent", "good", "great", "driven", "dynamic",
    "self-starter", "self starter", "proactive", "motivated", "detail-oriented",
    "detail oriented", "fast-paced", "passionate", "enthusiastic", "collaborative",
    "team player", "leadership", "communication", "problem solving", "problem-solving",
    "interpersonal", "organizational", "adaptability", "critical thinking",
    "flexible", "hardworking", "hard working", "innovative", "reliable"
}


def is_skill_grounded(skill_name: str, jd_text_clean: str) -> bool:
    """
    Grounding verification: Checks if a candidate skill physically exists in the JD text.
    Handles punctuation/case variations (e.g. 'Node.js' vs 'nodejs' or 'CI/CD' vs 'cicd').
    """
    if not skill_name or not jd_text_clean:
        return False
    s_norm = skill_name.strip().lower()
    if s_norm in jd_text_clean:
        return True

    # Check stripped alphanumeric representation (e.g., 'node.js' -> 'nodejs')
    s_stripped = re.sub(r"[^\w]", "", s_norm)
    jd_stripped = re.sub(r"[^\w]", "", jd_text_clean)
    if s_stripped and len(s_stripped) >= 2 and s_stripped in jd_stripped:
        return True

    # Check significant tokens for multi-word skills (e.g. 'Relational Database')
    tokens = [t for t in re.split(r"[^\w]", s_norm) if len(t) >= 3]
    if tokens and all(t in jd_text_clean for t in tokens):
        return True

    return False


async def _get_persistent_cache(cache_key: str, db: Optional[Any] = None) -> Optional[Dict[str, Any]]:
    """Retrieves cached JD specs from RAM or MongoDB."""
    if cache_key in _JD_CACHE:
        return _JD_CACHE[cache_key]

    if db is None:
        try:
            from config.db import get_database
            db = get_database()
        except Exception:
            db = None

    if db is not None:
        try:
            cached_doc = await db["jd_specs_cache"].find_one({"cache_key": cache_key})
            if cached_doc and "specs" in cached_doc:
                _JD_CACHE[cache_key] = cached_doc["specs"]
                return cached_doc["specs"]
        except Exception as e:
            logger.debug("MongoDB cache read error", error=str(e))

    return None


async def _set_persistent_cache(cache_key: str, specs: Dict[str, Any], db: Optional[Any] = None) -> None:
    """Persists parsed JD specs to RAM and MongoDB."""
    if len(_JD_CACHE) >= _MAX_CACHE_SIZE:
        _JD_CACHE.clear()
    _JD_CACHE[cache_key] = specs

    if db is None:
        try:
            from config.db import get_database
            db = get_database()
        except Exception:
            db = None

    if db is not None:
        try:
            from datetime import datetime, timezone
            await db["jd_specs_cache"].update_one(
                {"cache_key": cache_key},
                {"$set": {
                    "cache_key": cache_key,
                    "specs": specs,
                    "updated_at": datetime.now(timezone.utc),
                }},
                upsert=True,
            )
        except Exception as e:
            logger.debug("MongoDB cache write error", error=str(e))


def map_job_title_to_occupation(title: str) -> Optional[str]:
    """Resolves a free-text job title to a canonical ESCO/NCO/SOC occupation code."""
    if not title:
        return None
    try:
        from services.ontology.graph import get_ontology_graph
        graph = get_ontology_graph()
        occ = graph.find_occupation(title)
        if occ:
            return occ.code
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Section Segmentation (Boundary Detection)
# ---------------------------------------------------------------------------

def segment_jd_sections(jd_text: str) -> Dict[str, str]:
    """
    Segments a Job Description into distinct functional boundaries:
    1. company_profile: About Us, Company overview (Excluded from candidate eligibility parsing)
    2. responsibilities: Role expectations and duties (Used selectively for skills)
    3. requirements: Mandatory candidate criteria, education, tenure, skills
    4. benefits_culture: Perks, benefits, EEO statements, company culture (Excluded from candidate parsing)
    """
    if not jd_text or not jd_text.strip():
        return {"company_profile": "", "responsibilities": "", "requirements": "", "benefits_culture": "", "general": ""}

    sections = {
        "company_profile": "",
        "responsibilities": "",
        "requirements": "",
        "benefits_culture": "",
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
            if re.search(r"\b(about\s+us|about\s+the\s+company|who\s+we\s+are|company\s+overview|company\s+profile|our\s+story|our\s+mission)\b", lower_line):
                current_section = "company_profile"
                continue
            elif re.search(r"\b(responsibilities|what\s+you(?:'ll|\s+will)\s+do|day[\s-]to[\s-]day|the\s+role|key\s+duties|job\s+summary)\b", lower_line):
                current_section = "responsibilities"
                continue
            elif re.search(r"\b(requirements|qualifications|eligibility|what\s+we(?:'re|\s+are)\s+looking\s+for|must\s+have|skills\s+required|minimum\s+qualifications)\b", lower_line):
                current_section = "requirements"
                continue
            elif re.search(r"\b(benefits|perks|what\s+we\s+offer|why\s+join\s+us|compensation\s+and\s+benefits|life\s+at\s+[\w\s]+|equal\s+opportunity|diversity\s+and\s+inclusion|eeo|accommodations)\b", lower_line):
                current_section = "benefits_culture"
                continue

        buffer[current_section].append(line)

    for k in sections:
        sections[k] = "\n".join(buffer[k]).strip()

    return sections


# ---------------------------------------------------------------------------
# Structured Universal JD Prompt (Domain-Agnostic with Hard/Soft Split)
# ---------------------------------------------------------------------------

JD_PARSER_SYSTEM_PROMPT = """You are an elite, domain-agnostic Job Description Analyzer and Requirements Structurer.
Your task is to analyze the Job Description from ANY profession (technology, trades/manufacturing, healthcare, finance, legal, sales, education) and extract ONLY facts explicitly stated in the text into strict JSON.

CRITICAL INSTRUCTIONS:
1. Extract ONLY facts explicitly stated in the Job Description text. Never invent, infer, or hallucinate requirements.
2. "must_have_skills": Technical, functional, or domain competencies explicitly required/mandatory. Extract clean, individual ATOMIC tools, technologies, frameworks, and programming languages (e.g. ["Python", "FastAPI", "SQL", "Docker", "Git", "Redis", "Data Structures"]).
   - CRITICAL RESTRICTION: NEVER include single-word generic adjectives, personality traits, or vague soft qualities in must_have_skills (NEVER output "analytical", "strong", "excellent", "detail-oriented", "communication", "proactive", "self-starter").
3. "nice_to_have_skills": Clean, individual ATOMIC technical tools/skills explicitly mentioned as preferred, bonus, optional, desirable, or a plus.
4. "soft_competencies": Interpersonal qualities, professional attitudes, cognitive traits, and general soft skills mentioned in text (e.g. ["Analytical Thinking", "Effective Communication", "Problem Solving", "Team Collaboration"]).
5. "or_groups": Disjunctive alternative skills e.g. "Python or Java or C++", "at least one of X, Y, or Z" captured as [["skill1", "skill2"], ...].
6. "min_years": Minimum years of professional experience required as a number (0 if fresher/trainee/unspecified, e.g. 3.0, 5.0).
7. "years_is_required": true ONLY if experience years is strictly mandatory; false if preferred/optional/unspecified.
8. "min_education": Minimum required degree level (e.g. "Bachelor", "Master", "Associate", "High School", "Diploma", or null if not stated).
9. "education_is_required": true ONLY if education degree is strictly mandatory; false if preferred/optional/not stated.
10. "job_title": The formal role title as stated in the JD.
11. "location": City, state, or region as written (or null if not stated).
12. "remote_policy": "remote", "hybrid", "onsite", or null if not stated.

OUTPUT FORMAT (strict JSON only, no markdown, no explanation):
{
  "job_title": "<string | null>",
  "must_have_skills": ["<skill1>", "<skill2>"],
  "nice_to_have_skills": ["<skill1>", "<skill2>"],
  "soft_competencies": ["<trait1>", "<trait2>"],
  "or_groups": [["<skillA>", "<skillB>"]],
  "min_years": <number | null>,
  "years_is_required": <boolean>,
  "min_education": "<string | null>",
  "education_is_required": <boolean>,
  "location": "<string | null>",
  "remote_policy": "<remote | hybrid | onsite | null>"
}
"""



async def parse_jd_with_groq(jd_text: str, db: Optional[Any] = None) -> Dict[str, Any]:
    """
    Direct structured LLM parser for Job Descriptions using Groq.
    Cached persistently via sha256(normalized_jd_text + PROMPT_VERSION + GROQ_MODEL).
    Performs grounding checks and hard/soft skill separation.
    """
    if not jd_text or len(jd_text.strip()) < 10:
        return {}

    # 1. Normalize text and check persistent cache
    normalized_text = re.sub(r"\s+", " ", jd_text.strip().lower())
    jd_hash = hashlib.sha256(normalized_text.encode("utf-8")).hexdigest()
    cache_key = f"{GROQ_MODEL}:{PROMPT_VERSION}:{jd_hash}"

    cached_specs = await _get_persistent_cache(cache_key, db=db)
    if cached_specs:
        logger.debug("JD parser persistent cache hit", cache_key=cache_key[:12])
        return cached_specs

    segmented = segment_jd_sections(jd_text)
    resp_sec = segmented["responsibilities"][:1500]
    req_sec = segmented["requirements"][:3000]

    if req_sec or resp_sec:
        prompt_sections = []
        if req_sec:
            prompt_sections.append(f"[Candidate Requirements & Eligibility Criteria]:\n{req_sec}")
        if resp_sec:
            prompt_sections.append(f"[Role & Key Responsibilities]:\n{resp_sec}")
        content_for_llm = "\n\n".join(prompt_sections)
    else:
        lines = [
            l for l in (segmented["general"] or jd_text).splitlines()
            if not re.search(r"\b(equal opportunity|affirmative action|401\(k\)|health insurance|dental|pto|vision insurance)\b", l, re.I)
        ]
        content_for_llm = f"[Job Description Specifications]:\n" + "\n".join(lines)[:3500]

    structured_user_prompt = f"Analyze these Job Description specifications and extract candidate requirements:\n\n{content_for_llm}"

    async def _make_request(api_key: Optional[str]) -> Dict[str, Any]:
        if not api_key:
            raise RuntimeError("No Groq API key available for JD parsing.")

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
            "temperature": 0.0,
            "max_tokens": 1500,
        }
        if GROQ_MODEL.startswith("openai/gpt-oss"):
            payload["reasoning_effort"] = "low"

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(GROQ_URL, json=payload, headers=headers)
            if response.status_code != 200:
                raise RuntimeError(f"Groq API returned HTTP {response.status_code}: {response.text}")
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)

    try:
        raw_result = await groq_key_pool.execute_async_with_fallback(_make_request)
        if isinstance(raw_result, dict) and raw_result:
            raw_must = [str(s).strip() for s in (raw_result.get("must_have_skills") or []) if str(s).strip()]
            raw_nice = [str(s).strip() for s in (raw_result.get("nice_to_have_skills") or []) if str(s).strip()]
            soft_skills = [str(s).strip() for s in (raw_result.get("soft_competencies") or []) if str(s).strip()]

            # Grounding check and noise filtering
            jd_text_clean = jd_text.lower()

            def _clean_and_ground_skills(skills_list: List[str]) -> Tuple[List[str], List[str]]:
                hard_res = []
                rerouted_soft = []
                for s in skills_list:
                    s_low = s.lower().strip()
                    # 1. Reroute pure adjectives / soft traits to soft_competencies
                    if s_low in ADJECTIVE_NOISE_TOKENS or any(s_low.endswith(sfx) for sfx in ("-oriented", "-driven", " thinking", " skills")):
                        rerouted_soft.append(s)
                        continue
                    # 2. Verify grounding in JD text (prevents LLM hallucinating unmentioned tech)
                    if is_skill_grounded(s, jd_text_clean):
                        hard_res.append(s)
                    else:
                        logger.debug("Dropped ungrounded skill from JD specs", skill=s)
                return hard_res, rerouted_soft

            must_skills, soft_from_must = _clean_and_ground_skills(raw_must)
            nice_skills, soft_from_nice = _clean_and_ground_skills(raw_nice)
            soft_skills = list(dict.fromkeys(soft_skills + soft_from_must + soft_from_nice))

            or_groups_raw = raw_result.get("or_groups") or []
            or_groups = [[str(x).strip() for x in grp if str(x).strip() and is_skill_grounded(str(x), jd_text_clean)] for grp in or_groups_raw if isinstance(grp, list)]
            or_groups = [grp for grp in or_groups if len(grp) >= 2]

            min_y = raw_result.get("min_years")
            min_years_val = float(min_y) if min_y is not None else None
            role_val = raw_result.get("job_title") or raw_result.get("role") or None
            min_edu_val = raw_result.get("min_education") or raw_result.get("minimum_education") or None

            normalized_result: Dict[str, Any] = {
                "job_title": role_val,
                "role": role_val or "Target Role",
                "must_have_skills": must_skills,
                "nice_to_have_skills": nice_skills,
                "soft_competencies": soft_skills,
                "soft_skills": soft_skills,
                "required_skills": must_skills + nice_skills,
                "or_groups": or_groups,
                "skill_or_groups": or_groups,
                "min_years": min_years_val,
                "candidate_min_experience_years": min_years_val or 0.0,
                "years_is_required": bool(raw_result.get("years_is_required", True)),
                "min_education": min_edu_val,
                "minimum_education": min_edu_val,
                "education_is_required": bool(raw_result.get("education_is_required", False)),
                "location": raw_result.get("location") or None,
                "remote_policy": raw_result.get("remote_policy") or None,
                "jd_confidence": "high",
                "is_fresher_eligible": bool(min_years_val is None or min_years_val <= 1.0),
            }

            # Persist to RAM and MongoDB
            await _set_persistent_cache(cache_key, normalized_result, db=db)

            logger.info(
                "JD parsed successfully with Groq (grounded & cached)",
                role=normalized_result.get("job_title"),
                min_exp=normalized_result.get("min_years"),
                must_skills=len(must_skills),
                nice_skills=len(nice_skills),
                soft_skills=len(soft_skills),
            )
            return normalized_result

    except Exception as e:
        logger.error("Groq JD parser failed", error=str(e))
        raise RuntimeError(f"Failed to parse Job Description with Groq LLM: {str(e)}")

