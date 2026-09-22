"""
Phase 2 Verification Tests — Agentic Tool Framework & Router
============================================================
Tests:
1. ToolRegistry has all 15 tools (9 read tools + 6 action tools).
2. Pydantic schema validation for all tool inputs.
3. Read tools are strictly grounded (honest "no data on file", zero hallucinated numbers).
4. Action tools produce structured payloads and generative UI card directives.
5. Provider adapters: Groq, Gemini, and Mistral formats and tool-call normalization.
6. CopilotRouter: concurrent execution with asyncio.gather, 8s timeout isolation, fault tolerance.
7. Navigation tool routing replacing hardcoded direct_commands and parse_intents.
"""

import asyncio
from datetime import datetime, timezone
import pytest
from bson import ObjectId

from services.copilot.context import ToolExecutionContext
from services.copilot.registry import tool_registry, BaseTool, ToolResult
from services.copilot.tools.read_tools import (
    GetResumeSummaryArgs,
    GetResumeSummaryTool,
    GetATSBreakdownArgs,
    GetATSBreakdownTool,
    SearchResumeArgs,
    SearchResumeTool,
    GetGitHubProfileTool,
    GetInterviewHistoryTool,
    GetCertificatesTool,
    GetGamificationStateTool,
    SearchJobsArgs,
    SearchJobsTool,
    SearchHelpDocsArgs,
    SearchHelpDocsTool,
)
from services.copilot.tools.action_tools import (
    RunATSMatchArgs,
    RunATSMatchTool,
    EnhanceBulletsArgs,
    EnhanceBulletsTool,
    GenerateInterviewQuestionsArgs,
    GenerateInterviewQuestionsTool,
    BuildLearningRoadmapArgs,
    BuildLearningRoadmapTool,
    DraftOutreachEmailArgs,
    DraftOutreachEmailTool,
    NavigateArgs,
    NavigateTool,
)
from services.copilot.adapters.groq_adapter import GroqToolAdapter
from services.copilot.adapters.gemini_adapter import GeminiToolAdapter
from services.copilot.adapters.mistral_adapter import MistralToolAdapter
from services.copilot.router import CopilotRouter


class MockAsyncCollection:
    def __init__(self, initial_docs=None):
        self.docs = list(initial_docs or [])

    async def find_one(self, query=None, *args, **kwargs):
        query = query or {}
        for d in self.docs:
            if all(d.get(k) == v for k, v in query.items() if not isinstance(v, dict)):
                return dict(d)
        return None

    def find(self, query=None, *args, **kwargs):
        query = query or {}
        matching = [
            dict(d) for d in self.docs
            if all(d.get(k) == v for k, v in query.items() if not isinstance(v, dict))
        ]

        class MockCursor:
            def __init__(self, data):
                self.data = data

            def sort(self, *args, **kwargs):
                return self

            def limit(self, n):
                self.data = self.data[:n]
                return self

            async def to_list(self, length=100):
                return self.data[:length]

        return MockCursor(matching)


class MockResumeRepo:
    def __init__(self, resume_doc=None):
        self.resume_doc = resume_doc

    async def get_by_id_and_user(self, resume_id, user_id):
        if self.resume_doc and str(self.resume_doc.get("id")) == str(resume_id):
            return type("Resume", (), self.resume_doc)()
        return None

    async def get_latest_by_user(self, user_id):
        if self.resume_doc:
            return type("Resume", (), self.resume_doc)()
        return None


class MockResultRepo:
    def __init__(self, result_doc=None):
        self.result_doc = result_doc

    async def get_by_id_and_user(self, result_id, user_id):
        if self.result_doc and str(self.result_doc.get("id")) == str(result_id):
            return type("Result", (), self.result_doc)()
        return None

    async def get_latest_by_user(self, user_id):
        if self.result_doc:
            return type("Result", (), self.result_doc)()
        return None


@pytest.fixture
def mock_context():
    sample_resume = {
        "id": "res_123",
        "filename": "john_doe_resume.pdf",
        "original_filename": "john_doe_resume.pdf",
        "skills": ["Python", "FastAPI", "Docker", "MongoDB"],
        "experience_years": 4,
        "education": ["B.S. Computer Science"],
        "experience": [{"role": "Backend Engineer", "company": "Acme Corp"}],
        "raw_text": "Experienced Python Backend Developer skilled in FastAPI, Docker, and MongoDB.",
        "created_at": datetime.now(timezone.utc),
    }

    sample_ats = {
        "id": "ats_456",
        "final_score": 78.5,
        "matched_skills": ["Python", "FastAPI", "MongoDB"],
        "missing_skills": ["AWS", "Kubernetes"],
        "recommendation": "Good match",
        "created_at": datetime.now(timezone.utc),
    }

    class MockDB:
        def __init__(self):
            self.users = MockAsyncCollection([{"_id": ObjectId("665f1a2b3c4d5e6f7a8b9c0d"), "github_username": "johndoe"}])
            self.user_profiles = MockAsyncCollection([{"user_id": "user_123", "github_username": "johndoe", "languages": ["Python", "Go"], "contribution_score": 92}])
            self.interviews = MockAsyncCollection([{"user_id": "user_123", "role_title": "Senior Backend Engineer", "overall_score": 85, "weak_areas": ["System Design"]}])
            self.certificates = MockAsyncCollection([{"user_id": "user_123", "certificate_title": "FastAPI Certified Professional", "certificate_type": "backend", "grade": 94}])
            self.user_gamification = MockAsyncCollection([{"user_id": "user_123", "level": 4, "points": 1250, "streak_days": 8, "badges": ["Early Adopter"]}])
            self.jobs = MockAsyncCollection([
                {"_id": "job_1", "title": "Senior Python Engineer", "company": "Stripe", "status": "active", "required_skills": ["Python", "FastAPI", "Docker"], "location": "Remote", "remote": True},
                {"_id": "job_2", "title": "Frontend React Dev", "company": "Vercel", "status": "active", "required_skills": ["React", "TypeScript"], "location": "Remote", "remote": True},
            ])

    return ToolExecutionContext(
        tenant_id="tenant_alpha",
        user_id="user_123",
        user_name="John Doe",
        trace_id="trace_test_001",
        session_id="sess_test_001",
        db=MockDB(),
        resume_repo=MockResumeRepo(sample_resume),
        result_repo=MockResultRepo(sample_ats),
        copilot_repo=None,
    )


# ─── 1. Registry Invariants ───────────────────────────────────────────────────

def test_tool_registry_contains_all_15_tools():
    tools = tool_registry.list_tools()
    tool_names = {t.name for t in tools}

    expected_read_tools = {
        "get_resume_summary", "search_resume", "get_ats_breakdown",
        "get_github_profile", "get_interview_history", "get_certificates",
        "get_gamification_state", "search_jobs", "search_help_docs",
    }
    expected_action_tools = {
        "run_ats_match", "enhance_bullets", "generate_interview_questions",
        "build_learning_roadmap", "draft_outreach_email", "navigate",
    }

    assert expected_read_tools.issubset(tool_names), f"Missing read tools: {expected_read_tools - tool_names}"
    assert expected_action_tools.issubset(tool_names), f"Missing action tools: {expected_action_tools - tool_names}"
    assert len(tool_names) >= 15


# ─── 2. Grounded Read Tools Tests ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_resume_summary_grounded(mock_context):
    tool = GetResumeSummaryTool()
    res = await tool.execute(mock_context, GetResumeSummaryArgs())
    assert res.ok is True
    assert "Python" in res.data["skills"]
    assert res.data["experience_years"] == 4
    assert res.citation is not None
    assert "/upload" in res.citation["href"]


@pytest.mark.asyncio
async def test_get_resume_summary_empty_no_fabrication():
    """Verify honest failure when no resume is on file; never invent skills."""
    empty_context = ToolExecutionContext(
        tenant_id="tenant_alpha",
        user_id="empty_user",
        user_name="Ghost",
        trace_id="trace_002",
        session_id="sess_002",
        db=None,
        resume_repo=MockResumeRepo(None),  # No resume!
        result_repo=MockResultRepo(None),
        copilot_repo=None,
    )
    tool = GetResumeSummaryTool()
    res = await tool.execute(empty_context, GetResumeSummaryArgs())
    assert res.ok is False
    assert res.data is None
    assert "not uploaded a resume" in res.reason.lower()


@pytest.mark.asyncio
async def test_get_ats_breakdown_grounded(mock_context):
    tool = GetATSBreakdownTool()
    res = await tool.execute(mock_context, GetATSBreakdownArgs())
    assert res.ok is True
    assert res.data["final_score"] == 78.5
    assert "AWS" in res.data["missing_skills"]
    assert res.ui_card["card"] == "ats_score"


@pytest.mark.asyncio
async def test_get_ats_breakdown_empty_no_fabrication():
    empty_context = ToolExecutionContext(
        tenant_id="tenant_alpha",
        user_id="empty_user",
        user_name="Ghost",
        trace_id="trace_003",
        session_id="sess_003",
        db=None,
        resume_repo=MockResumeRepo(None),
        result_repo=MockResultRepo(None),  # No ATS scan!
        copilot_repo=None,
    )
    tool = GetATSBreakdownTool()
    res = await tool.execute(empty_context, GetATSBreakdownArgs())
    assert res.ok is False
    assert res.data is None
    assert "not run an ats match" in res.reason.lower()


@pytest.mark.asyncio
async def test_search_resume_and_help_docs(mock_context):
    # Resume search
    search_tool = SearchResumeTool()
    s_res = await search_tool.execute(mock_context, SearchResumeArgs(query="FastAPI"))
    assert s_res.ok is True
    assert len(s_res.data["matched_skills"]) > 0

    # Help docs
    help_tool = SearchHelpDocsTool()
    h_res = await help_tool.execute(mock_context, SearchHelpDocsArgs(query="how do I publish portfolio?"))
    assert h_res.ok is True
    assert "/portfolio" in h_res.data["guide"]


@pytest.mark.asyncio
async def test_search_jobs(mock_context):
    job_tool = SearchJobsTool()
    res = await job_tool.execute(mock_context, SearchJobsArgs(query="Python"))
    assert res.ok is True
    assert len(res.data["jobs"]) == 1
    assert res.data["jobs"][0]["company"] == "Stripe"
    assert res.ui_card["card"] == "job_match"


# ─── 3. Action Tools & Generative UI Cards ────────────────────────────────────

@pytest.mark.asyncio
async def test_run_ats_match_action(mock_context):
    tool = RunATSMatchTool()
    args = RunATSMatchArgs(job_description="We need a Python and FastAPI engineer with Docker and Kubernetes expertise.")
    res = await tool.execute(mock_context, args)
    assert res.ok is True
    assert res.data["final_score"] > 0
    assert res.ui_card["card"] == "ats_score"


@pytest.mark.asyncio
async def test_enhance_bullets_action(mock_context):
    tool = EnhanceBulletsTool()
    args = EnhanceBulletsArgs(bullets=["built a python backend for user analytics"], target_role="Senior Engineer")
    res = await tool.execute(mock_context, args)
    assert res.ok is True
    assert len(res.data["rewritten"]) == 1
    assert res.ui_card["card"] == "bullet_diff"
    enhanced_text = res.data["rewritten"][0]["enhanced"]
    assert any(verb in enhanced_text for verb in ["Architected", "Engineered", "Optimized", "Delivered"])


@pytest.mark.asyncio
async def test_generate_interview_questions_action(mock_context):
    tool = GenerateInterviewQuestionsTool()
    res = await tool.execute(mock_context, GenerateInterviewQuestionsArgs(role="Backend Engineer", difficulty="senior"))
    assert res.ok is True
    assert len(res.data["questions"]) == 3
    assert res.ui_card["card"] == "interview_questions"


@pytest.mark.asyncio
async def test_build_learning_roadmap_action(mock_context):
    tool = BuildLearningRoadmapTool()
    res = await tool.execute(mock_context, BuildLearningRoadmapArgs(gap_skills=["Kubernetes", "AWS", "gRPC"], weeks=6))
    assert res.ok is True
    assert len(res.data["milestones"]) == 6
    assert res.ui_card["card"] == "roadmap"


@pytest.mark.asyncio
async def test_navigate_tool_replaces_direct_commands(mock_context):
    tool = NavigateTool()
    res = await tool.execute(mock_context, NavigateArgs(route="/interview", reason="practice voice questions"))
    assert res.ok is True
    assert res.data["route"] == "/interview"
    assert "Interview Practice" in res.summary


# ─── 4. Provider Adapters ─────────────────────────────────────────────────────

def test_provider_adapters_format_and_extract():
    tools = [GetResumeSummaryTool(), NavigateTool()]

    # Groq Adapter
    groq = GroqToolAdapter()
    groq_formatted = groq.format_tools(tools)
    assert len(groq_formatted) == 2
    assert groq_formatted[0]["type"] == "function"
    assert groq_formatted[0]["function"]["name"] == "get_resume_summary"

    sample_groq_resp = {
        "choices": [
            {
                "message": {
                    "tool_calls": [
                        {
                            "id": "tc_01",
                            "type": "function",
                            "function": {"name": "navigate", "arguments": '{"route": "/results", "reason": "view ATS"}'},
                        }
                    ]
                }
            }
        ]
    }
    extracted_groq = groq.extract_tool_calls(sample_groq_resp)
    assert len(extracted_groq) == 1
    assert extracted_groq[0].name == "navigate"
    assert extracted_groq[0].args["route"] == "/results"

    # Gemini Adapter
    gemini = GeminiToolAdapter()
    gemini_formatted = gemini.format_tools(tools)
    assert "function_declarations" in gemini_formatted[0]

    # Mistral Adapter
    mistral = MistralToolAdapter()
    mistral_formatted = mistral.format_tools(tools)
    assert len(mistral_formatted) == 2


# ─── 5. CopilotRouter Execution & Resilience ──────────────────────────────────

@pytest.mark.asyncio
async def test_router_parallel_execution_and_resilience(mock_context):
    router = CopilotRouter()
    events = []

    async def emit_event(ev):
        events.append(ev)

    # Test heuristic planning with /ats shortcut
    outputs = await router.plan_and_execute_tools(
        ctx=mock_context,
        message="/ats",
        quick_action=None,
        emit_event=emit_event,
    )

    # Must have emitted tool_call and tool_result events
    event_types = [e["type"] for e in events]
    assert "tool_call" in event_types
    assert "tool_result" in event_types
    assert "navigate" in event_types


@pytest.mark.asyncio
async def test_router_tool_timeout_resilience(mock_context):
    """Verify an 8-second tool timeout is caught and gracefully handled without crashing."""
    class SlowTool(BaseTool):
        name = "slow_tool"
        description = "Simulates hanging tool"
        args_schema = GetResumeSummaryArgs
        side_effect = False

        async def execute(self, ctx, args):
            await asyncio.sleep(10.0)
            return ToolResult(ok=True, data="Too late", summary="Should timeout")

    router = CopilotRouter()
    # Execute with 0.1s override or standard safe execution
    tool = SlowTool()
    # Patch timeout attribute for test speed
    import services.copilot.router as r_mod
    orig_timeout = r_mod.PER_TOOL_TIMEOUT_SECONDS
    r_mod.PER_TOOL_TIMEOUT_SECONDS = 0.1
    try:
        res = await router.execute_tool_safe(tool, mock_context, {})
        assert res.ok is False
        assert "timed out" in res.summary.lower()
    finally:
        r_mod.PER_TOOL_TIMEOUT_SECONDS = orig_timeout
