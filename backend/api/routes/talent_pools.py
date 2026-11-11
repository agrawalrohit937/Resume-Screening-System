"""Consented Talent Pool API Routes (Privacy-Preserving Search).
CareerShala ATS v2.0.0 - Enterprise ATS Marketplace.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from api.deps import get_current_user
from schemas.user_schema import UserModel
from schemas.talent_pool_schema import TalentPoolProfile, TalentPoolViewAudit, VisibilityTier
from services.talent_pool_service import TalentPoolService

router = APIRouter()


class UpdateTalentProfilePayload(BaseModel):
    headline: str = ""
    summary: str = ""
    skills: List[str] = []
    years_experience: float = 0.0
    current_company: Optional[str] = None
    excluded_employers: Optional[List[str]] = None


class ConsentPayload(BaseModel):
    visibility_tier: VisibilityTier = VisibilityTier.ANONYMIZED


@router.get("/profile", response_model=TalentPoolProfile)
async def get_talent_profile_route(
    current_user: UserModel = Depends(get_current_user),
    service: TalentPoolService = Depends(),
):
    """Retrieves current candidate's talent pool consent profile."""
    candidate_id = current_user.id or "current_user"
    return await service.get_profile(
        candidate_id=candidate_id,
        candidate_name=current_user.full_name or "Candidate",
        candidate_email=current_user.email or "candidate@example.com",
    )


@router.post("/profile", response_model=TalentPoolProfile)
async def update_talent_profile_route(
    payload: UpdateTalentProfilePayload,
    current_user: UserModel = Depends(get_current_user),
):
    """Updates candidate talent profile information and employer blocklist."""
    service = TalentPoolService()
    return await service.create_or_update_profile(
        candidate_id=current_user.id or "current_user",
        headline=payload.headline,
        summary=payload.summary,
        skills=payload.skills,
        years_experience=payload.years_experience,
        current_company=payload.current_company,
        candidate_name=current_user.full_name or "Candidate",
        candidate_email=current_user.email or "candidate@example.com",
        excluded_employers=payload.excluded_employers,
    )


@router.post("/consent", response_model=TalentPoolProfile)
async def grant_consent_route(
    payload: ConsentPayload,
    current_user: UserModel = Depends(get_current_user),
):
    """Grants consent to be discoverable by recruiters under selected visibility tier."""
    service = TalentPoolService()
    profile = await service.grant_consent(
        candidate_id=current_user.id or "current_user",
        visibility_tier=payload.visibility_tier,
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Candidate profile not found")
    return profile


@router.post("/revoke", response_model=TalentPoolProfile)
async def revoke_consent_route(
    current_user: UserModel = Depends(get_current_user),
):
    """Instantly revokes talent pool consent, setting visibility to hidden."""
    service = TalentPoolService()
    profile = await service.revoke_consent(candidate_id=current_user.id or "current_user")
    if not profile:
        raise HTTPException(status_code=404, detail="Candidate profile not found")
    return profile


@router.get("/views", response_model=List[TalentPoolViewAudit])
async def get_views_audit_route(
    current_user: UserModel = Depends(get_current_user),
):
    """Provides transparency logs showing all recruiters who viewed this candidate's profile."""
    service = TalentPoolService()
    return await service.get_candidate_view_history(candidate_id=current_user.id or "current_user")


@router.get("/search", response_model=List[Dict[str, Any]])
async def search_talent_pool_route(
    skills: List[str] = Query([], description="Desired candidate skills"),
    min_experience: float = Query(0.0, description="Minimum years of experience"),
    recruiter_company: str = Query("Enterprise Corp", description="Recruiter organization name"),
    current_user: UserModel = Depends(get_current_user),
):
    """Recruiter search across consented candidate pool respecting employer blocklists."""
    service = TalentPoolService()
    tenant_id = getattr(current_user, "tenant_id", "default")
    return await service.search_talent_pool(
        query_skills=skills,
        min_experience=min_experience,
        recruiter_company=recruiter_company,
        recruiter_tenant_id=tenant_id,
        recruiter_id=current_user.id or "recruiter_user",
    )
