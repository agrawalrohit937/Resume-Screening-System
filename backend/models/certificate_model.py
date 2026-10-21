from dataclasses import dataclass, asdict, field, fields
from datetime import datetime
from typing import Optional
import structlog

from config.db import get_database

logger = structlog.get_logger(__name__)

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
    status: str  # "active" | "revoked" | "superseded"
    issued_at: datetime
    revoked_at: Optional[datetime] = None
    public_url: str = ""
    topic: Optional[str] = None
    superseded_by: Optional[str] = None
    superseded_at: Optional[datetime] = None
    schema_version: int = field(default=SCHEMA_VERSION)

    async def persist(self) -> None:
        db = get_database()
        doc = asdict(self)
        doc["_id"] = doc.pop("id")
        if not doc.get("topic"):
            doc["topic"] = (
                self.snapshot.get("assessment_slug")
                or self.snapshot.get("assessment_name")
                or "general"
            ).lower().strip()

        try:
            await db[COLLECTION].insert_one(doc)
        except Exception as e:
            err_str = str(e)
            if "certificate_user_topic_unique" in err_str or ("E11000" in err_str and "topic" in err_str):
                logger.warning("Detected legacy certificate_user_topic_unique index collision, dropping index and retrying", error=err_str)
                try:
                    await db[COLLECTION].drop_index("certificate_user_topic_unique")
                except Exception as drop_err:
                    logger.warning("Could not drop legacy certificate_user_topic_unique index", error=str(drop_err))
                await db[COLLECTION].insert_one(doc)
            else:
                raise

    @classmethod
    def from_mongo(cls, doc: dict) -> "CertificateRecord":
        d = dict(doc)
        d["id"] = d.pop("_id", d.get("id"))
        d.pop("schema_version", None)
        valid_fields = {f.name for f in fields(cls)}
        filtered = {k: v for k, v in d.items() if k in valid_fields}
        return cls(**filtered)

    @staticmethod
    async def find_by_id(cert_id: str) -> Optional["CertificateRecord"]:
        db = get_database()
        doc = await db[COLLECTION].find_one({"_id": cert_id})
        if doc is None:
            return None
        return CertificateRecord.from_mongo(doc)

    @staticmethod
    async def find_by_user(user_id: str, page_size: int = 20) -> list["CertificateRecord"]:
        db = get_database()
        cursor = db[COLLECTION].find({"user_id": user_id}).sort("issued_at", -1).limit(page_size)
        results = []
        async for doc in cursor:
            results.append(CertificateRecord.from_mongo(doc))
        return results

