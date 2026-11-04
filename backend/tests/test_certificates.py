import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from models.certificate_model import CertificateRecord

@pytest.mark.asyncio
async def test_certificate_record_creation_and_fields():
    record = CertificateRecord(
        id="CERT-TEST-001",
        certificate_type="assessment",
        template_used="modern",
        user_id="user_123",
        recipient_name="John Doe",
        snapshot={"assessment_name": "Python Developer", "assessment_slug": "python", "score": 90},
        status="active",
        issued_at=datetime.now(timezone.utc),
        topic="python",
    )
    assert record.id == "CERT-TEST-001"
    assert record.topic == "python"
    assert record.status == "active"

@pytest.mark.asyncio
async def test_certificate_from_doc_safely_filters_unknown_fields():
    doc = {
        "_id": "CERT-TEST-002",
        "certificate_type": "assessment",
        "template_used": "modern",
        "user_id": "user_123",
        "recipient_name": "Jane Doe",
        "snapshot": {"assessment_name": "React Developer", "assessment_slug": "react", "score": 88},
        "status": "active",
        "issued_at": datetime.now(timezone.utc),
        "topic": "react",
        "unknown_legacy_field": "some_value",
        "extra_field_123": True,
    }
    cert = CertificateRecord.from_doc(doc)
    assert cert.id == "CERT-TEST-002"
    assert cert.topic == "react"
    assert not hasattr(cert, "unknown_legacy_field")

@pytest.mark.asyncio
async def test_certificate_persist_populates_topic_if_missing():
    mock_session = AsyncMock()
    mock_factory = MagicMock(return_value=mock_session)
    mock_session.__aenter__.return_value = mock_session

    record = CertificateRecord(
        id="CERT-TEST-003",
        certificate_type="assessment",
        template_used="modern",
        user_id="user_456",
        recipient_name="Alex",
        snapshot={"assessment_name": "React", "assessment_slug": "react-developer", "score": 92},
        status="active",
        issued_at=datetime.now(timezone.utc),
        topic=None,  # Not provided initially
    )

    with patch("config.db.get_pg_session_factory", return_value=mock_factory):
        await record.persist()

    mock_session.add.assert_called_once()
    cert_row = mock_session.add.call_args[0][0]
    assert cert_row.id == "CERT-TEST-003"
    assert cert_row.topic == "react-developer"
    mock_session.commit.assert_called_once()

@pytest.mark.asyncio
async def test_certificate_persist_relational_session_execution():
    mock_session = AsyncMock()
    mock_factory = MagicMock(return_value=mock_session)
    mock_session.__aenter__.return_value = mock_session

    record = CertificateRecord(
        id="CERT-TEST-004",
        certificate_type="assessment",
        template_used="modern",
        user_id="user_123",
        recipient_name="Alex",
        snapshot={"assessment_name": "React", "assessment_slug": "react", "score": 85},
        status="active",
        issued_at=datetime.now(timezone.utc),
        topic="react",
    )

    with patch("config.db.get_pg_session_factory", return_value=mock_factory):
        await record.persist()

    mock_session.add.assert_called_once()
    cert_row = mock_session.add.call_args[0][0]
    assert cert_row.id == "CERT-TEST-004"
    assert cert_row.topic == "react"
    mock_session.commit.assert_called_once()
