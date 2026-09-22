"""Structured Interview Kit, Scorecard & Calibration Service.
CareerPilot ATS v2.0.0 - Enterprise ATS Workflows.
"""

from datetime import datetime
import math
from typing import List, Optional, Dict
import structlog

from models.interview_kit import (
    InterviewKitModel,
    ScorecardModel,
    CalibrationReport,
    RecommendationEnum,
    RECOMMENDATION_SCORES,
    Competency,
)
from services.multi_tenancy.tenant_context import get_current_tenant_id

logger = structlog.get_logger(__name__)


class InterviewKitService:
    def __init__(self, db):
        self.db = db

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
        await self.db.interview_kits.insert_one(kit.dict())
        logger.info("Interview kit created", kit_id=kit.id, job_id=job_id, stage=stage_name)
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

        # Enforce unique constraint per (candidate_id, interviewer_id, stage) or (application_id, interviewer_id, stage)
        existing = None
        if cand_id_str:
            existing = await self.db.scorecards.find_one({
                "candidate_id": cand_id_str,
                "interviewer_id": interviewer_id_str,
                "stage_name": stage_name,
            })
        if not existing and app_id_str:
            existing = await self.db.scorecards.find_one({
                "application_id": app_id_str,
                "interviewer_id": interviewer_id_str,
                "stage_name": stage_name,
            })

        if existing:
            # Preserve existing ID and update in place (atomic upsert)
            existing_id = existing.get("id") or (str(existing.get("_id")) if existing.get("_id") else None)
            if existing_id:
                scorecard.id = str(existing.get("id") or existing_id)
            scorecard_dict = scorecard.dict()

            if "id" in existing:
                up_q = {"id": existing["id"]}
            elif "_id" in existing:
                up_q = {"_id": existing["_id"]}
            elif cand_id_str:
                up_q = {"candidate_id": cand_id_str, "interviewer_id": interviewer_id_str, "stage_name": stage_name}
            else:
                up_q = {"application_id": app_id_str, "interviewer_id": interviewer_id_str, "stage_name": stage_name}

            await self.db.scorecards.update_one(
                up_q,
                {"$set": scorecard_dict}
            )
            logger.info("Existing scorecard updated (upsert)", application_id=app_id_str, candidate_id=cand_id_str, interviewer_id=interviewer_id_str, stage=stage_name)
        else:
            await self.db.scorecards.insert_one(scorecard.dict())
            logger.info("New scorecard inserted", application_id=app_id_str, candidate_id=cand_id_str, interviewer_id=interviewer_id_str, stage=stage_name)

        if hasattr(self.db, "applications"):
            try:
                from bson import ObjectId
                app_oid = ObjectId(application_id) if ObjectId.is_valid(application_id) else None
                app_query = {"_id": app_oid} if app_oid else {"_id": application_id}
                await self.db.applications.update_one(
                    app_query,
                    {"$set": {
                        f"scorecard_{interviewer_id}": scorecard.dict(),
                        "has_scorecard": True,
                        "last_scorecard_submitted_at": scorecard.submitted_at,
                    }}
                )
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
        resolved_tenant = tenant_id or get_current_tenant_id()
        cursor = self.db.scorecards.find({
            "application_id": application_id,
            "stage_name": stage_name,
            "tenant_id": resolved_tenant
        })
        scorecards_data = await cursor.to_list(length=100)

        # Resilient fallback: If no scorecards match the exact stage_name, fetch all scorecards for this application
        if not scorecards_data:
            cursor_all = self.db.scorecards.find({
                "application_id": application_id,
                "tenant_id": resolved_tenant
            })
            scorecards_data = await cursor_all.to_list(length=100)
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
