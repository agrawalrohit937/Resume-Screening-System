from dataclasses import dataclass, asdict, field
from datetime import datetime
from typing import Optional

from config.db import get_database

COLLECTION = "certificates"
SCHEMA_VERSION = 1


@dataclass
class CertificateRecord:
    id: str  # cert_id, also used as Mongo _id
    certificate_type: str
    template_used: str
    user_id: str
    recipient_name: str
    snapshot: dict
    status: str  # "active" | "revoked"
    issued_at: datetime
    revoked_at: Optional[datetime] = None
    public_url: str = ""
    schema_version: int = field(default=SCHEMA_VERSION)

    async def persist(self) -> None:
        db = get_database()
        doc = asdict(self)
        doc["_id"] = doc.pop("id")
        await db[COLLECTION].insert_one(doc)

    @staticmethod
    async def find_by_id(cert_id: str) -> Optional["CertificateRecord"]:
        db = get_database()
        doc = await db[COLLECTION].find_one({"_id": cert_id})
        if doc is None:
            return None
        doc["id"] = doc.pop("_id")
        doc.pop("schema_version", None)
        return CertificateRecord(**doc)

    @staticmethod
    async def find_by_user(user_id: str, page_size: int = 20) -> list["CertificateRecord"]:
        db = get_database()
        cursor = db[COLLECTION].find({"user_id": user_id}).sort("issued_at", -1).limit(page_size)
        results = []
        async for doc in cursor:
            doc["id"] = doc.pop("_id")
            doc.pop("schema_version", None)
            results.append(CertificateRecord(**doc))
        return results


# Indexes to create once at startup (call from your app's startup hook):
#   db.certificates.create_index("user_id")
#   db.certificates.create_index("status")
#   db.certificates.create_index([("user_id", 1), ("certificate_type", 1), ("snapshot.assessment_slug", 1)])
