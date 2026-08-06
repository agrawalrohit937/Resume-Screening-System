"""
Recruiter V2 Routes — JD-based candidate search, enriched candidate cards,
resume download, GitHub hover data.

New endpoints (extend existing /recruiter prefix in main.py):
  POST /recruiter/search          — post JD text → get ranked candidates (no stored JD needed)
  GET  /recruiter/candidate/{id}  — single enriched candidate profile
  GET  /recruiter/resume/{id}/download — resume file download for recruiter
  POST /recruiter/github-preview  — GitHub hover card data for a username

All endpoints require recruiter or admin role.
"""

from datetime import datetime, timezone
from typing import List, Optional

from annotated_types import doc
import structlog
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from api.deps import get_current_user, get_recruiter_or_admin, get_database, get_resume_repo
from config.db import get_database
from models.user_model import UserModel, UserRole
from repositories.resume_repo import ResumeRepository
from services.strict_ats_service import run_strict_ats_check
from services.github_service import GitHubService
from models.resume_model import ResumeModel
from fastapi.responses import RedirectResponse

logger = structlog.get_logger(__name__)
router = APIRouter()

_github_svc = GitHubService()


# ── Request models ────────────────────────────────────────────────────────────
class SearchRequest(BaseModel):
    job_description: str = Field(min_length=30)
    job_title:       str = "Candidate Search"
    required_skills: List[str] = []
    min_score:       float = Field(default=0.0, ge=0.0, le=1.0)
    max_results:     int   = Field(default=20, ge=1, le=100)
    filter_rec:      Optional[str] = None   # strong_match | good_match | partial_match | poor_match


class GitHubPreviewRequest(BaseModel):
    username: str


# ── POST /recruiter/search ────────────────────────────────────────────────────
@router.post("/search")
@router.post("/match-jd")
async def search_candidates(
    payload:  SearchRequest,
    user:     UserModel = Depends(get_recruiter_or_admin),
    db=Depends(get_database),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    """
    Score ALL parsed resumes in the system against the provided JD.
    Returns ranked candidate list with enriched profile data.
    """
    # 1. Extract target skills from the Job Description & explicit required skills
    jd_text_clean = payload.job_description or ""
    jd_extracted_skills = extract_skills_deterministic(jd_text_clean)
    explicit_skills = [s.strip() for s in (payload.required_skills or []) if s and s.strip()]
    target_skill_universe = list(dict.fromkeys(explicit_skills + jd_extracted_skills))

    # Fetch parsed primary resumes from DB
    cursor = resume_repo.collection.find(
        {
            "status": "parsed",
            "is_primary": True   # ONLY latest resumes
        },
        limit=min(payload.max_results * 5, 100)
    )
    raw_resumes = await cursor.to_list(length=min(payload.max_results * 5, 100))

    candidates = []
    seen_users = set()
    for doc in raw_resumes:
        user_id = doc.get("user_id")
        if not user_id or user_id in seen_users:
            continue
        seen_users.add(user_id)
        doc["_id"] = str(doc["_id"])
        
        parsed = doc.get("parsed_data", {})
        raw_text = parsed.get("raw_text", "")
        if not parsed or not raw_text:
            continue

        skills = parsed.get("technical_skills", []) or parsed.get("skills", [])

        # Multi-Factor ATS Scoring against JD
        try:
            strict_res = run_strict_ats_check(
                raw_text=raw_text,
                extracted_data=parsed,
                jd_text=payload.job_description,
                skill_universe=target_skill_universe or skills,
            )
            final_score = float(strict_res.get("final_score", 0.0))
            vector_score = float(strict_res.get("vector_score", 0.0))
            
            keyword_data = strict_res.get("keyword_match", {})
            keyword_score = float(keyword_data.get("strict_ats_score", 0.0))
            
            math_data = strict_res.get("math_result", {})
            matched = math_data.get("matched_skills") or keyword_data.get("matched_exact") or []
            missing = math_data.get("missing_skills") or keyword_data.get("missing_exact") or []
        except Exception as e:
            logger.warning("ATS scoring failed", resume_id=doc["_id"], error=str(e))
            continue

        recommendation = _label(final_score / 100.0)

        min_threshold = payload.min_score * 100.0 if payload.min_score <= 1.0 else payload.min_score
        if final_score < min_threshold:
            continue
        if payload.filter_rec and recommendation != payload.filter_rec:
            continue

        # Fetch user info for name/email
        user_doc = None
        try:
            user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            pass

        contact = parsed.get("contact_info", {})
        github_username = parsed.get("github_username") or _extract_github(raw_text)

        candidates.append({
            "resume_id": doc["_id"],
            "user_id": user_id,
            "filename": doc.get("original_filename", "resume.pdf"),
            "file_type": doc.get("file_type", "pdf"),
            "file_url": doc.get("file_url") or None,

            "name": parsed.get("full_name") or (user_doc.get("full_name") if user_doc else ""),
            "email": user_doc.get("email") if user_doc else contact.get("email", ""),
            "phone": contact.get("phone", ""),
            "linkedin": contact.get("linkedin", ""),
            "location": parsed.get("location", ""),
            "github_username": github_username,
            "experience_years": parsed.get("total_experience_years", 0),

            "skills": skills[:20],
            "matched_skills": matched[:15],
            "missing_skills": missing[:10],

            "final_score": round(final_score, 1),
            "bert_score": round(vector_score, 1),
            "tfidf_score": round(keyword_score, 1),
            "recommendation": recommendation,

            "uploaded_at": doc.get("created_at", ""),
        })

    # Sort by score descending
    candidates.sort(key=lambda c: c["final_score"], reverse=True)

    # Assign rank
    for i, c in enumerate(candidates[:payload.max_results], 1):
        c["rank"] = i

    top = candidates[:payload.max_results]
    total_top = len(top)
    avg_score = (sum(c["final_score"] for c in top) / max(total_top, 1)) / 100.0 if total_top > 0 else 0.0

    return {
        "total_candidates": total_top,
        "candidates":       top,
        "summary": {
            "strong_matches":  sum(1 for c in top if c["recommendation"] == "strong_match"),
            "good_matches":    sum(1 for c in top if c["recommendation"] == "good_match"),
            "partial_matches": sum(1 for c in top if c["recommendation"] == "partial_match"),
            "poor_matches":    sum(1 for c in top if c["recommendation"] == "poor_match"),
            "average_score":   round(avg_score, 3),
            "top_score":       round(top[0]["final_score"] / 100.0, 3) if top else 0.0,
        },
    }


# ── GET /recruiter/candidate/{resume_id} ─────────────────────────────────────
@router.get("/candidate/{resume_id}")
async def get_candidate_detail(
    resume_id: str,
    user:      UserModel = Depends(get_recruiter_or_admin),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    db=Depends(get_database),
):
    """Full candidate profile for recruiter — no user_id ownership check."""
    try:
        doc = await resume_repo.collection.find_one({"_id": ObjectId(resume_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Resume not found")
    if not doc:
        raise HTTPException(status_code=404, detail="Resume not found")
    doc["_id"] = str(doc["_id"])

    user_doc = None
    try:
        user_doc = await db.users.find_one({"_id": ObjectId(doc.get("user_id", ""))})
    except Exception:
        pass

    parsed = doc.get("parsed_data", {}) or {}
    contact = parsed.get("contact_info", {})
    return {
        "resume_id":    doc["_id"],
        "filename":     doc.get("original_filename"),
        "file_type":    doc.get("file_type"),
        "file_url": doc.get("file_url"),
        "parsed_data":  parsed,
        "candidate": {

            "name": parsed.get("full_name") or (user_doc.get("full_name") if user_doc else ""),
            "email": user_doc.get("email") if user_doc else contact.get("email", ""),
            "phone": contact.get("phone", ""),
            "linkedin": contact.get("linkedin", ""),
            "location": parsed.get("location", ""),
            "github_username": parsed.get("github_username") or _extract_github(parsed.get("raw_text", "")),
        },
        "uploaded_at":  doc.get("created_at"),
    }

@router.get("/resume/{resume_id}/download")
async def download_resume(
    resume_id: str,
    user: UserModel = Depends(get_recruiter_or_admin),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    try:
        doc = await resume_repo.collection.find_one({"_id": ObjectId(resume_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Resume not found")

    if not doc:
        raise HTTPException(status_code=404, detail="Resume not found")

    # 1. Try ATS enhanced resume
    ats_url = doc.get("file_url")

    if ats_url:
        return RedirectResponse(url=ats_url)

    # 2. Fallback → original resume
    original_path = doc.get("storage_path")

    if original_path:
        import os
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        file_path = os.path.join(BASE_DIR, original_path)

        if os.path.exists(file_path):
            return FileResponse(
                path=file_path,
                filename=doc.get("original_filename", "resume.pdf"),
                media_type="application/octet-stream",
            )

    # nothing available
    raise HTTPException(status_code=404, detail="No resume available")

# ── POST /recruiter/github-preview ────────────────────────────────────────────
@router.post("/github-preview")
async def github_preview(
    payload: GitHubPreviewRequest,
    user:    UserModel = Depends(get_recruiter_or_admin),
):
    """Lightweight GitHub data for hover card — reuses existing GitHubService."""
    if not payload.username or not payload.username.strip():
        raise HTTPException(status_code=400, detail="Username required")
    try:
        result = await _github_svc.analyze_profile(payload.username.strip())
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GitHub fetch failed: {str(e)}")


# ── Helpers ───────────────────────────────────────────────────────────────────
def _label(score: float) -> str:
    if score >= 0.80: return "strong_match"
    if score >= 0.60: return "good_match"
    if score >= 0.40: return "partial_match"
    return "poor_match"


def _extract_github(text: str) -> Optional[str]:
    """Try to find a GitHub username in resume raw text."""
    import re
    m = re.search(r'github\.com/([A-Za-z0-9_.-]+)', text or "")
    return m.group(1) if m else None