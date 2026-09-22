"""
Phase A4 Security Verification Tests: Binary File Upload Hardening & Magic Bytes.
"""

import io
import pytest
from fastapi import HTTPException, UploadFile
from utils.file_utils import validate_and_save_file, sanitize_filename


@pytest.mark.asyncio
async def test_validate_and_save_pdf_magic_bytes(tmp_path, monkeypatch):
    monkeypatch.setattr("core.config.settings.UPLOAD_DIR", str(tmp_path))

    # 1. Valid PDF header
    valid_pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF" + b"A" * 200
    upload_valid = UploadFile(
        filename="valid_resume.pdf",
        file=io.BytesIO(valid_pdf_content),
        headers={"content-type": "application/pdf"}
    )
    path, fname, ext, size = await validate_and_save_file(upload_valid, user_id="user_test_1")
    assert ext == "pdf"
    assert size == len(valid_pdf_content)

    # 2. Corrupted PDF / Spoofed text with .pdf extension -> Reject with 400
    fake_pdf_content = b"This is plain text pretending to be a PDF." + b"X" * 200
    upload_fake = UploadFile(
        filename="fake.pdf",
        file=io.BytesIO(fake_pdf_content),
        headers={"content-type": "application/pdf"}
    )
    with pytest.raises(HTTPException) as exc:
        await validate_and_save_file(upload_fake, user_id="user_test_1")
    assert exc.value.status_code == 400
    assert "magic-byte" in exc.value.detail


@pytest.mark.asyncio
async def test_validate_and_save_docx_magic_bytes(tmp_path, monkeypatch):
    monkeypatch.setattr("core.config.settings.UPLOAD_DIR", str(tmp_path))

    # 1. Valid DOCX zip header (PK\x03\x04)
    valid_docx_content = b"PK\x03\x04\x14\x00\x06\x00" + b"Z" * 200
    upload_valid_docx = UploadFile(
        filename="resume.docx",
        file=io.BytesIO(valid_docx_content),
        headers={"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
    )
    path, fname, ext, size = await validate_and_save_file(upload_valid_docx, user_id="user_test_1")
    assert ext == "docx"

    # 2. Invalid DOCX header
    fake_docx_content = b"Not a real docx zip header" + b"Y" * 200
    upload_fake_docx = UploadFile(
        filename="fake.docx",
        file=io.BytesIO(fake_docx_content),
        headers={"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
    )
    with pytest.raises(HTTPException) as exc:
        await validate_and_save_file(upload_fake_docx, user_id="user_test_1")
    assert exc.value.status_code == 400


def test_sanitize_filename_prevents_path_traversal():
    assert sanitize_filename("../../../etc/passwd.pdf") == "passwd.pdf"
    assert sanitize_filename("..\\..\\windows\\system32\\cmd.exe.pdf") == "cmd.exe.pdf"
    assert sanitize_filename("my resume (1).pdf") == "my resume _1_.pdf"
