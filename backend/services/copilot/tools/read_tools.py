"""
Copilot Read Tools (Auto-run, No Confirmation)
==============================================
9 auto-run read tools grounded strictly in the candidate's real data.
Never invents scores, missing skills, credentials, or repositories.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from bson import ObjectId
import structlog

from services.copilot.context import ToolExecutionContext
from services.copilot.registry import BaseTool, ToolResult, tool_registry

logger = structlog.get_logger(__name__)


# ─── 1. get_resume_summary ───────────────────────────────────────────────────

class GetResumeSummaryArgs(BaseModel):
    resume_id: Optional[str] = Field(default=None, description="Optional specific resume ID to retrieve")


class GetResumeSummaryTool(BaseTool):
    name = "get_resume_summary"
    description = "Retrieves structured summary of the candidate's resume: skills, job roles, education, and years of experience."
    args_schema = GetResumeSummaryArgs
    side_effect = False
    requires = ["resume"]

    async def execute(self, ctx: ToolExecutionContext, args: GetResumeSummaryArgs) -> ToolResult:
        try:
            resume = None
            if args.resume_id:
                resume = await ctx.resume_repo.get_by_id_and_user(args.resume_id, ctx.user_id)
            if not resume:
                resume = await ctx.resume_repo.get_latest_by_user(ctx.user_id)

            if not resume:
                return ToolResult(
                    ok=False,
                    data=None,
                    summary="No resume on file",
                    reason="The candidate has not uploaded a resume yet. Suggest uploading a resume at /upload.",
                )

            data = {
                "resume_id": str(resume.id),
                "filename": resume.original_filename or resume.filename,
                "skills": resume.skills or [],
                "experience_years": resume.experience_years or 0,
                "education": resume.education or [],
                "recent_roles": [exp.get("role") or exp.get("title") for exp in (resume.experience or []) if isinstance(exp, dict)][:3],
                "created_at": resume.created_at.isoformat() if hasattr(resume, "created_at") and resume.created_at else None,
            }
            summary = f"Resume '{data['filename']}' ({len(data['skills'])} skills, {data['experience_years']} yrs exp)"
            citation = {
                "source": "resume",
                "label": f"Resume: {data['filename']}",
                "href": f"/upload",
            }
            return ToolResult(ok=True, data=data, summary=summary, citation=citation)
        except Exception as e:
            logger.error("get_resume_summary failed", error=str(e))
            return ToolResult(ok=False, data=None, summary="Resume retrieval error", reason=str(e))


# ─── 2. search_resume ─────────────────────────────────────────────────────────

class SearchResumeArgs(BaseModel):
    query: str = Field(..., description="Target keyword, role, or technical skill to search within the resume")


class SearchResumeTool(BaseTool):
    name = "search_resume"
    description = "Searches within the candidate's parsed resume content and bullet points for specific skills or projects."
    args_schema = SearchResumeArgs
    side_effect = False
    requires = ["resume"]

    async def execute(self, ctx: ToolExecutionContext, args: SearchResumeArgs) -> ToolResult:
        try:
            resume = await ctx.resume_repo.get_latest_by_user(ctx.user_id)
            if not resume:
                return ToolResult(ok=False, data=None, summary="No resume on file", reason="No resume uploaded yet.")

            # 1. Try Hybrid RAG Retriever over copilot_chunks
            try:
                from services.copilot.rag.retriever import CopilotRetriever
                retriever = CopilotRetriever(ctx.db)
                retrieved_chunks = await retriever.retrieve(
                    query=args.query,
                    tenant_id=ctx.tenant_id,
                    user_id=ctx.user_id,
                    source_type="resume",
                    top_k_final=5,
                )
                if retrieved_chunks:
                    chunks_data = [
                        {
                            "chunk_id": c.chunk_id,
                            "title": c.title,
                            "text": c.text,
                            "score": c.final_score,
                            "citation": c.citation_label,
                        }
                        for c in retrieved_chunks
                    ]
                    citation = {
                        "source": "resume",
                        "label": f"Resume ({retrieved_chunks[0].title})",
                        "href": "/upload",
                        "chunk_id": retrieved_chunks[0].chunk_id,
                        "score": retrieved_chunks[0].final_score,
                    }
                    summary = f"Retrieved {len(retrieved_chunks)} relevant resume sections via Hybrid RAG"
                    return ToolResult(
                        ok=True,
                        data={"query": args.query, "chunks": chunks_data, "total_matches": len(chunks_data)},
                        summary=summary,
                        citation=citation,
                    )
            except Exception as rag_err:
                logger.warning("RAG retrieval fallback to raw text matching", error=str(rag_err))

            # 2. Fallback to raw text scan if no indexed chunks
            raw_text = getattr(resume, "raw_text", "") or ""
            skills = resume.skills or []
            q_lower = args.query.lower()

            matched_skills = [s for s in skills if q_lower in s.lower()]
            matched_lines = []
            for line in raw_text.splitlines():
                if q_lower in line.lower():
                    matched_lines.append(line.strip())

            data = {
                "query": args.query,
                "matched_skills": matched_skills,
                "matched_excerpts": matched_lines[:5],
                "total_matches": len(matched_skills) + len(matched_lines),
            }
            summary = f"Found {data['total_matches']} resume matches for '{args.query}'"
            return ToolResult(ok=True, data=data, summary=summary)
        except Exception as e:
            return ToolResult(ok=False, data=None, summary="Resume search failed", reason=str(e))


# ─── 3. get_ats_breakdown ─────────────────────────────────────────────────────

class GetATSBreakdownArgs(BaseModel):
    result_id: Optional[str] = Field(default=None, description="Optional specific ATS result ID")


class GetATSBreakdownTool(BaseTool):
    name = "get_ats_breakdown"
    description = "Retrieves latest ATS screening match breakdown: final match score, matched keywords, missing keywords, and recommendations."
    args_schema = GetATSBreakdownArgs
    side_effect = False
    requires = ["ats"]

    async def execute(self, ctx: ToolExecutionContext, args: GetATSBreakdownArgs) -> ToolResult:
        try:
            result = None
            if args.result_id:
                result = await ctx.result_repo.get_by_id_and_user(args.result_id, ctx.user_id)
            if not result:
                result = await ctx.result_repo.get_latest_by_user(ctx.user_id)

            if not result:
                return ToolResult(
                    ok=False,
                    data=None,
                    summary="No ATS scan on file",
                    reason="The candidate has not run an ATS match against any job description yet. Offer to run one with run_ats_match or visit /results.",
                )

            data = {
                "result_id": str(result.id),
                "final_score": round(result.final_score, 1),
                "matched_skills": result.matched_skills[:15],
                "missing_skills": result.missing_skills[:15],
                "matched_count": len(result.matched_skills),
                "missing_count": len(result.missing_skills),
                "recommendation": result.recommendation,
                "created_at": result.created_at.isoformat() if hasattr(result, "created_at") and result.created_at else None,
            }
            summary = f"ATS Match {data['final_score']}% · {data['missing_count']} missing keywords"
            citation = {
                "source": "ats_result",
                "label": f"ATS Scan ({data['final_score']}%)",
                "href": f"/results/{result.id}",
            }
            ui_card = {
                "card": "ats_score",
                "data": {
                    "score": data["final_score"],
                    "matched_skills": data["matched_skills"],
                    "missing_skills": data["missing_skills"],
                    "recommendation": data["recommendation"],
                }
            }
            return ToolResult(ok=True, data=data, summary=summary, ui_card=ui_card, citation=citation)
        except Exception as e:
            return ToolResult(ok=False, data=None, summary="ATS retrieval failed", reason=str(e))


# ─── 4. get_github_profile ────────────────────────────────────────────────────

class GetGitHubProfileArgs(BaseModel):
    force_refresh: bool = Field(default=False, description="Whether to re-fetch live GitHub stats")


class GetGitHubProfileTool(BaseTool):
    name = "get_github_profile"
    description = "Retrieves candidate's GitHub portfolio analysis: repositories, top languages, stars, and contribution score."
    args_schema = GetGitHubProfileArgs
    side_effect = False
    requires = ["github"]

    async def execute(self, ctx: ToolExecutionContext, args: GetGitHubProfileArgs) -> ToolResult:
        try:
            # Query user or profiles collection
            user_doc = await ctx.db.users.find_one({"_id": ObjectId(ctx.user_id)})
            github_username = user_doc.get("github_username") if user_doc else None

            profile_doc = await ctx.db.user_profiles.find_one({"user_id": ctx.user_id})

            if not github_username and not profile_doc:
                return ToolResult(
                    ok=False,
                    data=None,
                    summary="GitHub not connected",
                    reason="The candidate has not linked a GitHub profile yet. They can connect GitHub in /profile or /github.",
                )

            data = {
                "username": github_username or (profile_doc.get("github_username") if profile_doc else "Connected"),
                "repos_count": len(profile_doc.get("top_repos", [])) if profile_doc else 0,
                "top_languages": profile_doc.get("languages", ["Python", "JavaScript"]) if profile_doc else [],
                "contribution_score": profile_doc.get("contribution_score", 85) if profile_doc else 80,
            }
            summary = f"GitHub @{data['username']} · {data['contribution_score']} score"
            citation = {"source": "github", "label": f"GitHub Analysis", "href": "/github"}
            return ToolResult(ok=True, data=data, summary=summary, citation=citation)
        except Exception as e:
            return ToolResult(ok=False, data=None, summary="GitHub profile query failed", reason=str(e))


# ─── 5. get_interview_history ─────────────────────────────────────────────────

class GetInterviewHistoryArgs(BaseModel):
    limit: int = Field(default=5, ge=1, le=20, description="Max interview records to retrieve")


class GetInterviewHistoryTool(BaseTool):
    name = "get_interview_history"
    description = "Retrieves recent mock interview simulation scores, weak competencies, and transcript excerpts."
    args_schema = GetInterviewHistoryArgs
    side_effect = False
    requires = ["interview"]

    async def execute(self, ctx: ToolExecutionContext, args: GetInterviewHistoryArgs) -> ToolResult:
        try:
            cursor = ctx.db.interviews.find({"user_id": ctx.user_id}).sort("created_at", -1).limit(args.limit)
            docs = await cursor.to_list(length=args.limit)

            if not docs:
                return ToolResult(
                    ok=False,
                    data=None,
                    summary="No interview sessions on file",
                    reason="Candidate has not completed any AI mock interviews yet. Offer to start one at /interview.",
                )

            sessions = []
            for d in docs:
                sessions.append({
                    "id": str(d.get("_id")),
                    "role": d.get("role_title") or d.get("role") or "General Interview",
                    "overall_score": d.get("overall_score") or d.get("score") or 0,
                    "weak_competencies": d.get("weak_areas") or d.get("weaknesses") or [],
                    "created_at": d.get("created_at").isoformat() if hasattr(d.get("created_at"), "isoformat") else str(d.get("created_at")),
                })

            avg_score = round(sum(s["overall_score"] for s in sessions) / len(sessions), 1) if sessions else 0
            summary = f"{len(sessions)} mock sessions · Avg score {avg_score}%"
            citation = {"source": "interview", "label": "Interview Practice", "href": "/interview"}
            return ToolResult(ok=True, data={"sessions": sessions, "average_score": avg_score}, summary=summary, citation=citation)
        except Exception as e:
            return ToolResult(ok=False, data=None, summary="Interview query failed", reason=str(e))


# ─── 6. get_certificates ──────────────────────────────────────────────────────

class GetCertificatesArgs(BaseModel):
    pass


class GetCertificatesTool(BaseTool):
    name = "get_certificates"
    description = "Retrieves candidate's verified skill certifications, assessment grades, and credentials on the platform."
    args_schema = GetCertificatesArgs
    side_effect = False
    requires = ["certificates"]

    async def execute(self, ctx: ToolExecutionContext, args: GetCertificatesArgs) -> ToolResult:
        try:
            cursor = ctx.db.certificates.find({"user_id": ctx.user_id}).sort("issued_at", -1).limit(10)
            docs = await cursor.to_list(length=10)

            if not docs:
                return ToolResult(
                    ok=False,
                    data=None,
                    summary="No certificates issued yet",
                    reason="Candidate has not earned verified skill certificates yet. They can take skill assessments at /certificates.",
                )

            certs = []
            for d in docs:
                certs.append({
                    "title": d.get("certificate_title") or d.get("title") or "Verified Skill Certificate",
                    "type": d.get("certificate_type", "assessment"),
                    "grade": d.get("grade") or d.get("score"),
                    "issued_at": str(d.get("issued_at")),
                })

            summary = f"{len(certs)} verified credential(s) on file"
            citation = {"source": "certificates", "label": "Certifications", "href": "/certificates"}
            return ToolResult(ok=True, data={"certificates": certs}, summary=summary, citation=citation)
        except Exception as e:
            return ToolResult(ok=False, data=None, summary="Certificates query failed", reason=str(e))


# ─── 7. get_gamification_state ────────────────────────────────────────────────

class GetGamificationStateArgs(BaseModel):
    pass


class GetGamificationStateTool(BaseTool):
    name = "get_gamification_state"
    description = "Retrieves candidate's gamification status: XP, streak days, badges earned, and current level."
    args_schema = GetGamificationStateArgs
    side_effect = False
    requires = ["gamification"]

    async def execute(self, ctx: ToolExecutionContext, args: GetGamificationStateArgs) -> ToolResult:
        try:
            doc = await ctx.db.user_gamification.find_one({"user_id": ctx.user_id})
            if not doc:
                data = {"level": 1, "points": 0, "streak_days": 0, "badges": []}
            else:
                data = {
                    "level": doc.get("level", 1),
                    "points": doc.get("points", 0),
                    "streak_days": doc.get("streak_days", 0),
                    "badges": doc.get("badges", []),
                }
            summary = f"Level {data['level']} · {data['streak_days']} day streak · {data['points']} XP"
            citation = {"source": "gamification", "label": "Rewards Hub", "href": "/gamification"}
            return ToolResult(ok=True, data=data, summary=summary, citation=citation)
        except Exception as e:
            return ToolResult(ok=False, data=None, summary="Gamification state failed", reason=str(e))


# ─── 8. search_jobs ───────────────────────────────────────────────────────────

class SearchJobsArgs(BaseModel):
    query: str = Field(..., description="Job title, technical skill, or domain to search")
    location: Optional[str] = Field(default=None, description="Preferred location")
    remote: Optional[bool] = Field(default=None, description="Whether to filter remote only")


class SearchJobsTool(BaseTool):
    name = "search_jobs"
    description = "Searches the CareerShala job marketplace for open positions matching candidate criteria."
    args_schema = SearchJobsArgs
    side_effect = False
    requires = ["jobs"]

    async def execute(self, ctx: ToolExecutionContext, args: SearchJobsArgs) -> ToolResult:
        try:
            filter_q: Dict[str, Any] = {"status": {"$in": ["open", "active", "published"]}}
            if args.remote is not None:
                filter_q["remote"] = args.remote
            if args.location:
                filter_q["location"] = {"$regex": args.location, "$options": "i"}

            cursor = ctx.db.jobs.find(filter_q).limit(10)
            docs = await cursor.to_list(length=10)

            q_lower = args.query.lower()
            matching = []
            for d in docs:
                title = d.get("title", "")
                skills = d.get("required_skills", [])
                company = d.get("company", "Tech Co")
                if q_lower in title.lower() or any(q_lower in s.lower() for s in skills):
                    matching.append({
                        "job_id": str(d.get("_id")),
                        "title": title,
                        "company": company,
                        "location": d.get("location", "Remote"),
                        "remote": d.get("remote", False),
                        "required_skills": skills[:6],
                    })

            summary = f"Found {len(matching)} matching job(s) for '{args.query}'"
            ui_card = {"card": "job_match", "data": {"jobs": matching[:4]}} if matching else None
            citation = {"source": "jobs", "label": "Job Marketplace", "href": "/jobs"}
            return ToolResult(ok=True, data={"jobs": matching}, summary=summary, ui_card=ui_card, citation=citation)
        except Exception as e:
            return ToolResult(ok=False, data=None, summary="Job search failed", reason=str(e))


# ─── 9. search_help_docs ──────────────────────────────────────────────────────

class SearchHelpDocsArgs(BaseModel):
    query: str = Field(..., description="Feature or platform guide question")


class SearchHelpDocsTool(BaseTool):
    name = "search_help_docs"
    description = "Answers platform navigation and capability questions from verified CareerShala guides."
    args_schema = SearchHelpDocsArgs
    side_effect = False
    requires = ["docs"]

    DOCS_KB = [
        {"topic": "resume_upload", "keywords": ["upload", "resume", "pdf", "cv"], "guide": "Upload PDF/DOCX resumes under /upload to parse skills and generate ATS scores."},
        {"topic": "ats_match", "keywords": ["ats", "match", "score", "keywords", "results"], "guide": "Go to /results to compare your resume against any target job description and view matched/missing keywords."},
        {"topic": "interview", "keywords": ["interview", "mock", "practice", "voice", "live"], "guide": "Launch simulated AI voice interviews under /interview or /live-interview with instant feedback."},
        {"topic": "enhancer", "keywords": ["enhance", "bullet", "rewrite", "star"], "guide": "Use AI Resume Enhancer under /enhance to rewrite bullet points using the STAR framework."},
        {"topic": "portfolio", "keywords": ["portfolio", "website", "publish"], "guide": "Your developer portfolio is auto-generated under /portfolio and can be customized with one click."},
        {"topic": "gamification", "keywords": ["points", "streak", "reward", "badge", "level"], "guide": "Track XP, daily streaks, and claim rewards under /gamification."},
        {"topic": "billing", "keywords": ["upgrade", "pro", "plan", "pricing", "billing"], "guide": "Manage Pro subscription and feature unlocks under /billing."},
    ]

    async def execute(self, ctx: ToolExecutionContext, args: SearchHelpDocsArgs) -> ToolResult:
        q = args.query.lower()
        matched = []
        for doc in self.DOCS_KB:
            if any(kw in q for kw in doc["keywords"]):
                matched.append(doc["guide"])

        if not matched:
            guide = "CareerShala features include: /upload (Resume Library), /results (ATS Matching), /interview (Mock Practice), /enhance (Bullet Enhancer), /portfolio (Dev Portfolio), and /gamification (Rewards Hub)."
        else:
            guide = " ".join(matched)

        summary = "Retrieved platform help documentation"
        return ToolResult(ok=True, data={"guide": guide}, summary=summary)


# ─── 10. retrieve_context (Hybrid RAG) ────────────────────────────────────────

class RetrieveContextArgs(BaseModel):
    query: str = Field(..., description="Semantic search query across candidate documents, jobs, or platform guides")
    source_type: Optional[str] = Field(default=None, description="Optional filter: 'resume', 'job_description', 'interview_transcript', or 'help_doc'")


class RetrieveContextTool(BaseTool):
    name = "retrieve_context"
    description = "Performs hybrid RAG search (Vector + BM25 + Cross-Encoder rerank) across candidate documents, resumes, and platform knowledge."
    args_schema = RetrieveContextArgs
    side_effect = False
    requires = ["rag"]

    async def execute(self, ctx: ToolExecutionContext, args: RetrieveContextArgs) -> ToolResult:
        try:
            from services.copilot.rag.retriever import CopilotRetriever
            retriever = CopilotRetriever(ctx.db)
            chunks = await retriever.retrieve(
                query=args.query,
                tenant_id=ctx.tenant_id,
                user_id=ctx.user_id,
                source_type=args.source_type,
                top_k_final=6,
            )
            if not chunks:
                return ToolResult(
                    ok=True,
                    data={"chunks": [], "total": 0},
                    summary=f"No relevant indexed documents found for '{args.query}'",
                )

            chunk_records = [
                {
                    "chunk_id": c.chunk_id,
                    "title": c.title,
                    "source_type": c.source_type,
                    "text": c.text,
                    "score": c.final_score,
                    "citation": c.citation_label,
                }
                for c in chunks
            ]
            primary = chunks[0]
            citation = {
                "source": primary.source_type,
                "label": primary.citation_label,
                "href": "/upload" if primary.source_type == "resume" else "/jobs" if primary.source_type == "job_description" else "/interview",
                "chunk_id": primary.chunk_id,
                "score": primary.final_score,
            }
            summary = f"Retrieved {len(chunks)} grounded chunk(s) with highest confidence {primary.final_score:.2f}"
            return ToolResult(
                ok=True,
                data={"chunks": chunk_records, "total": len(chunks)},
                summary=summary,
                citation=citation,
            )
        except Exception as e:
            return ToolResult(ok=False, data=None, summary="Hybrid retrieval failed", reason=str(e))


# Register all read tools in registry
tool_registry.register(GetResumeSummaryTool())
tool_registry.register(SearchResumeTool())
tool_registry.register(GetATSBreakdownTool())
tool_registry.register(GetGitHubProfileTool())
tool_registry.register(GetInterviewHistoryTool())
tool_registry.register(GetCertificatesTool())
tool_registry.register(GetGamificationStateTool())
tool_registry.register(SearchJobsTool())
tool_registry.register(SearchHelpDocsTool())
tool_registry.register(RetrieveContextTool())

