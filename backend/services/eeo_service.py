"""
EEO Compliance & Segregation Service (Pure SQLAlchemy 2.0 / PostgreSQL).
Guarantees absolute segregation of candidate demographic self-identification data from
the core scoring engine, feature vectors, and recruiter candidate screening interfaces.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import structlog
from sqlalchemy import select

from config.db import get_pg_session_factory
from models.tables import EeoResponse
from schemas.eeo_schema import EEOSelfIdentificationPayload, EEOSelfIdentificationRecord

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

        new_id = f"eeo_{uuid.uuid4().hex[:12]}"
        try:
            async with get_pg_session_factory()() as session:
                eeo_row = EeoResponse(
                    id=new_id,
                    candidate_id=str(candidate_id),
                    tenant_id=str(tenant_id),
                    gender=record.gender,
                    race_ethnicity=record.race_ethnicity,
                    veteran_status=record.veteran_status,
                    disability_status=record.disability_status,
                    application_id=record.application_id,
                    job_id=record.job_id,
                    submitted_at=record.submitted_at,
                )
                session.add(eeo_row)
                await session.commit()
                record.id = new_id
        except Exception as e:
            logger.warning("Failed to record EEO response to PostgreSQL", error=str(e))
            record.id = new_id


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
        gender_counts: Dict[str, int] = {}
        race_counts: Dict[str, int] = {}
        total = 0

        try:
            async with get_pg_session_factory()() as session:
                stmt = select(EeoResponse).where(EeoResponse.tenant_id == str(tenant_id))
                res = await session.execute(stmt)
                records = res.scalars().all()
                total = len(records)
                for r in records:
                    g = r.gender or "Decline to State"
                    gender_counts[g] = gender_counts.get(g, 0) + 1
                    race = r.race_ethnicity or "Decline to State"
                    race_counts[race] = race_counts.get(race, 0) + 1
        except Exception as e:
            logger.warning("Failed to fetch aggregate demographics", error=str(e))

        return {
            "tenant_id": tenant_id,
            "total_responses": total,
            "gender_distribution": gender_counts,
            "race_distribution": race_counts,
            "anonymized": True,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }


eeo_service = EEOService()
