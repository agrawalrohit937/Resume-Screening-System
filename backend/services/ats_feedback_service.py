"""
ATS LLM Feedback & Suggestions Service
---------------------------------------
Generates hyper-personalized, actionable ATS resume improvement suggestions
using Groq LLM instead of static hardcoded template strings.

Features:
- Dual-key pool rotation with fallback via GroqKeyPool
- Sub-second execution using high-speed Groq model (openai/gpt-oss-20b)
- Category-aligned formatting for frontend UnifiedATSReadinessCard
- In-memory SHA256 caching to eliminate redundant LLM calls
- Seamless deterministic fallback if keys are missing or offline
"""

import hashlib
import json
import os
from typing import Any, Dict, List, Optional
import httpx
import structlog

from core.llm_client import groq_key_pool

logger = structlog.get_logger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_FEEDBACK_MODEL = os.getenv("GROQ_FEEDBACK_MODEL", "openai/gpt-oss-20b")
_FEEDBACK_CACHE: Dict[str, List[str]] = {}
_MAX_CACHE_SIZE = 500

ATS_FEEDBACK_SYSTEM_PROMPT = """You are an elite ATS (Applicant Tracking System) career advisor and technical recruiter.
Your goal is to provide 3 to 4 hyper-targeted, concrete, and deeply actionable recommendations for the candidate to improve their ATS resume score for the specified job.

STRICT INSTRUCTIONS:
1. Base your recommendations strictly on the provided ATS score breakdown (missing skills, experience duration, education status, and matched strengths).
2. For missing mandatory skills: Provide a ready-to-copy resume bullet in quotes demonstrating practical usage (e.g. 'Engineered scalable backend service using [Skill], improving performance by 25%').
3. For experience/tenure: Advise on how to quantify achievements with concrete STAR metrics (e.g. latency, users, throughput).
4. For education: If degree is in progress or differs from target, recommend highlighting technical coursework, capstones, and anticipated graduation timeline.
5. If score is high (>=80%), highlight their strongest technical alignment as a key selling point.
6. Format each recommendation to start with a clear uppercase prefix matching one of these categories:
   - "SKILL GAP: ..."
   - "EXPERIENCE: ..."
   - "PROJECTS: ..."
   - "EDUCATION: ..."
   - "STRENGTH: ..."
7. Keep each bullet under 2 sentences. Be punchy, professional, and directly useful.
8. Respond ONLY with a valid JSON object matching this schema:
   {
     "suggestions": [
       "SKILL GAP: ...",
       "EXPERIENCE: ...",
       "PROJECTS: ..."
     ]
   }
"""


def _compute_cache_key(scored_result: Dict[str, Any], job_title: str, jd_text: str, resume_raw: str) -> str:
    missing_key = ",".join(sorted(scored_result.get("missing_skills", [])[:10]))
    matched_key = ",".join(sorted(scored_result.get("matched_skills", [])[:10]))
    raw_hash = hashlib.sha256(f"{job_title}:{missing_key}:{matched_key}:{resume_raw[:500]}:{jd_text[:500]}".encode("utf-8")).hexdigest()
    return f"{GROQ_FEEDBACK_MODEL}:{raw_hash}"


async def generate_ats_feedback_with_groq(
    scored_result: Dict[str, Any],
    job_title: Optional[str] = None,
    job_description: Optional[str] = None,
    resume_data: Optional[Dict[str, Any]] = None,
) -> List[str]:
    """
    Generates intelligent, candidate-tailored suggestions via Groq LLM.
    Returns a list of suggestion strings. If Groq fails or is unconfigured,
    gracefully returns the deterministic baseline suggestions.
    """
    baseline_suggestions: List[str] = scored_result.get("feedback_suggestions", []) or []

    # If no Groq keys exist in pool, immediately return baseline
    if not groq_key_pool.get_keys():
        logger.debug("No Groq keys configured; using baseline ATS feedback")
        return baseline_suggestions

    try:
        # Extract metadata
        role = job_title or "Target Role"
        missing_skills = scored_result.get("missing_skills", [])
        matched_skills = scored_result.get("matched_skills", [])
        final_score = scored_result.get("final_score", 0.0)
        exp_score = scored_result.get("experience_score", 0.0)
        edu_score = scored_result.get("education_score", 0.0)
        edu_status = scored_result.get("education_status", "unspecified")
        is_in_progress = scored_result.get("is_in_progress", False)

        # Extract resume snippets
        resume_raw = ""
        resume_skills = []
        if isinstance(resume_data, dict):
            resume_raw = str(resume_data.get("raw_text", "") or "")
            resume_skills = resume_data.get("skills", []) or []

        # Check Cache
        cache_key = _compute_cache_key(scored_result, role, job_description or "", resume_raw)
        if cache_key in _FEEDBACK_CACHE:
            logger.debug("ATS feedback cache hit", cache_key=cache_key[:12])
            return _FEEDBACK_CACHE[cache_key]

        # Compact Context for Fast LLM Inference (avoids token waste)
        user_prompt_data = {
            "target_role": role,
            "overall_match_score": f"{final_score}%",
            "missing_mandatory_skills": missing_skills[:8],
            "matched_skills": matched_skills[:8],
            "experience_score": f"{exp_score}%",
            "education_score": f"{edu_score}%",
            "degree_in_progress": is_in_progress,
            "education_status": edu_status,
            "candidate_skills_on_file": resume_skills[:10] if resume_skills else "See matched skills",
        }

        user_content = (
            f"Generate personalized ATS feedback based on these candidate match metrics:\n"
            f"{json.dumps(user_prompt_data, indent=2)}\n\n"
            f"Provide exactly 3 to 4 actionable suggestions in JSON."
        )

        async def _call_groq(api_key: Optional[str]) -> List[str]:
            if not api_key:
                raise RuntimeError("No Groq API key available")

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            payload: Dict[str, Any] = {
                "model": GROQ_FEEDBACK_MODEL,
                "messages": [
                    {"role": "system", "content": ATS_FEEDBACK_SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
                "max_tokens": 450,
            }
            if GROQ_FEEDBACK_MODEL.startswith("openai/gpt-oss"):
                payload["reasoning_effort"] = "low"

            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(GROQ_URL, json=payload, headers=headers)
                if resp.status_code != 200:
                    raise RuntimeError(f"Groq API returned HTTP {resp.status_code}: {resp.text}")

                content = resp.json()["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                suggestions = parsed.get("suggestions", [])
                if isinstance(suggestions, list) and suggestions:
                    return [str(s).strip() for s in suggestions if str(s).strip()]
                raise ValueError("Groq returned empty or malformed suggestions list")

        llm_suggestions = await groq_key_pool.execute_async_with_fallback(_call_groq)

        if llm_suggestions and len(llm_suggestions) >= 2:
            # Update cache
            if len(_FEEDBACK_CACHE) >= _MAX_CACHE_SIZE:
                _FEEDBACK_CACHE.clear()
            _FEEDBACK_CACHE[cache_key] = llm_suggestions
            logger.info("Successfully generated dynamic ATS feedback via Groq", count=len(llm_suggestions))
            return llm_suggestions

    except Exception as e:
        logger.warning("Groq ATS feedback generation failed; falling back to deterministic baseline", error=str(e))

    return baseline_suggestions
