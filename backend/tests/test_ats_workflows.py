"""Unit and Integration Tests for Enterprise ATS Workflows (Task 5.3).
CareerShala ATS v2.0.0.
"""

import pytest

from schemas.interview_schema import Competency, RecommendationEnum
from services.interview_kit_service import InterviewKitService
from services.multi_tenancy.tenant_context import tenant_context


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

