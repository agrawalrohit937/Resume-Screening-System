"""
Credential and Professional Licensure Data Model.
Supports professional credentials (RN, CA, Bar, CTET, AWS, PMP, Welding 6G)
with jurisdiction, validity periods, and dynamic scoring-time expiry checks.
"""

from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


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

    def is_expired(self, reference_date: Optional[date] = None) -> bool:
        """
        Dynamically evaluated at scoring time (never cached at write time).
        Returns True if credential has expired relative to reference_date (defaults to today).
        """
        if self.expires_on is None:
            return False
        ref = reference_date or date.today()
        return self.expires_on < ref

    def is_valid_for_jurisdiction(self, required_jurisdiction: Optional[str]) -> bool:
        """Checks if credential jurisdiction matches or covers the required jurisdiction."""
        if not required_jurisdiction or not self.jurisdiction:
            return True
        req_clean = required_jurisdiction.strip().upper()
        cand_clean = self.jurisdiction.strip().upper()
        # Direct match or country-level coverage (e.g. 'IN' covers 'IN-MH')
        if req_clean == cand_clean or cand_clean.startswith(req_clean) or req_clean.startswith(cand_clean):
            return True
        return False
