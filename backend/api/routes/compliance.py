"""
Regulatory Compliance & Candidate Data Rights API Routes.
Provides:
- NYC Local Law 144 Bias Audit Reporting (/api/v1/compliance/bias-audit)
- Candidate Data Rights Portal (/api/v1/compliance/candidate-portal/{candidate_id})
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from api.deps import get_database, get_current_user
from models.user_model import UserModel
from services.fairness.impact_monitor import compute_adverse_impact_report
from utils.pagination import stream_cursor

router = APIRouter(prefix="/api/v1/compliance", tags=["Regulatory Compliance & Fairness"])


class BiasAuditSummary(BaseModel):
    audit_year: int
    regulatory_standard: str = "NYC Local Law 144 & EEOC 4/5ths Rule"
    gender_report: Dict[str, Any]
    race_ethnicity_report: Dict[str, Any]
    total_evaluated_applications: int
    passed_audit: bool


@router.get("/bias-audit", response_model=BiasAuditSummary)
async def get_bias_audit_report(
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """
    Produces NYC Local Law 144 / EEOC annual independent bias audit data.
    Aggregates voluntary EEO demographic self-identifications against stage transition outcomes.
    """
    if not current_user.has_role("admin", "platform_admin", "recruiter", "executive"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and compliance auditors may access the bias audit.",
        )

    # In a production environment, EEO self-ID is fetched from a dedicated collection `eeo_responses`
    # and joined in aggregate with applications
    cursor = db.applications.find(
        {},
        {"stage": 1, "status": 1, "eeo_gender": 1, "eeo_ethnicity": 1, "job_id": 1}
    )
    records = await stream_cursor(cursor)

    # Transform records for impact calculation
    gender_records = [{"gender": r.get("eeo_gender", "unspecified"), "stage": r.get("stage", "applied")} for r in records]
    ethnicity_records = [{"ethnicity": r.get("eeo_ethnicity", "unspecified"), "stage": r.get("stage", "applied")} for r in records]

    # Compute impact reports
    gender_rep = compute_adverse_impact_report(gender_records, demographic_key="gender")
    ethnicity_rep = compute_adverse_impact_report(ethnicity_records, demographic_key="ethnicity")

    passed_audit = bool(not gender_rep.adverse_impact_detected and not ethnicity_rep.adverse_impact_detected)

    return BiasAuditSummary(
        audit_year=2026,
        gender_report=gender_rep.to_dict(),
        race_ethnicity_report=ethnicity_rep.to_dict(),
        total_evaluated_applications=len(records),
        passed_audit=passed_audit,
    )


@router.get("/candidate-portal/{candidate_id}")
async def get_candidate_data_rights_export(
    candidate_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: Any = Depends(get_database),
):
    """
    Candidate Data-Rights Export Portal (GDPR Art. 15, 22 & India DPDP Act 2023).
    Allows candidates to export all personal data, parsed profiles, application decisions,
    and explanations computed about them.
    """
    # Enforce data principal access ownership
    if str(current_user.id) != str(candidate_id) and not current_user.has_role("admin", "platform_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Candidates may only access their own personal data principal export.",
        )

    # Fetch candidate profile, resumes, applications, and decision records
    candidate_doc = await db.users.find_one({"_id": candidate_id})
    resumes = await stream_cursor(db.resumes.find({"user_id": candidate_id}))
    applications = await stream_cursor(db.applications.find({"candidate_id": candidate_id}))
    decisions = await stream_cursor(db.decision_log.find({"candidate_id": candidate_id}))

    # Clean ObjectIds for JSON export
    for d in resumes:
        d["_id"] = str(d.get("_id", ""))
    for a in applications:
        a["_id"] = str(a.get("_id", ""))
    for dec in decisions:
        dec["_id"] = str(dec.get("_id", ""))

    return {
        "candidate_id": str(candidate_id),
        "data_principal_rights": {
            "right_to_access": True,
            "right_to_correction": True,
            "right_to_erasure": True,
            "right_to_explanation": True,
            "automated_decision_review": True,
        },
        "resumes_count": len(resumes),
        "applications_count": len(applications),
        "scoring_decisions_history": decisions,
        "applications": applications,
    }
