from datetime import datetime
import structlog
from services.email_service import EmailService

logger = structlog.get_logger(__name__)


async def dispatch_certificate_email(
    recipient_email: str,
    recipient_name: str,
    snapshot: dict,
    cert_id: str,
    issued_at: datetime,
    public_url: str,
    pdf_bytes: bytes,
):
    """Dispatches a certificate email using Brevo HTTP API."""
    title = snapshot.get("assessment_name", "your assessment")
    score = snapshot.get("score", 0)
    grade_label = snapshot.get("grade_label", "")
    difficulty = snapshot.get("difficulty", "Standard")

    try:
        svc = EmailService()
        await svc.send_certificate(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            topic=title,
            score=score,
            grade_label=grade_label,
            difficulty=difficulty,
            cert_id=cert_id,
            issued_at=issued_at,
            public_url=public_url,
            pdf_bytes=pdf_bytes,
        )
    except Exception as exc:
        logger.warning(
            "Certificate email delivery failed",
            cert_id=cert_id,
            recipient_email=recipient_email,
            error=str(exc),
        )
