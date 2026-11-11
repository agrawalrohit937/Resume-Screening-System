"""Unit and Integration Tests for Enterprise ATS Workflows (Task 5.3).
CareerShala ATS v2.0.0.
"""

import pytest

from schemas.requisition_schema import RequisitionStatus, ApprovalDecision, ApprovalStep
from services.requisition_service import RequisitionService
from schemas.interview_schema import Competency, RecommendationEnum
from services.interview_kit_service import InterviewKitService
from services.talent_crm_service import TalentCRMService
from services.multi_tenancy.tenant_context import tenant_context


@pytest.mark.asyncio
async def test_requisition_lifecycle_and_approval_chain():
    req_service = RequisitionService()

    with tenant_context("enterprise_tenant_1"):
        # 1. Create requisition in draft
        approval_chain = [
            ApprovalStep(step_order=1, approver_id="mgr_alice", approver_role="hiring_manager"),
            ApprovalStep(step_order=2, approver_id="fin_bob", approver_role="finance")
        ]
        req = await req_service.create_requisition(
            title="Senior Staff Platform Engineer",
            department="Infrastructure",
            hiring_manager_id="mgr_alice",
            headcount=2,
            budget_min=180000,
            budget_max=220000,
            approval_chain=approval_chain
        )
        assert req.status == RequisitionStatus.DRAFT
        assert req.headcount == 2
        assert len(req.approval_chain) == 2

        # 2. Submit for approval
        pending_req = await req_service.submit_for_approval(req.id)
        assert pending_req.status == RequisitionStatus.PENDING_APPROVAL

        # 3. First approver signs off -> still pending
        req_step1 = await req_service.record_approval_decision(
            requisition_id=req.id,
            approver_id="mgr_alice",
            decision=ApprovalDecision.APPROVED,
            comments="Approved headcount"
        )
        assert req_step1.status == RequisitionStatus.PENDING_APPROVAL
        assert req_step1.approval_chain[0].status == ApprovalDecision.APPROVED

        # 4. Second approver signs off -> fully APPROVED
        req_step2 = await req_service.record_approval_decision(
            requisition_id=req.id,
            approver_id="fin_bob",
            decision=ApprovalDecision.APPROVED,
            comments="Budget verified"
        )
        assert req_step2.status == RequisitionStatus.APPROVED

        # 5. Link to created job and open
        open_req = await req_service.link_to_job(req.id, job_id="job_platform_99")
        assert open_req.status == RequisitionStatus.OPEN
        assert open_req.linked_job_id == "job_platform_99"

        # 6. Record hires
        hired_req1 = await req_service.record_hire(req.id, count=1)
        assert hired_req1.filled_count == 1
        assert hired_req1.status == RequisitionStatus.OPEN

        hired_req2 = await req_service.record_hire(req.id, count=1)
        assert hired_req2.filled_count == 2
        assert hired_req2.status == RequisitionStatus.FILLED


@pytest.mark.asyncio
async def test_requisition_rejection_flow():
    req_service = RequisitionService()

    with tenant_context("enterprise_tenant_1"):
        req = await req_service.create_requisition(
            title="Junior QA Engineer",
            department="Quality",
            hiring_manager_id="mgr_alice"
        )
        await req_service.submit_for_approval(req.id)
        rejected = await req_service.record_approval_decision(
            requisition_id=req.id,
            approver_id="mgr_alice",
            decision=ApprovalDecision.REJECTED,
            comments="Hiring freeze active"
        )
        assert rejected.status == RequisitionStatus.REJECTED


@pytest.mark.asyncio
async def test_structured_interview_kits_and_calibration():
    kit_service = InterviewKitService()

    with tenant_context("tenant_acme"):
        # 1. Create interview kit
        rubric_python = {
            1: "No knowledge of Python generators or concurrency",
            3: "Comfortable with async/await and standard data structures",
            5: "Deep mastery of GIL, memory profiling, and metaclasses"
        }
        competencies = [
            Competency(name="Python Systems", description="Core language knowledge", weight=1.5, rubric=rubric_python),
            Competency(name="Communication", description="Articulates architectural trade-offs", weight=1.0)
        ]
        kit = await kit_service.create_interview_kit(
            job_id="job_eng_1",
            stage_name="Technical Deep Dive",
            competencies=competencies,
            standard_questions=["How does asyncio event loop schedule I/O tasks?"]
        )
        assert kit.id is not None
        assert len(kit.competencies) == 2

        # 2. Submit scorecards from 3 different interviewers
        app_id = "app_cand_101"
        cand_id = "cand_101"

        # Interviewer 1: Positive
        await kit_service.submit_scorecard(
            application_id=app_id,
            candidate_id=cand_id,
            interviewer_id="int_1",
            stage_name="Technical Deep Dive",
            ratings={"Python Systems": 5, "Communication": 4},
            recommendation=RecommendationEnum.STRONG_YES,
            notes="Outstanding architectural grasp."
        )

        # Interviewer 2: Moderate
        await kit_service.submit_scorecard(
            application_id=app_id,
            candidate_id=cand_id,
            interviewer_id="int_2",
            stage_name="Technical Deep Dive",
            ratings={"Python Systems": 4, "Communication": 4},
            recommendation=RecommendationEnum.YES,
            notes="Solid answers across all questions."
        )

        # Interviewer 3: Outlier harsh rater
        await kit_service.submit_scorecard(
            application_id=app_id,
            candidate_id=cand_id,
            interviewer_id="int_3",
            stage_name="Technical Deep Dive",
            ratings={"Python Systems": 2, "Communication": 1},
            recommendation=RecommendationEnum.STRONG_NO,
            notes="Missed niche metaclass question."
        )

        # 3. Calculate calibration
        report = await kit_service.calculate_calibration(app_id, stage_name="Technical Deep Dive")
        assert report.scorecard_count == 3
        assert report.divergent_raters == ["int_3"]  # int_3 gave average of 1.5, mean across all was ~3.33 -> delta > 1.25
        assert report.calibration_status == "split_decision"


@pytest.mark.asyncio
async def test_scorecard_submission_upsert_prevents_duplicates():
    kit_service = InterviewKitService()

    with tenant_context("tenant_acme"):
        # 1. Initial submission from interviewer_1
        sc1 = await kit_service.submit_scorecard(
            application_id="app_123",
            candidate_id="cand_456",
            interviewer_id="interviewer_1",
            stage_name="System Design",
            ratings={"Architecture": 4, "Scalability": 3},
            recommendation=RecommendationEnum.YES,
            notes="Initial assessment."
        )
        assert sc1.id is not None
        assert sc1.ratings["Architecture"] == 4
        saved_scorecards = await kit_service.kit_repo.get_scorecards_by_application("app_123")
        assert len(saved_scorecards) == 1

        # 2. Resubmission / update from same interviewer for same candidate and stage
        sc2 = await kit_service.submit_scorecard(
            application_id="app_123",
            candidate_id="cand_456",
            interviewer_id="interviewer_1",
            stage_name="System Design",
            ratings={"Architecture": 5, "Scalability": 5},
            recommendation=RecommendationEnum.STRONG_YES,
            notes="Revised assessment after deep dive."
        )

        # 3. Verify unique constraint: no duplicate record inserted, updated in place
        saved_scorecards2 = await kit_service.kit_repo.get_scorecards_by_application("app_123")
        assert len(saved_scorecards2) == 1
        assert sc2.id == sc1.id
        assert sc2.ratings["Architecture"] == 5
        assert sc2.recommendation == RecommendationEnum.STRONG_YES
        assert sc2.notes == "Revised assessment after deep dive."
        assert saved_scorecards2[0]["ratings"]["Architecture"] == 5
        assert saved_scorecards2[0]["notes"] == "Revised assessment after deep dive."


@pytest.mark.asyncio
async def test_talent_crm_silver_medalist_reengagement():
    crm_service = TalentCRMService()

    # 1. Register silver medalist under tenant_a
    with tenant_context("tenant_a"):
        cand = await crm_service.register_silver_medalist(
            candidate_id="cand_silver_1",
            candidate_name="Jane Developer",
            candidate_email="jane@example.com",
            original_application_id="app_old_55",
            original_job_id="job_old_10",
            original_job_title="Mid Software Engineer",
            final_stage_reached="Executive Review",
            ats_score=88.5,
            skills=["Python", "FastAPI", "Docker", "PostgreSQL", "Kafka"]
        )
        assert "silver_medalist" in cand.tags

        # 2. Match candidate against a new Senior Backend Engineer job in tenant_a
        matches = await crm_service.find_reengagement_matches(
            target_job_id="job_new_77",
            target_job_title="Senior Backend Engineer",
            required_skills=["Python", "Docker", "Kafka", "Kubernetes"],
            min_score=0.4
        )
        assert len(matches) == 1
        assert matches[0].candidate_id == "cand_silver_1"
        assert set(matches[0].overlapping_skills) == {"python", "docker", "kafka"}
        assert matches[0].match_score > 0.6

    # 3. Strict tenant isolation proof: tenant_b cannot view or match tenant_a's silver medalists
    with tenant_context("tenant_b"):
        tenant_b_matches = await crm_service.find_reengagement_matches(
            target_job_id="job_tenant_b_1",
            target_job_title="Senior Backend Engineer",
            required_skills=["Python", "Docker", "Kafka"]
        )
        assert len(tenant_b_matches) == 0
