"""
Credential and Professional Licensure Data Schemas.
"""

from datetime import date
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class Credential(BaseModel):
    """
    Structured professional credential or regulatory licence.
    """
    type: str = Field(..., description="Credential code e.g. RN, CA, BAR, CTET, WELDING_6G, PMP, AWS_SAA")
    canonical_id: str = Field(..., description="Ontology node identifier e.g. cred:rn, cred:ca")
    issuer: str = Field(..., description="Issuing authority or board e.g. State Nursing Council, ICAI, Bar Council")
    registration_number: Optional[str] = Field(None, description="Official registration or licence number")
    jurisdiction: Optional[str] = Field(None, description="ISO-3166-2 jurisdiction e.g. IN-KA, US-CA, GB")
    issued_on: Optional[date] = Field(None, description="Date of issuance")
    expires_on: Optional[date] = Field(None, description="Date of expiry")
    verification_status: str = Field(
        default="unverified",
        description="unverified | self_attested | document_provided | registry_verified"
    )

    model_config = ConfigDict(arbitrary_types_allowed=True)

    def is_expired(self, reference_date: Optional[date] = None) -> bool:
        if self.expires_on is None:
            return False
        ref = reference_date or date.today()
        return self.expires_on < ref

    def is_valid_for_jurisdiction(self, required_jurisdiction: Optional[str]) -> bool:
        if not required_jurisdiction or not self.jurisdiction:
            return True
        req_clean = required_jurisdiction.strip().upper()
        cand_clean = self.jurisdiction.strip().upper()
        if req_clean == cand_clean or cand_clean.startswith(req_clean) or req_clean.startswith(cand_clean):
            return True
        return False

