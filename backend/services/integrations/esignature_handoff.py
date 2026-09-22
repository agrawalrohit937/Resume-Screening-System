"""
E-Signature Handoff Service for Offer Letters (DocuSign / HelloSign Compatible).

Provides:
- Standardized envelope payload builder for candidate offer letters.
- Tab placement coordinates (signature, date signed, full name).
- Webhook callback status parser for e-signature lifecycle tracking.
"""

from __future__ import annotations

import base64
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import structlog

logger = structlog.get_logger(__name__)


def build_offer_letter_envelope(
    candidate_name: str,
    candidate_email: str,
    job_title: str,
    company_name: str,
    offer_salary: str,
    start_date: str,
    document_pdf_bytes: Optional[bytes] = None,
    document_name: str = "Candidate_Offer_Letter.pdf",
    signing_deadline_days: int = 7,
    tenant_id: str = "default",
) -> Dict[str, Any]:
    """
    Builds a DocuSign/HelloSign compliant envelope definition for candidate offer letter signature.
    """
    envelope_id = f"env_{uuid.uuid4().hex[:16]}"
    doc_base64 = base64.b64encode(document_pdf_bytes or b"%PDF-1.4 Mock Offer Letter Content").decode("ascii")

    envelope = {
        "envelopeId": envelope_id,
        "tenantId": tenant_id,
        "emailSubject": f"Offer of Employment: {job_title} at {company_name}",
        "emailBlurb": f"Dear {candidate_name},\n\nWe are delighted to offer you the position of {job_title} at {company_name}. Please review and sign your offer letter.",
        "status": "sent",
        "documents": [
            {
                "documentId": "1",
                "name": document_name,
                "fileExtension": "pdf",
                "documentBase64": doc_base64,
            }
        ],
        "recipients": {
            "signers": [
                {
                    "recipientId": "1",
                    "routingOrder": "1",
                    "name": candidate_name,
                    "email": candidate_email,
                    "roleName": "Candidate Signer",
                    "tabs": {
                        "signHereTabs": [
                            {
                                "anchorString": "/sn1/",
                                "anchorUnits": "pixels",
                                "anchorXOffset": "20",
                                "anchorYOffset": "0",
                                "documentId": "1",
                                "pageNumber": "1",
                                "tabLabel": "Candidate Signature",
                            }
                        ],
                        "dateSignedTabs": [
                            {
                                "anchorString": "/ds1/",
                                "anchorUnits": "pixels",
                                "anchorXOffset": "20",
                                "anchorYOffset": "0",
                                "documentId": "1",
                                "pageNumber": "1",
                                "tabLabel": "Date Signed",
                            }
                        ],
                        "textTabs": [
                            {
                                "tabLabel": "Salary",
                                "value": offer_salary,
                                "locked": "true",
                                "documentId": "1",
                            },
                            {
                                "tabLabel": "StartDate",
                                "value": start_date,
                                "locked": "true",
                                "documentId": "1",
                            },
                        ],
                    },
                }
            ]
        },
        "customFields": {
            "textCustomFields": [
                {"name": "TenantID", "value": tenant_id},
                {"name": "JobTitle", "value": job_title},
                {"name": "Platform", "value": "CareerShala ATS"},
            ]
        },
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    logger.info(
        "Built offer letter e-signature envelope",
        envelope_id=envelope_id,
        candidate_email=candidate_email,
        job_title=job_title,
    )
    return envelope


def parse_esignature_webhook_status(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parses incoming DocuSign Connect or HelloSign webhook callback payload.
    Maps status to internal ATS offer status ('sent', 'delivered', 'completed', 'declined', 'voided').
    """
    event = payload.get("event") or payload.get("event_type") or payload.get("status", "")
    envelope_id = payload.get("envelopeId") or payload.get("envelope_id") or payload.get("signature_request_id", "")

    status_mapping = {
        "envelope-sent": "sent",
        "envelope-delivered": "delivered",
        "envelope-completed": "completed",
        "envelope-signed": "completed",
        "envelope-declined": "declined",
        "envelope-voided": "voided",
        "signature_request_signed": "completed",
        "signature_request_declined": "declined",
    }

    normalized_status = status_mapping.get(event.lower(), event.lower() or "unknown")

    return {
        "envelope_id": envelope_id,
        "raw_event": event,
        "normalized_status": normalized_status,
        "is_signed": normalized_status == "completed",
        "is_rejected": normalized_status in ("declined", "voided"),
        "timestamp": payload.get("timestamp") or datetime.now(timezone.utc).isoformat(),
    }
