"""
Live Interview Routes
POST /live-interview/sessions              — create session
POST /live-interview/sessions/{id}/start   — start
POST /live-interview/sessions/{id}/answer  — submit answer + evaluate
POST /live-interview/sessions/{id}/cheat   — record cheating event
POST /live-interview/sessions/{id}/complete — finalize + generate report
GET  /live-interview/sessions/{id}         — fetch session
GET  /live-interview/history               — user history
"""
from typing import List, Optional, Dict
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from pydantic import BaseModel, Field

from api.deps import get_current_user, get_database, get_resume_repo
from models.user_model import UserModel, UserRole
from services.live_interview_service import LiveInterviewService
from services.evaluation_service import EvaluationService
from services.gamification_service import GamificationService
from repositories.resume_repo import ResumeRepository

from config.db import get_database
from fastapi import Depends

logger = structlog.get_logger(__name__)
router = APIRouter()

_eval_svc = EvaluationService()


def get_gamification_service(db=Depends(get_database)) -> GamificationService:
    return GamificationService(db)


def get_svc(db=Depends(get_database)) -> LiveInterviewService:
    return LiveInterviewService(db)


# ── Request models ─────────────────────────────────────────────────────────────
class CreateSessionRequest(BaseModel):
    job_title:      str = "Software Engineer"
    difficulty:     str = Field(default="medium", pattern="^(easy|medium|hard|mixed)$")
    interview_type: str = Field(default="mixed",  pattern="^(technical|behavioral|situational|mixed)$")
    num_questions:  int = Field(default=8, ge=3, le=15)
    resume_id:      Optional[str] = None   # optional — enables personalized questions


class SubmitAnswerRequest(BaseModel):
    question_id:    int
    question_text:  str
    category:       str = "technical"
    answer:         str
    answer_source:  str = "text"            # text | voice
    time_taken_secs:int = 0
    reattempted:    bool = False
    voice_pauses:   int = 0
    speech_rate_wpm:float = 0.0


class CheatingEventRequest(BaseModel):
    event_type: str
    severity:   str = "medium"
    details:    Optional[str] = None


class CompleteSessionRequest(BaseModel):
    total_time_secs: int = 0


class ScheduleInterviewRequest(BaseModel):
    job_id:               Optional[str] = None
    job_title:            str = "Software Engineer"
    full_job_description: Optional[str] = Field(default="Core engineering and domain competence interview assessment.", description="Full Job Description text")
    interview_mode:       str = Field(default="mixed", pattern="^(technical|behavioral|situational|mixed)$")
    difficulty:           str = Field(default="medium", pattern="^(easy|medium|hard)$")
    custom_questions:     Optional[List[str]] = Field(default_factory=list, description="1-2 mandatory questions added by recruiter")
    expiry_hours:         int = Field(default=48, ge=1, le=168)
    candidate_email:      Optional[str] = None
    candidate_name:       Optional[str] = None
    application_id:       Optional[str] = None
    num_questions:        int = Field(default=6, ge=3, le=15)


class BulkCandidateItem(BaseModel):
    candidate_name:  str
    candidate_email: str
    application_id:  Optional[str] = None


class BulkScheduleInterviewRequest(BaseModel):
    job_id:               Optional[str] = None
    job_title:            str = "Software Engineer"
    full_job_description: Optional[str] = Field(default="Core engineering and domain competence interview assessment.", description="Full Job Description text")
    interview_mode:       str = Field(default="mixed", pattern="^(technical|behavioral|situational|mixed)$")
    difficulty:           str = Field(default="medium", pattern="^(easy|medium|hard)$")
    custom_questions:     Optional[List[str]] = Field(default_factory=list, description="Mandatory custom questions")
    expiry_hours:         int = Field(default=48, ge=1, le=168)
    num_questions:        int = Field(default=6, ge=3, le=15)
    candidates:           List[BulkCandidateItem] = Field(..., min_length=1, description="List of candidates to invite")


# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: CreateSessionRequest,
    user:    UserModel = Depends(get_current_user),
    svc:     LiveInterviewService = Depends(get_svc),
    gamification: GamificationService = Depends(get_gamification_service),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    # Extract resume context if provided (optional — for personalized questions)
    resume_skills: Optional[List[str]] = None
    experience_years: Optional[float] = None
    experience_titles: Optional[List[str]] = None

    if payload.resume_id:
        try:
            resume = await resume_repo.get_by_id_and_user(payload.resume_id, str(user.id))
            if resume and resume.parsed_data:
                resume_skills = resume.parsed_data.technical_skills[:12]
                experience_years = resume.parsed_data.total_experience_years
                experience_titles = [e.title for e in (resume.parsed_data.work_experience or [])[:3]]
        except Exception:
            pass  # Resume fetch failed — proceed with generic questions

    data = await svc.create_session(
        user_id=str(user.id),
        job_title=payload.job_title,
        difficulty=payload.difficulty,
        interview_type=payload.interview_type,
        num_questions=payload.num_questions,
        resume_skills=resume_skills,
        experience_years=experience_years,
        experience_titles=experience_titles,
    )

    await gamification.mark_daily_activity(str(user.id))
    return {"success": True, **data}


@router.post("/sessions/{session_id}/start")
async def start_session(
    session_id: str,
    user:       UserModel = Depends(get_current_user),
    svc:        LiveInterviewService = Depends(get_svc),
):
    ok = await svc.start_session(session_id, str(user.id))
    if not ok:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True, "started_at": datetime.now(timezone.utc).isoformat()}


@router.post("/sessions/{session_id}/answer")
async def submit_answer(
    session_id: str,
    payload:    SubmitAnswerRequest,
    user:       UserModel = Depends(get_current_user),
    svc:        LiveInterviewService = Depends(get_svc),
):
    """Submit answer → evaluate with Groq → save → return feedback."""
    # Evaluate
    eval_result = await _eval_svc.evaluate_answer(
        question       = payload.question_text,
        answer         = payload.answer,
        category       = payload.category,
        difficulty     = "medium",
        job_title      = "Software Engineer",
        voice_pauses   = payload.voice_pauses,
        speech_rate    = payload.speech_rate_wpm,
    )

    answer_doc = {
        "question_id":       payload.question_id,
        "question_text":     payload.question_text,
        "category":          payload.category,
        "user_answer":       payload.answer,
        "answer_source":     payload.answer_source,
        "time_taken_secs":   payload.time_taken_secs,
        "reattempted":       payload.reattempted,
        "ai_score":          eval_result.get("overall_score", 0),
        "relevance_score":   eval_result.get("relevance_score", 0),
        "clarity_score":     eval_result.get("clarity_score", 0),
        "confidence_score":  eval_result.get("confidence_score", 0),
        "filler_word_count": eval_result.get("filler_word_count", 0),
        "ai_feedback":       eval_result.get("feedback", ""),
        "improvement_tips":  eval_result.get("improvement_tips", []),
        "keywords_found":    eval_result.get("keywords_found", []),
        "keywords_missing":  eval_result.get("keywords_missing", []),
        "grade":             eval_result.get("grade", "N/A"),
        "ideal_answer_summary": eval_result.get("ideal_answer_summary", ""),
        "evaluated_at":      datetime.now(timezone.utc).isoformat(),
    }

    await svc.save_answer(session_id, str(user.id), answer_doc)
    logger.info("Answer submitted", session_id=session_id, score=answer_doc["ai_score"])

    return {
        "success":     True,
        "question_id": payload.question_id,
        "evaluation":  eval_result,
    }


@router.post("/sessions/{session_id}/cheat")
async def record_cheating_event(
    session_id: str,
    payload:    CheatingEventRequest,
    user:       UserModel = Depends(get_current_user),
    svc:        LiveInterviewService = Depends(get_svc),
):
    event = {
        "event_type": payload.event_type,
        "severity":   payload.severity,
        "details":    payload.details,
        "timestamp":  datetime.now(timezone.utc).isoformat(),
    }
    result = await svc.record_cheating_event(session_id, str(user.id), event)
    return {"success": True, **result}


@router.post("/sessions/{session_id}/complete")
async def complete_session(
    session_id: str,
    payload:    CompleteSessionRequest,
    user:       UserModel = Depends(get_current_user),
    svc:        LiveInterviewService = Depends(get_svc),
    gamification: GamificationService = Depends(get_gamification_service),
):
    """Finalize session — compute aggregated stats + AI summary report."""
    session = await svc.get_session(session_id, str(user.id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    answers = session.get("answers", [])
    if not answers:
        raise HTTPException(status_code=400, detail="No answers submitted")

    # Aggregate scores
    scores = [a.get("ai_score", 0) for a in answers if a.get("ai_score") is not None]
    conf   = [a.get("confidence_score", 0) for a in answers]
    clar   = [a.get("clarity_score", 0) for a in answers]
    relev  = [a.get("relevance_score", 0) for a in answers]

    avg_score = sum(scores) / len(scores) if scores else 0
    avg_conf  = sum(conf) / len(conf)   if conf   else 0
    avg_clar  = sum(clar) / len(clar)   if clar   else 0
    avg_relev = sum(relev) / len(relev) if relev  else 0

    questions_answered = len(answers)
    await gamification.process_interview_result(
        user_id=str(user.id),
        interview_score=round(avg_score / 10.0, 2),
        questions_answered=questions_answered,
    )

    # Generate AI summary
    qa_pairs = [{"question": a["question_text"], "answer": a["user_answer"], "score": a.get("ai_score",0)} for a in answers]
    summary = await _eval_svc.generate_session_summary(
        job_title      = session.get("job_title",""),
        qa_pairs       = qa_pairs,
        overall_score  = avg_score,
        cheating_score = session.get("cheating_score", 0),
    )

    # Top-level strengths/weaknesses from individual answers
    all_strengths  = []
    all_weaknesses = []
    for a in answers:
        all_strengths.extend(a.get("improvement_tips", []))
    top_strengths  = summary.get("top_strengths", all_strengths[:3])
    top_weaknesses = summary.get("critical_gaps", all_weaknesses[:3])

    overall_data = {
        "overall_score":       round(avg_score, 1),
        "avg_confidence":      round(avg_conf, 1),
        "avg_clarity":         round(avg_clar, 1),
        "avg_relevance":       round(avg_relev, 1),
        "strengths":           top_strengths,
        "weaknesses":          top_weaknesses,
        "summary":             summary.get("executive_summary", ""),
        "session_summary":     summary,
        "total_time_secs":     payload.total_time_secs,
    }

    completed = await svc.complete_session(session_id, str(user.id), overall_data)
    return {"success": True, "session": completed, "summary": summary}


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    user:       UserModel = Depends(get_current_user),
    svc:        LiveInterviewService = Depends(get_svc),
):
    session = await svc.get_session(session_id, str(user.id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/history")
async def get_history(
    limit: int = Query(default=20, ge=1, le=100),
    user:  UserModel = Depends(get_current_user),
    svc:   LiveInterviewService = Depends(get_svc),
):
    history = await svc.get_user_history(str(user.id), limit=limit)
    return {"sessions": history, "total": len(history)}


# ══════════════════════════════════════════════════════════════════════════════
# B2B ENTERPRISE / EMPLOYER DRIVEN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

SCHEDULE_AUTHORITY_ROLES = {
    UserRole.INTERVIEWER,
    UserRole.HIRING_MANAGER,
    UserRole.EXECUTIVE,
    UserRole.EXEC,
    UserRole.EMPLOYER,
    UserRole.ADMIN,
    UserRole.PLATFORM_ADMIN,
}


@router.post("/schedule", status_code=status.HTTP_201_CREATED)
async def schedule_live_interview(
    payload: ScheduleInterviewRequest,
    user: UserModel = Depends(get_current_user),
    svc: LiveInterviewService = Depends(get_svc),
):
    """
    Employer / Interviewer / Hiring Manager schedules a B2B Live AI Interview session:
    - Generates questions tailored to full_job_description + custom_questions.
    - Generates secure magic link with deadline.
    - Dispatches invitation email to candidate if candidate_email is provided.
    """
    user_roles = getattr(user, "roles", [user.role])
    if not any(r in SCHEDULE_AUTHORITY_ROLES for r in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Live Interview scheduling is restricted to Interviewers, Hiring Managers, and Executives. Recruiters can advance candidates to the Interview pipeline stage.",
        )

    employer_name = getattr(user, "full_name", None) or "Hiring Manager"
    company_name = getattr(user, "company_name", None) or "CareerShala Enterprise"

    result = await svc.schedule_employer_session(
        employer_id=str(user.id),
        employer_name=employer_name,
        company_name=company_name,
        job_id=payload.job_id,
        job_title=payload.job_title,
        full_job_description=payload.full_job_description,
        interview_mode=payload.interview_mode,
        difficulty=payload.difficulty,
        custom_questions=payload.custom_questions,
        expiry_hours=payload.expiry_hours,
        candidate_email=payload.candidate_email,
        candidate_name=payload.candidate_name,
        application_id=payload.application_id,
        num_questions=payload.num_questions,
    )

    return {"success": True, **result}


@router.post("/schedule/bulk", status_code=status.HTTP_201_CREATED)
async def schedule_bulk_live_interviews(
    payload: BulkScheduleInterviewRequest,
    user: UserModel = Depends(get_current_user),
    svc: LiveInterviewService = Depends(get_svc),
):
    """
    Bulk schedule Live AI interview sessions for an entire pipeline cohort.
    Sends personalized invitation emails with Magic Links to all candidates.
    """
    user_roles = getattr(user, "roles", [user.role])
    if not any(r in SCHEDULE_AUTHORITY_ROLES for r in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Live Interview bulk scheduling is restricted to Interviewers, Hiring Managers, and Executives.",
        )

    employer_name = getattr(user, "full_name", None) or "Hiring Manager"
    company_name = getattr(user, "company_name", None) or "CareerShala Enterprise"

    result = await svc.schedule_bulk_employer_sessions(
        employer_id=str(user.id),
        employer_name=employer_name,
        company_name=company_name,
        job_id=payload.job_id,
        job_title=payload.job_title,
        full_job_description=payload.full_job_description,
        interview_mode=payload.interview_mode,
        difficulty=payload.difficulty,
        custom_questions=payload.custom_questions,
        expiry_hours=payload.expiry_hours,
        candidates=[c.model_dump() for c in payload.candidates],
        num_questions=payload.num_questions,
    )
    return {"success": True, **result}


@router.get("/employer/sessions")
async def list_employer_live_sessions(
    job_id: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default="all"),
    limit: int = Query(default=150, ge=1, le=300),
    user: UserModel = Depends(get_current_user),
    svc: LiveInterviewService = Depends(get_svc),
):
    """
    List all Live AI Interview sessions for the employer/recruiter dashboard,
    including candidate statuses, AI evaluation scores, and proctoring warnings.
    """
    sessions = await svc.list_employer_sessions(
        employer_id=str(user.id),
        job_id=job_id,
        status_filter=status_filter,
        limit=limit,
    )
    return {"success": True, "sessions": sessions, "total": len(sessions)}


@router.get("/employer/export-excel")
async def export_employer_evaluations_excel(
    job_id: Optional[str] = Query(default=None),
    user: UserModel = Depends(get_current_user),
    svc: LiveInterviewService = Depends(get_svc),
):
    """
    Export all candidate AI interview evaluations, proctoring warnings, and scores
    into a styled Excel spreadsheet (.xlsx).
    """
    excel_bytes = await svc.generate_excel_export(job_id=job_id, employer_id=str(user.id))
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"live_interview_evaluations_{timestamp}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ══════════════════════════════════════════════════════════════════════════════
# CANDIDATE MAGIC LINK ENDPOINTS (NO CONFIG CHOICES, BLIND SUBMIT)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/magic/{token}")
async def get_magic_session(
    token: str,
    svc: LiveInterviewService = Depends(get_svc),
):
    """
    Fetch session context via magic token for candidate landing page.
    Validates token presence and expiration.
    """
    session = await svc.get_session_by_magic_token(token)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found or invalid magic token.")
    return {"success": True, "session": session}


@router.post("/magic/{token}/start")
async def start_magic_session(
    token: str,
    svc: LiveInterviewService = Depends(get_svc),
):
    """Candidate initiates assessment from SystemCheck."""
    session = await svc.get_session_by_magic_token(token)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.get("is_expired"):
        raise HTTPException(status_code=410, detail="This interview invitation link has expired.")

    ok = await svc.start_magic_session(token)
    if not ok:
        raise HTTPException(status_code=400, detail="Could not start session")
    return {"success": True, "started_at": datetime.now(timezone.utc).isoformat()}


@router.post("/magic/{token}/answer")
async def submit_magic_answer(
    token: str,
    payload: SubmitAnswerRequest,
    svc: LiveInterviewService = Depends(get_svc),
):
    """
    Candidate submits an answer in magic session.
    Evaluates answer via AI in background, saves to DB.
    """
    session = await svc.get_session_by_magic_token(token)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.get("is_expired"):
        raise HTTPException(status_code=410, detail="Session expired")

    # Evaluate answer with LLM
    eval_result = await _eval_svc.evaluate_answer(
        question       = payload.question_text,
        answer         = payload.answer,
        category       = payload.category,
        difficulty     = session.get("difficulty", "medium"),
        job_title      = session.get("job_title", "Software Engineer"),
        voice_pauses   = payload.voice_pauses,
        speech_rate    = payload.speech_rate_wpm,
    )

    answer_doc = {
        "question_id":       payload.question_id,
        "question_text":     payload.question_text,
        "category":          payload.category,
        "user_answer":       payload.answer,
        "answer_source":     payload.answer_source,
        "time_taken_secs":   payload.time_taken_secs,
        "reattempted":       payload.reattempted,
        "ai_score":          eval_result.get("overall_score", 0),
        "relevance_score":   eval_result.get("relevance_score", 0),
        "clarity_score":     eval_result.get("clarity_score", 0),
        "confidence_score":  eval_result.get("confidence_score", 0),
        "filler_word_count": eval_result.get("filler_word_count", 0),
        "ai_feedback":       eval_result.get("feedback", ""),
        "improvement_tips":  eval_result.get("improvement_tips", []),
        "keywords_found":    eval_result.get("keywords_found", []),
        "keywords_missing":  eval_result.get("keywords_missing", []),
        "grade":             eval_result.get("grade", "N/A"),
        "ideal_answer_summary": eval_result.get("ideal_answer_summary", ""),
        "evaluated_at":      datetime.now(timezone.utc).isoformat(),
    }

    await svc.save_magic_answer(token, answer_doc)

    return {
        "success":     True,
        "question_id": payload.question_id,
        "message":     "Answer recorded securely",
    }


@router.post("/magic/{token}/cheat")
async def record_magic_cheat(
    token: str,
    payload: CheatingEventRequest,
    svc: LiveInterviewService = Depends(get_svc),
):
    """Record integrity event for magic assessment session."""
    event = {
        "event_type": payload.event_type,
        "severity":   payload.severity,
        "details":    payload.details,
        "timestamp":  datetime.now(timezone.utc).isoformat(),
    }
    result = await svc.record_magic_cheating_event(token, event)
    return {"success": True, **result}


@router.post("/magic/{token}/complete")
async def complete_magic_session(
    token: str,
    payload: CompleteSessionRequest,
    svc: LiveInterviewService = Depends(get_svc),
):
    """
    Blind completion for candidate:
    - Finalizes session scores & AI summary report.
    - Synchronizes full scorecard immediately to Recruiter Dashboard under candidate application.
    - Does NOT reveal score/feedback to candidate.
    """
    raw_doc = await svc.col.find_one({"magic_token": token})
    if not raw_doc:
        raise HTTPException(status_code=404, detail="Session not found")

    answers = raw_doc.get("answers", [])
    if not answers:
        raise HTTPException(status_code=400, detail="No answers submitted")

    scores = [a.get("ai_score", 0) for a in answers if a.get("ai_score") is not None]
    conf   = [a.get("confidence_score", 0) for a in answers]
    clar   = [a.get("clarity_score", 0) for a in answers]
    relev  = [a.get("relevance_score", 0) for a in answers]

    avg_score = sum(scores) / len(scores) if scores else 0
    avg_conf  = sum(conf) / len(conf)   if conf   else 0
    avg_clar  = sum(clar) / len(clar)   if clar   else 0
    avg_relev = sum(relev) / len(relev) if relev  else 0

    qa_pairs = [{"question": a["question_text"], "answer": a["user_answer"], "score": a.get("ai_score", 0)} for a in answers]
    summary = await _eval_svc.generate_session_summary(
        job_title      = raw_doc.get("job_title", ""),
        qa_pairs       = qa_pairs,
        overall_score  = avg_score,
        cheating_score = raw_doc.get("cheating_score", 0),
    )

    all_strengths  = []
    all_weaknesses = []
    for a in answers:
        all_strengths.extend(a.get("improvement_tips", []))
    top_strengths  = summary.get("top_strengths", all_strengths[:3])
    top_weaknesses = summary.get("critical_gaps", all_weaknesses[:3])

    overall_data = {
        "overall_score":       round(avg_score, 1),
        "avg_confidence":      round(avg_conf, 1),
        "avg_clarity":         round(avg_clar, 1),
        "avg_relevance":       round(avg_relev, 1),
        "strengths":           top_strengths,
        "weaknesses":          top_weaknesses,
        "summary":             summary.get("executive_summary", ""),
        "session_summary":     summary,
        "total_time_secs":     payload.total_time_secs,
    }

    await svc.complete_magic_session(token, overall_data)

    # Blind response — candidate is only shown confirmation of submission
    return {
        "success":         True,
        "blind_submitted": True,
        "message":         "Assessment securely submitted to the hiring team.",
        "completed_at":    datetime.now(timezone.utc).isoformat(),
    }


@router.get("/employer/scorecard/{session_id}")
async def get_employer_scorecard(
    session_id: str,
    user: UserModel = Depends(get_current_user),
    svc: LiveInterviewService = Depends(get_svc),
):
    """Fetch full AI interview scorecard for recruiter/employer dashboard."""
    scorecard = await svc.get_employer_scorecard(session_id)
    if not scorecard:
        raise HTTPException(status_code=404, detail="Scorecard not found")
    return {"success": True, "scorecard": scorecard}
