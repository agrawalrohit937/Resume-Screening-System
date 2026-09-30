"""
Live Interview Service — session CRUD + AI question generation + cheating processing
"""
import uuid
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Any

import structlog
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.interview_session_model import (
    InterviewSession, SessionStatus, CheatingEventRecord, QuestionAnswer,
    DifficultyLevel, CheatingEventType,
)
from services.ai_interview_service import AIInterviewService

logger = structlog.get_logger(__name__)
_ai_svc = AIInterviewService()

# ── Cheating event weights ────────────────────────────────────────────────────
CHEATING_WEIGHTS = {
    CheatingEventType.TAB_SWITCH:       0.15,
    CheatingEventType.FACE_MISSING:     0.10,
    CheatingEventType.MULTIPLE_FACES:   0.22,
    CheatingEventType.LOOKING_AWAY:     0.06,
    CheatingEventType.LOOKING_DOWN:     0.15,
    CheatingEventType.PHONE_DETECTED:   0.18,
    CheatingEventType.COPY_PASTE:       0.20,
    CheatingEventType.DEVTOOLS_OPEN:    0.25,
    CheatingEventType.WINDOW_BLUR:      0.08,
}

SEVERITY_MULT = { "low": 0.5, "medium": 1.0, "high": 1.6, "critical": 2.5 }

# ── Question Bank ─────────────────────────────────────────────────────────────
QUESTION_BANK = {
    "technical": {
        "easy": [
            {"text": "What is the difference between a stack and a queue? Give a real-world example.", "category": "technical"},
            {"text": "Explain what REST APIs are and why they're used.", "category": "technical"},
            {"text": "What is the difference between SQL and NoSQL databases?", "category": "technical"},
            {"text": "Explain the concept of version control and why Git is important.", "category": "technical"},
        ],
        "medium": [
            {"text": "Explain how you would design a URL shortener service. Walk through the architecture.", "category": "technical"},
            {"text": "What is the CAP theorem and how does it affect distributed system design?", "category": "technical"},
            {"text": "Describe the difference between horizontal and vertical scaling, and when you'd choose each.", "category": "technical"},
            {"text": "How would you optimize a slow SQL query? Walk through your debugging process.", "category": "technical"},
            {"text": "What are microservices? What are their advantages and drawbacks compared to monoliths?", "category": "technical"},
        ],
        "hard": [
            {"text": "Design a rate limiting system that handles 1M requests per second. Explain your data structures and tradeoffs.", "category": "technical"},
            {"text": "How would you implement distributed caching to reduce database load by 80%? What invalidation strategy would you use?", "category": "technical"},
            {"text": "Walk me through designing a real-time notification system for 10M users. Address consistency and fault tolerance.", "category": "technical"},
            {"text": "Explain consensus algorithms in distributed systems. When would you use Raft vs Paxos?", "category": "technical"},
        ],
    },
    "behavioral": {
        "easy": [
            {"text": "Tell me about yourself and why you're interested in this role.", "category": "behavioral"},
            {"text": "Describe a time you had to learn a new skill quickly. How did you approach it?", "category": "behavioral"},
        ],
        "medium": [
            {"text": "Tell me about a time you had a major conflict with a colleague. How did you resolve it?", "category": "behavioral"},
            {"text": "Describe the most challenging project you've worked on. What made it difficult and how did you overcome it?", "category": "behavioral"},
            {"text": "Give an example of when you had to make a decision with incomplete information. What was the outcome?", "category": "behavioral"},
            {"text": "Tell me about a time you failed at something important. What did you learn?", "category": "behavioral"},
        ],
        "hard": [
            {"text": "Describe a time you had to influence a decision without having authority. What was your strategy?", "category": "behavioral"},
            {"text": "Tell me about leading a team through a major technical crisis. How did you prioritize and communicate?", "category": "behavioral"},
        ],
    },
    "situational": {
        "medium": [
            {"text": "You discover a critical security vulnerability in production 2 hours before a major product launch. What do you do?", "category": "situational"},
            {"text": "Your team is 3 weeks behind on a 2-month project and the deadline is non-negotiable. How do you handle this?", "category": "situational"},
            {"text": "A senior engineer disagrees with your technical approach and escalates to your manager. How do you respond?", "category": "situational"},
        ],
        "hard": [
            {"text": "You're asked to cut your team's project timeline by 40% without reducing scope. What's your plan?", "category": "situational"},
            {"text": "You notice your manager is making a strategic decision based on incorrect data. How do you handle it?", "category": "situational"},
        ],
    },
}


class LiveInterviewService:

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.col = db.live_interview_sessions

    # ── Create session (AI questions) ─────────────────────────────────────────
    async def create_session(
        self,
        user_id:        str,
        job_title:      str,
        difficulty:     str,
        interview_type: str,
        num_questions:  int = 8,
        resume_skills:  Optional[List[str]] = None,
        experience_years: Optional[float] = None,
        experience_titles: Optional[List[str]] = None,
    ) -> Dict:
        # Try AI generation first, fall back to static bank
        questions = await self._generate_ai_questions(
            job_title=job_title,
            difficulty=difficulty,
            interview_type=interview_type,
            num_questions=num_questions,
            resume_skills=resume_skills,
            experience_years=experience_years,
            experience_titles=experience_titles,
        )

        session_id = str(uuid.uuid4())
        doc = {
            "_id": session_id,
            "user_id": user_id,
            "job_title": job_title,
            "difficulty": difficulty,
            "interview_type": interview_type,
            "status": SessionStatus.PENDING,
            "questions": questions,
            "answers": [],
            "cheating_events": [],
            "cheating_score": 0.0,
            "warning_count": 0,
            "session_aborted": False,
            "overall_score": None,
            "started_at": None,
            "completed_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await self.col.insert_one(doc)
        return {"session_id": session_id, "questions": questions, "total_questions": len(questions)}

    # ── AI Question Generation ────────────────────────────────────────────────
    async def _generate_ai_questions(
        self,
        job_title: str,
        difficulty: str,
        interview_type: str,
        num_questions: int = 10,
        resume_skills: Optional[List[str]] = None,
        experience_years: Optional[float] = None,
        experience_titles: Optional[List[str]] = None,
        full_job_description: Optional[str] = None,
        custom_questions: Optional[List[str]] = None,
        candidate_summary: Optional[str] = None,
        candidate_projects: Optional[List[str]] = None,
    ) -> List[Dict]:
        """Generate AI questions via Groq with 5 Resume + 5 JD + Custom questions structure."""
        try:
            skills = resume_skills or []
            exp_years = experience_years or 0
            titles = experience_titles or []
            custom_qs = [q.strip() for q in (custom_questions or []) if q and q.strip()]

            prompt = self._build_live_interview_prompt(
                job_title=job_title,
                difficulty=difficulty,
                interview_type=interview_type,
                num_questions=num_questions,
                skills=skills,
                exp_years=exp_years,
                experience_titles=titles,
                full_job_description=full_job_description,
                custom_questions=custom_qs,
                candidate_summary=candidate_summary,
                candidate_projects=candidate_projects,
            )

            raw = await _ai_svc._call_llm(prompt, max_tokens=3500)
            if not raw:
                raise ValueError("LLM returned empty response")

            import json, re
            # Parse JSON from LLM output
            clean = raw.replace("```json", "").replace("```", "").strip()
            try:
                data = json.loads(clean)
            except json.JSONDecodeError:
                match = re.search(r'\{.*"questions".*\}', raw, re.DOTALL)
                data = json.loads(match.group(0)) if match else None

            if not data or "questions" not in data:
                raise ValueError("Could not parse LLM questions JSON")

            ai_questions = []
            for i, q in enumerate(data["questions"][:num_questions]):
                ai_questions.append({
                    "id": i + 1,
                    "text": q.get("question", ""),
                    "category": q.get("category", "General"),
                    "difficulty": difficulty,
                    "ideal_answer": q.get("ideal_answer", ""),
                    "type": q.get("type", "technical"),
                    "time_limit": q.get("time_limit_seconds", 120),
                })

            # Ensure any custom questions provided by the recruiter are present if LLM omitted them
            if custom_qs:
                existing_texts = [q["text"].lower() for q in ai_questions]
                for cq in custom_qs:
                    if not any(cq.lower() in et or et in cq.lower() for et in existing_texts):
                        # Prepend or insert custom question
                        ai_questions.insert(0, {
                            "id": len(ai_questions) + 1,
                            "text": cq,
                            "category": "Employer Specific",
                            "difficulty": difficulty,
                            "ideal_answer": f"Clear, structured response addressing: {cq}",
                            "type": "custom",
                            "time_limit": 150,
                        })
                # Re-index ids
                for idx, q in enumerate(ai_questions[:num_questions + len(custom_qs)]):
                    q["id"] = idx + 1
                ai_questions = ai_questions[:max(num_questions, len(custom_qs))]

            return ai_questions

        except Exception as e:
            logger.warning("AI question generation failed, using fallback", error=str(e))
            base_qs = self._pick_questions(difficulty, interview_type, num_questions)
            if custom_questions:
                custom_items = [
                    {
                        "id": len(base_qs) + i + 1,
                        "text": cq.strip(),
                        "category": "Employer Specific",
                        "difficulty": difficulty,
                        "ideal_answer": f"Clear, structured response addressing: {cq.strip()}",
                        "type": "custom",
                        "time_limit": 150,
                    }
                    for i, cq in enumerate(custom_questions) if cq and cq.strip()
                ]
                base_qs = custom_items + base_qs
                for idx, q in enumerate(base_qs):
                    q["id"] = idx + 1
            return base_qs

    def _build_live_interview_prompt(
        self,
        job_title: str,
        difficulty: str,
        interview_type: str,
        num_questions: int,
        skills: List[str],
        exp_years: float,
        experience_titles: List[str],
        full_job_description: Optional[str] = None,
        custom_questions: Optional[List[str]] = None,
        candidate_summary: Optional[str] = None,
        candidate_projects: Optional[List[str]] = None,
    ) -> str:
        type_map = {
            "technical": "Focus primarily on technical depth, coding problem solving, tools, and system architecture.",
            "behavioral": "Use STAR-format behavioral questions evaluating leadership, ownership, and collaboration.",
            "situational": "Present practical scenarios, edge cases, and architectural trade-offs.",
            "mixed": "Comprehensive blend of hands-on technical validation, past project execution, and scenario problem-solving.",
        }
        diff_map = {
            "easy": "Foundational concepts, straightforward direct questions, approachable scope.",
            "medium": "Mid-level practical depth, real-world engineering trade-offs and design.",
            "hard": "Senior-level deep dives, high-scale architectural bottlenecks, edge cases.",
        }
        
        candidate_ctx_parts = []
        if skills:
            candidate_ctx_parts.append(f"- Verified Skills / Stack: {', '.join(skills[:15])}")
        if exp_years:
            candidate_ctx_parts.append(f"- Total Experience: {exp_years} years")
        if experience_titles:
            candidate_ctx_parts.append(f"- Past Roles & Internships: {', '.join(experience_titles[:4])}")
        if candidate_projects:
            candidate_ctx_parts.append(f"- Candidate Key Projects: {'; '.join(candidate_projects[:4])}")
        if candidate_summary:
            candidate_ctx_parts.append(f"- Profile Summary: {candidate_summary[:300]}")
        
        candidate_ctx = "\n".join(candidate_ctx_parts)

        jd_section = ""
        if full_job_description and full_job_description.strip():
            jd_section = f"""
=====================================================
TARGET JOB DESCRIPTION (JD):
{full_job_description.strip()[:3500]}
=====================================================
"""

        custom_section = ""
        if custom_questions:
            formatted_cq = "\n".join(f"- {q}" for q in custom_questions if q.strip())
            if formatted_cq:
                custom_section = f"""
=====================================================
MANDATORY INTERVIEWER CUSTOM QUESTIONS:
{formatted_cq}
=====================================================
"""

        return f"""You are an elite enterprise technical interviewer and hiring architect.
Your task is to generate a structured, highly personalized interview assessment for the role: '{job_title}'.

{jd_section}
{f"CANDIDATE RESUME PROFILE:{chr(10)}{candidate_ctx}" if candidate_ctx else ""}
{custom_section}

INTERVIEW CONFIGURATION:
- Mode: {type_map.get(interview_type, type_map['mixed'])}
- Difficulty: {diff_map.get(difficulty, diff_map['medium'])}

EXACT QUESTION STRUCTURE REQUIREMENTS:
1. CATEGORY A — CANDIDATE RESUME DEEP-DIVE (EXACTLY 5 QUESTIONS):
   - Formulate 5 probing questions specifically based on the candidate's declared projects, internships, past roles, and technical tools.
   - Challenge their actual hands-on contribution, architectural decisions made in their projects, and real problems they solved during past internships/roles.
   - Set "category" to "Resume & Past Experience".

2. CATEGORY B — JOB DESCRIPTION & ROLE TECHNICAL ALIGNMENT (EXACTLY 5 QUESTIONS):
   - Formulate 5 questions derived directly from the core responsibilities, tech stack, and domain challenges outlined in the Job Description.
   - Test their readiness for this exact job's day-to-day requirements and technical bottlenecks.
   - Set "category" to "Job Role & Technical Core".

3. CATEGORY C — MANDATORY CUSTOM QUESTIONS (IF ANY PROVIDED ABOVE):
   - Include any custom interviewer questions provided in the custom section verbatim. Set "category" to "Interviewer Custom Question".

Return ONLY valid JSON (no markdown fences, no explanatory text):
{{
  "questions": [
    {{
      "id": 1,
      "type": "technical|behavioral|situational|custom",
      "category": "Resume & Past Experience | Job Role & Technical Core | Interviewer Custom Question",
      "question": "Full question text",
      "ideal_answer": "Model answer expectation (2-3 sentences)",
      "time_limit_seconds": 120
    }}
  ]
}}"""

    # ── Employer B2B Scheduling ───────────────────────────────────────────────
    async def schedule_employer_session(
        self,
        employer_id:          str,
        employer_name:        str,
        company_name:         str,
        job_id:               Optional[str],
        job_title:            str,
        full_job_description: str,
        interview_mode:       str = "mixed",
        difficulty:           str = "medium",
        custom_questions:     Optional[List[str]] = None,
        expiry_hours:         int = 48,
        candidate_email:      Optional[str] = None,
        candidate_name:       Optional[str] = None,
        application_id:       Optional[str] = None,
        num_questions:        int = 6,
    ) -> Dict:
        """Schedule an enterprise B2B live interview session from employer dashboard and generate magic token."""
        import secrets
        from datetime import timedelta
        from core.config import settings
        from services.email_service import EmailService

        custom_qs = [q.strip() for q in (custom_questions or []) if q and q.strip()]

        # Extract candidate resume data if application_id or email is available
        cand_skills = []
        cand_exp_years = 0.0
        cand_titles = []
        cand_projects = []
        cand_summary = ""

        if application_id or candidate_email:
            try:
                from bson import ObjectId
                app_doc = None
                if application_id and ObjectId.is_valid(application_id):
                    app_doc = await self.db.applications.find_one({"_id": ObjectId(application_id)})
                elif application_id:
                    app_doc = await self.db.applications.find_one({"_id": application_id})
                elif candidate_email and job_id:
                    app_doc = await self.db.applications.find_one({"candidate_email": candidate_email, "job_id": job_id})
                
                if app_doc:
                    raw_parsed = (app_doc.get("resume_snapshot") or {}).get("parsed_data") or {}
                    if not raw_parsed and app_doc.get("candidate_id"):
                        res_doc = await self.db.resumes.find_one({"user_id": app_doc["candidate_id"]})
                        raw_parsed = (res_doc or {}).get("parsed_data") or {}
                    
                    if raw_parsed:
                        cand_skills = list(raw_parsed.get("skills") or raw_parsed.get("technical_skills") or [])
                        cand_exp_years = float(raw_parsed.get("total_experience_years") or 0.0)
                        for exp in (raw_parsed.get("work_experience") or []):
                            if isinstance(exp, dict):
                                title = exp.get("title") or exp.get("role") or ""
                                comp = exp.get("company") or ""
                                if title:
                                    cand_titles.append(f"{title} at {comp}" if comp else title)
                        for prj in (raw_parsed.get("projects") or []):
                            if isinstance(prj, dict):
                                pname = prj.get("name") or prj.get("title") or ""
                                pdesc = prj.get("description") or ""
                                if pname:
                                    cand_projects.append(f"{pname}: {pdesc[:120]}" if pdesc else pname)
                            elif isinstance(prj, str) and prj.strip():
                                cand_projects.append(prj.strip()[:120])
                        cand_summary = str(raw_parsed.get("summary") or "")
            except Exception as e:
                logger.debug("Failed to fetch candidate resume context for interview questions", error=str(e))

        # Generate targeted 5 Resume + 5 JD + Custom questions
        effective_num_qs = max(num_questions or 10, 10)
        questions = await self._generate_ai_questions(
            job_title=job_title,
            difficulty=difficulty,
            interview_type=interview_mode,
            num_questions=effective_num_qs,
            resume_skills=cand_skills,
            experience_years=cand_exp_years,
            experience_titles=cand_titles,
            full_job_description=full_job_description,
            custom_questions=custom_qs,
            candidate_summary=cand_summary,
            candidate_projects=cand_projects,
        )

        session_id = str(uuid.uuid4())
        magic_token = secrets.token_urlsafe(24)
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=expiry_hours)).isoformat()
        frontend_base = settings.FRONTEND_URL.rstrip("/")
        magic_link_url = f"{frontend_base}/live-assessment/{magic_token}"

        doc = {
            "_id":                   session_id,
            "user_id":               None,  # Candidate may take anonymously or with magic token
            "job_title":             job_title,
            "difficulty":            difficulty,
            "interview_type":        interview_mode,
            "status":                SessionStatus.PENDING,
            "questions":             questions,
            "answers":               [],
            "cheating_events":       [],
            "cheating_score":        0.0,
            "warning_count":         0,
            "session_aborted":       False,
            "overall_score":         None,
            "is_employer_scheduled": True,
            "magic_token":           magic_token,
            "expires_at":            expires_at,
            "employer_id":           employer_id,
            "employer_name":         employer_name,
            "company_name":          company_name,
            "job_id":                job_id,
            "full_job_description":  full_job_description,
            "custom_questions":      custom_qs,
            "candidate_email":       candidate_email,
            "candidate_name":        candidate_name,
            "application_id":        application_id,
            "magic_link_url":        magic_link_url,
            "started_at":            None,
            "completed_at":          None,
            "created_at":            datetime.now(timezone.utc).isoformat(),
            "updated_at":            datetime.now(timezone.utc).isoformat(),
        }

        await self.col.insert_one(doc)
        logger.info("B2B Employer Live Interview scheduled", session_id=session_id, company=company_name, job=job_title, token=magic_token)

        # Send invitation email if candidate email is provided
        email_sent = False
        if candidate_email:
            try:
                email_svc = EmailService()
                mode_labels = {
                    "technical": "Technical Core",
                    "behavioral": "Behavioral Competency",
                    "situational": "Situational Judgment",
                    "mixed": "All-in-One Comprehensive Assessment",
                }
                email_sent = await email_svc.send_live_interview_invitation(
                    recipient_email=candidate_email,
                    candidate_name=candidate_name or "Candidate",
                    company_name=company_name,
                    job_title=job_title,
                    interview_mode_label=mode_labels.get(interview_mode, "Live AI Assessment"),
                    magic_link_url=magic_link_url,
                    expiry_hours=expiry_hours,
                )
            except Exception as mail_err:
                logger.warning("Failed to dispatch magic link invitation email", error=str(mail_err))

        return {
            "session_id":       session_id,
            "magic_token":      magic_token,
            "magic_link_url":   magic_link_url,
            "expires_at":       expires_at,
            "total_questions":  len(questions),
            "questions":        questions,
            "email_sent":       email_sent,
        }

    # ── Magic Token Session Lifecycle (Candidate Experience) ─────────────────
    async def get_session_by_magic_token(self, magic_token: str) -> Optional[Dict]:
        """Fetch and validate candidate assessment session using magic token."""
        doc = await self.col.find_one({"magic_token": magic_token})
        if not doc:
            return None

        # Check expiration
        is_expired = False
        expires_at_val = doc.get("expires_at")
        if expires_at_val:
            try:
                if isinstance(expires_at_val, datetime):
                    exp_dt = expires_at_val if expires_at_val.tzinfo else expires_at_val.replace(tzinfo=timezone.utc)
                else:
                    exp_dt = datetime.fromisoformat(str(expires_at_val).replace("Z", "+00:00"))
                if datetime.now(timezone.utc) > exp_dt:
                    is_expired = True
            except Exception:
                pass

        expires_at_str = expires_at_val.isoformat() if isinstance(expires_at_val, datetime) else str(expires_at_val or "")

        session_data = {
            "id":                     str(doc["_id"]),
            "job_title":              doc.get("job_title", ""),
            "company_name":           doc.get("company_name", "Hiring Organization"),
            "difficulty":             doc.get("difficulty", "medium"),
            "interview_type":         doc.get("interview_type", "mixed"),
            "status":                 doc.get("status", SessionStatus.PENDING),
            "is_employer_scheduled":  True,
            "is_expired":             is_expired,
            "expires_at":             expires_at_str,
            "candidate_name":         doc.get("candidate_name", ""),
            "candidate_email":        doc.get("candidate_email", ""),
            "total_questions":        len(doc.get("questions", [])),
            "questions": [
                {
                    "id":         q.get("id"),
                    "text":       q.get("text"),
                    "category":   q.get("category", "General"),
                    "type":       q.get("type", "technical"),
                    "time_limit": q.get("time_limit", 120),
                    "difficulty": q.get("difficulty", doc.get("difficulty", "medium")),
                }
                for q in doc.get("questions", [])
            ],
            "answers_count":          len(doc.get("answers", [])),
            "session_aborted":        doc.get("session_aborted", False),
            "abort_reason":           doc.get("abort_reason"),
            "started_at":             doc.get("started_at"),
            "completed_at":           doc.get("completed_at"),
        }
        return session_data

    async def start_magic_session(self, magic_token: str) -> bool:
        """Start candidate session via magic token."""
        result = await self.col.update_one(
            {"magic_token": magic_token, "status": {"$in": [SessionStatus.PENDING, SessionStatus.ACTIVE]}},
            {"$set": {
                "status": SessionStatus.ACTIVE,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return result.modified_count > 0 or result.matched_count > 0

    async def save_magic_answer(self, magic_token: str, answer_data: Dict) -> bool:
        """Record answer for magic session."""
        now = datetime.now(timezone.utc).isoformat()
        result = await self.col.update_one(
            {"magic_token": magic_token},
            {
                "$push": {"answers": answer_data},
                "$set":  {"updated_at": now},
            },
        )
        return result.modified_count > 0

    async def record_magic_cheating_event(self, magic_token: str, event: Dict) -> Dict:
        """Record integrity event for magic session."""
        session = await self.col.find_one({"magic_token": magic_token})
        if not session:
            return {"error": "Session not found"}

        events = session.get("cheating_events", []) + [event]
        score  = self._compute_cheating_score(events)
        warnings = self._count_warnings(events)
        aborted  = warnings >= 5

        update = {
            "$push": {"cheating_events": event},
            "$set": {
                "cheating_score":   score,
                "warning_count":    warnings,
                "session_aborted":  aborted,
                "updated_at":       datetime.now(timezone.utc).isoformat(),
            },
        }
        if aborted:
            update["$set"]["status"] = SessionStatus.ABORTED
            update["$set"]["abort_reason"] = "Exceeded maximum cheating warnings"

        await self.col.update_one({"magic_token": magic_token}, update)

        return {
            "cheating_score": score,
            "warning_count":  warnings,
            "session_aborted": aborted,
            "abort_reason":    "Too many integrity violations" if aborted else None,
        }

    async def complete_magic_session(self, magic_token: str, overall_data: Dict) -> Dict:
        """Complete magic session and immediately sync scorecard to Recruiter's candidate profile."""
        now = datetime.now(timezone.utc).isoformat()
        await self.col.update_one(
            {"magic_token": magic_token},
            {"$set": {
                "status":              SessionStatus.COMPLETED,
                "overall_score":       overall_data.get("overall_score"),
                "avg_confidence":      overall_data.get("avg_confidence"),
                "avg_clarity":         overall_data.get("avg_clarity"),
                "avg_relevance":       overall_data.get("avg_relevance"),
                "strength_areas":      overall_data.get("strengths", []),
                "weakness_areas":      overall_data.get("weaknesses", []),
                "improvement_summary": overall_data.get("summary"),
                "session_summary":     overall_data.get("session_summary"),
                "completed_at":        now,
                "updated_at":          now,
            }},
        )

        session = await self.col.find_one({"magic_token": magic_token})
        if not session:
            return {}

        session_id = str(session["_id"])

        # Construct comprehensive scorecard payload for Recruiter's Dashboard
        scorecard = {
            "session_id":          session_id,
            "job_title":           session.get("job_title"),
            "company_name":        session.get("company_name"),
            "difficulty":          session.get("difficulty"),
            "interview_type":      session.get("interview_type"),
            "overall_score":       overall_data.get("overall_score"),
            "avg_confidence":      overall_data.get("avg_confidence"),
            "avg_clarity":         overall_data.get("avg_clarity"),
            "avg_relevance":       overall_data.get("avg_relevance"),
            "strengths":           overall_data.get("strengths", []),
            "weaknesses":          overall_data.get("weaknesses", []),
            "summary":             overall_data.get("summary", ""),
            "session_summary":     overall_data.get("session_summary", {}),
            "cheating_score":      session.get("cheating_score", 0.0),
            "warning_count":       session.get("warning_count", 0),
            "session_aborted":     session.get("session_aborted", False),
            "total_questions":     len(session.get("questions", [])),
            "answers":             session.get("answers", []),
            "cheating_events":     session.get("cheating_events", []),
            "completed_at":        now,
        }

        # Sync to applications collection if application_id or (job_id, candidate_email) is linked
        try:
            app_query = None
            if session.get("application_id"):
                from bson import ObjectId
                try:
                    app_query = {"_id": ObjectId(session["application_id"])}
                except Exception:
                    app_query = {"_id": session["application_id"]}
            elif session.get("job_id") and session.get("candidate_email"):
                app_query = {
                    "job_id": session["job_id"],
                    "candidate_email": {"$regex": f"^{re.escape(session['candidate_email'])}$", "$options": "i"},
                }

            if app_query:
                await self.db.applications.update_one(
                    app_query,
                    {
                        "$set": {
                            "live_interview_scorecard": scorecard,
                            "live_interview_completed": True,
                            "live_interview_score": overall_data.get("overall_score"),
                            "live_interview_session_id": session_id,
                            "updated_at": now,
                        }
                    }
                )
                logger.info("Synchronized AI Live Interview scorecard to Recruiter Application", session_id=session_id)
        except Exception as sync_err:
            logger.error("Failed to synchronize scorecard to applications collection", error=str(sync_err))

        session["id"] = session_id
        return session

    async def schedule_bulk_employer_sessions(
        self,
        employer_id:          str,
        employer_name:        str,
        company_name:         str,
        job_id:               Optional[str],
        job_title:            str,
        full_job_description: str,
        interview_mode:       str = "mixed",
        difficulty:           str = "medium",
        custom_questions:     Optional[List[str]] = None,
        expiry_hours:         int = 48,
        candidates:           List[Dict] = None,
        num_questions:        int = 6,
    ) -> Dict:
        """Bulk schedule live AI interviews for multiple candidates in a pipeline stage."""
        candidates = candidates or []
        custom_qs = [q.strip() for q in (custom_questions or []) if q and q.strip()]

        # Generate targeted AI questions once for the whole batch
        questions = await self._generate_ai_questions(
            job_title=job_title,
            difficulty=difficulty,
            interview_type=interview_mode,
            num_questions=num_questions,
            full_job_description=full_job_description,
            custom_questions=custom_qs,
        )

        from core.config import settings
        from services.email_service import EmailService
        frontend_base = settings.FRONTEND_URL.rstrip("/")

        mode_labels = {
            "technical": "Technical Core",
            "behavioral": "Behavioral (STAR)",
            "situational": "Situational",
            "mixed": "All-in-One Assessment",
        }

        created_sessions = []
        for cand in candidates:
            c_email = (cand.get("candidate_email") or "").strip()
            c_name = (cand.get("candidate_name") or "").strip() or "Candidate"
            app_id = cand.get("application_id")

            session_id = str(uuid.uuid4())
            magic_token = secrets.token_urlsafe(24)
            expires_at = (datetime.now(timezone.utc) + timedelta(hours=expiry_hours)).isoformat()
            magic_link_url = f"{frontend_base}/live-assessment/{magic_token}"

            doc = {
                "_id":                   session_id,
                "user_id":               None,
                "job_title":             job_title,
                "difficulty":            difficulty,
                "interview_type":        interview_mode,
                "status":                SessionStatus.PENDING,
                "questions":             questions,
                "answers":               [],
                "cheating_events":       [],
                "cheating_score":        0.0,
                "warning_count":         0,
                "session_aborted":       False,
                "overall_score":         None,
                "is_employer_scheduled": True,
                "magic_token":           magic_token,
                "expires_at":            expires_at,
                "employer_id":           employer_id,
                "employer_name":         employer_name,
                "company_name":          company_name,
                "job_id":                job_id,
                "full_job_description":  full_job_description,
                "custom_questions":      custom_qs,
                "candidate_email":       c_email,
                "candidate_name":        c_name,
                "application_id":        app_id,
                "magic_link_url":        magic_link_url,
                "started_at":            None,
                "completed_at":          None,
                "created_at":            datetime.now(timezone.utc).isoformat(),
                "updated_at":            datetime.now(timezone.utc).isoformat(),
            }

            await self.col.insert_one(doc)

            email_sent = False
            if c_email:
                try:
                    mail_svc = EmailService()
                    email_sent = await mail_svc.send_live_interview_invitation(
                        recipient_email=c_email,
                        to_email=c_email,
                        candidate_name=c_name,
                        company_name=company_name,
                        job_title=job_title,
                        interview_mode_label=mode_labels.get(interview_mode, "Live AI Assessment"),
                        magic_link_url=magic_link_url,
                        expiry_hours=expiry_hours,
                    )
                    logger.info("Bulk magic link email sent", email=c_email, candidate=c_name, sent=email_sent)
                except Exception as mail_err:
                    logger.warning("Failed to dispatch bulk magic link invitation email", error=str(mail_err))

            created_sessions.append({
                "session_id":     session_id,
                "candidate_name": c_name,
                "candidate_email": c_email,
                "magic_token":    magic_token,
                "magic_link_url": magic_link_url,
                "expires_at":     expires_at,
                "email_sent":     email_sent,
            })

        logger.info("Bulk scheduled Live AI Interviews", count=len(created_sessions), company=company_name, job=job_title)
        return {
            "scheduled_count": len(created_sessions),
            "sessions":        created_sessions,
            "total_questions": len(questions),
        }

    async def list_employer_sessions(
        self,
        employer_id: Optional[str] = None,
        job_id: Optional[str] = None,
        status_filter: Optional[str] = None,
        limit: int = 150,
    ) -> List[Dict]:
        """List live interview sessions scheduled by employer with real-time status & scorecards."""
        query = {"is_employer_scheduled": True}
        if job_id:
            query["job_id"] = job_id
        if status_filter and status_filter != "all":
            query["status"] = status_filter

        cursor = self.col.find(query).sort("created_at", -1).limit(limit)
        docs = await cursor.to_list(length=limit)

        now_utc = datetime.now(timezone.utc)
        results = []
        for d in docs:
            sid = str(d.pop("_id"))
            d["id"] = sid

            # Calculate expiry
            is_expired = False
            exp_val = d.get("expires_at")
            if exp_val:
                try:
                    if isinstance(exp_val, datetime):
                        exp_dt = exp_val if exp_val.tzinfo else exp_val.replace(tzinfo=timezone.utc)
                    else:
                        exp_dt = datetime.fromisoformat(str(exp_val).replace("Z", "+00:00"))
                    if now_utc > exp_dt:
                        is_expired = True
                except Exception:
                    pass

            d["is_expired"] = is_expired
            d["answers_count"] = len(d.get("answers", []))
            d["total_questions"] = len(d.get("questions", []))
            results.append(d)

        return results

    async def generate_excel_export(
        self,
        job_id: Optional[str] = None,
        employer_id: Optional[str] = None,
    ) -> bytes:
        """Generate formatted Excel workbook (.xlsx) containing all assessment scorecards and proctoring logs."""
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter
        import io

        sessions = await self.list_employer_sessions(employer_id=employer_id, job_id=job_id, limit=500)

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Assessment Evaluations"

        # Styling definitions
        header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        title_font = Font(name="Calibri", size=15, bold=True, color="1E3A8A")
        sub_font = Font(name="Calibri", size=10, italic=True, color="64748B")
        regular_font = Font(name="Calibri", size=10)
        center_align = Alignment(horizontal="center", vertical="center")
        left_align = Alignment(horizontal="left", vertical="center")
        thin_border = Border(
            left=Side(style="thin", color="E2E8F0"),
            right=Side(style="thin", color="E2E8F0"),
            top=Side(style="thin", color="E2E8F0"),
            bottom=Side(style="thin", color="E2E8F0")
        )

        # Title block
        ws.merge_cells("A1:N1")
        ws["A1"] = "CareerShala AI — Live Assessment Evaluations & Proctoring Report"
        ws["A1"].font = title_font
        ws["A1"].alignment = left_align

        ws.merge_cells("A2:N2")
        ws["A2"] = f"Generated on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} | Total Candidates Evaluated: {len(sessions)}"
        ws["A2"].font = sub_font
        ws["A2"].alignment = left_align

        ws.row_dimensions[1].height = 24
        ws.row_dimensions[2].height = 18
        ws.row_dimensions[4].height = 26

        headers = [
            "#",
            "Candidate Name",
            "Candidate Email",
            "Job Title",
            "Mode",
            "Difficulty",
            "Status",
            "Overall AI Score",
            "Confidence (10)",
            "Clarity (10)",
            "Relevance (10)",
            "Proctoring Warnings",
            "Cheating Risk Score",
            "Integrity Status",
            "Key Strengths",
            "Critical Gaps / Weaknesses",
            "Assessment Summary",
            "Link Expiry Status",
            "Completed Date",
        ]

        row_num = 4
        for col_idx, h in enumerate(headers, 1):
            cell = ws.cell(row=row_num, column=col_idx, value=h)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center_align
            cell.border = thin_border

        # Fill data rows
        for idx, s in enumerate(sessions, 1):
            row_num += 1
            ws.row_dimensions[row_num].height = 20

            score_val = s.get("overall_score")
            score_display = f"{score_val}/10" if score_val is not None else "Pending"

            warnings = s.get("warning_count", 0)
            cheat_score = s.get("cheating_score", 0.0)
            aborted = s.get("session_aborted", False)

            if aborted:
                integrity_status = "ABORTED (Violations)"
            elif warnings == 0:
                integrity_status = "Clean (0 Flags)"
            else:
                integrity_status = f"Flagged ({warnings} warnings)"

            strengths = ", ".join(s.get("strength_areas") or s.get("strengths") or [])
            weaknesses = ", ".join(s.get("weakness_areas") or s.get("weaknesses") or [])
            summary = s.get("improvement_summary") or s.get("summary") or ""
            is_expired = s.get("is_expired", False)
            status_str = "Completed" if s.get("status") == "completed" else "Expired" if is_expired else s.get("status", "Pending").capitalize()

            row_data = [
                idx,
                s.get("candidate_name") or "Anonymous",
                s.get("candidate_email") or "N/A",
                s.get("job_title") or "N/A",
                s.get("interview_type", "mixed").capitalize(),
                s.get("difficulty", "medium").capitalize(),
                status_str,
                score_display,
                s.get("avg_confidence") if s.get("avg_confidence") is not None else "-",
                s.get("avg_clarity") if s.get("avg_clarity") is not None else "-",
                s.get("avg_relevance") if s.get("avg_relevance") is not None else "-",
                warnings,
                f"{round(cheat_score * 100, 1)}%",
                integrity_status,
                strengths or "None noted",
                weaknesses or "None noted",
                summary or "N/A",
                "Expired" if is_expired else "Active",
                s.get("completed_at", "")[:19].replace("T", " ") if s.get("completed_at") else "-",
            ]

            for c_idx, val in enumerate(row_data, 1):
                cell = ws.cell(row=row_num, column=c_idx, value=val)
                cell.font = regular_font
                cell.border = thin_border
                if c_idx in (1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 18, 19):
                    cell.alignment = center_align
                else:
                    cell.alignment = left_align

                if c_idx == 7: # Status
                    if val == "Completed":
                        cell.fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
                    elif val == "Expired":
                        cell.fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
                elif c_idx == 14: # Integrity
                    if "Clean" in str(val):
                        cell.fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
                    elif "Flagged" in str(val) or "ABORTED" in str(val):
                        cell.fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")

        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or "")
                if cell.row > 3:
                    max_len = max(max_len, len(val))
            ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue()

    async def get_employer_scorecard(self, session_id: str, employer_id: Optional[str] = None) -> Optional[Dict]:
        """Fetch full interview scorecard for employer dashboard."""
        query = {"_id": session_id}
        if employer_id:
            query["employer_id"] = employer_id
        doc = await self.col.find_one(query)
        if doc:
            doc["id"] = doc.pop("_id")
        return doc

    # ── Start session ─────────────────────────────────────────────────────────
    async def start_session(self, session_id: str, user_id: str) -> bool:
        result = await self.col.update_one(
            {"_id": session_id, "user_id": user_id},
            {"$set": {
                "status": SessionStatus.ACTIVE,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return result.modified_count > 0

    # ── Save answer ───────────────────────────────────────────────────────────
    async def save_answer(
        self,
        session_id:  str,
        user_id:     str,
        answer_data: Dict,
    ) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        result = await self.col.update_one(
            {"_id": session_id, "user_id": user_id},
            {
                "$push": {"answers": answer_data},
                "$set":  {"updated_at": now},
            },
        )
        return result.modified_count > 0

    # ── Record cheating event ─────────────────────────────────────────────────
    async def record_cheating_event(
        self,
        session_id: str,
        user_id:    str,
        event:      Dict,
    ) -> Dict:
        session = await self.col.find_one({"_id": session_id, "user_id": user_id})
        if not session:
            return {"error": "Session not found"}

        events = session.get("cheating_events", []) + [event]
        score  = self._compute_cheating_score(events)
        warnings = self._count_warnings(events)
        aborted  = warnings >= 5

        update = {
            "$push": {"cheating_events": event},
            "$set": {
                "cheating_score":   score,
                "warning_count":    warnings,
                "session_aborted":  aborted,
                "updated_at":       datetime.now(timezone.utc).isoformat(),
            },
        }
        if aborted:
            update["$set"]["status"] = SessionStatus.ABORTED
            update["$set"]["abort_reason"] = "Exceeded maximum cheating warnings"

        await self.col.update_one({"_id": session_id}, update)

        return {
            "cheating_score": score,
            "warning_count":  warnings,
            "session_aborted": aborted,
            "abort_reason":    "Too many integrity violations" if aborted else None,
        }

    # ── Complete session ──────────────────────────────────────────────────────
    async def complete_session(
        self,
        session_id:   str,
        user_id:      str,
        overall_data: Dict,
    ) -> Dict:
        now = datetime.now(timezone.utc).isoformat()
        await self.col.update_one(
            {"_id": session_id, "user_id": user_id},
            {"$set": {
                "status":              SessionStatus.COMPLETED,
                "overall_score":       overall_data.get("overall_score"),
                "avg_confidence":      overall_data.get("avg_confidence"),
                "avg_clarity":         overall_data.get("avg_clarity"),
                "avg_relevance":       overall_data.get("avg_relevance"),
                "strength_areas":      overall_data.get("strengths", []),
                "weakness_areas":      overall_data.get("weaknesses", []),
                "improvement_summary": overall_data.get("summary"),
                "session_summary":     overall_data.get("session_summary"),
                "completed_at":        now,
                "updated_at":          now,
            }},
        )
        session = await self.col.find_one({"_id": session_id})
        if session:
            session["id"] = session.pop("_id")
        return session or {}

    # ── Get session ───────────────────────────────────────────────────────────
    async def get_session(self, session_id: str, user_id: str) -> Optional[Dict]:
        doc = await self.col.find_one({"_id": session_id, "user_id": user_id})
        if doc:
            doc["id"] = doc.pop("_id")
        return doc

    # ── User history ──────────────────────────────────────────────────────────
    async def get_user_history(self, user_id: str, limit: int = 20) -> List[Dict]:
        cursor = self.col.find(
            {"user_id": user_id, "status": {"$in": [SessionStatus.COMPLETED, SessionStatus.ABORTED]}},
            {"questions": 0, "cheating_events": 0},
        ).sort("created_at", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        for d in docs:
            d["id"] = d.pop("_id")
        return docs

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _pick_questions(self, difficulty: str, interview_type: str, n: int) -> List[Dict]:
        pool = []
        if interview_type in ("technical", "mixed"):
            d = difficulty if difficulty in ("easy","medium","hard") else "medium"
            pool.extend(QUESTION_BANK["technical"].get(d, []))
            if interview_type == "mixed":
                pool.extend(QUESTION_BANK["behavioral"].get(d, []))
                pool.extend(QUESTION_BANK["situational"].get(d, []))
        elif interview_type == "behavioral":
            d = difficulty if difficulty in ("easy","medium","hard") else "medium"
            pool.extend(QUESTION_BANK["behavioral"].get(d, []))
        elif interview_type == "situational":
            pool.extend(QUESTION_BANK["situational"].get("medium", []))

        import random
        random.shuffle(pool)
        selected = pool[:n]
        return [{"id": i+1, **q, "difficulty": difficulty} for i, q in enumerate(selected)]

    def _compute_cheating_score(self, events: List[Dict]) -> float:
        raw = 0.0
        for ev in events:
            et = ev.get("event_type", "")
            try:
                weight = CHEATING_WEIGHTS.get(CheatingEventType(et), 0.05)
            except ValueError:
                weight = 0.05
            mult   = SEVERITY_MULT.get(ev.get("severity", "medium"), 1.0)
            raw   += weight * mult
        return round(min(1.0, raw), 3)

    def _count_warnings(self, events: List[Dict]) -> int:
        """Each HIGH/CRITICAL or looking_down event is a warning; every 3 mediums is 1 warning."""
        high_events = sum(1 for e in events if e.get("severity") in ("high","critical") or e.get("event_type") == "looking_down")
        med_events  = sum(1 for e in events if e.get("severity") == "medium" and e.get("event_type") != "looking_down")
        return high_events + (med_events // 3)
