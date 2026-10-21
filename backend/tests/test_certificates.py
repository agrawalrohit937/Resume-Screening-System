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
async def test_certificate_from_mongo_safely_filters_unknown_fields():
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
    cert = CertificateRecord.from_mongo(doc)
    assert cert.id == "CERT-TEST-002"
    assert cert.topic == "react"
    assert not hasattr(cert, "unknown_legacy_field")

@pytest.mark.asyncio
async def test_certificate_persist_populates_topic_if_missing():
    mock_db = MagicMock()
    mock_col = AsyncMock()
    mock_db.__getitem__.return_value = mock_col

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

    with patch("models.certificate_model.get_database", return_value=mock_db):
        await record.persist()

    mock_col.insert_one.assert_called_once()
    saved_doc = mock_col.insert_one.call_args[0][0]
    assert saved_doc["_id"] == "CERT-TEST-003"
    assert saved_doc["topic"] == "react-developer"

@pytest.mark.asyncio
async def test_certificate_persist_catches_duplicate_index_and_retries():
    mock_db = MagicMock()
    mock_col = AsyncMock()
    mock_db.__getitem__.return_value = mock_col

    # First call simulates MongoDB duplicate key error on the old index
    mock_col.insert_one.side_effect = [
        Exception("E11000 duplicate key error collection: ai_career_platform.certificates index: certificate_user_topic_unique dup key: { user_id: '123', topic: null }"),
        None  # Second call succeeds after dropping index
    ]

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

    with patch("models.certificate_model.get_database", return_value=mock_db):
        await record.persist()

    mock_col.drop_index.assert_called_once_with("certificate_user_topic_unique")
    assert mock_col.insert_one.call_count == 2
