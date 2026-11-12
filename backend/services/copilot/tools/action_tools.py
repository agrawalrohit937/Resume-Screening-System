"""
Copilot Action Tools (With side_effect=True)
===========================================
6 action tools producing structured directives and generative UI cards:
- run_ats_match
- enhance_bullets
- generate_interview_questions
- build_learning_roadmap
- draft_outreach_email
- navigate (replaces direct_commands dict)
"""

import re
from typing import List, Optional
from pydantic import BaseModel, Field
import structlog

from services.copilot.context import ToolExecutionContext
from services.copilot.registry import BaseTool, ToolResult, tool_registry

logger = structlog.get_logger(__name__)


# ─── 1. run_ats_match ─────────────────────────────────────────────────────────

class RunATSMatchArgs(BaseModel):
    job_description: str = Field(..., min_length=20, description="Full job description text to evaluate against")
    resume_id: Optional[str] = Field(default=None, description="Optional resume ID; uses latest if omitted")


class RunATSMatchTool(BaseTool):
    name = "run_ats_match"
    description = "Runs an ATS match calculation comparing candidate's resume against a target job description, returning match percentage and missing skills."
    args_schema = RunATSMatchArgs
    side_effect = True
    requires = ["resume", "ats"]

    async def execute(self, ctx: ToolExecutionContext, args: RunATSMatchArgs) -> ToolResult:
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
                    summary="No resume on file to evaluate",
                    reason="Please upload a resume first under /upload before running an ATS match.",
                )

            resume_skills = list(resume.skills or [])
            resume_text = getattr(resume, "raw_text", "") or (" ".join(resume_skills) if resume_skills else resume.filename)
            jd_text = args.job_description

            calculated_score = None
            matched_skills = []
            missing_skills = []
            recommendation = "Needs skill optimization"

            # 1. Use the real ATS Scoring Engine whenever available
            try:
                from services.scoring_engine import score_resume
                scoring_result = score_resume(resume_text, jd_text)
                if scoring_result:
                    raw_score = scoring_result.get("final_score") or scoring_result.get("quality_score") or scoring_result.get("recruiter_score")
                    if raw_score is not None:
                        calculated_score = round(float(raw_score), 1)
                    matched_skills = list(scoring_result.get("matched_skills") or [])
                    missing_skills = list(scoring_result.get("missing_skills") or [])
                    recommendation = scoring_result.get("recommendation") or ("Good match" if (calculated_score or 0) >= 70 else "Needs skill optimization")
            except Exception as score_err:
                logger.debug("Scoring engine fallback engaged", error=str(score_err))

            # 2. Resilient fallback: dynamic skill overlap without static hardcoded lists
            if calculated_score is None:
                jd_lower = jd_text.lower()
                matched_skills = [s for s in resume_skills if s.lower() in jd_lower]
                # Extract potential terms from JD matching title/word patterns
                jd_terms = [t.title() for t in set(re.findall(r"\b[A-Za-z][A-Za-z0-9+#.]{1,20}\b", jd_text)) if len(t) > 2]
                candidate_lower = {s.lower() for s in resume_skills}
                missing_skills = [t for t in jd_terms[:8] if t.lower() not in candidate_lower and t.lower() in jd_lower][:5]

                total_evaluated = max(len(matched_skills) + len(missing_skills), 1)
                calculated_score = round(min(100.0, max(25.0, (len(matched_skills) / total_evaluated) * 100)), 1)
                recommendation = "Good match" if calculated_score >= 70 else "Needs skill optimization"

            data = {
                "final_score": calculated_score,
                "matched_skills": matched_skills,
                "missing_skills": missing_skills,
                "resume_filename": resume.original_filename or resume.filename,
            }
            summary = f"Match calculated: {calculated_score}% ({len(missing_skills)} missing keywords)"
            ui_card = {
                "card": "ats_score",
                "data": {
                    "score": calculated_score,
                    "matched_skills": matched_skills,
                    "missing_skills": missing_skills,
                    "recommendation": recommendation,
                }
            }
            citation = {"source": "ats_eval", "label": f"Live ATS Evaluation ({calculated_score}%)", "href": "/results"}
            return ToolResult(ok=True, data=data, summary=summary, ui_card=ui_card, citation=citation)
        except Exception as e:
            logger.error("run_ats_match failed", error=str(e))
            return ToolResult(ok=False, data=None, summary="ATS evaluation failed", reason=str(e))


# ─── 2. enhance_bullets ───────────────────────────────────────────────────────

class EnhanceBulletsArgs(BaseModel):
    bullets: List[str] = Field(..., min_length=1, description="List of bullet points to rewrite using STAR methodology")
    target_role: Optional[str] = Field(default=None, description="Target job title or specialization")


class EnhanceBulletsTool(BaseTool):
    name = "enhance_bullets"
    description = "Rewrites weak resume bullet points into high-impact STAR statements with measurable metrics and action verbs."
    args_schema = EnhanceBulletsArgs
    side_effect = True
    requires = ["resume"]

    async def execute(self, ctx: ToolExecutionContext, args: EnhanceBulletsArgs) -> ToolResult:
        rewritten = []
        action_verbs = ["Architected", "Engineered", "Spearheaded", "Optimized", "Delivered", "Automated"]

        for idx, original in enumerate(args.bullets[:5]):
            verb = action_verbs[idx % len(action_verbs)]
            role_hint = f" for {args.target_role}" if args.target_role else ""
            cleaned = original.strip().rstrip(".")
            if not cleaned.lower().startswith(("managed", "worked", "helped", "developed", "built", "created")):
                enhanced = f"{verb} {cleaned}{role_hint}, improving [measurable outcome] through [specific action]."
            else:
                words = cleaned.split(" ", 1)
                remainder = words[1] if len(words) > 1 else cleaned
                enhanced = f"{verb} {remainder}{role_hint}, delivering [measurable outcome] by [specific method]."

            rewritten.append({"original": original, "enhanced": enhanced})

        summary = f"Enhanced {len(rewritten)} bullet(s) with STAR metrics"
        ui_card = {"card": "bullet_diff", "data": {"diffs": rewritten}}
        return ToolResult(ok=True, data={"rewritten": rewritten}, summary=summary, ui_card=ui_card)


# ─── 3. generate_interview_questions ─────────────────────────────────────────

class GenerateInterviewQuestionsArgs(BaseModel):
    role: str = Field(..., description="Target role (e.g. 'Backend Engineer', 'Product Manager')")
    difficulty: str = Field(default="mid", description="'junior', 'mid', or 'senior'")
    focus_area: Optional[str] = Field(default=None, description="Focus area such as 'System Design', 'Algorithms', 'Behavioral'")


class GenerateInterviewQuestionsTool(BaseTool):
    name = "generate_interview_questions"
    description = "Generates targeted interview practice questions with criteria and expected answers."
    args_schema = GenerateInterviewQuestionsArgs
    side_effect = True
    requires = ["interview"]

    async def execute(self, ctx: ToolExecutionContext, args: GenerateInterviewQuestionsArgs) -> ToolResult:
        focus = args.focus_area or f"{args.role} Architecture & Problem Solving"
        questions = [
            {
                "id": "q1",
                "question": f"How do you design a resilient, high-throughput service for a {args.role} system under peak loads?",
                "category": focus,
                "difficulty": args.difficulty.title(),
                "eval_criteria": "Scalability, caching strategies, rate-limiting, and graceful degradation.",
            },
            {
                "id": "q2",
                "question": f"Describe a complex production incident you resolved in a {args.role} role. What was your root cause analysis methodology?",
                "category": "Behavioral / Incident Response",
                "difficulty": args.difficulty.title(),
                "eval_criteria": "Structured debugging, post-mortem rigor, team communication under pressure.",
            },
            {
                "id": "q3",
                "question": f"What are the critical data modeling, reliability, and security trade-offs you prioritize when building {args.role} solutions?",
                "category": "System Design & Data Architecture",
                "difficulty": args.difficulty.title(),
                "eval_criteria": "ACID compliance vs eventual consistency, index strategies, API contract security.",
            }
        ]
        summary = f"Generated {len(questions)} {args.difficulty} interview questions for {args.role}"
        ui_card = {
            "card": "interview_questions",
            "data": {
                "role": args.role,
                "difficulty": args.difficulty,
                "questions": questions,
                "practice_route": "/live-interview",
            }
        }
        citation = {"source": "interview", "label": "Start Live Voice Practice", "href": "/live-interview"}
        return ToolResult(ok=True, data={"questions": questions}, summary=summary, ui_card=ui_card, citation=citation)


# ─── 4. build_learning_roadmap ────────────────────────────────────────────────

class BuildLearningRoadmapArgs(BaseModel):
    gap_skills: List[str] = Field(..., min_length=1, description="List of technical skills to build a curriculum for")
    weeks: int = Field(default=4, ge=2, le=12, description="Target timeline duration in weeks")


class BuildLearningRoadmapTool(BaseTool):
    name = "build_learning_roadmap"
    description = "Builds a structured week-by-week learning roadmap with project milestones to close candidate skill gaps."
    args_schema = BuildLearningRoadmapArgs
    side_effect = True
    requires = ["ats"]

    async def execute(self, ctx: ToolExecutionContext, args: BuildLearningRoadmapArgs) -> ToolResult:
        milestones = []
        skills_count = len(args.gap_skills)

        deliverable_templates = [
            "Master core concepts, syntax, and foundational patterns for {skill}.",
            "Build a hands-on functional prototype or service integrating {skill}.",
            "Implement automated unit and integration tests with CI/CD for {skill}.",
            "Optimize latency, memory efficiency, and concurrency with {skill}.",
            "Deploy to cloud staging with structured observability and monitoring.",
            "Complete an end-to-end portfolio-grade capstone project utilizing {skill}."
        ]

        for week in range(1, args.weeks + 1):
            skill = args.gap_skills[(week - 1) % skills_count]
            template = deliverable_templates[(week - 1) % len(deliverable_templates)]
            milestones.append({
                "week": week,
                "focus": skill,
                "deliverable": template.format(skill=skill),
                "verified": False,
            })

        summary = f"Constructed {args.weeks}-week roadmap covering {', '.join(args.gap_skills[:3])}"
        ui_card = {
            "card": "roadmap",
            "data": {
                "weeks": args.weeks,
                "skills": args.gap_skills,
                "milestones": milestones,
            }
        }
        return ToolResult(ok=True, data={"milestones": milestones}, summary=summary, ui_card=ui_card)


# ─── 5. draft_outreach_email ──────────────────────────────────────────────────

class DraftOutreachEmailArgs(BaseModel):
    job_id: Optional[str] = Field(default=None, description="Optional job ID to tailor email for")
    jd_text: Optional[str] = Field(default=None, description="Job description text")
    company_name: Optional[str] = Field(default=None, description="Company name")


class DraftOutreachEmailTool(BaseTool):
    name = "draft_outreach_email"
    description = "Drafts a personalized recruiter outreach email tailored to a target role and company."
    args_schema = DraftOutreachEmailArgs
    side_effect = True
    requires = ["resume"]

    async def execute(self, ctx: ToolExecutionContext, args: DraftOutreachEmailArgs) -> ToolResult:
        company = args.company_name or "the engineering team"
        role_label = f"{args.job_id} role" if args.job_id else "engineering opening"
        subject = f"Application: {ctx.user_name} — Impactful Contribution to {company}"
        body = (
            f"Dear Hiring Team at {company},\n\n"
            f"I came across the {role_label} at {company} and was energized by your team's technical vision. "
            f"With proven hands-on experience designing reliable systems, optimizing latency, and shipping customer-focused software, "
            f"I am confident I can immediately contribute to your engineering objectives.\n\n"
            f"I have attached my verified resume and portfolio for your review. Would you be open to a brief 10-minute introductory conversation this week?\n\n"
            f"Best regards,\n{ctx.user_name}"
        )

        data = {"subject": subject, "body": body, "company": company, "role_context": role_label}
        summary = f"Drafted tailored recruiter outreach message for {company}"
        return ToolResult(ok=True, data=data, summary=summary)


# ─── 6. navigate ──────────────────────────────────────────────────────────────

class NavigateArgs(BaseModel):
    route: str = Field(..., description="Target application route (e.g. '/interview', '/results', '/upload')")
    reason: str = Field(..., description="Human explanation of why this page is being opened")


class NavigateTool(BaseTool):
    name = "navigate"
    description = "Directs the candidate to any section of CareerShala (e.g. /interview, /results, /enhance, /github, /portfolio, /billing)."
    args_schema = NavigateArgs
    side_effect = True
    requires = []

    VALID_ROUTES = {
        "/interview": "Interview Practice Center",
        "/live-interview": "Live AI Voice Interview",
        "/results": "ATS Matcher & Results",
        "/upload": "Resume Library",
        "/enhance": "AI Resume Enhancer",
        "/github": "GitHub Analysis",
        "/fake-detect": "Authenticity Verification",
        "/gamification": "Rewards Hub",
        "/billing": "Billing & Subscriptions",
        "/profile": "Account Profile",
        "/dashboard": "Career Dashboard",
        "/portfolio": "Developer Portfolio",
        "/certificates": "Verified Certifications",
        "/jobs": "Job Marketplace",
    }

    async def execute(self, ctx: ToolExecutionContext, args: NavigateArgs) -> ToolResult:
        normalized_route = args.route.strip()
        if not normalized_route.startswith("/"):
            normalized_route = f"/{normalized_route}"

        route_label = self.VALID_ROUTES.get(normalized_route, normalized_route)
        summary = f"Navigating to {route_label}"
        data = {"route": normalized_route, "reason": args.reason, "label": route_label}
        citation = {"source": "navigation", "label": f"Go to {route_label}", "href": normalized_route}
        return ToolResult(ok=True, data=data, summary=summary, citation=citation)


# Register all action tools in registry
tool_registry.register(RunATSMatchTool())
tool_registry.register(EnhanceBulletsTool())
tool_registry.register(GenerateInterviewQuestionsTool())
tool_registry.register(BuildLearningRoadmapTool())
tool_registry.register(DraftOutreachEmailTool())
tool_registry.register(NavigateTool())
