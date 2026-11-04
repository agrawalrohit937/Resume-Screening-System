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
        from config.db import get_pg_session_factory
        from models.tables import Certificate
        t_val = self.topic or (
            self.snapshot.get("assessment_slug")
            or self.snapshot.get("assessment_name")
            or "general"
        ).lower().strip()

        async with get_pg_session_factory()() as session:
            cert_row = Certificate(
                id=self.id,
                certificate_type=self.certificate_type,
                template_used=self.template_used,
                user_id=str(self.user_id),
                recipient_name=self.recipient_name,
                snapshot=self.snapshot,
                status=self.status,
                issued_at=self.issued_at,
                revoked_at=self.revoked_at,
                public_url=self.public_url,
                topic=t_val,
                superseded_by=self.superseded_by,
                superseded_at=self.superseded_at,
                schema_version=self.schema_version,
            )
            session.add(cert_row)
            await session.commit()

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
        from config.db import get_pg_session_factory
        from models.tables import Certificate
        from sqlalchemy import select
        async with get_pg_session_factory()() as session:
            stmt = select(Certificate).where(Certificate.id == str(cert_id))
            row = (await session.execute(stmt)).scalar_one_or_none()
            if not row:
                return None
            return CertificateRecord(
                id=row.id,
                certificate_type=row.certificate_type,
                template_used=row.template_used,
                user_id=row.user_id,
                recipient_name=row.recipient_name,
                snapshot=row.snapshot or {},
                status=row.status,
                issued_at=row.issued_at,
                revoked_at=row.revoked_at,
                public_url=row.public_url or "",
                topic=row.topic,
                superseded_by=row.superseded_by,
                superseded_at=row.superseded_at,
                schema_version=row.schema_version or 1,
            )

    @staticmethod
    async def find_by_user(user_id: str, page_size: int = 20) -> list["CertificateRecord"]:
        from config.db import get_pg_session_factory
        from models.tables import Certificate
        from sqlalchemy import select, desc
        async with get_pg_session_factory()() as session:
            stmt = select(Certificate).where(Certificate.user_id == str(user_id)).order_by(desc(Certificate.issued_at)).limit(page_size)
            rows = (await session.execute(stmt)).scalars().all()
            return [
                CertificateRecord(
                    id=row.id,
                    certificate_type=row.certificate_type,
                    template_used=row.template_used,
                    user_id=row.user_id,
                    recipient_name=row.recipient_name,
                    snapshot=row.snapshot or {},
                    status=row.status,
                    issued_at=row.issued_at,
                    revoked_at=row.revoked_at,
                    public_url=row.public_url or "",
                    topic=row.topic,
                    superseded_by=row.superseded_by,
                    superseded_at=row.superseded_at,
                    schema_version=row.schema_version or 1,
                )
                for row in rows
            ]

