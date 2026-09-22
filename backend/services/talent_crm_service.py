"""Talent CRM Fundamentals - Silver Medalists & Candidate Re-engagement.
CareerPilot ATS v2.0.0 - Enterprise ATS Workflows.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import uuid
import structlog

from services.multi_tenancy.tenant_context import get_current_tenant_id

logger = structlog.get_logger(__name__)


class SilverMedalistCandidate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = "default"
    candidate_id: str
    candidate_name: str
    candidate_email: str
    original_application_id: str
    original_job_id: str
    original_job_title: str
    final_stage_reached: str  # e.g., "final_round", "executive", "onsite"
    ats_score: float = 0.0
    skills: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=lambda: ["silver_medalist"])
    status: str = "available"  # available, re_engaged, hired, opted_out
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_contacted_at: Optional[datetime] = None


class ReEngagementAlert(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = "default"
    candidate_id: str
    candidate_name: str
    candidate_email: str
    target_job_id: str
    target_job_title: str
    match_score: float
    overlapping_skills: List[str] = Field(default_factory=list)
    recommended_action: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TalentCRMService:
    def __init__(self, db):
        self.db = db

    async def register_silver_medalist(
        self,
        candidate_id: str,
        candidate_name: str,
        candidate_email: str,
        original_application_id: str,
        original_job_id: str,
        original_job_title: str,
        final_stage_reached: str,
        ats_score: float,
        skills: List[str],
        notes: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> SilverMedalistCandidate:
        resolved_tenant = tenant_id or get_current_tenant_id()
        
        # Check if already exists in CRM
        existing = await self.db.talent_crm.find_one({
            "candidate_id": candidate_id,
            "tenant_id": resolved_tenant
        })
        if existing:
            await self.db.talent_crm.update_one(
                {"id": existing["id"], "tenant_id": resolved_tenant},
                {"$addToSet": {"tags": "silver_medalist"}, "$set": {"ats_score": ats_score, "skills": skills}}
            )
            existing["tags"] = list(set(existing.get("tags", []) + ["silver_medalist"]))
            return SilverMedalistCandidate(**existing)

        candidate = SilverMedalistCandidate(
            tenant_id=resolved_tenant,
            candidate_id=candidate_id,
            candidate_name=candidate_name,
            candidate_email=candidate_email,
            original_application_id=original_application_id,
            original_job_id=original_job_id,
            original_job_title=original_job_title,
            final_stage_reached=final_stage_reached,
            ats_score=ats_score,
            skills=[s.strip() for s in skills if s.strip()],
            notes=notes
        )
        await self.db.talent_crm.insert_one(candidate.dict())
        logger.info(
            "Candidate tagged as Silver Medalist in CRM",
            candidate_id=candidate_id,
            job_title=original_job_title,
            tenant_id=resolved_tenant
        )
        return candidate

    async def find_reengagement_matches(
        self,
        target_job_id: str,
        target_job_title: str,
        required_skills: List[str],
        min_score: float = 0.5,
        tenant_id: Optional[str] = None
    ) -> List[ReEngagementAlert]:
        resolved_tenant = tenant_id or get_current_tenant_id()
        cursor = self.db.talent_crm.find({
            "tenant_id": resolved_tenant,
            "tags": "silver_medalist",
            "status": "available"
        })
        candidates_data = await cursor.to_list(length=100)
        
        alerts: List[ReEngagementAlert] = []
        target_skills_set = {s.lower().strip() for s in required_skills}

        for doc in candidates_data:
            cand = SilverMedalistCandidate(**doc)
            cand_skills_set = {s.lower().strip() for s in cand.skills}
            overlap = list(cand_skills_set.intersection(target_skills_set))

            skill_match_ratio = len(overlap) / max(1, len(target_skills_set))
            # Combined score: 60% skill overlap + 40% previous ATS score
            combined_match = round((0.6 * skill_match_ratio) + (0.4 * (cand.ats_score / 100.0)), 2)

            if combined_match >= min_score or len(overlap) >= 2:
                alert = ReEngagementAlert(
                    tenant_id=resolved_tenant,
                    candidate_id=cand.candidate_id,
                    candidate_name=cand.candidate_name,
                    candidate_email=cand.candidate_email,
                    target_job_id=target_job_id,
                    target_job_title=target_job_title,
                    match_score=combined_match,
                    overlapping_skills=overlap,
                    recommended_action=f"Re-engage prior silver medalist from {cand.original_job_title}"
                )
                alerts.append(alert)

        # Sort by match score descending
        alerts.sort(key=lambda a: a.match_score, reverse=True)
        logger.info("Found re-engagement matches", target_job_id=target_job_id, matches_count=len(alerts))
        return alerts
