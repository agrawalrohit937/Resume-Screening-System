from datetime import datetime, timezone

import structlog
from sympy import pprint

from certificates.ftp_storage import FTPCertificateStorage
from certificates.id_generator import generate_certificate_id, resolve_grade
from certificates.qr import build_verification_url, generate_qr_image
from certificates.registry import get_registry_entry
from certificates.renderer import render_certificate_pdf
from certificates.skill_icons import resolve_skill_icon_path
from core.config import settings
from models.certificate_model import CertificateRecord


logger = structlog.get_logger(__name__)


class CertificateService:
    """Public entry point for issuing a certificate of any registered type.

    Flow: build a fully-resolved, type-specific snapshot -> validate it
    against the registry's required fields -> render (ReportLab draws
    only the dynamic fields onto the Canva background) -> upload via Cloudinary
    -> persist a DB record that stores the snapshot verbatim. Nothing
    after the snapshot is built ever looks at "current" config again.
    """

    # ------------------------------------------------------------------
    # Type-specific context builders. Each one turns raw input into a
    # flat, template-ready snapshot. Add one function per new
    # certificate_type — this is deliberately NOT over-abstracted since
    # there's currently only one type in production use.
    # ------------------------------------------------------------------
    @staticmethod
    def _build_assessment_snapshot(recipient_name: str, assessment_name: str,
                                    assessment_slug: str, difficulty: str, score: int) -> dict:
        grade_label, _accent = resolve_grade(score)
        return {
            "recipient_name": recipient_name,
            "assessment_name": assessment_name,
            "assessment_slug": assessment_slug,
            "assessment_slug_display": assessment_name,
            "assessment_icon": f"{assessment_slug}.png",
            "difficulty": difficulty.capitalize(),
            "score": score,
            "grade_label": grade_label,
            "is_top_performer": score >= 95,
        }

    @classmethod
    def _build_snapshot(cls, certificate_type: str, context: dict) -> dict:
        if certificate_type == "assessment":
            return cls._build_assessment_snapshot(
                recipient_name=context["recipient_name"],
                assessment_name=context["assessment_name"],
                assessment_slug=context["assessment_slug"],
                difficulty=context["difficulty"],
                score=context["score"],
            )
        raise ValueError(f"No snapshot builder registered for certificate_type='{certificate_type}'")

    @staticmethod
    def _validate_snapshot(certificate_type: str, snapshot: dict) -> None:
        required = get_registry_entry(certificate_type)["required_snapshot_fields"]
        missing = [f for f in required if f not in snapshot or snapshot[f] in (None, "")]
        if missing:
            raise ValueError(f"Snapshot for '{certificate_type}' is missing required fields: {missing}")

    # ------------------------------------------------------------------
    @classmethod
    async def issue(cls, user_id: str, certificate_type: str, context: dict) -> tuple:
        registry_entry = get_registry_entry(certificate_type)  # raises on unknown type — allow-list check
        template_dir = registry_entry["template"]

        snapshot = cls._build_snapshot(certificate_type, context)
        cls._validate_snapshot(certificate_type, snapshot)

        cert_id = generate_certificate_id()
        issued_at = datetime.now(timezone.utc)
        verification_url = build_verification_url(cert_id)

        # Only the fields ReportLab actually draws — everything else
        # (grade banner, "100/100" style copy, seal, signatures, borders)
        # is permanently baked into the Canva background and never
        # touched here. Keys must match templates/*/layout.json's
        # `text_fields` / `image_fields` names.
        render_context = {
            "recipient_name": snapshot["recipient_name"],

            # Display Text
            "assessment_name": (
                f"{snapshot['assessment_name']} Assessment "
                f"({snapshot['difficulty']} Level)"
            ),

            "issued_date": issued_at.strftime("%d %B %Y"),
            "cert_id": cert_id,

            "skill_logo_image": resolve_skill_icon_path(snapshot["assessment_slug"]),

            "skill_name": snapshot["assessment_name"].upper(),
            "qr_code_image": generate_qr_image(verification_url),
        }

        try:
            pdf_bytes = render_certificate_pdf(template_dir, render_context)
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise

        filename = f"{cert_id}.pdf"
        try:
            print(f"PDF Size = {len(pdf_bytes)/1024:.2f} KB")
            public_url, _public_id = await FTPCertificateStorage.async_upload(filename, pdf_bytes)
        except Exception:
            import traceback
            traceback.print_exc()
            raise

        record = CertificateRecord(
            id=cert_id,
            certificate_type=certificate_type,
            template_used=template_dir,
            user_id=user_id,
            recipient_name=snapshot["recipient_name"],
            snapshot=snapshot,          # frozen forever — see architecture note
            status="active",
            issued_at=issued_at,
            revoked_at=None,
            public_url=public_url,
        )
        try:
            await record.persist()
        except Exception:
            import traceback
            traceback.print_exc()
            raise

        return record, pdf_bytes

    # ------------------------------------------------------------------
    @staticmethod
    async def get_public_view(cert_id: str) -> dict:
        """Used by the public /verify endpoint. Reads ONLY the frozen
        snapshot + non-sensitive record fields — never touches the users
        collection, so a leak here structurally cannot expose private
        user data. Unaffected by the rendering-layer change."""
        record = await CertificateRecord.find_by_id(cert_id)
        if record is None:
            return {"valid": False, "reason": "not_found"}
        if record.status == "revoked":
            return {"valid": False, "reason": "revoked"}

        snap = record.snapshot
        return {
            "valid": True,
            "recipient_name": record.recipient_name,
            "cert_id": record.id,
            "certificate_type": record.certificate_type,
            "title": snap.get("assessment_name") or snap.get("course_name") or "CareerShala Certificate",
            "score": snap.get("score"),
            "grade": snap.get("grade_label"),
            "difficulty": snap.get("difficulty"),
            "issued_at": record.issued_at.isoformat(),
            "issuer": "CareerShala",
            "status": record.status,
            "public_url": record.public_url,
        }
