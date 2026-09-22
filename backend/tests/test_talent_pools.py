"""Unit and Integration Tests for Consented Talent Pools (Task 5.5).
CareerPilot ATS v2.0.0.
"""

import pytest
from models.talent_pool import VisibilityTier
from services.talent_pool_service import TalentPoolService


class InMemoryCollection:
    def __init__(self):
        self.docs = []

    async def insert_one(self, doc):
        self.docs.append(dict(doc))
        return type("InsertResult", (), {"inserted_id": doc.get("id")})()

    async def find_one(self, query):
        for d in self.docs:
            if all(d.get(k) == v for k, v in query.items()):
                return dict(d)
        return None

    def find(self, query):
        results = []
        for d in self.docs:
            match = True
            for k, v in query.items():
                if isinstance(v, dict):
                    if "$ne" in v and d.get(k) == v["$ne"]:
                        match = False
                        break
                    if "$gte" in v and (d.get(k) is None or d.get(k) < v["$gte"]):
                        match = False
                        break
                elif d.get(k) != v:
                    match = False
                    break
            if match:
                results.append(dict(d))

        class MockCursor:
            def __init__(self, data):
                self.data = data

            async def to_list(self, length=100):
                return self.data[:length]

        return MockCursor(results)

    async def update_one(self, query, update):
        for d in self.docs:
            if all(d.get(k) == v for k, v in query.items()):
                if "$set" in update:
                    d.update(update["$set"])
                return type("UpdateResult", (), {"modified_count": 1})()
        return type("UpdateResult", (), {"modified_count": 0})()


class MockDB:
    def __init__(self):
        self.talent_pool_profiles = InMemoryCollection()
        self.talent_pool_views = InMemoryCollection()


@pytest.mark.asyncio
async def test_consented_talent_pool_lifecycle():
    db = MockDB()
    service = TalentPoolService(db)

    # 1. Profile created: Default is strictly OFF (opted_in=False, HIDDEN)
    profile = await service.create_or_update_profile(
        candidate_id="cand_alex_99",
        headline="Senior Distributed Systems Engineer",
        summary="Specializing in high-throughput consensus protocols",
        skills=["Go", "Raft", "Distributed Systems", "Kubernetes"],
        years_experience=7.0,
        current_company="Acme Corp",
        candidate_name="Alex Mercer",
        candidate_email="alex.mercer@gmail.com",
        excluded_employers=["Acme Corp", "BadBoss Inc"]
    )
    assert profile.opted_in is False
    assert profile.visibility_tier == VisibilityTier.HIDDEN

    # Search returns NOTHING because candidate has not opted in
    results_unconsented = await service.search_talent_pool(
        query_skills=["Go", "Raft"],
        recruiter_company="ThirdParty Venture",
        recruiter_tenant_id="tenant_venture",
        recruiter_id="recruiter_sam"
    )
    assert len(results_unconsented) == 0

    # 2. Candidate Grants Consent: ANONYMIZED tier
    consented_profile = await service.grant_consent("cand_alex_99", VisibilityTier.ANONYMIZED)
    assert consented_profile.opted_in is True
    assert consented_profile.visibility_tier == VisibilityTier.ANONYMIZED
    assert consented_profile.consent_granted_at is not None

    # Recruiter from neutral company searches: gets ANONYMIZED profile
    results_neutral = await service.search_talent_pool(
        query_skills=["Go", "Raft"],
        min_experience=5.0,
        recruiter_company="ScaleFast Technologies",
        recruiter_tenant_id="tenant_scale",
        recruiter_id="rec_scale_1"
    )
    assert len(results_neutral) == 1
    found = results_neutral[0]
    assert found["candidate_id"] == "cand_alex_99"
    assert found["name"].startswith("Candidate #")
    assert found["name"] != "Alex Mercer"  # Masked!
    assert found["email"] == "[hidden@consented-talent-pool]"
    assert found["current_company"] == "[Confidential Employer]"
    assert set(found["matching_skills"]) == {"go", "raft"}

    # 3. Recruiter from EXCLUDED company searches: Candidate is hidden completely!
    results_blocked = await service.search_talent_pool(
        query_skills=["Go"],
        recruiter_company="Acme Corporation USA",  # Matches "acme corp"
        recruiter_tenant_id="tenant_acme",
        recruiter_id="rec_acme_boss"
    )
    assert len(results_blocked) == 0

    # 4. Candidate Upgrades to FULL visibility
    await service.grant_consent("cand_alex_99", VisibilityTier.FULL)
    results_full = await service.search_talent_pool(
        query_skills=["Go"],
        recruiter_company="ScaleFast Technologies",
        recruiter_tenant_id="tenant_scale",
        recruiter_id="rec_scale_1"
    )
    assert len(results_full) == 1
    found_full = results_full[0]
    assert found_full["name"] == "Alex Mercer"
    assert found_full["email"] == "alex.mercer@gmail.com"

    # 5. Candidate Transparency: Candidate checks who viewed them
    history = await service.get_candidate_view_history("cand_alex_99")
    assert len(history) == 2  # First view (anonymized), second view (full)
    assert history[0].recruiter_company == "ScaleFast Technologies"
    assert history[0].visibility_tier_at_view == VisibilityTier.ANONYMIZED
    assert history[1].visibility_tier_at_view == VisibilityTier.FULL

    # 6. Immediate Revocation
    revoked = await service.revoke_consent("cand_alex_99")
    assert revoked.opted_in is False
    assert revoked.visibility_tier == VisibilityTier.HIDDEN
    assert revoked.consent_revoked_at is not None

    # Subsequent search returns 0 results
    results_after_revocation = await service.search_talent_pool(
        query_skills=["Go"],
        recruiter_company="ScaleFast Technologies",
        recruiter_tenant_id="tenant_scale",
        recruiter_id="rec_scale_1"
    )
    assert len(results_after_revocation) == 0
