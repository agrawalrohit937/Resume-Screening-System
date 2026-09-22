"""Consented Talent Pool Service (Privacy-Preserving Search & Candidate Controls).
CareerPilot ATS v2.0.0 - Enterprise ATS Marketplace.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
import hashlib
import structlog

from models.talent_pool import TalentPoolProfile, TalentPoolViewAudit, VisibilityTier

logger = structlog.get_logger(__name__)


class TalentPoolService:
    def __init__(self, db):
        self.db = db

    async def create_or_update_profile(
        self,
        candidate_id: str,
        headline: str,
        summary: str,
        skills: List[str],
        years_experience: float,
        current_company: Optional[str],
        candidate_name: str,
        candidate_email: str,
        excluded_employers: Optional[List[str]] = None
    ) -> TalentPoolProfile:
        doc = await self.db.talent_pool_profiles.find_one({"candidate_id": candidate_id})
        excluded = [e.lower().strip() for e in (excluded_employers or []) if e.strip()]
        
        if doc:
            profile = TalentPoolProfile(**doc)
            profile.headline = headline
            profile.summary = summary
            profile.skills = [s.strip() for s in skills]
            profile.years_experience = years_experience
            profile.current_company = current_company
            profile.candidate_name = candidate_name
            profile.candidate_email = candidate_email
            profile.excluded_employers = excluded
            profile.updated_at = datetime.utcnow()
            await self.db.talent_pool_profiles.update_one(
                {"candidate_id": candidate_id},
                {"$set": profile.dict()}
            )
        else:
            profile = TalentPoolProfile(
                candidate_id=candidate_id,
                opted_in=False,  # Defaults to False (OFF)
                visibility_tier=VisibilityTier.HIDDEN,
                headline=headline,
                summary=summary,
                skills=[s.strip() for s in skills],
                years_experience=years_experience,
                current_company=current_company,
                candidate_name=candidate_name,
                candidate_email=candidate_email,
                excluded_employers=excluded
            )
            await self.db.talent_pool_profiles.insert_one(profile.dict())

        logger.info("Talent pool profile updated", candidate_id=candidate_id, opted_in=profile.opted_in)
        return profile

    async def grant_consent(
        self,
        candidate_id: str,
        visibility_tier: VisibilityTier = VisibilityTier.ANONYMIZED
    ) -> Optional[TalentPoolProfile]:
        if visibility_tier == VisibilityTier.HIDDEN:
            return await self.revoke_consent(candidate_id)

        now = datetime.utcnow()
        await self.db.talent_pool_profiles.update_one(
            {"candidate_id": candidate_id},
            {
                "$set": {
                    "opted_in": True,
                    "visibility_tier": visibility_tier.value,
                    "consent_granted_at": now,
                    "consent_revoked_at": None,
                    "updated_at": now
                }
            }
        )
        doc = await self.db.talent_pool_profiles.find_one({"candidate_id": candidate_id})
        logger.info("Talent pool consent granted", candidate_id=candidate_id, tier=visibility_tier.value)
        return TalentPoolProfile(**doc) if doc else None

    async def revoke_consent(self, candidate_id: str) -> Optional[TalentPoolProfile]:
        now = datetime.utcnow()
        await self.db.talent_pool_profiles.update_one(
            {"candidate_id": candidate_id},
            {
                "$set": {
                    "opted_in": False,
                    "visibility_tier": VisibilityTier.HIDDEN.value,
                    "consent_revoked_at": now,
                    "updated_at": now
                }
            }
        )
        doc = await self.db.talent_pool_profiles.find_one({"candidate_id": candidate_id})
        logger.info("Talent pool consent revoked", candidate_id=candidate_id)
        return TalentPoolProfile(**doc) if doc else None

    async def search_talent_pool(
        self,
        query_skills: List[str],
        min_experience: float = 0.0,
        recruiter_company: str = "Enterprise Corp",
        recruiter_tenant_id: str = "default",
        recruiter_id: str = "recruiter_1"
    ) -> List[Dict[str, Any]]:
        # 1. Fetch only opted-in profiles that are not hidden
        cursor = self.db.talent_pool_profiles.find({
            "opted_in": True,
            "visibility_tier": {"$ne": VisibilityTier.HIDDEN.value},
            "years_experience": {"$gte": min_experience}
        })
        profiles_data = await cursor.to_list(length=100)
        
        results: List[Dict[str, Any]] = []
        clean_company = recruiter_company.lower().strip()
        query_skills_set = {s.lower().strip() for s in query_skills}

        for doc in profiles_data:
            profile = TalentPoolProfile(**doc)

            # 2. Enforce Excluded Employers Blocklist:
            # If recruiter's company is in candidate's blocklist, immediately skip
            is_blocked = any(
                ex in clean_company or clean_company in ex
                for ex in profile.excluded_employers
            )
            if is_blocked:
                logger.info("Skipping candidate due to employer blocklist match", candidate_id=profile.candidate_id)
                continue

            # 3. Check skill overlap
            cand_skills_set = {s.lower().strip() for s in profile.skills}
            overlap = list(cand_skills_set.intersection(query_skills_set))
            if query_skills and not overlap:
                continue

            # 4. Apply visibility tier redaction
            if profile.visibility_tier == VisibilityTier.ANONYMIZED:
                anon_id = hashlib.sha256(profile.candidate_id.encode("utf-8")).hexdigest()[:8]
                display_name = f"Candidate #{anon_id.upper()}"
                display_email = "[hidden@consented-talent-pool]"
                display_company = "[Confidential Employer]"
            else:  # FULL
                display_name = profile.candidate_name
                display_email = profile.candidate_email
                display_company = profile.current_company or "Confidential"

            item = {
                "candidate_id": profile.candidate_id,
                "visibility_tier": profile.visibility_tier.value,
                "name": display_name,
                "email": display_email,
                "current_company": display_company,
                "headline": profile.headline,
                "summary": profile.summary,
                "years_experience": profile.years_experience,
                "matching_skills": overlap,
                "all_skills": profile.skills
            }
            results.append(item)

            # 5. Record Transparency View Audit
            audit = TalentPoolViewAudit(
                candidate_id=profile.candidate_id,
                recruiter_id=recruiter_id,
                recruiter_company=recruiter_company,
                recruiter_tenant_id=recruiter_tenant_id,
                visibility_tier_at_view=profile.visibility_tier
            )
            await self.db.talent_pool_views.insert_one(audit.dict())

        logger.info("Talent pool search completed", query_skills=query_skills, results_count=len(results))
        return results

    async def get_candidate_view_history(self, candidate_id: str) -> List[TalentPoolViewAudit]:
        """Allows candidates to inspect who viewed their profile in the talent pool."""
        cursor = self.db.talent_pool_views.find({"candidate_id": candidate_id})
        views_data = await cursor.to_list(length=100)
        return [TalentPoolViewAudit(**v) for v in views_data]
