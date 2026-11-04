from __future__ import annotations

"""Talent CRM Fundamentals - Silver Medalists & Candidate Re-engagement (Pure PostgreSQL).
CareerShala ATS v2.0.0 - Enterprise ATS Workflows.
"""

from datetime import datetime, timezone
from typing import Any, List, Optional
from pydantic import BaseModel, Field
import uuid
import structlog
from sqlalchemy import select, and_

from config.db import get_pg_session_factory
from models.tables import CandidateApplication
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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
    overlapping_skills: List[str]
    recommended_action: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TalentCRMService:
    def __init__(self, db: Any = None, session_factory: Any = None):
        self.db = db
        self.session_factory = session_factory or get_pg_session_factory()

    def _get_session(self):
        return self.session_factory()

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
        cand_dict = {
            "tenant_id": resolved_tenant,
            "candidate_id": candidate_id,
            "candidate_name": candidate_name,
            "candidate_email": candidate_email,
            "original_application_id": original_application_id,
            "original_job_id": original_job_id,
            "original_job_title": original_job_title,
            "final_stage_reached": final_stage_reached,
            "ats_score": ats_score,
            "skills": skills,
            "notes": notes,
            "tags": ["silver_medalist"],
            "status": "available",
        }
        candidate = SilverMedalistCandidate(**cand_dict)

        async with self._get_session() as session:
            stmt = select(CandidateApplication).where(
                and_(CandidateApplication.candidate_id == str(candidate_id), CandidateApplication.tenant_id == str(resolved_tenant))
            )
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none() if hasattr(res, "scalar_one_or_none") else None
            if existing:
                existing.stage = "silver_medalist"
                existing.details = cand_dict
                existing.updated_at = datetime.now(timezone.utc)
            else:
                session.add(CandidateApplication(
                    id=f"app_{uuid.uuid4().hex[:12]}",
                    job_id=str(original_job_id),
                    candidate_id=str(candidate_id),
                    tenant_id=str(resolved_tenant),
                    candidate_name=candidate_name,
                    candidate_email=candidate_email,
                    stage="silver_medalist",
                    match_score=float(ats_score),
                    notes=notes,
                    details=cand_dict,
                ))
            await session.commit()
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
        async with self._get_session() as session:
            stmt = select(CandidateApplication).where(
                and_(
                    CandidateApplication.tenant_id == str(resolved_tenant),
                    CandidateApplication.stage == "silver_medalist"
                )
            )
            res = await session.execute(stmt)
            rows = res.scalars().all() if hasattr(res, "scalars") else []
            candidates_data = [r.details for r in rows if getattr(r, "details", None)]

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
