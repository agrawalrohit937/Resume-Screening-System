"""Structured Interview Kit, Scorecard & Calibration Service (Pure PostgreSQL).
CareerShala ATS v2.0.0 - Enterprise ATS Workflows.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import structlog
from sqlalchemy import update

from config.db import get_pg_session_factory
from models.tables import CandidateApplication
from models.interview_kit import (
    InterviewKitModel,
    ScorecardModel,
    CalibrationReport,
    RecommendationEnum,
    RECOMMENDATION_SCORES,
    Competency,
)
from services.multi_tenancy.tenant_context import get_current_tenant_id
from repositories.interview_kit_repo import InterviewKitRepository
from repositories.application_repo import ApplicationRepository

logger = structlog.get_logger(__name__)


class InterviewKitService:
    def __init__(self, db: Any = None, kit_repo: Optional[InterviewKitRepository] = None, app_repo: Optional[ApplicationRepository] = None):
        self.db = db
        self.kit_repo = kit_repo or InterviewKitRepository()
        self.app_repo = app_repo or ApplicationRepository()

    async def create_interview_kit(
        self,
        job_id: str,
        stage_name: str,
        competencies: List[Competency],
        standard_questions: Optional[List[str]] = None,
        tenant_id: Optional[str] = None
    ) -> InterviewKitModel:
        resolved_tenant = tenant_id or get_current_tenant_id()
        kit = InterviewKitModel(
            tenant_id=resolved_tenant,
            job_id=job_id,
            stage_name=stage_name,
            competencies=competencies,
            standard_questions=standard_questions or [],
        )
        saved = await self.kit_repo.create_kit(kit.dict())
        if saved and saved.get("id"):
            kit.id = saved["id"]
        logger.info("Interview kit created via PostgreSQL", kit_id=kit.id, job_id=job_id, stage=stage_name)
        return kit

    async def submit_scorecard(
        self,
        application_id: str,
        candidate_id: str,
        interviewer_id: str,
        stage_name: str,
        ratings: Dict[str, int],
        recommendation: RecommendationEnum,
        notes: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> ScorecardModel:
        resolved_tenant = tenant_id or get_current_tenant_id()
        
        # Enforce ratings between 1 and 5
        validated_ratings = {k: max(1, min(5, int(v))) for k, v in ratings.items()}
        
        # Normalize IDs to strings
        app_id_str = str(application_id) if application_id else ""
        cand_id_str = str(candidate_id) if candidate_id else ""
        interviewer_id_str = str(interviewer_id) if interviewer_id else "interviewer_user"

        scorecard = ScorecardModel(
            tenant_id=resolved_tenant,
            application_id=app_id_str,
            candidate_id=cand_id_str,
            interviewer_id=interviewer_id_str,
            stage_name=stage_name,
            ratings=validated_ratings,
            recommendation=recommendation,
            notes=notes
        )

        saved = await self.kit_repo.submit_scorecard(scorecard.dict())
        if saved and saved.get("id"):
            scorecard.id = saved["id"]
        logger.info("Scorecard saved via repository", application_id=app_id_str, candidate_id=cand_id_str, stage=stage_name)

        try:
            async with get_pg_session_factory()() as session:
                await session.execute(
                    update(CandidateApplication)
                    .where(CandidateApplication.id == str(application_id))
                    .values(updated_at=scorecard.submitted_at)
                )
                await session.commit()
        except Exception as e:
            logger.debug("Application scorecard metadata sync skipped", error=str(e))

        logger.info("Scorecard submitted", application_id=application_id, interviewer_id=interviewer_id, rec=recommendation.value)
        return scorecard

    async def calculate_calibration(
        self,
        application_id: str,
        stage_name: str,
        tenant_id: Optional[str] = None
    ) -> CalibrationReport:
        scorecards_data = await self.kit_repo.get_scorecards_by_application(str(application_id))
        scorecards = [ScorecardModel(**doc) for doc in scorecards_data]

        if not scorecards:
            return CalibrationReport(
                application_id=application_id,
                stage_name=stage_name,
                scorecard_count=0,
                mean_competency_score=0.0,
                rating_variance=0.0,
                consensus_recommendation=RecommendationEnum.MIXED,
                divergent_raters=[],
                calibration_status="insufficient_data"
            )

        # Calculate average overall score per scorecard
        interviewer_averages: Dict[str, float] = {}
        all_ratings: List[float] = []

        for sc in scorecards:
            if sc.ratings:
                avg = sum(sc.ratings.values()) / len(sc.ratings)
            else:
                avg = RECOMMENDATION_SCORES.get(sc.recommendation, 3.0)
            interviewer_averages[sc.interviewer_id] = avg
            all_ratings.append(avg)

        overall_mean = sum(all_ratings) / len(all_ratings)
        variance = sum((x - overall_mean) ** 2 for x in all_ratings) / len(all_ratings) if len(all_ratings) > 1 else 0.0

        # Divergent raters (> 1.25 delta from mean)
        divergent_raters = [
            interviewer_id for interviewer_id, score in interviewer_averages.items()
            if abs(score - overall_mean) >= 1.25
        ]

        # Consensus recommendation from average recommendation scores
        avg_rec_score = sum(RECOMMENDATION_SCORES[sc.recommendation] for sc in scorecards) / len(scorecards)
        if avg_rec_score >= 4.5:
            consensus = RecommendationEnum.STRONG_YES
        elif avg_rec_score >= 3.5:
            consensus = RecommendationEnum.YES
        elif avg_rec_score >= 2.5:
            consensus = RecommendationEnum.MIXED
        elif avg_rec_score >= 1.5:
            consensus = RecommendationEnum.NO
        else:
            consensus = RecommendationEnum.STRONG_NO

        status = "calibrated" if variance < 1.0 and not divergent_raters else "split_decision"

        report = CalibrationReport(
            application_id=application_id,
            stage_name=stage_name,
            scorecard_count=len(scorecards),
            mean_competency_score=round(overall_mean, 2),
            rating_variance=round(variance, 3),
            consensus_recommendation=consensus,
            divergent_raters=divergent_raters,
            calibration_status=status
        )
        logger.info(
            "Interviewer calibration computed",
            application_id=application_id,
            stage=stage_name,
            scorecard_count=len(scorecards),
            variance=report.rating_variance,
            consensus=consensus.value
        )
        return report
