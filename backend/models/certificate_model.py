from dataclasses import dataclass, asdict, field, fields
from datetime import datetime
from typing import Optional
import structlog

logger = structlog.get_logger(__name__)

SCHEMA_VERSION = 1


@dataclass
class CertificateRecord:
    id: str  # cert_id, primary key
    certificate_type: str
    template_used: str
    user_id: str
    recipient_name: str
    snapshot: dict
    status: str  # "active" | "revoked" | "superseded"
    issued_at: datetime
    revoked_at: Optional[datetime] = None
    public_url: str = ""
    topic: Optional[str] = None
    superseded_by: Optional[str] = None
    superseded_at: Optional[datetime] = None
    schema_version: int = field(default=SCHEMA_VERSION)

    async def persist(self) -> None:
        from repositories.certificate_repo import CertificateRepository
        t_val = self.topic or (
            self.snapshot.get("assessment_slug")
            or self.snapshot.get("assessment_name")
            or "general"
        ).lower().strip()

        repo = CertificateRepository()
        await repo.create({
            "id": self.id,
            "certificate_type": self.certificate_type,
            "template_used": self.template_used,
            "user_id": str(self.user_id),
            "recipient_name": self.recipient_name,
            "snapshot": self.snapshot,
            "status": self.status,
            "issued_at": self.issued_at,
            "revoked_at": self.revoked_at,
            "public_url": self.public_url,
            "topic": t_val,
            "superseded_by": self.superseded_by,
            "superseded_at": self.superseded_at,
            "schema_version": self.schema_version,
        })

    @classmethod
    def from_doc(cls, doc: dict) -> "CertificateRecord":
        d = dict(doc)
        d["id"] = d.pop("_id", d.get("id"))
        d.pop("schema_version", None)
        valid_fields = {f.name for f in fields(cls)}
        filtered = {k: v for k, v in d.items() if k in valid_fields}
        return cls(**filtered)

    @staticmethod
    async def find_by_id(cert_id: str) -> Optional["CertificateRecord"]:
        from repositories.certificate_repo import CertificateRepository
        repo = CertificateRepository()
        row = await repo.get_by_id(str(cert_id))
        if not row:
            return None
        return CertificateRecord(
            id=row["id"],
            certificate_type=row.get("certificate_type") or "",
            template_used=row.get("template_used") or "",
            user_id=row.get("user_id") or "",
            recipient_name=row.get("recipient_name") or "",
            snapshot=row.get("snapshot") or {},
            status=row.get("status") or "active",
            issued_at=row.get("issued_at"),
            revoked_at=row.get("revoked_at"),
            public_url=row.get("public_url") or "",
            topic=row.get("topic"),
            superseded_by=row.get("superseded_by"),
            superseded_at=row.get("superseded_at"),
            schema_version=row.get("schema_version") or 1,
        )

    @staticmethod
    async def find_by_user(user_id: str, page_size: int = 20) -> list["CertificateRecord"]:
        from repositories.certificate_repo import CertificateRepository
        repo = CertificateRepository()
        rows = await repo.list_by_user(str(user_id), limit=page_size)
        return [
            CertificateRecord(
                id=row["id"],
                certificate_type=row.get("certificate_type") or "",
                template_used=row.get("template_used") or "",
                user_id=row.get("user_id") or "",
                recipient_name=row.get("recipient_name") or "",
                snapshot=row.get("snapshot") or {},
                status=row.get("status") or "active",
                issued_at=row.get("issued_at"),
                revoked_at=row.get("revoked_at"),
                public_url=row.get("public_url") or "",
                topic=row.get("topic"),
                superseded_by=row.get("superseded_by"),
                superseded_at=row.get("superseded_at"),
                schema_version=row.get("schema_version") or 1,
            )
            for row in rows
        ]

