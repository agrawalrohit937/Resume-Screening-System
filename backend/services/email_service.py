"""
Email Service — sends transactional emails via SMTP using environment-driven
configuration.

This service is shared by OTP delivery and support-ticket notifications so the
SMTP setup, logging, and error handling stay consistent in one place.
"""

import base64
from contextlib import suppress
from datetime import timezone
from email.message import EmailMessage
from html import escape
from pathlib import Path
from typing import Any, Dict, List

import aiosmtplib
import httpx
import structlog
from aiosmtplib.errors import (
    SMTPAuthenticationError,
    SMTPConnectError,
    SMTPException,
    SMTPResponseException,
    SMTPTimeoutError,
)
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from core.config import settings
from models.otp_model import OTPPurpose

logger = structlog.get_logger(__name__)

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"

# Purpose -> (template filename, subject). Single source of truth for
# what each OTP purpose sends. Add new purposes here only.
_OTP_DISPATCH = {
    OTPPurpose.SIGNUP_VERIFICATION: ("otp_verification.html", "Verify your CareerShala email"),
    OTPPurpose.LOGIN_VERIFICATION: ("otp_verification.html", "Your CareerShala login code"),
    OTPPurpose.PASSWORD_RESET: ("password_reset.html", "Reset your CareerShala password"),
}


def _render_template(filename: str, **context) -> str:
    path = TEMPLATES_DIR / filename
    html = path.read_text(encoding="utf-8")
    for key, value in context.items():
        html = html.replace("{{" + key + "}}", str(value))
    return html


class EmailService:
    def _smtp_config_ready(self) -> tuple[bool, str | None]:
        if not settings.SMTP_HOST:
            return False, "SMTP_HOST is not configured"
        if not settings.SMTP_PORT:
            return False, "SMTP_PORT is not configured"
        if not settings.SMTP_USER:
            return False, "SMTP_USER is not configured"
        if not settings.SMTP_PASSWORD:
            return False, "SMTP_PASSWORD is not configured"
        return True, None

    def _smtp_transport_flags(self) -> tuple[bool, bool]:
        use_tls = bool(settings.SMTP_PORT == 465 and settings.SMTP_USE_SSL)
        start_tls = bool(settings.SMTP_PORT == 587 or not use_tls)
        return use_tls, start_tls

    def _build_message(self, *, to_email: str, subject: str, from_email: str, html_body: str, text_body: str) -> EmailMessage:
        message = EmailMessage()
        message["From"] = f"{settings.SMTP_FROM_NAME} <{from_email}>"
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(text_body)
        message.add_alternative(html_body, subtype="html")
        return message

    async def _send_message(self, *, message: EmailMessage, to_email: str, subject: str) -> dict[str, Any]:
        is_ready, config_error = self._smtp_config_ready()
        if not is_ready:
            logger.error(
                "SMTP Configuration Missing",
                to=to_email,
                subject=subject,
                error=config_error,
            )
            return {"sent": False, "error": config_error or "SMTP configuration missing"}

        from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
        if not from_email:
            logger.error("SMTP From Address Missing", to=to_email, subject=subject)
            return {"sent": False, "error": "SMTP_FROM_EMAIL is not configured"}

        use_tls, start_tls = self._smtp_transport_flags()
        client = aiosmtplib.SMTP(
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            timeout=30,
            use_tls=use_tls,
            start_tls=start_tls,
        )

        logger.info(
            "SMTP Connecting",
            host=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            from_email=from_email,
            to=to_email,
            use_tls=use_tls,
            start_tls=start_tls,
            subject=subject,
        )

        try:
            await client.connect()
            logger.info("SMTP Connected", host=settings.SMTP_HOST, port=settings.SMTP_PORT, to=to_email)

            await client.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            logger.info("Authentication Successful", user=settings.SMTP_USER, to=to_email)

            logger.info("Sending Email...", to=to_email, subject=subject)
            await client.send_message(message)
            logger.info("Email Sent Successfully", to=to_email, subject=subject)
            return {"sent": True, "to": to_email, "subject": subject}
        except SMTPAuthenticationError as exc:
            logger.error(
                "SMTP Authentication Failed",
                to=to_email,
                subject=subject,
                error=str(exc),
            )
            return {"sent": False, "error": "SMTP authentication failed. Check SMTP_USER and SMTP_PASSWORD."}
        except SMTPTimeoutError as exc:
            logger.error("SMTP Timeout", to=to_email, subject=subject, error=str(exc))
            return {"sent": False, "error": "SMTP timeout while sending email."}
        except SMTPConnectError as exc:
            logger.error("SMTP Connection Failed", to=to_email, subject=subject, error=str(exc))
            return {"sent": False, "error": "Could not connect to the SMTP server."}
        except SMTPResponseException as exc:
            logger.error(
                "SMTP Response Error",
                to=to_email,
                subject=subject,
                code=getattr(exc, "code", None),
                error=str(exc),
            )
            return {"sent": False, "error": f"SMTP server rejected the message: {getattr(exc, 'code', 'unknown')}"}
        except SMTPException as exc:
            logger.error("SMTP Error", to=to_email, subject=subject, error=str(exc))
            return {"sent": False, "error": "SMTP error while sending email."}
        except Exception as exc:
            logger.exception("Email Sending Failed", to=to_email, subject=subject, error=str(exc))
            return {"sent": False, "error": "Unexpected error while sending email."}
        finally:
            with suppress(Exception):
                await client.quit()

    async def _send(self, to_email: str, subject: str, html_body: str) -> bool:
        text_body = "This email requires an HTML-capable client to view."
        from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER or "no-reply@careershala.tech"
        message = self._build_message(
            to_email=to_email,
            subject=subject,
            from_email=from_email,
            html_body=html_body,
            text_body=text_body,
        )
        result = await self._send_message(message=message, to_email=to_email, subject=subject)
        return bool(result.get("sent"))

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

    async def send_support_ticket_notification(self, *, ticket: Any, user: Any, metadata: dict | None = None, attachments: list[dict] | None = None) -> dict[str, Any]:
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

        from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER or "no-reply@careershala.tech"
        message = self._build_message(
            to_email=support_email,
            subject=subject,
            from_email=from_email,
            html_body=html_body,
            text_body=text_body,
        )

        logger.info(
            "Preparing Support Ticket Email",
            ticket_id=getattr(ticket, "ticket_id", None),
            to=support_email,
            subject=subject,
            attachment_count=len(attachments or []),
        )
        return await self._send_message(message=message, to_email=support_email, subject=subject)

    async def send_otp(self, to_email: str, full_name: str, otp: str, purpose: OTPPurpose) -> bool:
        """Unified OTP sender — replaces send_verification_otp / send_login_otp /
        send_password_reset_otp. Template + subject are resolved from _OTP_DISPATCH,
        so adding a new OTP purpose only requires a new dispatch entry, not a new method."""
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
    

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from pathlib import Path
from typing import List

from core.config import settings


async def send_with_attachments(*, to: str, subject: str, html_body: str, attachments: List[str]) -> str:
    """
    Sends an email with one or more file attachments (resume PDF, cover
    letter PDF). Returns a message-id-like string for storage in
    send_metadata.provider_message_id.
    """
    msg = MIMEMultipart()
    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    from_name = getattr(settings, "SMTP_FROM_NAME", "CareerShala")
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    for file_path in attachments:
        path = Path(file_path)
        if not path.exists():
            continue
        with open(path, "rb") as f:
            part = MIMEApplication(f.read(), Name=path.name)
        part["Content-Disposition"] = f'attachment; filename="{path.name}"'
        msg.attach(part)

    use_tls = bool(settings.SMTP_PORT == 465 and getattr(settings, "SMTP_USE_SSL", False))
    start_tls = bool(settings.SMTP_PORT == 587 or not use_tls)

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=use_tls,
            start_tls=start_tls,
        )
        logger.info("Application email with attachments sent successfully", to=to, subject=subject)
    except Exception as e:
        logger.error("Failed sending email with attachments via aiosmtplib", error=str(e))
        if use_tls:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(from_email, [to], msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if start_tls:
                    server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(from_email, [to], msg.as_string())

    return f"{to}-{subject[:20]}"

async def send_application_via_gmail_api(
    *,
    to: str,
    subject: str,
    html_body: str,
    attachments: List[str],
    user_id: str,
    user_repo,
) -> str:
    """
    Sends an email with file attachments directly from the user's Gmail account
    via Google Gmail API, using server-side stored OAuth tokens.

    Token management is fully automatic:
    - Loads the user's stored refresh_token from MongoDB.
    - If the access_token is expired, silently refreshes it via Google's token
      endpoint without any user interaction.
    - The user only sees Google's consent screen once (during initial connection).

    Supports both local file paths and remote HTTP/HTTPS URLs.
    Returns the sent message ID.

    Raises:
        HTTP 428 — if the user has not yet connected their Gmail account.
        HTTP 401 — if the stored refresh_token was revoked by the user.
        HTTP 503 — if Google's token endpoint is unreachable.
    """
    from services.gmail_token_service import GmailTokenService

    # Get auto-refreshed, ready-to-use credentials from the token service
    token_service = GmailTokenService(user_repo)
    creds = await token_service.get_valid_credentials(user_id)

    service = build("gmail", "v1", credentials=creds)

    msg = EmailMessage()
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content("This email requires an HTML-capable email client to view.")
    msg.add_alternative(html_body, subtype="html")

    async with httpx.AsyncClient(timeout=30.0) as client:
        for file_path in attachments:
            if not file_path:
                continue

            logger.info(f"Attempting to attach file: {file_path}")

            if file_path.startswith("http://") or file_path.startswith("https://"):
                try:
                    response = await client.get(file_path)
                    response.raise_for_status()
                    content = response.content
                except Exception as err:
                    raise Exception(f"Failed to download resume URL: {file_path}") from err

                url_path_name = Path(file_path.split("?")[0]).name
                filename = url_path_name if (url_path_name and "." in url_path_name) else "resume.pdf"
            else:
                path = Path(file_path)
                if not path.exists():
                    raise FileNotFoundError(f"Attachment missing at exact path: {file_path}")
                with open(path, "rb") as f:
                    content = f.read()
                filename = path.name

            msg.add_attachment(content, maintype="application", subtype="pdf", filename=filename)

    raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    sent_message = service.users().messages().send(userId="me", body={"raw": raw_message}).execute()

    msg_id = sent_message.get("id", "")
    logger.info("Application email sent via Gmail API", to=to, message_id=msg_id)
    return msg_id



