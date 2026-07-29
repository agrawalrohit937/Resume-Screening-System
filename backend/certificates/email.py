from datetime import datetime
from email.message import EmailMessage

import aiosmtplib

from core.config import settings


async def dispatch_certificate_email(
    recipient_email: str,
    recipient_name: str,
    snapshot: dict,
    cert_id: str,
    issued_at: datetime,
    public_url: str,
    pdf_bytes: bytes,
):
    verification_url = f"{settings.BASE_URL.rstrip('/')}/verify/{cert_id}"
    issued_str = issued_at.strftime("%d %B %Y")
    title = snapshot.get("assessment_name", "your assessment")
    score = snapshot.get("score")
    grade_label = snapshot.get("grade_label", "")

    message = EmailMessage()
    message["From"] = settings.SMTP_USER
    message["To"] = recipient_email
    message["Subject"] = f"🎉 Congratulations {recipient_name}! Your CareerShala Certificate is Ready"

    plain_body = (
        f"Hi {recipient_name},\n\n"
        f"Congratulations on completing {title} with a score of {score}% ({grade_label}).\n\n"
        f"Certificate ID : {cert_id}\n"
        f"Issued on      : {issued_str}\n"
        f"Download link  : {public_url}\n"
        f"Verify online  : {verification_url}\n\n"
        f"Your certificate is also attached to this email as a PDF.\n\n"
        f"Keep learning and growing!\nTeam CareerShala"
    )
    message.set_content(plain_body)

    html_body = f"""\
<html>
  <body style="font-family: Arial, sans-serif; background:#f8fafc; padding:24px; color:#1e293b;">
    <div style="max-width:560px;margin:auto;background:white;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
      <h2 style="color:#1e293b;">🎉 Congratulations, {recipient_name}!</h2>
      <p>You've successfully completed <b>{title}</b>.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr><td style="padding:8px 0;color:#64748b;">Score</td><td style="padding:8px 0;font-weight:bold;">{score}%</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Grade</td><td style="padding:8px 0;font-weight:bold;color:#6366f1;">{grade_label}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Issued on</td><td style="padding:8px 0;">{issued_str}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Certificate ID</td><td style="padding:8px 0;font-family:monospace;font-size:12px;">{cert_id}</td></tr>
      </table>
      <p style="text-align:center;margin:28px 0;">
        <a href="{public_url}" style="background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Download Certificate</a>
      </p>
      <p style="font-size:13px;color:#94a3b8;">
        Also attached to this email as a PDF. Anyone can verify its authenticity at
        <a href="{verification_url}">{verification_url}</a>.
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="font-size:12px;color:#94a3b8;">Team CareerShala</p>
    </div>
  </body>
</html>
"""
    message.add_alternative(html_body, subtype="html")
    message.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=f"CareerShala_Certificate_{title.replace(' ', '_')}.pdf",
    )

    use_tls = bool(settings.SMTP_PORT == 465 and getattr(settings, "SMTP_USE_SSL", False))
    start_tls = bool(settings.SMTP_PORT == 587 or not use_tls)

    try:
      await aiosmtplib.send(
        message,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASSWORD,
        use_tls=use_tls,
        start_tls=start_tls,
      )
    except Exception as exc:
      # Email should never block certificate issuance; the PDF is already
      # persisted and attached to the record response at this point.
      import structlog

      logger = structlog.get_logger(__name__)
      logger.warning(
        "Certificate email delivery failed",
        cert_id=cert_id,
        recipient_email=recipient_email,
        error=str(exc),
      )
