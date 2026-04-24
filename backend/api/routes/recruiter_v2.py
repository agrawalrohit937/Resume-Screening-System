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
from services.ats_service import ATSService
from services.github_service import GitHubService
from models.resume_model import ResumeModel
from fastapi.responses import RedirectResponse

logger = structlog.get_logger(__name__)
router = APIRouter()

_ats_svc    = ATSService()
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
    Expensive for large datasets — results are computed on-the-fly (no caching).
    """
    # Fetch parsed resumes from DB
    cursor = resume_repo.collection.find(
        {
            "status": "parsed",
            "is_primary": True   # ONLY latest resumes
        },
        limit=min(payload.max_results * 5, 100)
    )
    raw_resumes = await cursor.to_list(length=min(payload.max_results * 5, 100)) # fetch into memory for processing   

    candidates = []
    seen_users = set()
    for doc in raw_resumes:
        user_id = doc.get("user_id")
        # 🚨 Skip duplicate users
        if user_id in seen_users:
            continue
        seen_users.add(user_id)
        doc["_id"] = str(doc["_id"])
        # Skip resumes with no parsed text
        parsed = doc.get("parsed_data", {})

        if not parsed or not parsed.get("raw_text"):
            continue

        skills = parsed.get("technical_skills", []) or parsed.get("skills", [])
        try:
            resume_obj = ResumeModel(**doc)
        except Exception:
            continue

        # Score against JD using ATS service
        try:
            score_result = await _ats_svc.score_resume(
                resume=resume_obj,
                job_description=payload.job_description,
                job_title=payload.job_title,
                required_skills=payload.required_skills,
            )
        except Exception as e:
            logger.warning("ATS scoring failed", resume_id=doc["_id"], error=str(e))
            continue

        final_score  = score_result.get("final_score", 0.0)
        bert_score   = score_result.get("bert_score",  0.0)
        tfidf_score  = score_result.get("tfidf_score", 0.0)
        matched      = score_result.get("matched_skills", [])
        missing      = score_result.get("missing_skills",  [])
        skill_boost = len(matched) / max(len(payload.required_skills), 1)
        final_score += 0.1 * skill_boost
        recommendation = _label(final_score)

        if final_score < payload.min_score:
            continue
        if payload.filter_rec and recommendation != payload.filter_rec:
            continue

        # Fetch user info for name/email
        user_id = doc.get("user_id", "")
        user_doc = None
        try:
            user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            pass

        contact = parsed.get("contact_info", {})

        github_username = parsed.get("github_username") or _extract_github(parsed.get("raw_text", ""))

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

            "final_score": round(final_score, 3),
            "bert_score": round(bert_score, 3),
            "tfidf_score": round(tfidf_score, 3),
            "recommendation": recommendation,

            "uploaded_at": doc.get("created_at", ""),
        })

    # Sort by score descending
    candidates.sort(key=lambda c: c["final_score"], reverse=True)

    # Assign rank
    for i, c in enumerate(candidates[:payload.max_results], 1):
        c["rank"] = i

    top = candidates[:payload.max_results]
    return {
        "total_candidates": len(top),
        "candidates":       top,
        "summary": {
            "strong_matches":  sum(1 for c in top if c["recommendation"] == "strong_match"),
            "good_matches":    sum(1 for c in top if c["recommendation"] == "good_match"),
            "partial_matches": sum(1 for c in top if c["recommendation"] == "partial_match"),
            "poor_matches":    sum(1 for c in top if c["recommendation"] == "poor_match"),
            "average_score":   round(sum(c["final_score"] for c in top) / max(len(top), 1), 3),
            "top_score":       round(top[0]["final_score"], 3) if top else 0.0,
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