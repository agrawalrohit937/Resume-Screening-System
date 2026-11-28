"""CareerShala MCP Server — exposes ATS, Ontology, Format Health, and Job Search over MCP."""

from __future__ import annotations

import dataclasses
import json
import sys
from typing import Any, Dict, List

from mcp.server.mcpserver import MCPServer

from services.ats_format_check import check_ats_formatting
from services.scoring_engine import SCORING_PROFILES, score_resume
from services.skill_ontology import canonicalize_skills, expand_skills

mcp = MCPServer(
    name="careershala",
    instructions=(
        "CareerShala AI Career Platform MCP Server. Use these tools to score resumes against "
        "job descriptions, check ATS formatting health, expand ESCO skill ontologies, and search open jobs."
    ),
)


@mcp.tool()
def score_resume_against_jd(
    resume_text: str,
    job_description: str,
    mode: str = "candidate",
) -> Dict[str, Any]:
    """Score a resume against a job description using CareerShala's hybrid ATS engine."""
    safe_mode = mode if mode in ("candidate", "recruiter") else "candidate"
    result = score_resume(resume=resume_text, jd=job_description, mode=safe_mode)
    return {
        "final_score": result.get("final_score"),
        "quality_score": result.get("quality_score"),
        "match_band": result.get("match_band"),
        "eligibility_status": (result.get("eligibility") or {}).get("status"),
        "skills_score": result.get("skills_score"),
        "experience_score": result.get("experience_score"),
        "education_score": result.get("education_score"),
        "matched_skills": result.get("matched_skills", []),
        "missing_skills": result.get("missing_skills", []),
        "feedback_suggestions": result.get("feedback_suggestions", []),
    }


@mcp.tool()
def check_resume_format_health(resume_text: str) -> Dict[str, Any]:
    """Inspect resume text for ATS parsing issues, hidden text, and compliance score."""
    return check_ats_formatting(raw_text=resume_text)


@mcp.tool()
def expand_skill_ontology(skills: List[str]) -> Dict[str, Any]:
    """Canonicalize raw skill names and expand related transferable skills using ESCO ontology."""
    canonical = canonicalize_skills(skills)
    expanded = expand_skills(canonical)
    return {
        "canonical_skills": canonical,
        "related_skills": {k: sorted(v) for k, v in expanded.items()},
    }


@mcp.tool()
async def search_open_jobs(query: str = "", limit: int = 5) -> List[Dict[str, Any]]:
    """Search open jobs in CareerShala PostgreSQL database by title, skills, or location."""
    from sqlalchemy import or_, select
    from config.db import get_pg_session_factory
    from models.tables import Job

    safe_limit = max(1, min(limit, 20))
    async with get_pg_session_factory()() as session:
        stmt = select(Job).where(Job.status == "open")
        q = query.strip()
        if q:
            pattern = f"%{q}%"
            stmt = stmt.where(
                or_(Job.title.ilike(pattern), Job.jd_text_raw.ilike(pattern), Job.location.ilike(pattern))
            )
        stmt = stmt.limit(safe_limit)
        rows = (await session.execute(stmt)).scalars().all()
        return [
            {
                "id": j.id,
                "title": j.title,
                "company_name": j.company_name,
                "location": j.location,
                "work_mode": j.work_mode,
                "min_years": j.min_years,
                "required_skills": j.required_skills or [],
            }
            for j in rows
        ]


@mcp.resource("careershala://ats-weights")
def get_ats_scoring_weights() -> str:
    """Return CareerShala's ATS scoring weight profiles for candidate and recruiter modes."""
    profiles = {
        mode: dataclasses.asdict(p) if dataclasses.is_dataclass(p) else dict(vars(p))
        for mode, p in SCORING_PROFILES.items()
    }
    return json.dumps(profiles, indent=2)


if __name__ == "__main__":
    transport = "streamable-http" if "--http" in sys.argv else "stdio"
    mcp.run(transport=transport)
