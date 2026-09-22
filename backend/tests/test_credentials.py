"""
Unit tests for Credential & Professional Licensure Verification Layer.
Tests dynamic expiry evaluation, jurisdiction validation, and mandatory knockouts.
"""

from datetime import date, timedelta
import pytest

from models.credential_model import Credential
from services.credential_service import (
    evaluate_credential_eligibility,
    CredentialVerifier,
    set_credential_verifier,
    NoOpCredentialVerifier,
)
from services.scoring_engine import _evaluate_eligibility


def test_credential_model_and_expiry_at_scoring_time():
    today = date.today()
    past_date = today - timedelta(days=30)
    future_date = today + timedelta(days=365)

    active_cred = Credential(
        type="RN",
        canonical_id="cred:rn",
        issuer="Karnataka State Nursing Council",
        registration_number="KNC-98765",
        jurisdiction="IN-KA",
        expires_on=future_date,
    )
    assert active_cred.is_expired(today) is False

    expired_cred = Credential(
        type="RN",
        canonical_id="cred:rn",
        issuer="Karnataka State Nursing Council",
        registration_number="KNC-98765",
        jurisdiction="IN-KA",
        expires_on=past_date,
    )
    assert expired_cred.is_expired(today) is True


def test_credential_jurisdiction_matching():
    cred_in_ka = Credential(
        type="BAR",
        canonical_id="cred:bar",
        issuer="Bar Council of Maharashtra & Goa",
        jurisdiction="IN-MH",
    )
    # Exact or parent country match
    assert cred_in_ka.is_valid_for_jurisdiction("IN-MH") is True
    assert cred_in_ka.is_valid_for_jurisdiction("IN") is True
    assert cred_in_ka.is_valid_for_jurisdiction("US-NY") is False


def test_evaluate_credential_eligibility_knockouts():
    today = date.today()
    cand_creds = [
        Credential(
            type="AWS_SAA",
            canonical_id="cred:aws_saa",
            issuer="Amazon Web Services",
            registration_number="AWS-12345",
            expires_on=today + timedelta(days=200),
        ),
        Credential(
            type="RN",
            canonical_id="cred:rn",
            issuer="State Nursing Council",
            registration_number="RN-444",
            expires_on=today - timedelta(days=10),  # Expired!
        ),
    ]

    required = [
        {"type": "AWS_SAA", "is_mandatory": True},
        {"type": "RN", "is_mandatory": True},
        {"type": "PMP", "is_mandatory": False},  # Preferred
    ]

    checks, reasons, advisories = evaluate_credential_eligibility(
        candidate_credentials=cand_creds,
        required_credentials=required,
        reference_date=today,
    )

    # AWS_SAA passed
    aws_check = next(c for c in checks if c["rule_id"] == "credential_aws_saa")
    assert aws_check["passed"] is True
    assert aws_check["severity"] == "hard"

    # RN expired -> hard knockout
    rn_check = next(c for c in checks if c["rule_id"] == "credential_rn")
    assert rn_check["passed"] is False
    assert rn_check["severity"] == "hard"
    assert any("expired" in r for r in reasons)

    # PMP missing -> soft advisory, not in reasons
    pmp_check = next(c for c in checks if c["rule_id"] == "credential_pmp")
    assert pmp_check["passed"] is False
    assert pmp_check["severity"] == "soft"
    assert any("PMP" in a for a in advisories)


def test_pluggable_credential_verifier():
    class MockRegistryVerifier(CredentialVerifier):
        def verify(self, credential: Credential) -> str:
            if credential.registration_number == "VERIFIED-999":
                return "registry_verified"
            return "unverified"

    custom_verifier = MockRegistryVerifier()
    set_credential_verifier(custom_verifier)

    cred = Credential(
        type="CA",
        canonical_id="cred:ca",
        issuer="ICAI",
        registration_number="VERIFIED-999",
    )
    assert custom_verifier.verify(cred) == "registry_verified"

    # Restore default
    set_credential_verifier(NoOpCredentialVerifier())
