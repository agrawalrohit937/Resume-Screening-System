"""Tests for CareerShala MCP Server tools and resources."""

import json
import pytest

from mcp_server import (
    check_resume_format_health,
    expand_skill_ontology,
    get_ats_scoring_weights,
    mcp,
    score_resume_against_jd,
)


@pytest.mark.asyncio
async def test_mcp_server_registers_tools_and_resource():
    tools = await mcp.list_tools()
    tool_names = {t.name for t in tools}
    assert {
        "score_resume_against_jd",
        "check_resume_format_health",
        "expand_skill_ontology",
        "search_open_jobs",
    }.issubset(tool_names)

    resources = await mcp.list_resources()
    resource_uris = {str(r.uri) for r in resources}
    assert "careershala://ats-weights" in resource_uris


def test_mcp_ats_weights_resource():
    raw = get_ats_scoring_weights()
    data = json.loads(raw)
    assert "candidate" in data
    assert "recruiter" in data
    assert "skills_weight" in data["candidate"]


def test_mcp_format_health_and_ontology_tools():
    health = check_resume_format_health(
        "Rohit Agrawal\nSkills: Python, FastAPI, React, PostgreSQL\nExperience: Backend Intern"
    )
    assert "is_ats_compliant" in health
    assert "compliance_score" in health

    ontology = expand_skill_ontology(["Python", "ReactJS"])
    assert "canonical_skills" in ontology
    assert "related_skills" in ontology


def test_mcp_score_resume_tool():
    res = score_resume_against_jd(
        resume_text="Python FastAPI PostgreSQL React 18 LangGraph developer with 1 year internship.",
        job_description="Looking for a Python FastAPI Backend Engineer with PostgreSQL and Docker skills.",
        mode="candidate",
    )
    assert isinstance(res["final_score"], (int, float))
    assert 0 <= res["final_score"] <= 100
    assert "matched_skills" in res
    assert "missing_skills" in res
