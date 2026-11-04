from __future__ import annotations
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import structlog
from sqlalchemy import select, and_, desc

from config.db import get_pg_session_factory
from models.tables import TalentPoolProfile as TalentPoolTable, AuditLog
from models.talent_pool import TalentPoolProfile, TalentPoolViewAudit, VisibilityTier

logger = structlog.get_logger(__name__)


class TalentPoolService:
    """Consented Talent Pool Service (Privacy-Preserving Search & Candidate Controls).
    100% Native PostgreSQL via SQLAlchemy 2.0.
    """

    def __init__(self, db: Optional[Any] = None, session_factory: Optional[Any] = None):
        self.db = db
        self._session_factory = session_factory

    @property
    def session_factory(self):
        return self._session_factory or get_pg_session_factory()

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
        excluded_employers: Optional[List[str]] = None,
    ) -> TalentPoolProfile:
        excluded = [e.lower().strip() for e in (excluded_employers or []) if e.strip()]
        now = datetime.now(timezone.utc)

        async with self.session_factory() as session:
            stmt = select(TalentPoolTable).where(TalentPoolTable.candidate_id == str(candidate_id))
            tp_row = (await session.execute(stmt)).scalar_one_or_none()

            if tp_row:
                doc = dict(tp_row.profile_data or {})
                profile = TalentPoolProfile(**doc) if doc else TalentPoolProfile(candidate_id=candidate_id)
                profile.headline = headline
                profile.summary = summary
                profile.skills = [s.strip() for s in skills]
                profile.years_experience = years_experience
                profile.current_company = current_company
                profile.candidate_name = candidate_name
                profile.candidate_email = candidate_email
                profile.excluded_employers = excluded
                profile.updated_at = now

                tp_row.opted_in = profile.opted_in
                tp_row.visibility_tier = profile.visibility_tier.value if hasattr(profile.visibility_tier, "value") else str(profile.visibility_tier)
                tp_row.years_experience = profile.years_experience
                tp_row.profile_data = profile.dict()
                await session.commit()
            else:
                profile = TalentPoolProfile(
                    candidate_id=candidate_id,
                    opted_in=False,
                    visibility_tier=VisibilityTier.HIDDEN,
                    headline=headline,
                    summary=summary,
                    skills=[s.strip() for s in skills],
                    years_experience=years_experience,
                    current_company=current_company,
                    candidate_name=candidate_name,
                    candidate_email=candidate_email,
                    excluded_employers=excluded,
                )
                new_tp = TalentPoolTable(
                    id=f"tp_{uuid.uuid4().hex[:12]}",
                    candidate_id=str(candidate_id),
                    opted_in=profile.opted_in,
                    visibility_tier=profile.visibility_tier.value if hasattr(profile.visibility_tier, "value") else str(profile.visibility_tier),
                    years_experience=profile.years_experience,
                    profile_data=profile.dict(),
                )
                session.add(new_tp)
                await session.commit()

        logger.info("Talent pool profile updated", candidate_id=candidate_id, opted_in=profile.opted_in)
        return profile

    async def grant_consent(
        self,
        candidate_id: str,
        visibility_tier: VisibilityTier = VisibilityTier.ANONYMIZED,
    ) -> Optional[TalentPoolProfile]:
        if visibility_tier == VisibilityTier.HIDDEN:
            return await self.revoke_consent(candidate_id)

        now = datetime.now(timezone.utc)
        tier_val = visibility_tier.value if hasattr(visibility_tier, "value") else str(visibility_tier)

        async with self.session_factory() as session:
            stmt = select(TalentPoolTable).where(TalentPoolTable.candidate_id == str(candidate_id))
            tp_row = (await session.execute(stmt)).scalar_one_or_none()
            if not tp_row:
                return None

            doc = dict(tp_row.profile_data or {})
            doc["opted_in"] = True
            doc["visibility_tier"] = tier_val
            doc["consent_granted_at"] = now.isoformat()
            doc["consent_revoked_at"] = None

            tp_row.opted_in = True
            tp_row.visibility_tier = tier_val
            tp_row.profile_data = doc
            await session.commit()

        logger.info("Talent pool consent granted", candidate_id=candidate_id, tier=tier_val)
        return TalentPoolProfile(**doc)

    async def revoke_consent(self, candidate_id: str) -> Optional[TalentPoolProfile]:
        now = datetime.now(timezone.utc)
        hidden_val = VisibilityTier.HIDDEN.value

        async with self.session_factory() as session:
            stmt = select(TalentPoolTable).where(TalentPoolTable.candidate_id == str(candidate_id))
            tp_row = (await session.execute(stmt)).scalar_one_or_none()
            if not tp_row:
                return None

            doc = dict(tp_row.profile_data or {})
            doc["opted_in"] = False
            doc["visibility_tier"] = hidden_val
            doc["consent_revoked_at"] = now.isoformat()

            tp_row.opted_in = False
            tp_row.visibility_tier = hidden_val
            tp_row.profile_data = doc
            await session.commit()

        logger.info("Talent pool consent revoked", candidate_id=candidate_id)
        return TalentPoolProfile(**doc)

    async def search_consented_pool(
        self,
        query_skills: List[str],
        min_experience: float = 0.0,
        recruiter_company: str = "Enterprise Corp",
        recruiter_tenant_id: str = "default",
        recruiter_id: str = "recruiter_1",
    ) -> List[Dict[str, Any]]:
        # 1. Fetch only opted-in profiles that are not hidden via PostgreSQL
        async with self.session_factory() as session:
            stmt = select(TalentPoolTable).where(
                TalentPoolTable.opted_in == True,
                TalentPoolTable.visibility_tier != VisibilityTier.HIDDEN.value,
                TalentPoolTable.years_experience >= min_experience,
            ).limit(100)
            rows = (await session.execute(stmt)).scalars().all()
            profiles_data = [dict(r.profile_data or {}) for r in rows if r.profile_data]

        results: List[Dict[str, Any]] = []
        clean_company = recruiter_company.lower().strip()
        query_skills_set = {s.lower().strip() for s in query_skills}

        for doc in profiles_data:
            profile = TalentPoolProfile(**doc)

            # Candidate must be explicitly opted-in and not hidden
            if not profile.opted_in or profile.visibility_tier == VisibilityTier.HIDDEN or profile.years_experience < min_experience:
                continue

            # 2. Enforce Excluded Employers Blocklist
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
            else:
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
                "all_skills": profile.skills,
            }
            results.append(item)

            # 5. Record Transparency View Audit in PostgreSQL AuditLog
            try:
                async with self.session_factory() as session:
                    async with session.begin():
                        audit_entry = AuditLog(
                            id=f"audit_{uuid.uuid4().hex[:12]}",
                            event_id=str(uuid.uuid4()),
                            tenant_id=recruiter_tenant_id,
                            actor_id=str(recruiter_id),
                            action="talent_pool_view",
                            target_id=str(profile.candidate_id),
                            created_at=datetime.now(timezone.utc),
                            payload={
                                "recruiter_company": recruiter_company,
                                "visibility_tier": profile.visibility_tier.value,
                            },
                        )
                        session.add(audit_entry)
            except Exception as e:
                logger.warning("Could not persist talent pool view audit", error=str(e))

            logger.info("Talent pool profile viewed", candidate_id=profile.candidate_id, recruiter_id=recruiter_id)

        logger.info("Talent pool search completed", query_skills=query_skills, results_count=len(results))
        return results

    search_talent_pool = search_consented_pool

    async def get_candidate_view_history(self, candidate_id: str) -> List[TalentPoolViewAudit]:
        """Allows candidates to inspect who viewed their profile in the talent pool from AuditLog."""
        try:
            async with self.session_factory() as session:
                stmt = (
                    select(AuditLog)
                    .where(
                        AuditLog.action == "talent_pool_view",
                        AuditLog.target_id == str(candidate_id),
                    )
                    .order_by(AuditLog.created_at.asc())
                    .limit(50)
                )
                rows = (await session.execute(stmt)).scalars().all()
                audits = []
                for r in rows:
                    payload = dict(r.payload or {})
                    tier = payload.get("visibility_tier", VisibilityTier.ANONYMIZED.value)
                    audits.append(
                        TalentPoolViewAudit(
                            candidate_id=candidate_id,
                            recruiter_id=str(r.actor_id),
                            recruiter_company=payload.get("recruiter_company", "Enterprise"),
                            recruiter_tenant_id=str(r.tenant_id or "default"),
                            visibility_tier_at_view=VisibilityTier(tier) if tier in [v.value for v in VisibilityTier] else VisibilityTier.ANONYMIZED,
                            viewed_at=r.created_at or datetime.now(timezone.utc),
                        )
                    )
                return audits
        except Exception as e:
            logger.warning("Error fetching view history", error=str(e))
            return []
