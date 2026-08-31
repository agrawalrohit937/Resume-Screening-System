"""
Brevo HTTP API Email Service — sends transactional emails via Brevo REST API v3
(https://api.brevo.com/v3/smtp/email) using HTTPS over port 443.

Replaces legacy SMTP (aiosmtplib) with an async, non-blocking HTTP mailer service.
"""

import base64
from datetime import datetime, timezone
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

    from datetime import datetime

    base_url = (getattr(settings, "FRONTEND_URL", "") or getattr(settings, "APP_BASE_URL", "") or "https://careershala.tech").rstrip("/")
    if "localhost" in base_url or not base_url:
        base_url = "https://careershala.tech"

    context.setdefault("base_url", base_url)
    context.setdefault("logo_url", f"{base_url}/logo_t.png")
    context.setdefault("support_url", f"{base_url}/support")
    context.setdefault("support_email", getattr(settings, "SUPPORT_EMAIL", "support@careershala.tech") or "support@careershala.tech")
    context.setdefault("careers_email", getattr(settings, "CAREERS_EMAIL", "careers@careershala.tech") or "careers@careershala.tech")
    context.setdefault("info_email", getattr(settings, "INFO_EMAIL", "info@careershala.tech") or "info@careershala.tech")
    context.setdefault("year", str(datetime.now().year))

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
        sender_email: Optional[str] = None,
        sender_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Core async method for dispatching emails via Brevo HTTP API (v3/smtp/email).

        :param attachments: List of dicts with keys 'name' and 'content' (base64 string)
        """
        api_key = settings.BREVO_API_KEY
        if not api_key:
            logger.error("Brevo API Key Missing", to=to_email, subject=subject)
            return {"sent": False, "error": "BREVO_API_KEY is not configured"}

        default_sender = settings.mail_sender
        sender_info = {
            "name": sender_name or default_sender["name"],
            "email": sender_email or default_sender["email"],
        }
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

    async def send_email(
        self,
        *,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        to_name: Optional[str] = None,
        reply_to_email: Optional[str] = None,
        reply_to_name: Optional[str] = None,
        sender_email: Optional[str] = None,
        sender_name: Optional[str] = None,
        attachments: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Generic email dispatch helper via Brevo HTTP API."""
        return await self._send_brevo_email(
            to_email=to_email,
            to_name=to_name,
            subject=subject,
            html_body=html_content,
            text_body=text_content,
            reply_to_email=reply_to_email,
            reply_to_name=reply_to_name,
            sender_email=sender_email,
            sender_name=sender_name,
            attachments=attachments,
        )

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

        base_url = (getattr(settings, "FRONTEND_URL", "") or getattr(settings, "APP_BASE_URL", "") or "https://careershala.tech").rstrip("/")
        if "localhost" in base_url or not base_url:
            base_url = "https://careershala.tech"
        logo_url = f"{base_url}/logo_t.png"
        support_email = settings.SUPPORT_EMAIL or "support@careershala.tech"
        year = str(datetime.now().year)

        html_body = f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your certificate for {escape(topic)} is ready</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 48px 16px;">
    <tr>
      <td align="center">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="520" align="center" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
        <![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding: 36px 40px 24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <a href="{base_url}" target="_blank" style="text-decoration: none; display: inline-flex; align-items: center;">
                      <img src="{logo_url}" alt="CareerShala" width="30" height="30" style="display: block; width: 30px; height: 30px; border: 0; vertical-align: middle;" />
                      <span style="font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; margin-left: 10px; vertical-align: middle;">
                        Career<span style="color: #2E9BDA;">Shala</span>
                      </span>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #f1f5f9;"></div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 40px 24px 40px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; line-height: 1.3;">
                Your certificate is ready
              </h1>
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
                Hi {escape(recipient_name)},
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.6;">
                Congratulations! You have successfully passed the assessment for <strong>{escape(topic)}</strong> ({escape(difficulty)} level) on CareerShala.
              </p>

              <!-- Certificate Details Table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 28px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 12px 16px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9; width: 40%;">Topic</td>
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f5f9; text-align: right;">{escape(topic)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Score</td>
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9; text-align: right;">{score}% ({escape(grade_label)})</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Issued on</td>
                  <td style="padding: 12px 16px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #f1f5f9; text-align: right;">{issued_str}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">Certificate ID</td>
                  <td style="padding: 12px 16px; font-size: 12px; font-family: ui-monospace, SFMono-Regular, monospace; color: #334155; text-align: right;">{escape(cert_id)}</td>
                </tr>
              </table>

              <!-- Primary Action Buttons -->
              <div style="margin: 0 0 24px 0;">
                <a href="{escape(public_url)}" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin-right: 8px; margin-bottom: 8px;">
                  View & Download PDF →
                </a>
                <a href="{escape(linkedin_url)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #0A66C2; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin-bottom: 8px;">
                  Add to LinkedIn
                </a>
              </div>

              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                The official PDF certificate is also attached to this email. Anyone can verify its authenticity at{' '}
                <a href="{escape(verification_url)}" target="_blank" style="color: #2E9BDA; text-decoration: underline;">{escape(verification_url)}</a>.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #f1f5f9;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px 40px;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Sent by CareerShala Technologies Pvt. Ltd. · Credentials Authority
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Questions? <a href="mailto:{support_email}" style="color: #64748b; text-decoration: underline;">{support_email}</a>
              </p>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>"""

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
        support_email = settings.SUPPORT_EMAIL or "support@careershala.tech"
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

        base_url = (getattr(settings, "FRONTEND_URL", "") or getattr(settings, "APP_BASE_URL", "") or "https://careershala.tech").rstrip("/")
        if "localhost" in base_url or not base_url:
            base_url = "https://careershala.tech"
        logo_url = f"{base_url}/logo_t.png"

        ticket_id = escape(str(getattr(ticket, "ticket_id", "N/A")))
        ticket_subject = escape(str(getattr(ticket, "subject", "Support Inquiry")))
        ticket_priority = escape(str(getattr(ticket, "priority", "medium"))).upper()
        ticket_category = escape(str(getattr(ticket, "category", "general"))).title()
        user_name = escape(str(getattr(user, "full_name", None) or "Candidate"))
        user_email = escape(str(getattr(user, "email", None) or "N/A"))
        user_plan = escape(str(getattr(user, "plan", "free"))).upper()
        description = escape(str(getattr(ticket, "description", "No details provided."))).replace("\n", "<br/>")
        created_time = self._format_support_created_at(getattr(ticket, "created_at", None))
        browser_info = escape(str(meta.get("browser") or getattr(ticket, "browser", None) or "N/A"))
        os_info = escape(str(meta.get("os") or getattr(ticket, "os", None) or "N/A"))
        page_url = escape(str(meta.get("current_url") or getattr(ticket, "current_url", None) or "N/A"))

        priority_bg = "#fee2e2" if "HIGH" in ticket_priority or "URGENT" in ticket_priority else "#f1f5f9"
        priority_color = "#b91c1c" if "HIGH" in ticket_priority or "URGENT" in ticket_priority else "#475569"

        attachment_html_items: list[str] = []
        for attachment in attachment_rows:
            filename = attachment.get("filename") or attachment.get("public_id") or "Attachment"
            url = attachment.get("url") or ""
            if url:
                attachment_html_items.append(
                    f"<a href='{escape(url)}' target='_blank' rel='noopener noreferrer' style='display:inline-block;margin:4px;padding:6px 14px;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;color:#0284c7;text-decoration:none;font-weight:600;'>📎 {escape(filename)}</a>"
                )
            else:
                attachment_html_items.append(f"<span style='display:inline-block;margin:4px;padding:6px 14px;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;color:#64748b;'>📎 {escape(filename)}</span>")

        attachments_block = "<p style='margin:0;font-size:13px;color:#94a3b8;font-style:italic;'>No attachments uploaded with this ticket.</p>" if not attachment_html_items else f"<div>{''.join(attachment_html_items)}</div>"

        html_body = f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Support ticket #{ticket_id}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 48px 16px;">
    <tr>
      <td align="center">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
        <![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding: 36px 40px 24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <a href="{base_url}" target="_blank" style="text-decoration: none; display: inline-flex; align-items: center;">
                      <img src="{logo_url}" alt="CareerShala" width="30" height="30" style="display: block; width: 30px; height: 30px; border: 0; vertical-align: middle;" />
                      <span style="font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; margin-left: 10px; vertical-align: middle;">
                        Career<span style="color: #2E9BDA;">Shala</span> Support
                      </span>
                    </a>
                  </td>
                  <td align="right">
                    <span style="font-size: 12px; font-weight: 600; color: #64748b; background-color: #f1f5f9; padding: 4px 10px; border-radius: 6px;">
                      #{ticket_id}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #f1f5f9;"></div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 40px 24px 40px;">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px;">
                {ticket_category} · {ticket_priority} priority
              </div>
              <h1 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; line-height: 1.35;">
                {ticket_subject}
              </h1>

              <!-- Reporter Meta Table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 10px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9; width: 35%;">Reporter</td>
                  <td style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f5f9; text-align: right;">{user_name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Email</td>
                  <td style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f5f9; text-align: right;">
                    <a href="mailto:{user_email}" style="color: #2E9BDA; text-decoration: none;">{user_email}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Plan</td>
                  <td style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f5f9; text-align: right;">{user_plan}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Submitted</td>
                  <td style="padding: 10px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9; text-align: right;">{created_time}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-size: 13px; color: #64748b;">Client Info</td>
                  <td style="padding: 10px 14px; font-size: 12px; color: #64748b; text-align: right;">{browser_info} · {os_info}</td>
                </tr>
              </table>

              <!-- Description Body -->
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px;">
                Description
              </div>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; font-size: 14px; line-height: 1.6; color: #1e293b; margin-bottom: 24px;">
                {description}
              </div>

              <!-- Attachments -->
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px;">
                Attachments
              </div>
              <div style="margin-bottom: 28px;">
                {attachments_block}
              </div>

              <!-- Action Reply Button -->
              <div style="margin-bottom: 12px;">
                <a href="mailto:{user_email}?subject=Re:%20[Support%20Ticket%20{ticket_id}]%20{quote(ticket_subject)}" 
                   style="display: inline-block; background-color: #0f172a; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 6px; letter-spacing: -0.01em;">
                  Reply to reporter →
                </a>
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #f1f5f9;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px 40px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Internal Support Dispatch · CareerShala Technologies Pvt. Ltd.
              </p>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>"""

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

        user_email = getattr(user, "email", None)
        user_name = getattr(user, "full_name", None)
        return await self._send_brevo_email(
            to_email=support_email,
            to_name="CareerShala Support Team",
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            reply_to_email=user_email,
            reply_to_name=user_name,
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
        """Send job application notification email to hiring team via Brevo HTTP API with attached resume PDF."""
        careers_email = getattr(settings, "CAREERS_EMAIL", None) or "careers@careershala.tech"
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

        base_url = (getattr(settings, "FRONTEND_URL", "") or getattr(settings, "APP_BASE_URL", "") or "https://careershala.tech").rstrip("/")
        if "localhost" in base_url or not base_url:
            base_url = "https://careershala.tech"
        logo_url = f"{base_url}/logo_t.png"
        careers_email = getattr(settings, "CAREERS_EMAIL", None) or "careers@careershala.tech"
        year = str(datetime.now().year)

        html_body = f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Application: {escape(applicant_name)} — {escape(role_title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 48px 16px;">
    <tr>
      <td align="center">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
        <![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding: 36px 40px 24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <a href="{base_url}" target="_blank" style="text-decoration: none; display: inline-flex; align-items: center;">
                      <img src="{logo_url}" alt="CareerShala" width="30" height="30" style="display: block; width: 30px; height: 30px; border: 0; vertical-align: middle;" />
                      <span style="font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; margin-left: 10px; vertical-align: middle;">
                        Career<span style="color: #2E9BDA;">Shala</span> Careers
                      </span>
                    </a>
                  </td>
                  <td align="right">
                    <span style="font-size: 12px; font-weight: 600; color: #0284c7; background-color: #f0f9ff; padding: 4px 10px; border-radius: 6px;">
                      New Applicant
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #f1f5f9;"></div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 40px 24px 40px;">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px;">
                Application Received
              </div>
              <h1 style="margin: 0 0 4px 0; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; line-height: 1.3;">
                {escape(applicant_name)}
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.5;">
                Applied for <strong>{escape(role_title)}</strong>
              </p>

              <!-- Applicant Details Table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 10px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9; width: 35%;">Candidate Email</td>
                  <td style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f5f9; text-align: right;">
                    <a href="mailto:{escape(applicant_email)}" style="color: #2E9BDA; text-decoration: none;">{escape(applicant_email)}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Portfolio / Profile</td>
                  <td style="padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; text-align: right;">{portfolio_html}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-size: 13px; color: #64748b;">Resume</td>
                  <td style="padding: 10px 14px; font-size: 13px; text-align: right;">{resume_status_html}</td>
                </tr>
              </table>

              <!-- Cover Letter / Pitch -->
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px;">
                Note / Cover Letter
              </div>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; font-size: 14px; line-height: 1.6; color: #1e293b; margin-bottom: 24px;">
                {formatted_cover}
              </div>

              <!-- Quick Reply Action -->
              <div style="margin-bottom: 12px;">
                <a href="mailto:{escape(applicant_email)}?subject=Re:%20Application%20for%20{quote(role_title)}%20at%20CareerShala" 
                   style="display: inline-block; background-color: #0f172a; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 6px; letter-spacing: -0.01em;">
                  Reply to candidate →
                </a>
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #f1f5f9;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px 40px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                CareerShala Talent Acquisition · Confidential hiring dispatch to <a href="mailto:{careers_email}" style="color: #64748b; text-decoration: underline;">{careers_email}</a>
              </p>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>"""

        attachments_payload = []
        if resume_bytes and resume_filename:
            b64_content = base64.b64encode(resume_bytes).decode("utf-8")
            attachments_payload.append({
                "name": resume_filename,
                "content": b64_content,
            })

        return await self._send_brevo_email(
            to_email=careers_email,
            to_name="CareerShala Hiring Team",
            subject=subject,
            html_body=html_body,
            reply_to_email=applicant_email,
            reply_to_name=applicant_name,
            attachments=attachments_payload if attachments_payload else None,
        )

    async def send_payment_recovery_email(
        self,
        *,
        to_email: str,
        full_name: str,
        plan_name: str,
        amount: float,
        failure_situation: str,
        retry_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Sends AI-personalized subscription payment recovery email via Brevo."""
        base_url = (getattr(settings, "FRONTEND_URL", "") or getattr(settings, "APP_BASE_URL", "") or "https://careershala.tech").rstrip("/")
        if "localhost" in base_url or not base_url:
            base_url = "https://careershala.tech"

        final_retry_url = retry_url or f"{base_url}/billing"
        support_url = f"{base_url}/support"

        html = _render_template(
            "payment_recovery.html",
            full_name=full_name or "there",
            plan_name=plan_name.capitalize(),
            amount=f"{amount:.0f}" if amount == int(amount) else f"{amount:.2f}",
            failure_situation=failure_situation or "Temporary payment processing issue",
            retry_url=final_retry_url,
            support_url=support_url,
            logo_url=f"{base_url}/logo.png",
        )

        subject = f"⚠️ Action Required: Renew your CareerShala {plan_name.capitalize()} subscription"
        return await self._send_brevo_email(
            to_email=to_email,
            to_name=full_name,
            subject=subject,
            html_body=html,
        )

    async def send_winback_offer_email(
        self,
        *,
        to_email: str,
        full_name: str,
        plan_name: str,
        discount_pct: int,
        promo_code: str,
        original_amount: float,
        discounted_amount: float,
        valid_until_str: str,
        claim_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Sends bounded win-back discount offer email via Brevo."""
        base_url = (getattr(settings, "FRONTEND_URL", "") or getattr(settings, "APP_BASE_URL", "") or "https://careershala.tech").rstrip("/")
        if "localhost" in base_url or not base_url:
            base_url = "https://careershala.tech"

        final_claim_url = claim_url or f"{base_url}/premium?coupon={promo_code}"
        support_url = f"{base_url}/support"

        html = _render_template(
            "winback_offer.html",
            full_name=full_name or "there",
            plan_name=plan_name.capitalize(),
            discount_pct=discount_pct,
            promo_code=promo_code,
            original_amount=f"{original_amount:.0f}",
            discounted_amount=f"{discounted_amount:.0f}",
            valid_until_str=valid_until_str or "next 7 days",
            claim_url=final_claim_url,
            support_url=support_url,
            logo_url=f"{base_url}/logo.png",
        )

        subject = f"🎁 Special Offer: {discount_pct}% Off CareerShala {plan_name.capitalize()}"
        return await self._send_brevo_email(
            to_email=to_email,
            to_name=full_name,
            subject=subject,
            html_body=html,
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
