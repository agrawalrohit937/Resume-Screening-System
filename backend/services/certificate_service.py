"""
Certificate Service (legacy) — Render and upload certificates via Cloudinary.
This is a standalone certificate generator used separately from the
certificates/ package. It now uses cloudinary_service instead of FTP.
"""

import io
import os
import uuid
from datetime import datetime, timezone

import qrcode
import aiosmtplib
import structlog
from email.message import EmailMessage
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from core.config import settings
from services.cloudinary_service import upload_certificate

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
PAGE_SIZE = landscape(letter)  # 792 x 612 pt == 11in x 8.5in
PAGE_WIDTH, PAGE_HEIGHT = PAGE_SIZE

LAYOUT = {
    "name_y_frac": 0.56,
    "desc_y_frac": 0.44,
    "meta_y_frac": 0.37,
    "certid_y_frac": 0.08,
    "qr_size_pt": 70,
    "qr_margin_pt": 40,
}

# score threshold -> (label, hex color), checked top-down
GRADES = [
    (95, "Highest Distinction", "#B45309"),
    (90, "Distinction", "#6366F1"),
    (80, "Merit", "#0EA5E9"),
]


def _grade_for_score(score: int) -> tuple[str, str]:
    for threshold, label, color in GRADES:
        if score >= threshold:
            return label, color
    return "Pass", "#475569"


class CertificateService:
    _fonts_registered = False

    @classmethod
    def _register_fonts(cls):
        if cls._fonts_registered:
            return
        asset_dir = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")
        font_map = {
            "CertName": "GreatVibes-Regular.ttf",
            "CertBody": "Montserrat-Regular.ttf",
            "CertBodySemibold": "Montserrat-SemiBold.ttf",
        }
        for alias, filename in font_map.items():
            path = os.path.join(asset_dir, filename)
            try:
                pdfmetrics.registerFont(TTFont(alias, path))
            except Exception:
                logger.warning("Font not found", alias=alias, path=path)
        cls._fonts_registered = True

    @staticmethod
    async def generate_and_upload(user_name: str, email: str, topic: str, score: int, difficulty: str):
        CertificateService._register_fonts()

        cert_id = str(uuid.uuid4())
        verify_base = getattr(settings, "CERT_VERIFY_BASE_URL", "https://careershala.com/verify/cert")
        verification_url = f"{verify_base.rstrip('/')}/{cert_id}"
        grade_label, grade_color = _grade_for_score(score)
        issued_at = datetime.now(timezone.utc)

        ASSET_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")
        TEMPLATE_PATH = os.path.join(ASSET_DIR, "base_cert.png")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print(TEMPLATE_PATH)
        # --- QR code ---
        qr = qrcode.QRCode(box_size=8, border=1)
        qr.add_data(verification_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="#1e293b", back_color="white").convert("RGB")

        # --- Compose PDF ---
        pdf_buffer = io.BytesIO()
        c = canvas.Canvas(pdf_buffer, pagesize=PAGE_SIZE)
        c.setTitle(f"CareerShala Certificate - {user_name}")
        c.setAuthor(getattr(settings, "CERT_ISSUER_NAME", "CareerShala"))
        c.setSubject(f"Certificate of Achievement - {topic}")

        c.drawImage(TEMPLATE_PATH, 0, 0, width=PAGE_WIDTH, height=PAGE_HEIGHT, mask="auto")

        registered = pdfmetrics.getRegisteredFontNames()
        name_font = "CertName" if "CertName" in registered else "Helvetica-Bold"
        body_font = "CertBody" if "CertBody" in registered else "Helvetica"
        semibold_font = "CertBodySemibold" if "CertBodySemibold" in registered else "Helvetica-Bold"

        c.setFont(name_font, 46)
        c.setFillColor("#1e293b")
        c.drawCentredString(PAGE_WIDTH / 2, PAGE_HEIGHT * LAYOUT["name_y_frac"], user_name)

        c.setFont(body_font, 14)
        c.setFillColor("#475569")
        description = f'has successfully completed the "{topic}" assessment at {difficulty} level'
        c.drawCentredString(PAGE_WIDTH / 2, PAGE_HEIGHT * LAYOUT["desc_y_frac"], description)

        c.setFont(semibold_font, 12)
        c.setFillColor(grade_color)
        meta_line = f"Score: {score}%   |   Grade: {grade_label}   |   Issued: {issued_at.strftime('%d %B %Y')}"
        c.drawCentredString(PAGE_WIDTH / 2, PAGE_HEIGHT * LAYOUT["meta_y_frac"], meta_line)

        c.setFont(body_font, 8)
        c.setFillColor("#94a3b8")
        c.drawCentredString(
            PAGE_WIDTH / 2,
            PAGE_HEIGHT * LAYOUT["certid_y_frac"],
            f"Certificate ID: {cert_id}   •   Verify at {verify_base}",
        )

        qr_size = LAYOUT["qr_size_pt"]
        margin = LAYOUT["qr_margin_pt"]
        qr_x = PAGE_WIDTH - qr_size - margin
        qr_y = margin
        c.setFillColor("white")
        c.roundRect(qr_x - 8, qr_y - 8, qr_size + 16, qr_size + 16, 6, fill=1, stroke=0)
        c.drawImage(ImageReader(qr_img), qr_x, qr_y, width=qr_size, height=qr_size, mask="auto")

        c.showPage()
        c.save()
        pdf_bytes = pdf_buffer.getvalue()

        logger.info("Uploading certificate to Cloudinary", cert_id=cert_id)

        # Upload to Cloudinary
        public_url, _public_id = await upload_certificate(pdf_bytes, cert_id)
        logger.info("Certificate upload complete", cert_id=cert_id, url=public_url)

        return public_url, cert_id, pdf_bytes, grade_label, issued_at

    @staticmethod
    async def dispatch_certificate_email(
        recipient_email: str,
        recipient_name: str,
        topic: str,
        difficulty: str,
        score: int,
        grade_label: str,
        cert_id: str,
        issued_at: datetime,
        public_url: str,
        pdf_bytes: bytes,
    ):
        verify_base = getattr(settings, "CERT_VERIFY_BASE_URL", "https://careershala.com/verify/cert")
        verification_url = f"{verify_base.rstrip('/')}/{cert_id}"
        issued_str = issued_at.strftime("%d %B %Y")

        message = EmailMessage()
        message["From"] = settings.SMTP_USER
        message["To"] = recipient_email
        message["Subject"] = f"🎉 Congratulations {recipient_name}! Your CareerShala Certificate is Ready"

        plain_body = (
            f"Hi {recipient_name},\n\n"
            f"Congratulations on completing the {topic} assessment with a score of "
            f"{score}% ({grade_label}) at {difficulty} level.\n\n"
            f"Certificate ID : {cert_id}\n"
            f"Issued on      : {issued_str}\n"
            f"Download link  : {public_url}\n"
            f"Verify online  : {verification_url}\n\n"
            f"Your certificate is also attached to this email as a PDF.\n\n"
            f"Keep learning and growing!\n"
            f"Team CareerShala"
        )
        message.set_content(plain_body)

        html_body = f"""\
<html>
  <body style="font-family: Arial, sans-serif; background:#f8fafc; padding:24px; color:#1e293b;">
    <div style="max-width:560px;margin:auto;background:white;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
      <h2 style="color:#1e293b;">🎉 Congratulations, {recipient_name}!</h2>
      <p>You've successfully completed the <b>{topic}</b> assessment at <b>{difficulty}</b> level.</p>
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
            filename=f"CareerShala_Certificate_{topic.replace(' ', '_')}.pdf",
        )

        use_tls = bool(settings.SMTP_PORT == 465 and getattr(settings, "SMTP_USE_SSL", False))
        start_tls = bool(settings.SMTP_PORT == 587 or not use_tls)

        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=use_tls,
            start_tls=start_tls,
        )