"""Equal Employment Opportunity (EEO) Vault API Routes.
CareerShala ATS v2.0.0 - Enterprise Surface.
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import get_database, get_current_user, get_optional_current_user
from models.user_model import UserModel
from models.eeo import EEOSelfIdentificationPayload, EEOSelfIdentificationRecord
from services.eeo_service import EEOService

router = APIRouter()


@router.post("/self-identify", response_model=EEOSelfIdentificationRecord, status_code=status.HTTP_201_CREATED)
@router.post("/self-id", response_model=EEOSelfIdentificationRecord, status_code=status.HTTP_201_CREATED)
async def submit_eeo_self_id_route(
    payload: EEOSelfIdentificationPayload,
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Any = Depends(get_database),
):
    """
    Records voluntary EEO self-identification demographic responses into an isolated vault.
    This demographic data is mathematically decoupled from candidate ATS scoring pipelines.
    """
    service = EEOService(db)
    raw_db = getattr(db, "raw_db", db)
    tenant_id = getattr(current_user, "tenant_id", "default") if current_user else "default"
    tenant_id = tenant_id or "default"

    # If job_id or application_id provided, resolve employer's tenant_id
    if payload.job_id:
        try:
            from bson import ObjectId
            job = await raw_db.jobs.find_one({"_id": ObjectId(payload.job_id)})
            if job and job.get("tenant_id") and job.get("tenant_id") != "default":
                tenant_id = job.get("tenant_id")
        except Exception:
            pass
    elif payload.application_id:
        try:
            from bson import ObjectId
            app_doc = await raw_db.applications.find_one({"_id": ObjectId(payload.application_id)})
            if app_doc and app_doc.get("tenant_id") and app_doc.get("tenant_id") != "default":
                tenant_id = app_doc.get("tenant_id")
        except Exception:
            pass

    cand_id = "candidate_user"
    if current_user and getattr(current_user, "id", None):
        cand_id = str(current_user.id)
    elif payload.application_id:
        cand_id = f"app_{payload.application_id}"

    return await service.record_self_identification(
        candidate_id=cand_id,
        payload=payload,
        tenant_id=tenant_id,
    )


@router.get("/aggregate-report", response_model=Dict[str, Any])
async def get_eeo_aggregate_report_route(
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """
    Generates an aggregate anonymized demographic report for statutory compliance.
    Individual candidate responses are never exposed to recruiters.
    """
    if not current_user.has_role("admin", "platform_admin", "executive", "exec", "recruiter"):
        raise HTTPException(status_code=403, detail="Unauthorized to access compliance reports")

    service = EEOService(db)
    tenant_id = getattr(current_user, "tenant_id", "default") or "default"
    return await service.generate_aggregate_report(tenant_id=tenant_id)



