"""
Brevo HTTP API Email Service — sends transactional emails via Brevo REST API v3
(https://api.brevo.com/v3/smtp/email) using HTTPS over port 443.

Replaces legacy SMTP (aiosmtplib) with an async, non-blocking HTTP mailer service.
"""

import base64
from datetime import timezone
from html import escape
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import httpx
import structlog

from core.config import settings
from models.otp_model import OTPPurpose

logger = structlog.get_logger(__name__)

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"

_OTP_DISPATCH = {
    OTPPurpose.SIGNUP_VERIFICATION: ("otp_verification.html", "Verify your CareerShala email"),
    OTPPurpose.LOGIN_VERIFICATION: ("otp_verification.html", "Your CareerShala login code"),
    OTPPurpose.PASSWORD_RESET: ("password_reset.html", "Reset your CareerShala password"),
}


def _render_template(filename: str, **context) -> str:
    path = TEMPLATES_DIR / filename
    if not path.exists():
        logger.error(f"Template {filename} not found at {path}")
        return f"<p>Your OTP code is {context.get('otp', '')}</p>"
    html = path.read_text(encoding="utf-8")

    if "logo_url" not in context:
        base_url = (getattr(settings, "FRONTEND_URL", "") or getattr(settings, "APP_BASE_URL", "") or "https://careershala.tech").rstrip("/")
        if "localhost" in base_url or not base_url:
            base_url = "https://careershala.tech"
        context["logo_url"] = f"{base_url}/logo.png"

    for key, value in context.items():
        html = html.replace("{{" + key + "}}", str(value))
    return html


class EmailService:
    """Production-ready Brevo HTTP API Mailer Service."""

    def _get_api_headers(self) -> Dict[str, str]:
        api_key = settings.BREVO_API_KEY
        if not api_key:
            logger.warning("BREVO_API_KEY is not configured in environment settings")
        return {
            "accept": "application/json",
            "api-key": api_key or "",
            "content-type": "application/json",
        }

    async def _send_brevo_email(
        self,
        *,
        to_email: str,
        to_name: Optional[str] = None,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        reply_to_email: Optional[str] = None,
        reply_to_name: Optional[str] = None,
        attachments: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Core async method for dispatching emails via Brevo HTTP API (v3/smtp/email).

        :param attachments: List of dicts with keys 'name' and 'content' (base64 string)
        """
        api_key = settings.BREVO_API_KEY
        if not api_key:
            logger.error("Brevo API Key Missing", to=to_email, subject=subject)
            return {"sent": False, "error": "BREVO_API_KEY is not configured"}

        sender_info = settings.mail_sender
        payload: Dict[str, Any] = {
            "sender": sender_info,
            "to": [{"email": to_email, "name": to_name or to_email.split("@")[0]}],
            "subject": subject,
            "htmlContent": html_body,
        }

        if text_body:
            payload["textContent"] = text_body

        if reply_to_email:
            payload["replyTo"] = {
                "email": reply_to_email,
                "name": reply_to_name or reply_to_email.split("@")[0],
            }

        if attachments:
            payload["attachment"] = attachments

        headers = self._get_api_headers()

        logger.info(
            "Sending Email via Brevo HTTP API",
            to=to_email,
            subject=subject,
            has_reply_to=bool(reply_to_email),
            attachment_count=len(attachments or []),
        )

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(BREVO_API_URL, headers=headers, json=payload)

            if response.status_code in (200, 201, 202):
                data = response.json()
                message_id = data.get("messageId") or data.get("message_id") or "brevo-success"
                logger.info("Brevo Email Sent Successfully", to=to_email, subject=subject, message_id=message_id)
                return {"sent": True, "to": to_email, "subject": subject, "message_id": message_id}
            else:
                logger.error(
                    "Brevo API Error Response",
                    status_code=response.status_code,
                    to=to_email,
                    subject=subject,
                    response_text=response.text[:300],
                )
                return {
                    "sent": False,
                    "error": f"Brevo API returned status {response.status_code}",
                    "detail": response.text,
                }
        except httpx.TimeoutException as exc:
            logger.error("Brevo API Timeout", to=to_email, subject=subject, error=str(exc))
            return {"sent": False, "error": "Brevo HTTP API connection timeout."}
        except httpx.RequestError as exc:
            logger.error("Brevo HTTP Request Error", to=to_email, subject=subject, error=str(exc))
            return {"sent": False, "error": f"Failed to connect to Brevo API: {str(exc)}"}
        except Exception as exc:
            logger.exception("Unexpected error in Brevo Email Dispatch", to=to_email, subject=subject, error=str(exc))
            return {"sent": False, "error": "Unexpected error while dispatching email via Brevo."}

    async def _send(self, to_email: str, subject: str, html_body: str) -> bool:
        result = await self._send_brevo_email(to_email=to_email, subject=subject, html_body=html_body)
        return bool(result.get("sent"))

    async def send_otp(self, to_email: str, full_name: str, otp: str, purpose: OTPPurpose) -> bool:
        """1. User Sign-up / Auth OTP Verification"""
        try:
            template, subject = _OTP_DISPATCH[purpose]
        except KeyError:
            raise ValueError(f"No email dispatch configured for OTP purpose: {purpose}")

        html = _render_template(
            template,
            full_name=full_name or "there",
            otp=otp,
            expiry_minutes=settings.OTP_EXPIRE_MINUTES,
        )
        return await self._send(to_email, subject, html)

    async def send_certificate(
        self,
        *,
        recipient_email: str,
        recipient_name: str,
        topic: str,
        score: float,
        grade_label: str,
        difficulty: str,
        cert_id: str,
        issued_at: Any,
        public_url: str,
        pdf_bytes: bytes,
    ) -> bool:
        """2. Certificate Delivery with PDF attachment"""
        verification_url = f"{settings.cert_verify_base_url}/{cert_id}"
        issued_str = issued_at.strftime("%d %B %Y") if hasattr(issued_at, "strftime") else str(issued_at)
        subject = f"🎉 Congratulations {recipient_name}! Your CareerShala Certificate is Ready"

        # Generate LinkedIn 'Add Certification' URL with proper encoding
        issue_year = str(issued_at.year) if hasattr(issued_at, "year") else str(datetime.now().year)
        issue_month = str(issued_at.month) if hasattr(issued_at, "month") else str(datetime.now().month)

        cert_name = f"CareerShala {topic} Certificate"
        encoded_cert_name = quote(cert_name, safe='')
        encoded_org_name = quote("CareerShala", safe='')
        encoded_cert_id = quote(str(cert_id), safe='')
        encoded_cert_url = quote(public_url or verification_url, safe='')

        linkedin_url = (
            "https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME"
            f"&name={encoded_cert_name}"
            f"&organizationName={encoded_org_name}"
            f"&issueYear={issue_year}"
            f"&issueMonth={issue_month}"
            f"&certId={encoded_cert_id}"
            f"&certUrl={encoded_cert_url}"
        )

        html_body = f"""
<html>
  <body style="font-family: Arial, sans-serif; background:#f8fafc; padding:24px; color:#1e293b;">
    <div style="max-width:560px;margin:auto;background:white;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
      <h2 style="color:#1e293b;">🎉 Congratulations, {escape(recipient_name)}!</h2>
      <p>You've successfully completed the <b>{escape(topic)}</b> assessment at <b>{escape(difficulty)}</b> level.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr><td style="padding:8px 0;color:#64748b;">Score</td><td style="padding:8px 0;font-weight:bold;">{score}%</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Grade</td><td style="padding:8px 0;font-weight:bold;color:#6366f1;">{escape(grade_label)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Issued on</td><td style="padding:8px 0;">{issued_str}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Certificate ID</td><td style="padding:8px 0;font-family:monospace;font-size:12px;">{escape(cert_id)}</td></tr>
      </table>
      <div style="text-align:center;margin:28px 0;">
        <a href="{escape(public_url)}" style="background:#6366f1;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin-right:8px;margin-bottom:8px;">Download Certificate</a>
        <a href="{escape(linkedin_url)}" target="_blank" rel="noopener noreferrer" style="background:#0A66C2;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin-bottom:8px;">Add to LinkedIn</a>
      </div>
      <p style="font-size:13px;color:#94a3b8;">
        Also attached to this email as a PDF. Anyone can verify its authenticity at
        <a href="{escape(verification_url)}">{escape(verification_url)}</a>.
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="font-size:12px;color:#94a3b8;">Team CareerShala</p>
    </div>
  </body>
</html>
"""

        pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
        filename = f"CareerShala_Certificate_{topic.replace(' ', '_')}.pdf"

        result = await self._send_brevo_email(
            to_email=recipient_email,
            to_name=recipient_name,
            subject=subject,
            html_body=html_body,
            attachments=[{"name": filename, "content": pdf_b64}],
        )
        return bool(result.get("sent"))

    async def send_hr_application(
        self,
        *,
        to_email: str,
        subject: str,
        html_body: str,
        attachments: List[str],
        candidate_email: str,
        candidate_name: str,
    ) -> str:
        """3. AI-Automated HR Job Applications:

        Email sent to recruiters on behalf of candidate.
        CRITICAL REQUIREMENT: replyTo header mapped dynamically to candidate_email
        so HR replies route directly to candidate's inbox.
        """
        brevo_attachments = []
        async with httpx.AsyncClient(timeout=30.0) as client:
            for file_path in attachments:
                if not file_path:
                    continue
                try:
                    if file_path.startswith("http://") or file_path.startswith("https://"):
                        resp = await client.get(file_path)
                        resp.raise_for_status()
                        file_bytes = resp.content
                        url_name = Path(file_path.split("?")[0]).name
                        filename = url_name if (url_name and "." in url_name) else "attachment.pdf"
                    else:
                        p = Path(file_path)
                        if not p.exists():
                            logger.warning(f"Attachment file path missing: {file_path}")
                            continue
                        file_bytes = p.read_bytes()
                        filename = p.name

                    b64_content = base64.b64encode(file_bytes).decode("utf-8")
                    brevo_attachments.append({"name": filename, "content": b64_content})
                except Exception as exc:
                    logger.error(f"Error encoding attachment {file_path}: {exc}")

        res = await self._send_brevo_email(
            to_email=to_email,
            subject=subject,
            html_body=html_body,
            reply_to_email=candidate_email,
            reply_to_name=candidate_name,
            attachments=brevo_attachments,
        )
        if res.get("sent"):
            return res.get("message_id") or f"brevo-{to_email}-{subject[:20]}"
        raise Exception(res.get("error") or "Failed to send HR application via Brevo HTTP API")

    def _format_support_created_at(self, created_at) -> str:
        if not created_at:
            return "N/A"
        if getattr(created_at, "tzinfo", None) is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        else:
            created_at = created_at.astimezone(timezone.utc)
        return created_at.strftime("%Y-%m-%d %H:%M:%S UTC")

    def _build_support_ticket_payload(self, *, ticket: Any, user: Any, metadata: dict | None, attachments: list[dict] | None) -> tuple[str, str, str, str]:
        support_email = settings.SUPPORT_EMAIL
        if not support_email:
            raise ValueError("SUPPORT_EMAIL is not configured")

        meta = metadata or {}
        attachment_rows = attachments or []
        subject = f"[Support] New Ticket: {ticket.ticket_id} - {ticket.subject[:50]}"

        fields = [
            ("Ticket ID", ticket.ticket_id),
            ("User Name", getattr(user, "full_name", None) or "N/A"),
            ("User Email", getattr(user, "email", None) or "N/A"),
            ("Plan", getattr(user, "plan", None) or "free"),
            ("Category", getattr(ticket, "category", None) or "N/A"),
            ("Subject", getattr(ticket, "subject", None) or "N/A"),
            ("Description", getattr(ticket, "description", None) or "N/A"),
            ("Priority", getattr(ticket, "priority", None) or "N/A"),
            ("Browser", meta.get("browser") or getattr(ticket, "browser", None) or "N/A"),
            ("Operating System", meta.get("os") or getattr(ticket, "os", None) or "N/A"),
            ("Current Page", meta.get("current_url") or getattr(ticket, "current_url", None) or "N/A"),
            ("Created At", self._format_support_created_at(getattr(ticket, "created_at", None))),
        ]

        text_lines = ["-----------------------------------------", "New Support Ticket Received", ""]
        for label, value in fields:
            text_lines.append(f"{label}: {value}")
        text_lines.extend(["", "Attachment Links (if any)"])

        html_rows = "".join(
            f"<tr><td style='padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;'>{escape(label)}</td><td style='padding:8px 12px;color:#0f172a;border-bottom:1px solid #e2e8f0;white-space:pre-wrap;'>{escape(str(value))}</td></tr>"
            for label, value in fields
        )

        attachment_text_lines: list[str] = []
        attachment_html_items: list[str] = []
        for attachment in attachment_rows:
            filename = attachment.get("filename") or attachment.get("public_id") or "Attachment"
            url = attachment.get("url") or ""
            attachment_text_lines.append(f"- {filename}: {url or 'N/A'}")
            if url:
                attachment_html_items.append(
                    f"<li style='margin-bottom:6px;'><a href='{escape(url)}' target='_blank' rel='noopener noreferrer'>{escape(filename)}</a></li>"
                )
            else:
                attachment_html_items.append(f"<li style='margin-bottom:6px;'>{escape(filename)}</li>")

        if attachment_text_lines:
            text_lines.extend(attachment_text_lines)
        else:
            text_lines.append("No attachments")

        html_attachments = "<p style='margin:0;color:#64748b;'>No attachments</p>" if not attachment_html_items else f"<ul style='margin:0;padding-left:18px;color:#334155;'>{''.join(attachment_html_items)}</ul>"

        html_body = f"""
        <html>
          <body style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px;">
            <div style="max-width:720px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e2e8f0;">
              <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;">New Support Ticket Received</h2>
              <p style="margin:0 0 20px;color:#64748b;">A new support ticket was created and saved successfully.</p>
              <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">{html_rows}</table>
              <div style="margin-top:20px;">
                <h3 style="margin:0 0 10px;font-size:14px;color:#0f172a;">Attachment Links (if any)</h3>
                {html_attachments}
              </div>
            </div>
          </body>
        </html>
        """

        return support_email, subject, "\n".join(text_lines), html_body

    async def send_support_ticket_notification(
        self, *, ticket: Any, user: Any, metadata: dict | None = None, attachments: list[dict] | None = None
    ) -> dict[str, Any]:
        try:
            support_email, subject, text_body, html_body = self._build_support_ticket_payload(
                ticket=ticket,
                user=user,
                metadata=metadata,
                attachments=attachments,
            )
        except ValueError as exc:
            logger.error("Support Email Configuration Missing", ticket_id=getattr(ticket, "ticket_id", None), error=str(exc))
            return {"sent": False, "error": str(exc)}

        return await self._send_brevo_email(
            to_email=support_email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
        )

    async def send_career_application(
        self,
        *,
        applicant_name: str,
        applicant_email: str,
        role_title: str,
        portfolio_url: Optional[str],
        cover_letter: str,
        resume_bytes: Optional[bytes] = None,
        resume_filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send job application notification email to admin via Brevo HTTP API with attached resume PDF."""
        admin_email = settings.SUPPORT_EMAIL or settings.MAIL_FROM_EMAIL or "admin@careershala.tech"
        subject = f"💼 New Job Application: {applicant_name} — {role_title}"

        portfolio_html = (
            f'<a href="{escape(portfolio_url)}" target="_blank" style="color:#2E9BDA; font-weight:bold;">{escape(portfolio_url)}</a>'
            if portfolio_url
            else '<span style="color:#94a3b8; font-style:italic;">Not provided</span>'
        )

        formatted_cover = escape(cover_letter).replace("\n", "<br/>")

        resume_status_html = (
            f'<span style="color:#10b981; font-weight:bold;">Attached ({escape(resume_filename)})</span>'
            if resume_bytes and resume_filename
            else '<span style="color:#94a3b8; font-style:italic;">No file attached</span>'
        )

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"/></head>
        <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #0f172a;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15,23,42,0.06);">
            
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; tracking-tight: -0.02em;">
                Career<span style="color: #2E9BDA;">Shala</span> Careers
              </h1>
              <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px; font-weight: 600;">
                New Candidate Application Submission
              </p>
            </div>

            <div style="padding: 32px;">
              <div style="background: #f1f5f9; border-left: 4px solid #2E9BDA; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #2E9BDA;">Position Applied For</p>
                <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 800; color: #0f172a;">{escape(role_title)}</p>
              </div>

              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 700; color: #64748b; width: 140px;">Applicant Name</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 700; color: #0f172a;">{escape(applicant_name)}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 700; color: #64748b;">Email Address</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 700; color: #2E9BDA;">
                    <a href="mailto:{escape(applicant_email)}" style="color: #2E9BDA; text-decoration: none;">{escape(applicant_email)}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 700; color: #64748b;">Portfolio Link</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px;">{portfolio_html}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 700; color: #64748b;">Resume Attachment</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px;">{resume_status_html}</td>
                </tr>
              </table>

              <div style="margin-top: 24px;">
                <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">Cover Letter / Note</p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; font-size: 14px; line-height: 1.6; color: #334155;">
                  {formatted_cover}
                </div>
              </div>

              <div style="margin-top: 32px; text-align: center;">
                <a href="mailto:{escape(applicant_email)}?subject=Re:%20Application%20for%20{quote(role_title)}" 
                   style="display: inline-block; background: #2E9BDA; color: #ffffff; font-weight: 800; font-size: 13px; text-decoration: none; padding: 14px 28px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Reply Directly to Applicant
                </a>
              </div>
            </div>

            <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
              Sent via CareerShala Brevo Mailer Engine · {settings.APP_NAME}
            </div>
          </div>
        </body>
        </html>
        """

        attachments_payload = []
        if resume_bytes and resume_filename:
            b64_content = base64.b64encode(resume_bytes).decode("utf-8")
            attachments_payload.append({
                "name": resume_filename,
                "content": b64_content,
            })

        return await self._send_brevo_email(
            to_email=admin_email,
            to_name="CareerShala Hiring Team",
            subject=subject,
            html_body=html_body,
            reply_to_email=applicant_email,
            reply_to_name=applicant_name,
            attachments=attachments_payload if attachments_payload else None,
        )


async def send_with_attachments(
    *,
    to: str,
    subject: str,
    html_body: str,
    attachments: List[str],
    reply_to_email: Optional[str] = None,
    reply_to_name: Optional[str] = None,
) -> str:
    """Sends an email with file attachments via Brevo HTTP API.

    Returns provider message ID string.
    """
    svc = EmailService()
    return await svc.send_hr_application(
        to_email=to,
        subject=subject,
        html_body=html_body,
        attachments=attachments,
        candidate_email=reply_to_email or settings.mail_sender["email"],
        candidate_name=reply_to_name or settings.mail_sender["name"],
    )


async def send_application_via_gmail_api(
    *,
    to: str,
    subject: str,
    html_body: str,
    attachments: List[str],
    user_id: str,
    user_repo,
) -> str:
    """Sends an application via Google Gmail API if user connected Gmail OAuth,

    otherwise falls back to Brevo HTTP mailer service.
    """
    from googleapiclient.discovery import build
    from services.gmail_token_service import GmailTokenService

    try:
        token_service = GmailTokenService(user_repo)
        creds = await token_service.get_valid_credentials(user_id)
        if creds:
            service = build("gmail", "v1", credentials=creds)
            from email.message import EmailMessage

            msg = EmailMessage()
            msg["To"] = to
            msg["Subject"] = subject
            msg.set_content("This email requires an HTML-capable email client to view.")
            msg.add_alternative(html_body, subtype="html")

            async with httpx.AsyncClient(timeout=30.0) as client:
                for file_path in attachments:
                    if not file_path:
                        continue
                    if file_path.startswith("http://") or file_path.startswith("https://"):
                        resp = await client.get(file_path)
                        resp.raise_for_status()
                        content = resp.content
                        url_path_name = Path(file_path.split("?")[0]).name
                        filename = url_path_name if (url_path_name and "." in url_path_name) else "resume.pdf"
                    else:
                        p = Path(file_path)
                        if not p.exists():
                            continue
                        with open(p, "rb") as f:
                            content = f.read()
                        filename = p.name
                    msg.add_attachment(content, maintype="application", subtype="pdf", filename=filename)

            raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
            sent_message = service.users().messages().send(userId="me", body={"raw": raw_message}).execute()
            msg_id = sent_message.get("id", "")
            logger.info("Application email sent via Gmail API", to=to, message_id=msg_id)
            return msg_id
    except Exception as err:
        logger.warning(f"Gmail API dispatch failed or not connected for user {user_id}: {err}. Falling back to Brevo HTTP service.")

    # Fallback to Brevo HTTP mailer
    svc = EmailService()
    user_doc = await user_repo.get_by_id(user_id) if hasattr(user_repo, "get_by_id") else None
    candidate_email = user_doc.get("email") if user_doc else None
    candidate_name = user_doc.get("full_name") if user_doc else None

    return await svc.send_hr_application(
        to_email=to,
        subject=subject,
        html_body=html_body,
        attachments=attachments,
        candidate_email=candidate_email or settings.mail_sender["email"],
        candidate_name=candidate_name or settings.mail_sender["name"],
    )
