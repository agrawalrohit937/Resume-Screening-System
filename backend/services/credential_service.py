"""
Credential and Licensure Verification Service.
Provides dynamic scoring-time expiry checks, jurisdiction matching,
and a pluggable CredentialVerifier interface for state registries.
"""

from abc import ABC, abstractmethod
from datetime import date
from typing import Dict, List, Optional, Tuple, Any
import structlog

from models.credential_model import Credential

logger = structlog.get_logger(__name__)


class CredentialVerifier(ABC):
    """Abstract interface for verifying candidate credentials against external registries."""

    @abstractmethod
    def verify(self, credential: Credential) -> str:
        """
        Verifies credential status.
        Returns: 'unverified' | 'self_attested' | 'document_provided' | 'registry_verified'
        """
        pass


class NoOpCredentialVerifier(CredentialVerifier):
    """Default no-op verifier that preserves existing candidate attestation status."""

    def verify(self, credential: Credential) -> str:
        return credential.verification_status or "self_attested"


_DEFAULT_VERIFIER: CredentialVerifier = NoOpCredentialVerifier()


def get_credential_verifier() -> CredentialVerifier:
    return _DEFAULT_VERIFIER


def set_credential_verifier(verifier: CredentialVerifier):
    global _DEFAULT_VERIFIER
    _DEFAULT_VERIFIER = verifier


def parse_candidate_credentials(raw_candidate_data: dict) -> List[Credential]:
    """
    Parses candidate credentials from structured fields or raw dictionary entries.
    """
    creds = []
    raw_creds = raw_candidate_data.get("credentials", []) or []
    for item in raw_creds:
        if isinstance(item, Credential):
            creds.append(item)
        elif isinstance(item, dict):
            try:
                creds.append(Credential(**item))
            except Exception as e:
                logger.debug("Failed parsing credential dictionary", error=str(e), item=item)
    return creds


def evaluate_credential_eligibility(
    candidate_credentials: List[Credential],
    required_credentials: List[Dict[str, Any]],
    reference_date: Optional[date] = None,
    required_jurisdiction: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], List[str], List[str]]:
    """
    Evaluates required credentials against candidate credentials.
    Returns: (checks, reasons, advisories)
    
    Mandatory credentials act as boolean eligibility knockouts (severity='hard').
    Expiry is strictly calculated relative to reference_date (defaults to today).
    """
    checks: List[Dict[str, Any]] = []
    reasons: List[str] = []
    advisories: List[str] = []

    ref_date = reference_date or date.today()

    for req in required_credentials:
        req_type = str(req.get("type") or req.get("name") or "").strip().upper()
        is_mandatory = req.get("is_mandatory", True)
        severity = "hard" if is_mandatory else "soft"
        req_jurisdiction = req.get("jurisdiction") or required_jurisdiction

        matching_creds = [
            c for c in candidate_credentials
            if c.type.strip().upper() == req_type or req_type in c.type.strip().upper()
        ]

        if not matching_creds:
            passed = False
            msg = f"Mandatory credential '{req_type}' not found on candidate profile."
            observed = "none found"
            evidence = []
            if is_mandatory:
                reasons.append(msg)
            else:
                advisories.append(msg)
        else:
            # Check for active non-expired credential
            active_creds = [c for c in matching_creds if not c.is_expired(ref_date)]
            if not active_creds:
                passed = False
                expired_on = matching_creds[0].expires_on
                observed = f"expired on {expired_on}" if expired_on else "expired"
                msg = f"Credential '{req_type}' has expired ({observed})."
                evidence = [f"{c.type}:{c.registration_number or 'no-reg'}" for c in matching_creds]
                if is_mandatory:
                    reasons.append(msg)
                else:
                    advisories.append(msg)
            else:
                # Check jurisdiction if required
                jurisdiction_valid = any(c.is_valid_for_jurisdiction(req_jurisdiction) for c in active_creds)
                if not jurisdiction_valid:
                    passed = False
                    cand_jur = active_creds[0].jurisdiction
                    observed = f"jurisdiction mismatch (candidate: {cand_jur}, required: {req_jurisdiction})"
                    msg = f"Credential '{req_type}' does not cover required jurisdiction '{req_jurisdiction}'."
                    evidence = [f"{c.type}:{c.jurisdiction}" for c in active_creds]
                    if is_mandatory:
                        reasons.append(msg)
                    else:
                        advisories.append(msg)
                else:
                    passed = True
                    valid_c = active_creds[0]
                    observed = f"active ({valid_c.verification_status})"
                    evidence = [f"{valid_c.type}:{valid_c.registration_number or 'verified'}"]

        checks.append({
            "rule_id": f"credential_{req_type.lower()}",
            "label": f"{req_type} Credential Required",
            "passed": passed,
            "severity": severity,
            "observed": observed,
            "evidence": evidence,
            "source": "credential_service",
        })

    return checks, reasons, advisories
