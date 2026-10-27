"""
Parser Service — Extract structured data from PDF and DOCX resumes.
Combines fast deterministic NLP extraction with Groq LLM (gpt-oss-120b)
for high-precision entity extraction (experience, education, projects, certs).
"""

import hashlib
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx
import structlog

from core.llm_client import groq_key_pool
from models.resume_model import (
    Certification,
    ContactInfo,
    Education,
    ParsedResumeData,
    Project,
    WorkExperience,
)
from services.document_parser_service import document_parser
from services.skill_ontology import normalize_skill
from utils.nlp_utils import (
    calculate_experience_from_intervals,
    count_words,
    extract_contact_details,
    extract_name,
    extract_sections,
)

logger = structlog.get_logger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_PARSE_MODEL = os.getenv("GROQ_PARSE_MODEL", "openai/gpt-oss-20b")
PROMPT_VERSION = "v3.2.0-verbatim-skills"
_PARSED_RESUME_CACHE: Dict[str, Dict[str, Any]] = {}
_MAX_CACHE_SIZE = 256

RESUME_PARSER_PROMPT = """You are an expert resume parsing engine. Extract structured information from the resume text into strict JSON.
The resume can be from ANY profession (technology, healthcare/nursing, finance/accounting, legal, skilled trades, sales, academia).
Rules:
- Extract ONLY facts explicitly stated in the text. NEVER invent, infer, or hallucinate details.
- If a field is not present in the resume, return null (for strings/objects) or [] (for lists).
- Copy names, titles, institutions, credentials, and skills EXACTLY as written.
- Copy dates exactly as written in the resume (e.g. "Jan 2021", "2019", "03/2020", "Present").
- Include internships, clinical residencies/rotations, and freelance contracts under work_experience.
- In "skills", include every hard skill, tool, technique, software, clinical competency, framework, or licence explicitly listed in the resume, copied verbatim.
- STRICT NEGATION RULE: NEVER extract any skill, tool, technology, or responsibility that the candidate explicitly states they DO NOT have, lacked, were not responsible for, or did not work on (e.g., "no experience in X", "did not work on Y", "excluding Z", "not involved in W"). Only extract competencies the candidate actually possesses and utilized.

JSON Schema:
{
  "full_name": string | null,
  "summary": string | null,
  "location": string | null,
  "work_experience": [
    {
      "company": string,
      "title": string,
      "start_date": string | null,
      "end_date": string | null,
      "is_current": boolean,
      "description": string | null,
      "technologies": [string]
    }
  ],
  "education": [
    {
      "institution": string,
      "degree": string | null,
      "field_of_study": string | null,
      "start_year": integer | null,
      "end_year": integer | null,
      "gpa": number | null
    }
  ],
  "projects": [
    {
      "name": string,
      "description": string | null,
      "technologies": [string],
      "url": string | null,
      "github_url": string | null
    }
  ],
  "certifications": [
    {
      "name": string,
      "issuer": string | null,
      "issue_date": string | null,
      "credential_id": string | null
    }
  ],
  "skills": [string],
  "technical_skills": [string],
  "soft_skills": [string],
  "languages": [string]
}"""


def _norm(s: Optional[str]) -> str:
    """Lowercase and collapse non-[a-z0-9+#] characters to single spaces."""
    if not s:
        return ""
    return re.sub(r"[^a-z0-9+#]+", " ", str(s).lower()).strip()


_GENERIC_LEGAL_SUFFIXES = {"pvt", "ltd", "inc", "corp", "llc", "limited", "private", "co", "company"}


def _grounded(raw_norm: str, value: Optional[str], ratio: float = 0.6) -> bool:
    """
    True if the normalized value is an exact whole-word phrase match in raw_norm,
    or if >= ratio of its distinct tokens appear as whole tokens in raw_norm.
    Matches strictly on whole-word boundaries so 'Java' does not match 'JavaScript',
    and short/single-letter skills ('R', 'C') only match as standalone tokens.
    """
    val_norm = _norm(value)
    if not val_norm or not raw_norm:
        return False

    # 1. Whole-word phrase boundary match (NOT substring)
    # e.g., 'java' must NOT match inside 'javascript', and 'c' must not match inside 'docker'
    phrase_pattern = rf"(?<![a-z0-9+#]){re.escape(val_norm)}(?![a-z0-9+#])"
    if re.search(phrase_pattern, raw_norm):
        return True

    # 2. Token-level matching
    tokens = [t for t in val_norm.split() if len(t) > 1]
    if not tokens:
        # Single-letter/short tokens must match as whole word above
        return False

    distinctive = [t for t in tokens if t not in _GENERIC_LEGAL_SUFFIXES]
    eval_tokens = distinctive if distinctive else tokens
    raw_tokens = set(raw_norm.split())
    matched = sum(1 for t in eval_tokens if t in raw_tokens)
    return (matched / len(eval_tokens)) >= ratio


def _safe_int(val: Any) -> Optional[int]:
    try:
        return int(val) if val is not None else None
    except (ValueError, TypeError):
        return None


def _safe_float(val: Any) -> Optional[float]:
    try:
        return float(val) if val is not None else None
    except (ValueError, TypeError):
        return None


def _clean_str_list(items: Any) -> List[str]:
    return [str(x).strip() for x in (items or []) if str(x).strip()] if isinstance(items, list) else []


async def _parse_resume_with_groq(raw_text: str) -> Tuple[Dict[str, Any], bool]:
    """
    Parses resume text into structured JSON using Groq LLM with key rotation, cache, and token limits.
    Returns (result_dict, is_cache_hit).
    """
    if not raw_text or len(raw_text.strip()) < 10:
        return {}, False

    text_hash = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()
    cache_key = f"{PROMPT_VERSION}:{GROQ_PARSE_MODEL}:{text_hash}"
    if cache_key in _PARSED_RESUME_CACHE:
        logger.debug("Resume structuring cache hit", cache_key=cache_key[:8])
        return _PARSED_RESUME_CACHE[cache_key], True

    # Send full raw_text directly without any truncation or section limits
    full_prompt_text = raw_text.strip()

    async def _make_request(api_key: Optional[str]) -> Dict[str, Any]:
        if not api_key:
            raise RuntimeError("No Groq API keys configured or available in key pool.")
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload: Dict[str, Any] = {
            "model": GROQ_PARSE_MODEL,
            "messages": [
                {"role": "system", "content": RESUME_PARSER_PROMPT},
                {"role": "user", "content": f"Extract structured resume information from the following resume text:\n\n{full_prompt_text}"},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.0,
            "max_tokens": 4000,
        }
        if GROQ_PARSE_MODEL.startswith("openai/gpt-oss"):
            payload["reasoning_effort"] = "low"

        async with httpx.AsyncClient(timeout=40.0) as client:
            resp = await client.post(GROQ_URL, json=payload, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(f"Groq API returned HTTP {resp.status_code}: {resp.text}")
            content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(content)

    last_error: Optional[Exception] = None
    # 2 attempts retry loop on invalid JSON or network/model failure
    for attempt in range(2):
        try:
            result = await groq_key_pool.execute_async_with_fallback(_make_request)
            if isinstance(result, dict) and result:
                if len(_PARSED_RESUME_CACHE) >= _MAX_CACHE_SIZE:
                    _PARSED_RESUME_CACHE.pop(next(iter(_PARSED_RESUME_CACHE)))
                _PARSED_RESUME_CACHE[cache_key] = result
                return result, False
            raise RuntimeError("Groq model returned empty structuring response.")
        except Exception as e:
            last_error = e
            logger.warning("Groq parse attempt failed", attempt=attempt + 1, error=str(e))

    # ─── [FALLBACK] Groq LLM API Failure Graceful Fallback ────────────────────
    # When Groq fails after 2 attempts (network, rate-limit, exhaustion), do NOT crash upload.
    # Returns fallback marker payload so Python deterministic layer can deliver contacts,
    # ESCO skills, and languages, setting auto_fill_failed=True for frontend wizard manual review.
    logger.warning(
        "Groq resume structuring call failed after 2 attempts; falling back gracefully to deterministic parsing",
        error=str(last_error),
    )
    return {"_auto_fill_failed": True, "_error": str(last_error)}, False


class ParserService:
    """Parses resumes from PDF/DOCX into structured ParsedResumeData."""

    async def parse_resume(self, file_path: str, file_type: str) -> ParsedResumeData:
        logger.info("Parsing resume", file_path=file_path, file_type=file_type)
        try:
            raw_text, page_count, parsing_source = await self._extract_raw_text_with_meta(file_path, file_type)
            result = await self._structure_resume(raw_text)
            result.page_count = page_count
            result.parsing_source = parsing_source
            logger.info(
                "Resume structured successfully",
                source=parsing_source,
                page_count=page_count,
                word_count=result.word_count,
                name=result.full_name,
                experience_count=len(result.work_experience),
                education_count=len(result.education),
                skills_count=len(result.skills),
            )
            return result
        except Exception as e:
            logger.error("Resume parse failed", error=str(e))
            raise RuntimeError(f"Failed to parse resume: {str(e)}")

    async def _extract_raw_text(self, file_path: str, file_type: str) -> str:
        """Backward-compatible extraction helper returning raw_text string."""
        raw_text, _, _ = await self._extract_raw_text_with_meta(file_path, file_type)
        return raw_text

    async def _extract_raw_text_with_meta(self, file_path: str, file_type: str) -> Tuple[str, int, str]:
        """Primary extractor using DocumentParserService with fallback."""
        ft = (file_type or "").lower().lstrip(".")
        parsed_doc = await document_parser.parse_document(file_path, ft)
        raw_text = parsed_doc.get("raw_text", "")
        page_count = parsed_doc.get("page_count", 1)
        source = parsed_doc.get("source", "document_parser")

        if not raw_text or len(raw_text.strip()) < 10:
            raise ValueError(f"No extractable text found in file: {file_path}")

        return raw_text, page_count, source

    async def _structure_resume(self, raw_text: str) -> ParsedResumeData:
        """Structures resume using deterministic NLP + Groq JSON-mode extraction with entity validation."""
        contact = ContactInfo(**extract_contact_details(raw_text))
        deterministic_name = extract_name(raw_text)

        ai_data, cache_hit = await _parse_resume_with_groq(raw_text)
        auto_fill_failed = bool(ai_data.get("_auto_fill_failed", False))

        raw_norm = _norm(raw_text)

        # ─── [FALLBACK] Candidate Name Grounding Fallback ──────────────────────
        # Candidate name requires strict ratio 1.0 (all tokens must appear in raw_text).
        # Fallback: If LLM hallucinates or alters name, fallback to deterministic regex name.
        llm_name = (ai_data.get("full_name") or "").strip()
        full_name = llm_name if (llm_name and _grounded(raw_norm, llm_name, ratio=1.0)) else deterministic_name

        # Location extraction and grounding
        raw_loc = str(ai_data.get("location") or "").strip()
        loc_grounded = raw_loc if (raw_loc and _grounded(raw_norm, raw_loc, ratio=0.6)) else contact.location
        if loc_grounded:
            contact.location = loc_grounded

        # Validated entity extraction with source-grounding checks
        raw_work = ai_data.get("work_experience", []) if isinstance(ai_data.get("work_experience"), list) else []
        validated_work_exp: List[WorkExperience] = []
        dropped_jobs = 0
        for it in raw_work:
            if not isinstance(it, dict):
                continue
            c = str(it.get("company") or "").strip()
            t = str(it.get("title") or "").strip()

            c_grounded = bool(c and _grounded(raw_norm, c, ratio=0.6))
            t_grounded = bool(t and _grounded(raw_norm, t, ratio=0.5))

            # Fix 5: Keep entry if company OR title is grounded (supports freelance, contracts, self-employed)
            if c_grounded or t_grounded:
                # Fix 4: Ground technologies in work experience so hallucinated tech is dropped
                raw_techs = _clean_str_list(it.get("technologies"))
                grounded_techs = [tech for tech in raw_techs if _grounded(raw_norm, tech, ratio=1.0)]

                # ─── [FALLBACK] Freelance / Missing Company Fallback ───────────
                # Fallback: If company is ungrounded or absent (freelance / contractor),
                # assign "Freelance / Self-Employed" fallback label instead of dropping the job.
                company_name = c if c_grounded else (c or "Freelance / Self-Employed")
                title_name = t if t_grounded else (t or "Professional")

                validated_work_exp.append(
                    WorkExperience(
                        company=company_name,
                        title=title_name,
                        start_date=it.get("start_date"),
                        end_date=it.get("end_date"),
                        duration_months=_safe_int(it.get("duration_months")),
                        description=it.get("description"),
                        technologies=grounded_techs,
                        is_current=bool(it.get("is_current", False)),
                    )
                )
            else:
                dropped_jobs += 1

        raw_edu = ai_data.get("education", []) if isinstance(ai_data.get("education"), list) else []
        validated_education: List[Education] = []
        dropped_edu = 0
        for it in raw_edu:
            if not isinstance(it, dict):
                continue
            inst = str(it.get("institution") or "").strip()
            if inst and _grounded(raw_norm, inst, ratio=0.6):
                validated_education.append(
                    Education(
                        institution=inst,
                        degree=it.get("degree"),
                        field_of_study=it.get("field_of_study"),
                        start_year=_safe_int(it.get("start_year")),
                        end_year=_safe_int(it.get("end_year")),
                        gpa=_safe_float(it.get("gpa")),
                    )
                )
            else:
                dropped_edu += 1

        raw_projects = ai_data.get("projects", []) if isinstance(ai_data.get("projects"), list) else []
        validated_projects: List[Project] = []
        dropped_projects = 0
        for it in raw_projects:
            if not isinstance(it, dict):
                continue
            pname = str(it.get("name") or "").strip()
            if pname and _grounded(raw_norm, pname, ratio=0.6):
                # Fix 4: Ground technologies in projects so hallucinated tech is dropped
                raw_techs = _clean_str_list(it.get("technologies"))
                grounded_techs = [tech for tech in raw_techs if _grounded(raw_norm, tech, ratio=1.0)]

                validated_projects.append(
                    Project(
                        name=pname,
                        description=it.get("description"),
                        technologies=grounded_techs,
                        url=it.get("url"),
                        github_url=it.get("github_url"),
                    )
                )
            else:
                dropped_projects += 1

        raw_certs = ai_data.get("certifications", []) if isinstance(ai_data.get("certifications"), list) else []
        validated_certs: List[Certification] = []
        dropped_certs = 0
        for it in raw_certs:
            if not isinstance(it, dict):
                continue
            cname = str(it.get("name") or "").strip()
            if cname and _grounded(raw_norm, cname, ratio=0.6):
                validated_certs.append(
                    Certification(
                        name=cname,
                        issuer=it.get("issuer"),
                        issue_date=it.get("issue_date"),
                        credential_id=it.get("credential_id"),
                    )
                )
            else:
                dropped_certs += 1

        # Calculate experience from normalized employment date intervals (merges overlaps, Present = today)
        total_exp = calculate_experience_from_intervals(validated_work_exp)

        # Option A: Grounded LLM skills extraction (technical skills, soft skills, languages)
        # 1. Collect candidate skills from LLM (structured fields + work experience + projects)
        raw_tech_skills = _clean_str_list(ai_data.get("technical_skills", []))
        raw_soft_skills = _clean_str_list(ai_data.get("soft_skills", []))
        raw_general_skills = _clean_str_list(ai_data.get("skills", []))

        role_technologies = [t for w in validated_work_exp for t in w.technologies]
        proj_technologies = [t for p in validated_projects for t in p.technologies]

        candidate_tech = (raw_tech_skills or raw_general_skills) + role_technologies + proj_technologies
        candidate_soft = raw_soft_skills

        grounded_tech: Set[str] = set()
        grounded_soft: Set[str] = set()
        dropped_skills = 0
        unknown_skills_count = 0

        # 2. Python strictly grounds technical skills against the resume text
        for s in candidate_tech:
            if not s or not isinstance(s, str) or not s.strip():
                continue
            s_clean = s.strip()
            if _grounded(raw_norm, s_clean, ratio=1.0):
                try:
                    canon = normalize_skill(s_clean)
                    if canon and isinstance(canon, str) and canon.strip():
                        grounded_tech.add(canon.strip().lower())
                    else:
                        grounded_tech.add(s_clean.lower())
                        unknown_skills_count += 1
                except Exception:
                    grounded_tech.add(s_clean.lower())
                    unknown_skills_count += 1
            else:
                dropped_skills += 1

        # 3. Ground soft skills against resume text (supporting multi-word soft skills)
        for s in candidate_soft:
            if not s or not isinstance(s, str) or not s.strip():
                continue
            s_clean = s.strip()
            if _grounded(raw_norm, s_clean, ratio=0.8):
                grounded_soft.add(s_clean.lower())
            else:
                dropped_skills += 1

        all_skills = sorted({s for s in (grounded_tech | grounded_soft) if s and isinstance(s, str) and s.strip()})
        normalized_soft = sorted(grounded_soft)
        normalized_tech = sorted(grounded_tech)

        # 4. LLM language extraction with strict text grounding
        raw_llm_languages = _clean_str_list(ai_data.get("languages", []))
        grounded_languages: Set[str] = set()
        for lang in raw_llm_languages:
            if lang and _grounded(raw_norm, lang, ratio=1.0):
                grounded_languages.add(lang.strip().title())

        # If LLM output omitted languages, parse directly from explicit Languages header without hardcoded sets
        if not grounded_languages:
            lang_match = re.search(r"(?:^|\n)[\s#*_-]*languages?\s*[:\-]\s*([^\n\r]+)", raw_text, re.IGNORECASE)
            if lang_match:
                for item in re.split(r"[,;/|•]", lang_match.group(1)):
                    clean_item = re.sub(r"[^a-zA-Z\s]", "", item).strip()
                    if clean_item and 1 < len(clean_item) < 25:
                        grounded_languages.add(clean_item.title())

        languages = sorted(grounded_languages)

        # ─── [FALLBACK] Executive Summary Section Fallback ─────────────────────
        # Fallback: If LLM does not return a summary, fall back to regex section extractor.
        summary_val = ai_data.get("summary") or extract_sections(raw_text).get("summary")
        section_set = set()
        if validated_work_exp:
            section_set.add("experience")
        if validated_education:
            section_set.add("education")
        if all_skills:
            section_set.add("skills")
        if validated_projects:
            section_set.add("projects")
        if validated_certs:
            section_set.add("certifications")
        if summary_val:
            section_set.add("summary")
        if languages:
            section_set.add("languages")

        # One structured log after parsing
        logger.info(
            "Resume parsed and validated",
            model=GROQ_PARSE_MODEL,
            cache_hit=cache_hit,
            auto_fill_failed=auto_fill_failed,
            jobs_count=len(validated_work_exp),
            edu_count=len(validated_education),
            projects_count=len(validated_projects),
            certs_count=len(validated_certs),
            skills_count=len(all_skills),
            unknown_skills_count=unknown_skills_count,
            dropped_jobs=dropped_jobs,
            dropped_edu=dropped_edu,
            dropped_projects=dropped_projects,
            dropped_certs=dropped_certs,
            dropped_skills=dropped_skills,
            total_experience_years=total_exp,
            full_name=full_name,
        )

        return ParsedResumeData(
            raw_text=raw_text,
            contact_info=contact,
            full_name=full_name,
            location=loc_grounded,
            summary=summary_val,
            skills=all_skills,
            technical_skills=normalized_tech,
            soft_skills=normalized_soft,
            work_experience=validated_work_exp,
            education=validated_education,
            projects=validated_projects,
            certifications=validated_certs,
            languages=languages,
            total_experience_years=total_exp,
            word_count=count_words(raw_text),
            sections_detected=sorted(section_set),
            auto_fill_failed=auto_fill_failed,
        )