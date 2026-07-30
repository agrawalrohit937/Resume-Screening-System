"""
Certificate API Router
======================
Single consolidated router for all certificate operations.

Endpoints:
  POST /issue          – authenticated: issue a new certificate
  POST /claim          – authenticated: alias for /issue (quiz/assessment flow)
  GET  /verify/{id}    – PUBLIC, rate-limited: verify any certificate by ID
  GET  /my             – authenticated: list the current user's certificates
"""

import traceback

from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from api.deps import get_current_user
from certificates.email import dispatch_certificate_email
from certificates.rate_limit import limiter
from certificates.service import CertificateService
from certificates.skill_icons import slugify
from models.certificate_record import CertificateRecord
from models.user_model import UserModel

router = APIRouter()


# ── Payload models ─────────────────────────────────────────────────────────────

class IssuePayload(BaseModel):
    certificate_type: str = Field(default="assessment")
    assessment_name: str
    assessment_slug: Optional[str] = None
    score: int
    difficulty: str


class ClaimPayload(BaseModel):
    topic: str
    assessment_slug: Optional[str] = None
    score: int
    difficulty: str


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _do_issue(
    *,
    background_tasks: BackgroundTasks,
    current_user: UserModel,
    assessment_name: str,
    assessment_slug: Optional[str] = None,
    score: int,
    difficulty: str,
):
    """Core issuance logic shared between /issue and /claim."""
    if score < 80:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minimum 80% score required to claim a certificate.",
        )

    # Use explicitly passed assessment_slug if provided, otherwise slugify the display name
    final_slug = slugify(assessment_slug) if assessment_slug else slugify(assessment_name)
    if not final_slug:
        final_slug = "assessment"

    context = {
        "recipient_name": current_user.full_name,
        "assessment_name": assessment_name,
        "assessment_slug": final_slug,
        "difficulty": difficulty,
        "score": score,
    }

    try:
        record, pdf_bytes = await CertificateService.issue(
            user_id=str(current_user.id),
            certificate_type="assessment",
            context=context,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        # Operational failures (e.g., missing Cloudinary env vars, missing assets)
        # should not be treated as an internal server error.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as e:

        # AGGRESSIVE DEBUG CATCH
        import sys
        import traceback
        exc_info = traceback.format_exc()
        
        # Force print to terminal
        print("\n" + "="*50)
        print("CRITICAL BACKEND CRASH IN _do_issue:")
        print(exc_info)
        print("="*50 + "\n")
        
        # Force send to browser
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CRASH REPORT: {str(e)} | TRACEBACK: {exc_info}"
        )

    # Fire-and-forget: email PDF to user (non-blocking)
    background_tasks.add_task(
        dispatch_certificate_email,
        current_user.email,
        record.recipient_name,
        record.snapshot,
        record.id,
        record.issued_at,
        record.public_url,
        pdf_bytes,
    )

    return {
        "status": "success",
        "certificate_id": record.id,
        "public_url": record.public_url,
        "recipient_name": record.recipient_name,
        "grade": record.snapshot.get("grade_label"),
        "issued_at": record.issued_at.isoformat(),
    }


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/issue", status_code=status.HTTP_201_CREATED)
async def issue_certificate(
    payload: IssuePayload,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
):
    print("\n" + "!"*50)
    print(f"REQUEST RECEIVED AT /ISSUE FOR USER: {current_user.email}")
    print("!"*50 + "\n")
    """Issue a new certificate. Requires authentication and score ≥ 80."""
    if payload.certificate_type != "assessment":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only 'assessment' certificate type is supported.",
        )
    return await _do_issue(
        background_tasks=background_tasks,
        current_user=current_user,
        assessment_name=payload.assessment_name,
        assessment_slug=payload.assessment_slug,
        score=payload.score,
        difficulty=payload.difficulty,
    )


@router.post("/claim", status_code=status.HTTP_201_CREATED)
async def claim_certificate(
    payload: ClaimPayload,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
):
    """Alias for /issue used by the quiz/gamification flow."""
    return await _do_issue(
        background_tasks=background_tasks,
        current_user=current_user,
        assessment_name=payload.topic,
        assessment_slug=payload.assessment_slug,
        score=payload.score,
        difficulty=payload.difficulty,
    )


@router.get("/verify/{certificate_id}")
@limiter.limit("20/minute")
async def verify_certificate(certificate_id: str, request: Request = None):
    """
    Public endpoint — no authentication required.

    Returns HTTP 200 in all cases; validity is expressed via the `valid` field
    so the frontend can render a clean "Invalid Certificate" page without
    branching on HTTP status codes.

    Rate-limited to 20 requests/minute/IP to prevent enumeration attacks.
    """
    return await CertificateService.get_public_view(certificate_id)


@router.get("/my")
async def my_certificates(
    current_user: UserModel = Depends(get_current_user),
):
    """Return the current user's issued certificates (most recent first)."""
    records: list[CertificateRecord] = await CertificateRecord.find_by_user(
        str(current_user.id)
    )
    return {
        "status": "success",
        "total": len(records),
        "certificates": [
            {
                "certificate_id": r.id,
                "assessment_name": r.snapshot.get("assessment_name", ""),
                "score": r.snapshot.get("score"),
                "grade": r.snapshot.get("grade_label"),
                "difficulty": r.snapshot.get("difficulty"),
                "status": r.status,
                "public_url": r.public_url,
                "issued_at": r.issued_at.isoformat() if r.issued_at else None,
            }
            for r in records
        ],
    }