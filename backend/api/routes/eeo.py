"""Equal Employment Opportunity (EEO) Vault API Routes.
CareerPilot ATS v2.0.0 - Enterprise Surface.
"""

from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import get_database, get_current_user
from models.user_model import UserModel
from models.eeo import EEOSelfIdentificationPayload, EEOSelfIdentificationRecord
from services.eeo_service import EEOService

router = APIRouter()


@router.post("/self-identify", response_model=EEOSelfIdentificationRecord, status_code=status.HTTP_201_CREATED)
async def submit_eeo_self_id_route(
    payload: EEOSelfIdentificationPayload,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """
    Records voluntary EEO self-identification demographic responses into an isolated vault.
    This demographic data is mathematically decoupled from candidate ATS scoring pipelines.
    """
    service = EEOService(db)
    raw_db = getattr(db, "raw_db", db)
    tenant_id = getattr(current_user, "tenant_id", "default") or "default"

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

    return await service.record_self_identification(
        candidate_id=str(current_user.id or "candidate_user"),
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


@router.post("/demo-seed", response_model=Dict[str, Any])
async def seed_demo_eeo_data_route(
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """
    Seeds realistic anonymized voluntary demographic responses in db.eeo_responses
    for test / demonstration of Executive Diversity Analytics. Strict vault isolation is maintained.
    """
    if not current_user.has_role("admin", "platform_admin", "executive", "exec", "recruiter"):
        raise HTTPException(status_code=403, detail="Unauthorized to seed compliance data")

    raw_db = getattr(db, "raw_db", db)
    tenant_id = getattr(current_user, "tenant_id", "default") or "default"

    # Find recruiter jobs to link with
    job_ids = []
    job_query = {}
    if tenant_id and tenant_id != "default":
        job_query["tenant_id"] = tenant_id
    else:
        job_query["created_by"] = str(current_user.id)
    jobs = await raw_db.jobs.find(job_query, {"_id": 1}).to_list(10)
    job_ids = [str(j["_id"]) for j in jobs]
    primary_job_id = job_ids[0] if job_ids else None

    # Sample demographic profiles conforming to standard EEOC categories
    sample_records = [
        {
            "gender": "Female",
            "race_ethnicity": "Asian",
            "veteran_status": "I am not a protected veteran",
            "disability_status": "No, I don't have a disability, or a history/record of having a disability",
        },
        {
            "gender": "Female",
            "race_ethnicity": "Hispanic or Latino",
            "veteran_status": "I am not a protected veteran",
            "disability_status": "No, I don't have a disability, or a history/record of having a disability",
        },
        {
            "gender": "Male",
            "race_ethnicity": "White (Not Hispanic or Latino)",
            "veteran_status": "I am not a protected veteran",
            "disability_status": "No, I don't have a disability, or a history/record of having a disability",
        },
        {
            "gender": "Male",
            "race_ethnicity": "Black or African American",
            "veteran_status": "I identify as one or more of the classifications of protected veteran",
            "disability_status": "No, I don't have a disability, or a history/record of having a disability",
        },
        {
            "gender": "Non-Binary",
            "race_ethnicity": "Two or More Races",
            "veteran_status": "I am not a protected veteran",
            "disability_status": "Yes, I have a disability, or have a history/record of having a disability",
        },
        {
            "gender": "Female",
            "race_ethnicity": "Asian",
            "veteran_status": "I am not a protected veteran",
            "disability_status": "No, I don't have a disability, or a history/record of having a disability",
        },
        {
            "gender": "Male",
            "race_ethnicity": "White (Not Hispanic or Latino)",
            "veteran_status": "I am not a protected veteran",
            "disability_status": "No, I don't have a disability, or a history/record of having a disability",
        },
        {
            "gender": "Decline to State",
            "race_ethnicity": "Decline to State",
            "veteran_status": "I decline to state my veteran status",
            "disability_status": "I do not wish to answer",
        },
        {
            "gender": "Female",
            "race_ethnicity": "Black or African American",
            "veteran_status": "I am not a protected veteran",
            "disability_status": "No, I don't have a disability, or a history/record of having a disability",
        },
        {
            "gender": "Male",
            "race_ethnicity": "Asian",
            "veteran_status": "I am not a protected veteran",
            "disability_status": "No, I don't have a disability, or a history/record of having a disability",
        },
    ]

    from datetime import datetime, timezone
    from bson import ObjectId

    inserted = 0
    for idx, item in enumerate(sample_records):
        doc = {
            "_id": ObjectId(),
            "candidate_id": f"demo_candidate_{idx+1}",
            "tenant_id": tenant_id,
            "job_id": primary_job_id,
            "gender": item["gender"],
            "race_ethnicity": item["race_ethnicity"],
            "veteran_status": item["veteran_status"],
            "disability_status": item["disability_status"],
            "submitted_at": datetime.now(timezone.utc),
        }
        await raw_db.eeo_responses.insert_one(doc)
        inserted += 1

    return {
        "success": True,
        "message": f"Successfully seeded {inserted} anonymized EEO records into vault for tenant '{tenant_id}'",
        "count": inserted,
        "tenant_id": tenant_id,
    }
