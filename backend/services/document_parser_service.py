"""
Document Parser Service — Server-Side Document Extraction & Fallback Architecture.

Core extraction architecture:
1. Primary PDF Provider: Azure Document Intelligence (prebuilt-layout model).
   - Asynchronous submission & Operation-Location polling workflow.
   - Single verified GA API version (2023-07-31).
   - Documented resource limits (50 MB file size limit, 500 page limit).
   - Zero arbitrary two-page artificial truncation.
2. Local Fallback Provider: pdfplumber.
   - Automatically invoked when Azure credentials are missing, API fails, times out, or returns unusable text.
   - Distinguishes text-based documents from scanned/image-only PDFs (raises clear actionable error).
3. DOCX Provider: python-docx.
   - Full paragraph & table extraction.
   - Rejects legacy binary .doc files with an explicit conversion error.
4. TXT Provider: Safe UTF-8 reader preserving meaningful structure.

Consistent output contract:
{
    "raw_text": str,
    "page_count": int,
    "source": "azure_di" | "pdfplumber" | "docx" | "txt",
    "metadata": {
        "provider": str,
        "word_count": int,
        "processing_time_ms": int,
        "fallback": Optional[bool],
    }
}
"""

from __future__ import annotations

import asyncio
import io
import math
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple, Union

import httpx
import structlog

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    from docx import Document
except ImportError:
    Document = None

logger = structlog.get_logger(__name__)

# Environment Configuration
AZURE_DI_ENDPOINT = (os.getenv("AZURE_DI_ENDPOINT") or "").rstrip("/")
AZURE_DI_KEY = os.getenv("AZURE_DI_KEY") or os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY") or ""
AZURE_DI_API_VERSION = os.getenv("AZURE_DI_API_VERSION", "2023-07-31")

# Document limits
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_DOCUMENT_PAGES = 500


class DocumentParserService:
    """
    Server-side document extraction service.
    Uses Azure Document Intelligence as primary provider for PDFs with pdfplumber local fallback.
    """

    def __init__(
        self,
        endpoint: Optional[str] = None,
        key: Optional[str] = None,
        api_version: Optional[str] = None,
        timeout_seconds: float = 25.0,
    ):
        self.endpoint = (endpoint if endpoint is not None else AZURE_DI_ENDPOINT).rstrip("/")
        self.key = key if key is not None else AZURE_DI_KEY
        self.api_version = api_version or AZURE_DI_API_VERSION or "2023-07-31"
        self.timeout_seconds = timeout_seconds

    # ══════════════════════════════════════════════════════════════════════════
    # PUBLIC ENTRYPOINT
    # ══════════════════════════════════════════════════════════════════════════

    async def parse_document(
        self,
        file_input: Union[str, Path, bytes, io.BytesIO],
        file_type: str = "pdf",
    ) -> Dict[str, Any]:
        """
        Extract text from PDF, DOCX, or TXT document with Azure DI + local fallback.

        Args:
            file_input: File path (str/Path), raw bytes, or BytesIO stream.
            file_type: Extension ('pdf', 'docx', 'doc', 'txt').

        Returns:
            Dict containing:
                - raw_text: Extracted plain text / markdown layout.
                - page_count: Total detected pages in document.
                - source: 'azure_di' | 'pdfplumber' | 'docx' | 'txt'
                - metadata: Dictionary of operational metrics.
        """
        t0 = time.perf_counter()
        clean_ext = file_type.lower().lstrip(".")

        if clean_ext == "txt":
            return self._parse_txt(file_input, t0)
        elif clean_ext == "docx":
            return self._parse_docx(file_input, t0)
        elif clean_ext == "doc":
            raise ValueError(
                "Legacy .doc format is not supported directly. Please convert the file to .docx or .pdf."
            )
        elif clean_ext == "pdf":
            return await self._parse_pdf(file_input, t0)
        else:
            raise ValueError(
                f"Unsupported document file type: '{file_type}'. Supported formats: PDF, DOCX, TXT."
            )

    # ══════════════════════════════════════════════════════════════════════════
    # PDF PARSING & FALLBACK PIPELINE
    # ══════════════════════════════════════════════════════════════════════════

    async def _parse_pdf(
        self,
        file_input: Union[str, Path, bytes, io.BytesIO],
        start_time: float,
    ) -> Dict[str, Any]:
        """
        PDF extraction pipeline:
        1. Read bytes & enforce file size limits.
        2. If Azure credentials configured: attempt Azure Document Intelligence prebuilt-layout.
        3. If Azure is not configured, fails, times out, or returns unusable text: fall back to pdfplumber.
        4. If local extraction also fails, raise a clear user-friendly error.
        """
        pdf_bytes = self._get_bytes(file_input)
        has_azure_creds = bool(self.endpoint and self.key)

        # 1. Attempt Azure Document Intelligence if credentials are present
        if has_azure_creds:
            logger.info("Attempting PDF extraction via Azure Document Intelligence", size_bytes=len(pdf_bytes))
            try:
                azure_text, page_count = await self._call_azure_di(pdf_bytes)
                cleaned_azure = self._clean_text(azure_text)
                if cleaned_azure and len(cleaned_azure.strip()) >= 30:
                    elapsed_ms = int((time.perf_counter() - start_time) * 1000)
                    logger.info(
                        "Azure Document Intelligence extraction successful",
                        provider="azure_di",
                        page_count=page_count,
                        elapsed_ms=elapsed_ms,
                    )
                    return {
                        "raw_text": cleaned_azure,
                        "page_count": page_count,
                        "source": "azure_di",
                        "metadata": {
                            "provider": "azure_di",
                            "word_count": len(cleaned_azure.split()),
                            "processing_time_ms": elapsed_ms,
                        },
                    }
                else:
                    logger.warning(
                        "Azure Document Intelligence returned empty or unusable text. Falling back to local pdfplumber."
                    )
            except Exception as exc:
                # Log provider failure without exposing secret keys or document content
                logger.warning(
                    "Azure Document Intelligence call failed. Falling back to local pdfplumber extraction.",
                    provider="azure_di",
                    error=str(exc),
                )

        # 2. Local Fallback Provider (pdfplumber)
        return self._extract_pdfplumber(pdf_bytes, start_time, had_azure=has_azure_creds)

    def _extract_pdfplumber(
        self,
        pdf_bytes: bytes,
        start_time: float,
        had_azure: bool = False,
    ) -> Dict[str, Any]:
        """
        Extracts text locally using pdfplumber.
        Detects scanned/image-only PDFs and raises user-friendly errors when no text is found.
        """
        if pdfplumber is None:
            if had_azure:
                raise RuntimeError("pdfplumber library is not installed for local PDF fallback.")
            raise RuntimeError("Neither Azure Document Intelligence nor pdfplumber is available for PDF parsing.")

        text_parts = []
        page_count = 0

        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                page_count = len(pdf.pages)
                if page_count == 0:
                    raise ValueError("PDF document contains no pages.")
                if page_count > MAX_DOCUMENT_PAGES:
                    raise ValueError(
                        f"PDF exceeds maximum page limit of {MAX_DOCUMENT_PAGES} pages (got {page_count})."
                    )

                for page in pdf.pages:
                    page_text = None
                    try:
                        page_text = page.extract_text(layout=True)
                    except Exception:
                        page_text = None

                    if not page_text or len(page_text.strip()) < 30:
                        try:
                            page_text = page.extract_text(x_tolerance=2, y_tolerance=2)
                        except Exception:
                            page_text = None

                    if page_text and page_text.strip():
                        text_parts.append(page_text.strip())

                    # Also extract tabular contents
                    try:
                        tables = page.extract_tables() or []
                        for table in tables:
                            for row in (table or []):
                                row_text = " | ".join(str(c) for c in (row or []) if c and str(c).strip())
                                if row_text.strip():
                                    text_parts.append(row_text.strip())
                    except Exception:
                        pass
        except ValueError:
            raise
        except Exception as err:
            logger.error("Local pdfplumber extraction encountered an error", error=str(err))
            raise ValueError(
                "Unable to parse PDF document. The file may be corrupted, malformed, or password-protected."
            )

        combined = "\n\n".join(text_parts).strip()
        cleaned = self._clean_text(combined)

        # Scanned / Image-only PDF detection
        if not cleaned or len(cleaned) < 30:
            raise ValueError(
                "Could not extract readable text from PDF. The document may be empty, corrupted, or a scanned image without selectable text."
            )

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        logger.info(
            "Local pdfplumber extraction successful",
            provider="pdfplumber",
            fallback=had_azure,
            page_count=page_count,
            elapsed_ms=elapsed_ms,
        )
        return {
            "raw_text": cleaned,
            "page_count": page_count,
            "source": "pdfplumber",
            "metadata": {
                "provider": "pdfplumber",
                "fallback": had_azure,
                "word_count": len(cleaned.split()),
                "processing_time_ms": elapsed_ms,
            },
        }

    # ══════════════════════════════════════════════════════════════════════════
    # AZURE DOCUMENT INTELLIGENCE REST CLIENT
    # ══════════════════════════════════════════════════════════════════════════

    async def _call_azure_di(self, pdf_bytes: bytes) -> Tuple[str, int]:
        """
        Submits PDF to Azure Document Intelligence prebuilt-layout model and polls Operation-Location.
        Uses one verified API version (default 2023-07-31 GA) without redundant multi-endpoint loops.
        """
        submit_url = (
            f"{self.endpoint}/formrecognizer/documentModels/prebuilt-layout:analyze"
            f"?api-version={self.api_version}"
        )
        headers = {
            "Ocp-Apim-Subscription-Key": self.key,
            "Content-Type": "application/pdf",
        }

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            # 1. Asynchronous Submission
            resp = await client.post(submit_url, headers=headers, content=pdf_bytes)
            if resp.status_code not in (200, 202):
                raise RuntimeError(
                    f"Azure Document Intelligence submission failed with status {resp.status_code}: {resp.text[:200]}"
                )

            operation_url = resp.headers.get("Operation-Location")
            if not operation_url:
                # Direct response fallback if 200 returned immediately
                if resp.status_code == 200:
                    data = resp.json()
                    return self._extract_azure_content(data)
                raise RuntimeError("Azure Document Intelligence response missing Operation-Location header.")

            # 2. Polling Operation-Location
            poll_headers = {"Ocp-Apim-Subscription-Key": self.key}
            start_poll = time.monotonic()
            poll_interval = 1.0

            while time.monotonic() - start_poll < self.timeout_seconds:
                await asyncio.sleep(poll_interval)
                poll_resp = await client.get(operation_url, headers=poll_headers)
                if poll_resp.status_code != 200:
                    continue

                data = poll_resp.json()
                status = data.get("status")
                if status == "succeeded":
                    return self._extract_azure_content(data)
                elif status in ("failed", "canceled"):
                    error_msg = data.get("error", {}).get("message", "Azure DI analysis failed")
                    raise RuntimeError(f"Azure Document Intelligence analysis {status}: {error_msg}")

            raise TimeoutError(f"Azure Document Intelligence polling timed out after {self.timeout_seconds}s")

    @staticmethod
    def _extract_azure_content(data: Dict[str, Any]) -> Tuple[str, int]:
        """Extracts text content and page count from Azure DI response payload."""
        result = data.get("analyzeResult", {})
        content = (result.get("content") or "").strip()

        if not content:
            paragraphs = [p.get("content", "") for p in result.get("paragraphs", []) if p.get("content")]
            content = "\n\n".join(paragraphs).strip()

        pages = result.get("pages", [])
        page_count = len(pages) if pages else 1
        return content, page_count

    # ══════════════════════════════════════════════════════════════════════════
    # DOCX & TXT PARSING
    # ══════════════════════════════════════════════════════════════════════════

    def _parse_docx(
        self,
        file_input: Union[str, Path, bytes, io.BytesIO],
        start_time: float,
    ) -> Dict[str, Any]:
        """Extracts text from DOCX files using python-docx."""
        if Document is None:
            raise RuntimeError("python-docx library is not installed on server.")

        docx_bytes = self._get_bytes(file_input)

        try:
            doc = Document(io.BytesIO(docx_bytes))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                    if row_text:
                        paragraphs.append(row_text)

            full_text = "\n\n".join(paragraphs).strip()
            cleaned = self._clean_text(full_text)
            if not cleaned or len(cleaned) < 15:
                raise ValueError("DOCX document appears to be empty.")

            estimated_pages = max(1, math.ceil(len(cleaned) / 2800))
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)

            logger.info("DOCX extraction successful", provider="docx", elapsed_ms=elapsed_ms)
            return {
                "raw_text": cleaned,
                "page_count": estimated_pages,
                "source": "docx",
                "metadata": {
                    "provider": "docx",
                    "word_count": len(cleaned.split()),
                    "processing_time_ms": elapsed_ms,
                },
            }
        except ValueError:
            raise
        except Exception as e:
            logger.error("Failed to parse DOCX file", error=str(e))
            raise ValueError(
                "Unable to read DOCX file. Please ensure it is a valid, uncorrupted Microsoft Word (.docx) document."
            )

    def _parse_txt(
        self,
        file_input: Union[str, Path, bytes, io.BytesIO],
        start_time: float,
    ) -> Dict[str, Any]:
        """Safely reads UTF-8 plain text preserving meaningful newlines."""
        txt_bytes = self._get_bytes(file_input)
        text = txt_bytes.decode("utf-8", errors="replace")

        if not text.strip():
            raise ValueError("Text document is empty.")

        cleaned = self._clean_text(text)
        if not cleaned:
            raise ValueError("Text document contains no readable text.")

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        logger.info("TXT extraction successful", provider="txt", elapsed_ms=elapsed_ms)
        return {
            "raw_text": cleaned,
            "page_count": 1,
            "source": "txt",
            "metadata": {
                "provider": "txt",
                "word_count": len(cleaned.split()),
                "processing_time_ms": elapsed_ms,
            },
        }

    # ══════════════════════════════════════════════════════════════════════════
    # UTILITY & TEXT SANITIZATION
    # ══════════════════════════════════════════════════════════════════════════

    @staticmethod
    def _get_bytes(file_input: Union[str, Path, bytes, io.BytesIO]) -> bytes:
        """Loads and validates file input bytes, enforcing upload size constraints."""
        if isinstance(file_input, (str, Path)):
            p = Path(file_input)
            if not p.exists():
                raise FileNotFoundError(f"File not found: {file_input}")
            data = p.read_bytes()
        elif isinstance(file_input, io.BytesIO):
            data = file_input.getvalue()
        elif isinstance(file_input, bytes):
            data = file_input
        elif hasattr(file_input, "read"):
            data = file_input.read()
        else:
            data = bytes(file_input)

        if len(data) == 0:
            raise ValueError("Document file is empty (0 bytes).")

        if len(data) > MAX_FILE_SIZE_BYTES:
            raise ValueError(
                f"File size exceeds maximum supported limit of 50 MB (got {len(data) / (1024 * 1024):.1f} MB)."
            )

        return data

    @staticmethod
    def _clean_text(text: str) -> str:
        """Removes null and control characters while preserving meaningful newlines and layout."""
        if not text:
            return ""
        # Remove null and non-printable control characters, preserving \n, \r, \t
        cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", text)
        cleaned = re.sub(r"\r\n", "\n", cleaned)
        cleaned = re.sub(r"[ \t]{3,}", "  ", cleaned)
        cleaned = re.sub(r"\n{4,}", "\n\n\n", cleaned)
        return cleaned.strip()


# Singleton instance
document_parser = DocumentParserService()
