"""
Certificate API Router
======================
Single consolidated router for all certificate operations.

Endpoints:
  POST /issue          – authenticated: issue a new or updated certificate
  POST /claim          – authenticated: alias for /issue (quiz/assessment flow)
  POST /resend/{id}    – authenticated: re-deliver certificate PDF directly to registered email
  GET  /check          – authenticated: check if candidate already holds a certificate for a topic
  GET  /verify/{id}    – PUBLIC, rate-limited: verify any certificate by ID
  GET  /my             – authenticated: list the current user's certificates
"""

import asyncio
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
import structlog

from api.deps import get_current_user, get_certificate_repo
from certificates.email import dispatch_certificate_email
from certificates.rate_limit import limiter
from certificates.service import CertificateService
from certificates.skill_icons import slugify, resolve_skill_icon_path
from certificates.renderer import render_certificate_pdf
from certificates.qr import build_verification_url, generate_qr_image
from schemas.user_schema import UserModel
from repositories.certificate_repo import CertificateRepository

logger = structlog.get_logger(__name__)
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
    cert_repo: CertificateRepository,
):
    """Core issuance logic shared between /issue and /claim with update / re-issue support."""
    if score < 80:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minimum 80% score required to claim a certificate.",
        )

    # Use explicitly passed assessment_slug if provided, otherwise slugify the display name
    final_slug = slugify(assessment_slug) if assessment_slug else slugify(assessment_name)
    if not final_slug:
        final_slug = "assessment"

    # Detect if user already received an active certificate for this assessment
    existing_cert = await cert_repo.get_active_by_user_and_topic(str(current_user.id), final_slug)

    is_update = bool(existing_cert)
    prev_score = (existing_cert.get("snapshot") or {}).get("score", 0) if existing_cert else None

    context = {
        "recipient_name": current_user.full_name or "Certified Candidate",
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as e:
        logger.error("Certificate issuance exception", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Certificate issuance failed: {str(e)}"
        )

    # Mark previously-issued certificate as superseded so the new credential is primary
    if existing_cert:
        old_id = str(existing_cert.get("id") or existing_cert.get("_id"))
        if old_id != record.id:
            try:
                await cert_repo.supersede(old_id, record.id)
            except Exception as e:
                logger.warning("Could not mark previous certificate as superseded", error=str(e))

    # Fire-and-forget: email PDF to user with update context if applicable
    background_tasks.add_task(
        dispatch_certificate_email,
        current_user.email,
        record.recipient_name,
        record.snapshot,
        record.id,
        record.issued_at,
        record.public_url,
        pdf_bytes,
        is_update,
    )

    return {
        "status": "success",
        "certificate_id": record.id,
        "public_url": record.public_url,
        "recipient_name": record.recipient_name,
        "grade": record.snapshot.get("grade_label"),
        "issued_at": record.issued_at.isoformat() if hasattr(record.issued_at, "isoformat") else str(record.issued_at),
        "is_update": is_update,
        "previous_score": prev_score,
        "message": (
            f"Updated certificate with enhanced score ({score}%) dispatched to your registered email!"
            if is_update else
            "Official certificate dispatched to your registered email!"
        ),
    }


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/issue", status_code=status.HTTP_201_CREATED)
async def issue_certificate(
    payload: IssuePayload,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
    cert_repo: CertificateRepository = Depends(get_certificate_repo),
):
    """Issue a new or updated certificate. Requires authentication and score ≥ 80."""
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
        cert_repo=cert_repo,
    )


@router.post("/claim", status_code=status.HTTP_201_CREATED)
async def claim_certificate(
    payload: ClaimPayload,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
    cert_repo: CertificateRepository = Depends(get_certificate_repo),
):
    """Alias for /issue used by the quiz/gamification flow with full re-issue support."""
    return await _do_issue(
        background_tasks=background_tasks,
        current_user=current_user,
        assessment_name=payload.topic,
        assessment_slug=payload.assessment_slug,
        score=payload.score,
        difficulty=payload.difficulty,
        cert_repo=cert_repo,
    )


@router.get("/check")
async def check_certificate_status(
    topic: str = Query(..., description="Assessment topic or slug"),
    current_user: UserModel = Depends(get_current_user),
    cert_repo: CertificateRepository = Depends(get_certificate_repo),
):
    """Checks whether the current candidate already holds an e-certificate for this topic."""
    slug = slugify(topic)
    cert = await cert_repo.get_active_by_user_and_topic(str(current_user.id), slug)

    if not cert:
        return {"has_certificate": False, "certificate": None}

    snap = cert.get("snapshot") or {}
    issued_dt = cert.get("issued_at")
    return {
        "has_certificate": True,
        "certificate": {
            "certificate_id": cert.get("id"),
            "topic": snap.get("assessment_name", topic),
            "score": snap.get("score"),
            "grade": snap.get("grade_label"),
            "difficulty": snap.get("difficulty"),
            "public_url": cert.get("public_url") or "",
            "issued_at": issued_dt.isoformat() if hasattr(issued_dt, "isoformat") else str(issued_dt or ""),
        }
    }


@router.post("/resend/{certificate_id}")
async def resend_certificate(
    certificate_id: str,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
    cert_repo: CertificateRepository = Depends(get_certificate_repo),
):
    """
    Allows a candidate who already received an e-certificate to have it re-rendered with their
    latest profile information and dispatched directly to their email inbox.
    """
    cert = await cert_repo.get_by_id(certificate_id)
    if not cert or str(cert.get("user_id")) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate not found or not owned by current user.",
        )

    snapshot = dict(cert.get("snapshot") or {})
    # Sync with current user profile name if updated
    if current_user.full_name and current_user.full_name.strip():
        snapshot["recipient_name"] = current_user.full_name.strip()

    template_dir = cert.get("template_used") or "assessment"
    verification_url = build_verification_url(certificate_id)
    issued_dt = cert.get("issued_at")
    render_context = {
        "recipient_name": snapshot.get("recipient_name", current_user.full_name),
        "assessment_name": (
            f"{snapshot.get('assessment_name', 'Skill Assessment')} Assessment "
            f"({snapshot.get('difficulty', 'Standard')} Level)"
        ),
        "issued_date": issued_dt.strftime("%d %B %Y") if hasattr(issued_dt, "strftime") else datetime.now().strftime("%d %B %Y"),
        "cert_id": certificate_id,
        "skill_logo_image": resolve_skill_icon_path(snapshot.get("assessment_slug", "assessment")),
        "skill_name": str(snapshot.get("assessment_name", "SKILL")).upper(),
        "qr_code_image": generate_qr_image(verification_url),
    }

    try:
        pdf_bytes = await asyncio.to_thread(render_certificate_pdf, template_dir, render_context)
    except Exception as e:
        logger.error("Certificate PDF re-rendering failed", error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to render certificate PDF.")

    # Update recipient name in DB if it changed
    if snapshot.get("recipient_name") != cert.get("recipient_name"):
        await cert_repo.update_recipient(certificate_id, snapshot["recipient_name"], snapshot)

    # Dispatch email in background with updated flag
    background_tasks.add_task(
        dispatch_certificate_email,
        current_user.email,
        snapshot.get("recipient_name", current_user.full_name),
        snapshot,
        certificate_id,
        cert.get("issued_at"),
        cert.get("public_url") or "",
        pdf_bytes,
        True,
    )

    return {
        "status": "success",
        "message": f"Updated certificate successfully re-sent to {current_user.email}!",
        "certificate_id": certificate_id,
        "recipient_name": snapshot.get("recipient_name", current_user.full_name),
        "recipient_email": current_user.email,
    }


@router.get("/verify/{certificate_id}")
@limiter.limit("20/minute")
async def verify_certificate(certificate_id: str, request: Request = None):
    """
    Public endpoint — no authentication required.
    Returns HTTP 200 in all cases; validity is expressed via the `valid` field.
    """
    return await CertificateService.get_public_view(certificate_id)


@router.get("/my")
async def my_certificates(
    current_user: UserModel = Depends(get_current_user),
    cert_repo: CertificateRepository = Depends(get_certificate_repo),
):
    """Return the current user's issued certificates (most recent first)."""
    records = await cert_repo.list_by_user(str(current_user.id))
    return {
        "status": "success",
        "total": len(records),
        "certificates": [
            {
                "certificate_id": r.get("id"),
                "assessment_name": (r.get("snapshot") or {}).get("assessment_name", ""),
                "score": (r.get("snapshot") or {}).get("score"),
                "grade": (r.get("snapshot") or {}).get("grade_label"),
                "difficulty": (r.get("snapshot") or {}).get("difficulty"),
                "status": r.get("status"),
                "public_url": r.get("public_url") or "",
                "issued_at": r["issued_at"].isoformat() if hasattr(r.get("issued_at"), "isoformat") else str(r.get("issued_at") or ""),
            }
            for r in records
        ],
    }
