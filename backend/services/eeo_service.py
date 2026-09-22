"""
EEO Compliance & Segregation Service.

Phase 5, Task 5.2:
Guarantees absolute segregation of candidate demographic self-identification data from
the core scoring engine, feature vectors, and recruiter candidate screening interfaces.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
import structlog

from core.feature_flags import FEATURE_EEO_ISOLATION
from models.eeo import EEOSelfIdentificationPayload, EEOSelfIdentificationRecord
from services.multi_tenancy import tenant_context

logger = structlog.get_logger(__name__)


class EEOService:
    """
    Manages voluntary demographic self-identification with absolute algorithmic isolation.
    """

    def __init__(self, db: Any = None):
        self.db = db

    async def record_self_identification(
        self,
        candidate_id: str,
        payload: EEOSelfIdentificationPayload,
        tenant_id: str,
        db: Any = None,
    ) -> EEOSelfIdentificationRecord:
        return await self.save_self_identification(
            payload=payload,
            candidate_id=candidate_id,
            tenant_id=tenant_id,
            db=db or self.db,
        )

    async def generate_aggregate_report(
        self,
        tenant_id: str,
        db: Any = None,
    ) -> Dict[str, Any]:
        return await self.get_aggregate_demographics_report(
            tenant_id=tenant_id,
            db=db or self.db,
        )

    async def save_self_identification(
        self,
        payload: EEOSelfIdentificationPayload,
        candidate_id: str,
        tenant_id: str,
        db: Any = None,
    ) -> EEOSelfIdentificationRecord:
        """
        Stores voluntary demographic information exclusively in `db.eeo_responses`.
        This collection is mathematically isolated from applications, resumes, and scoring.
        """
        active_db = db if db is not None else self.db
        record = EEOSelfIdentificationRecord(
            candidate_id=str(candidate_id),
            tenant_id=str(tenant_id),
            gender=payload.gender.value if hasattr(payload.gender, "value") else str(payload.gender or "Decline to State"),
            race_ethnicity=payload.race_ethnicity.value if hasattr(payload.race_ethnicity, "value") else str(payload.race_ethnicity or "Decline to State"),
            veteran_status=payload.veteran_status.value if hasattr(payload.veteran_status, "value") else str(payload.veteran_status or "Decline to State"),
            disability_status=payload.disability_status.value if hasattr(payload.disability_status, "value") else str(payload.disability_status or "Decline to State"),
            application_id=str(payload.application_id) if payload.application_id else None,
            job_id=str(payload.job_id) if payload.job_id else None,
            submitted_at=datetime.now(timezone.utc),
        )

        if active_db is not None:
            doc = record.model_dump(by_alias=True, exclude={"id"})
            doc["_id"] = ObjectId()
            await active_db.eeo_responses.insert_one(doc)
            record.id = str(doc["_id"])

        logger.info(
            "EEO self-identification recorded to isolated vault",
            candidate_id=str(candidate_id),
            tenant_id=tenant_id,
        )
        return record

    async def get_aggregate_demographics_report(
        self,
        tenant_id: str,
        db: Any = None,
    ) -> Dict[str, Any]:
        """
        Generates an anonymized aggregate summary for compliance reporting.
        Individual responses are never exposed.
        """
        active_db = db if db is not None else self.db
        if active_db is None:
            return {"total_responses": 0, "gender_distribution": {}, "race_distribution": {}}

        from utils.pagination import stream_cursor
        cursor = active_db.eeo_responses.find({"tenant_id": tenant_id})
        records = await stream_cursor(cursor)

        gender_counts: Dict[str, int] = {}
        race_counts: Dict[str, int] = {}

        for r in records:
            g = r.get("gender", "Decline to State")
            gender_counts[g] = gender_counts.get(g, 0) + 1

            race = r.get("race_ethnicity", "Decline to State")
            race_counts[race] = race_counts.get(race, 0) + 1

        return {
            "tenant_id": tenant_id,
            "total_responses": len(records),
            "gender_distribution": gender_counts,
            "race_distribution": race_counts,
            "anonymized": True,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }


eeo_service = EEOService()
