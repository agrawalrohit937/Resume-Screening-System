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
import jinja2
import structlog

from core.config import settings
from models.otp_model import OTPPurpose

logger = structlog.get_logger(__name__)

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"

_jinja_env = jinja2.Environment(
    loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=jinja2.select_autoescape(["html", "xml"]),
)

_OTP_DISPATCH = {
    OTPPurpose.SIGNUP_VERIFICATION: ("otp_verification.html", "Verify your CareerShala email"),
    OTPPurpose.LOGIN_VERIFICATION: ("otp_verification.html", "Your CareerShala login code"),
    OTPPurpose.PASSWORD_RESET: ("password_reset.html", "Reset your CareerShala password"),
}


def _render_template(filename: str, **context) -> str:
    base_url = settings.FRONTEND_URL.rstrip("/")
    public_base = "https://careershala.tech" if ("localhost" in base_url or "127.0.0.1" in base_url) else base_url
    context.setdefault("base_url", base_url)
    context.setdefault("logo_url", "https://res.cloudinary.com/docxk5qop/image/upload/v1789955361/careerpilot/brand/careershala_logo.png")
    context.setdefault("support_url", f"{base_url}/support")
    context.setdefault("support_email", getattr(settings, "SUPPORT_EMAIL", "support@careershala.tech") or "support@careershala.tech")
    context.setdefault("careers_email", getattr(settings, "CAREERS_EMAIL", "careers@careershala.tech") or "careers@careershala.tech")
    context.setdefault("info_email", getattr(settings, "INFO_EMAIL", "info@careershala.tech") or "info@careershala.tech")
    context.setdefault("year", str(datetime.now().year))

    try:
        template = _jinja_env.get_template(filename)
        return template.render(**context)
    except Exception as e:
        logger.warning(f"Jinja2 template render exception for {filename}: {e}")
        path = TEMPLATES_DIR / filename
        if path.exists():
            html = path.read_text(encoding="utf-8")
            for key, value in context.items():
                html = html.replace("{{" + key + "}}", str(value))
            return html
        return f"<p>{context.get('otp', '')}</p>"


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

        try:
            safe_subj = str(subject).encode("ascii", "replace").decode("ascii")
            logger.info(
                "Sending Email via Brevo HTTP API",
                to=to_email,
                subject=safe_subj,
                has_reply_to=bool(reply_to_email),
                attachment_count=len(attachments or []),
            )
        except Exception:
            pass

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(BREVO_API_URL, headers=headers, json=payload)

            if response.status_code in (200, 201, 202):
                data = response.json()
                message_id = data.get("messageId") or data.get("message_id") or "brevo-success"
                try:
                    safe_subj = str(subject).encode("ascii", "replace").decode("ascii")
                    logger.info("Brevo Email Sent Successfully", to=to_email, subject=safe_subj, message_id=message_id)
                except Exception:
                    pass
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

    async def send_team_invitation(
        self,
        *,
        recipient_email: str,
        inviter_name: str,
        organization_name: str,
        role: str,
        invite_url: str,
        expires_days: int = 7,
    ) -> bool:
        """Sends an enterprise team invitation email via Brevo HTTP API with an acceptance CTA button."""
        role_label_map = {
            "recruiter": "Talent Recruiter",
            "hiring_manager": "Hiring Manager",
            "interviewer": "Technical Interviewer",
            "coordinator": "Interview Coordinator",
            "executive": "Executive Owner",
        }
        role_name = role_label_map.get(role.lower(), role.title().replace("_", " "))
        subject = f"You're invited to join {organization_name} on CareerShala as {role_name}"

        html = _render_template(
            "team_invitation.html",
            recipient_email=recipient_email,
            inviter_name=inviter_name or "An organization administrator",
            organization_name=organization_name or "CareerShala Enterprise",
            role_name=role_name,
            invite_url=invite_url,
            expiry_days=expires_days,
        )
        return await self._send(recipient_email, subject, html)

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

        html_body = _render_template(
            "certificate_delivery.html",
            recipient_name=recipient_name,
            topic=topic,
            difficulty=difficulty,
            score=score,
            grade_label=grade_label,
            issued_str=issued_str,
            cert_id=cert_id,
            public_url=public_url,
            linkedin_url=linkedin_url,
            verification_url=verification_url,
        )

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

        base_url = settings.FRONTEND_URL.rstrip("/")
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

        html_body = _render_template(
            "support_ticket.html",
            ticket_id=ticket_id,
            ticket_subject=ticket_subject,
            ticket_priority=ticket_priority,
            ticket_category=ticket_category,
            user_name=user_name,
            user_email=user_email,
            user_plan=user_plan,
            description=description,
            created_time=created_time,
            browser_info=browser_info,
            os_info=os_info,
            page_url=page_url,
            priority_bg=priority_bg,
            priority_color=priority_color,
            attachments_block=attachments_block,
        )

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
        linkedin_url: Optional[str] = None,
        github_url: Optional[str] = None,
        portfolio_url: Optional[str] = None,
        cover_letter: Optional[str] = None,
        resume_bytes: Optional[bytes] = None,
        resume_filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send job application notification email to hiring team via Brevo HTTP API with attached resume PDF."""
        careers_email = getattr(settings, "CAREERS_EMAIL", None) or "careers@careershala.tech"
        subject = f"💼 New Job Application: {applicant_name} — {role_title}"

        def _fmt_link(url: Optional[str]) -> str:
            if not url:
                return '<span style="color:#9ca3af; font-style:italic;">Not provided</span>'
            clean_url = url.strip()
            href = clean_url if clean_url.startswith("http") else f"https://{clean_url}"
            return f'<a href="{escape(href)}" target="_blank" style="color:#2563eb; text-decoration:none; font-weight:500;">{escape(clean_url)}</a>'

        linkedin_html = _fmt_link(linkedin_url)
        github_html = _fmt_link(github_url)
        portfolio_html = _fmt_link(portfolio_url) if portfolio_url else ""

        formatted_cover = escape(cover_letter or "").replace("\n", "<br/>")
        if not formatted_cover.strip():
            formatted_cover = '<span style="color:#9ca3af; font-style:italic;">No cover letter provided.</span>'

        resume_status_html = (
            f'<span style="color:#16a34a; font-weight:600;">Attached ({escape(resume_filename)})</span>'
            if resume_bytes and resume_filename
            else '<span style="color:#9ca3af; font-style:italic;">No file attached</span>'
        )

        applied_date = datetime.now(timezone.utc).strftime("%B %d, %Y • %H:%M UTC")
        
        # Extract 2-letter initials
        name_parts = [p for p in applicant_name.strip().split() if p]
        applicant_initials = (name_parts[0][0] + (name_parts[-1][0] if len(name_parts) > 1 else "")) if name_parts else "CS"
        applicant_initials = applicant_initials.upper()

        html_body = _render_template(
            "career_application.html",
            applicant_name=applicant_name,
            applicant_initials=applicant_initials,
            role_title=role_title,
            applicant_email=applicant_email,
            linkedin_html=linkedin_html,
            github_html=github_html,
            portfolio_html=portfolio_html,
            resume_status_html=resume_status_html,
            formatted_cover=formatted_cover,
            applied_date=applied_date,
        )

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
        base_url = settings.FRONTEND_URL.rstrip("/")

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
        base_url = settings.FRONTEND_URL.rstrip("/")

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


# ══════════════════════════════════════════════════════════════════════════════
# NIGHTLY AI JOB ALERT EMAIL SERVICE (SMTP & MIME)
# ══════════════════════════════════════════════════════════════════════════════

async def send_job_alert_email(
    to_email: str,
    candidate_name: str,
    matched_jobs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Sends a nightly AI Job Alert email to a candidate with high-matching opportunities.
    Uses built-in smtplib and email.mime with non-blocking async execution.
    Configured via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, FROM_EMAIL env vars.
    Falls back gracefully to simulated delivery in dev environments if SMTP is unconfigured.
    """
    import asyncio
    import os
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    if not to_email or not matched_jobs:
        return {"sent": False, "error": "Recipient email and matched jobs are required"}

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    from_email = os.getenv("FROM_EMAIL", getattr(settings, "MAIL_FROM_EMAIL", None) or "alerts@careershala.tech")
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")

    count = len(matched_jobs)
    plural_roles = "roles" if count != 1 else "role"
    subject = f"New job recommendation{'s' if count != 1 else ''} matching your profile | CareerShala"

    # 1. Construct Premium Modern Job Cards HTML
    job_cards_html = []
    color_palette = [
        ("#4f46e5", "#6366f1"),
        ("#0284c7", "#38bdf8"),
        ("#0d9488", "#14b8a6"),
        ("#7c3aed", "#a855f7"),
        ("#2563eb", "#60a5fa"),
    ]

    for idx, job in enumerate(matched_jobs):
        title = escape(str(job.get("title") or "Software Engineer"))
        raw_company = str(job.get("company_name") or job.get("company") or "CareerShala Partner")
        company = escape(raw_company)
        raw_loc = str(job.get("location") or "Remote").strip()
        raw_mode = str(job.get("work_mode") or job.get("job_type") or job.get("type") or "").strip()
        salary = escape(str(job.get("salary_range") or job.get("salary") or "")) if (job.get("salary_range") or job.get("salary")) else None
        match_score = int(round(float(job.get("match_score", 85))))
        job_id = str(job.get("id") or job.get("_id") or "")
        job_url = f"{frontend_url}/jobs"

        # Company logo resolution: dynamically use employer's company_logo_url
        raw_logo = (
            job.get("company_logo_url")
            or job.get("company_logo")
            or job.get("logo_url")
            or job.get("logo")
        )
        c_initial = escape(raw_company[:1].upper() if raw_company else "C")
        c1, c2 = color_palette[abs(hash(raw_company)) % len(color_palette)]

        # Resolve logo to an absolute HTTPS URL if provided by employer
        logo_url = None
        if raw_logo:
            raw_logo_str = str(raw_logo).strip()
            # Tenant isolation safeguard: If raw_logo points to the platform logo but company is not CareerShala, ignore it
            if "careershala_logo" in raw_logo_str.lower() and "careershala" not in raw_company.lower():
                logo_url = None
            elif raw_logo_str.startswith("http://") or raw_logo_str.startswith("https://"):
                logo_url = raw_logo_str
            elif raw_logo_str.startswith("data:image/"):
                from services.cloudinary_service import upload_base64_company_logo
                c_id = raw_company.lower().replace(" ", "-") if raw_company else "company"
                uploaded_url = await upload_base64_company_logo(raw_logo_str, company_id=c_id)
                if uploaded_url:
                    logo_url = uploaded_url
            elif raw_logo_str.startswith("/"):
                logo_url = f"{frontend_url}/{raw_logo_str.lstrip('/')}"
            elif "." in raw_logo_str:
                logo_url = f"{frontend_url}/{raw_logo_str.lstrip('/')}"

        # Template logic: Prioritize image when logo_url exists, fallback to text avatar if missing
        if logo_url:
            logo_html = f"""
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 auto;">
                <tr>
                    <td style="width:42px;height:42px;text-align:center;vertical-align:middle;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;padding:0;">
                        <img src="{escape(logo_url)}" alt="{company}" width="40" height="40" style="display:block;margin:0 auto;width:40px;height:40px;border-radius:6px;object-fit:contain;border:0;outline:none;" />
                    </td>
                </tr>
            </table>
            """
        else:
            logo_html = f"""
            <div style="width:42px;height:42px;border-radius:8px;background:linear-gradient(135deg, {c1} 0%, {c2} 100%);text-align:center;line-height:42px;color:#ffffff;font-size:16px;font-weight:700;">
                {c_initial}
            </div>
            """

        # Metadata badges
        meta_parts = []
        if raw_loc and raw_mode and raw_loc.lower() == raw_mode.lower():
            meta_parts.append(f'<span style="display:inline-block;background-color:#f8fafc;border:1px solid #e2e8f0;color:#475569;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:500;margin-right:4px;">{escape(raw_loc)}</span>')
        else:
            if raw_loc:
                meta_parts.append(f'<span style="display:inline-block;background-color:#f8fafc;border:1px solid #e2e8f0;color:#475569;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:500;margin-right:4px;">{escape(raw_loc)}</span>')
            if raw_mode:
                meta_parts.append(f'<span style="display:inline-block;background-color:#f8fafc;border:1px solid #e2e8f0;color:#475569;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:500;margin-right:4px;">{escape(raw_mode)}</span>')

        if salary:
            meta_parts.append(f'<span style="display:inline-block;background-color:#ecfdf5;border:1px solid #a7f3d0;color:#047857;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-right:4px;">{salary}</span>')

        meta_line_html = "".join(meta_parts)

        # Skills badges HTML
        matched_skills = job.get("matched_skills") or job.get("required_skills") or job.get("skills") or []
        skills_pills = "".join(
            f'<span style="display:inline-block;padding:3px 8px;margin:2px 4px 2px 0;background-color:#f1f5f9;color:#334155;border-radius:4px;font-size:11px;font-weight:500;">{escape(str(s))}</span>'
            for s in matched_skills[:4]
        )

        skills_section = (
            f'<div style="margin-top:10px;">{skills_pills}</div>'
            if skills_pills
            else ""
        )

        job_cards_html.append(f"""
        <div style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px 18px;margin-bottom:14px;box-shadow:0 1px 3px rgba(15,23,42,0.03);">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                    <td valign="top" style="width:44px;padding-right:12px;">
                        {logo_html}
                    </td>
                    <td valign="top" style="padding-right:10px;">
                        <a href="{job_url}" target="_blank" style="text-decoration:none;font-size:15px;font-weight:700;color:#0f172a;line-height:1.3;display:inline-block;">
                            {title}
                        </a>
                        <div style="font-size:13px;font-weight:500;color:#4b5563;margin-top:2px;">
                            {company}
                        </div>
                    </td>
                    <td valign="top" align="right" style="text-align:right;width:86px;">
                        <span style="display:inline-block;background-color:#ecfdf5;border:1px solid #a7f3d0;color:#047857;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap;">
                            {match_score}% Match
                        </span>
                    </td>
                </tr>
            </table>

            <div style="margin-top:10px;">
                {meta_line_html}
            </div>

            {skills_section}

            <div style="margin-top:14px;padding-top:12px;border-top:1px solid #f1f5f9;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td>
                            <a href="{job_url}" target="_blank" style="display:inline-block;background-color:#4F46E5;color:#ffffff;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;box-shadow:0 1px 2px rgba(79,70,229,0.2);">
                                View Role &amp; Apply &rarr;
                            </a>
                        </td>
                    </tr>
                </table>
            </div>
        </div>
        """)

    job_cards_rendered = "\n".join(job_cards_html)

    # 2. Render HTML Email via Jinja2 Template
    html_template = _render_template(
        "job_alert.html",
        subject=subject,
        count=count,
        plural_roles=plural_roles,
        candidate_name=candidate_name or "there",
        job_cards_rendered=job_cards_rendered,
        frontend_url=frontend_url,
    )

    # Plain text alternative
    text_lines = [
        f"Hi {candidate_name or 'there'},",
        f"\nWe found {count} new {plural_roles} matching your profile on CareerShala:\n",
    ]
    for j in matched_jobs:
        text_lines.append(f"- {j.get('title')} at {j.get('company_name')} ({j.get('match_score', 80)}% Match)")
        text_lines.append(f"  Location: {j.get('location')} ({j.get('work_mode')})")
        text_lines.append(f"  View: {frontend_url}/jobs\n")
    text_lines.append(f"View all matches: {frontend_url}/jobs")
    plain_text = "\n".join(text_lines)

    # 3. Assemble MIME message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"CareerShala Job Alerts <{from_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(plain_text, "plain", "utf-8"))
    msg.attach(MIMEText(html_template, "html", "utf-8"))
    msg_bytes = msg.as_bytes()

    # 4. Dispatch via Brevo HTTP API (primary) or SMTP fallback
    if getattr(settings, "BREVO_API_KEY", None):
        try:
            email_svc = EmailService()
            brevo_res = await email_svc._send_brevo_email(
                to_email=to_email,
                to_name=candidate_name,
                subject=subject,
                html_body=html_template,
                text_body=plain_text,
                sender_name="CareerShala Job Alerts",
            )
            if brevo_res.get("sent"):
                logger.info("Job alert email dispatched via Brevo", to=to_email, count=count)
                return {"sent": True, "method": "brevo", "to": to_email, "count": count}
            else:
                logger.warning("Brevo returned error for job alert", res=brevo_res)
        except Exception as exc:
            logger.warning("Brevo dispatch exception for job alert, falling back to SMTP", error=str(exc))

    # 5. Synchronous SMTP transport helper
    def _send_smtp_sync() -> None:
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=20)
        try:
            server.ehlo()
            if server.has_extn("STARTTLS"):
                server.starttls()
                server.ehlo()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(from_email, [to_email], msg_bytes)
        finally:
            try:
                server.quit()
            except Exception:
                pass

    # 6. Dispatch via SMTP or simulate in development
    if smtp_user and smtp_password:
        try:
            await asyncio.to_thread(_send_smtp_sync)
            logger.info("Job alert email dispatched via SMTP", to=to_email, count=count)
            return {"sent": True, "method": "smtp", "to": to_email, "count": count}
        except Exception as exc:
            logger.error("Failed to send job alert via SMTP", to=to_email, error=str(exc))
            return {"sent": False, "error": str(exc), "to": to_email}
    else:
        logger.info(
            "SMTP credentials not fully configured; simulated job alert email dispatch",
            to=to_email,
            job_count=count,
            host=smtp_host,
        )
        return {"sent": True, "simulated": True, "to": to_email, "count": count}

