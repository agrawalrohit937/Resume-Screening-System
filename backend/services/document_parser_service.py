"""
Document Parser Service — Server-Side Document Extraction & Fallback Architecture.

Phase 2 of Budget-Smart Hybrid-RAG Overhaul:
- Page counting and strict 2-page guardrail to protect against Azure F0 silent truncation.
- Azure Document Intelligence (prebuilt-layout model) for documents <= 2 pages.
- Local pdfplumber / docx extraction fallback when:
  * Document > 2 pages (guardrail prevents F0 truncation)
  * Azure DI credentials missing or API fails (timeout, rate limits, quota)
- Structured output schema: {"raw_text": "...", "page_count": int, "source": "azure_di" | "pdfplumber" | "docx" | "txt"}
"""

from __future__ import annotations

import asyncio
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

AZURE_DI_ENDPOINT = (os.getenv("AZURE_DI_ENDPOINT") or "").rstrip("/")
AZURE_DI_KEY = os.getenv("AZURE_DI_KEY") or os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY") or ""
AZURE_API_VERSION = os.getenv("AZURE_DI_API_VERSION", "2023-07-31")


class DocumentParserService:
    """
    Central server-side document parsing service.
    Implements intelligent routing between Azure Document Intelligence and local pdfplumber.
    """

    def __init__(
        self,
        endpoint: Optional[str] = None,
        key: Optional[str] = None,
        timeout_seconds: float = 25.0,
    ):
        self.endpoint = (endpoint or AZURE_DI_ENDPOINT or "").rstrip("/")
        self.key = key or AZURE_DI_KEY or ""
        self.timeout_seconds = timeout_seconds

    # ══════════════════════════════════════════════════════════════════════════
    # PUBLIC ENTRYPOINT
    # ══════════════════════════════════════════════════════════════════════════

    async def parse_document(
        self,
        file_input: Union[str, Path, bytes],
        file_type: str = "pdf",
    ) -> Dict[str, Any]:
        """
        Extract text from PDF, DOCX, or TXT document with Azure DI + local fallback.

        Args:
            file_input: File path (str/Path) or raw bytes of document.
            file_type: Extension ('pdf', 'docx', 'doc', 'txt').

        Returns:
            Dict containing:
                - raw_text: Extracted plain text / markdown layout.
                - page_count: Total detected pages in document.
                - source: 'azure_di' | 'pdfplumber' | 'docx' | 'txt'
                - metadata: Word count, extraction time ms, tables count.
        """
        t0 = time.perf_counter()
        clean_ext = file_type.lower().lstrip(".")

        if clean_ext == "txt":
            return self._parse_txt(file_input, t0)
        elif clean_ext in ("docx", "doc"):
            return self._parse_docx(file_input, t0)
        elif clean_ext == "pdf":
            return await self._parse_pdf(file_input, t0)
        else:
            raise ValueError(f"Unsupported document file type: {file_type}")

    # ══════════════════════════════════════════════════════════════════════════
    # PDF PARSING & 2-PAGE GUARDRAIL
    # ══════════════════════════════════════════════════════════════════════════

    async def _parse_pdf(
        self,
        file_input: Union[str, Path, bytes],
        start_time: float,
    ) -> Dict[str, Any]:
        """
        PDF routing pipeline:
        1. Count pages locally via pdfplumber.
        2. If pages <= 2 and Azure DI credentials exist: invoke Azure prebuilt-layout.
        3. If pages > 2: skip Azure DI to prevent F0 truncation; use local pdfplumber.
        4. If Azure DI fails: catch exception and fallback to pdfplumber immediately.
        """
        # 1. Inspect and count pages locally
        page_count, pdf_bytes, local_text = self._inspect_pdf_locally(file_input)

        logger.info(
            "PDF document inspected",
            page_count=page_count,
            has_azure_creds=bool(self.endpoint and self.key),
        )

        # 2. Apply the 2-Page Guardrail (Azure F0 silently truncates past page 2)
        if page_count > 2:
            logger.info(
                "PDF exceeds 2 pages: Bypassing Azure Document Intelligence to prevent F0 truncation. Using local pdfplumber.",
                page_count=page_count,
            )
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            return {
                "raw_text": self._clean_text(local_text),
                "page_count": page_count,
                "source": "pdfplumber",
                "metadata": {
                    "reason": "page_count_gt_2_guardrail",
                    "word_count": len(local_text.split()),
                    "processing_time_ms": elapsed_ms,
                },
            }

        # 3. If pages <= 2, attempt Azure Document Intelligence
        if self.endpoint and self.key and pdf_bytes:
            try:
                azure_text = await self._call_azure_di(pdf_bytes)
                if azure_text and len(azure_text.strip()) > 30:
                    elapsed_ms = int((time.perf_counter() - start_time) * 1000)
                    logger.info("Azure Document Intelligence extraction successful", page_count=page_count, elapsed_ms=elapsed_ms)
                    return {
                        "raw_text": self._clean_text(azure_text),
                        "page_count": page_count,
                        "source": "azure_di",
                        "metadata": {
                            "word_count": len(azure_text.split()),
                            "processing_time_ms": elapsed_ms,
                        },
                    }
            except Exception as e:
                logger.warning(
                    "Azure Document Intelligence call failed. Falling back to local pdfplumber extraction.",
                    error=str(e),
                )

        # 4. Fallback: local pdfplumber extraction
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return {
            "raw_text": self._clean_text(local_text),
            "page_count": page_count,
            "source": "pdfplumber",
            "metadata": {
                "fallback": True,
                "word_count": len(local_text.split()),
                "processing_time_ms": elapsed_ms,
            },
        }

    # ══════════════════════════════════════════════════════════════════════════
    # AZURE DOCUMENT INTELLIGENCE REST CLIENT
    # ══════════════════════════════════════════════════════════════════════════

    async def _call_azure_di(self, pdf_bytes: bytes) -> str:
        """
        Submits PDF to Azure Document Intelligence prebuilt-layout model and polls Operation-Location.
        Prioritizes the verified 2023-07-31 GA endpoint format with automatic fallback.
        """
        headers = {
            "Ocp-Apim-Subscription-Key": self.key,
            "Content-Type": "application/pdf",
        }

        # Candidate analyze endpoints in order of proven compatibility
        candidate_urls = [
            f"{self.endpoint}/formrecognizer/documentModels/prebuilt-layout:analyze?api-version=2023-07-31",
            f"{self.endpoint}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-02-29-preview&outputContentFormat=markdown",
            f"{self.endpoint}/formrecognizer/documentModels/prebuilt-layout:analyze?api-version={AZURE_API_VERSION}",
        ]

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            resp = None
            operation_url = None

            for url in candidate_urls:
                try:
                    resp = await client.post(url, headers=headers, content=pdf_bytes)
                    if resp.status_code == 202:
                        operation_url = resp.headers.get("Operation-Location")
                        if operation_url:
                            break
                except Exception as post_err:
                    logger.debug("Azure DI post endpoint attempt failed", url=url, error=str(post_err))
                    continue

            if not operation_url:
                status = resp.status_code if resp else "unknown"
                body = resp.text[:200] if resp else "no response"
                raise RuntimeError(f"Azure DI submission rejected with status {status}: {body}")

            # 2. Poll Operation-Location for completion
            poll_headers = {"Ocp-Apim-Subscription-Key": self.key}
            max_attempts = 12
            for attempt in range(max_attempts):
                await asyncio.sleep(1.0 + (attempt * 0.4))
                poll_resp = await client.get(operation_url, headers=poll_headers)
                if poll_resp.status_code != 200:
                    continue

                data = poll_resp.json()
                status = data.get("status")
                if status == "succeeded":
                    result = data.get("analyzeResult", {})
                    content = result.get("content", "")
                    if content:
                        return content
                    # If content empty, assemble from paragraphs/pages
                    paragraphs = [p.get("content", "") for p in result.get("paragraphs", [])]
                    return "\n\n".join(filter(bool, paragraphs))

                elif status in ("failed", "canceled"):
                    error_msg = data.get("error", {}).get("message", "Azure DI analysis failed")
                    raise RuntimeError(error_msg)

            raise TimeoutError("Azure Document Intelligence polling timed out")

    # ══════════════════════════════════════════════════════════════════════════
    # LOCAL EXTRACTION (PDFPLUMBER & DOCX)
    # ══════════════════════════════════════════════════════════════════════════

    def _inspect_pdf_locally(
        self,
        file_input: Union[str, Path, bytes],
    ) -> Tuple[int, Optional[bytes], str]:
        """
        Opens PDF using pdfplumber to accurately determine page count and extract text.
        """
        import io

        if isinstance(file_input, (str, Path)):
            pdf_bytes = Path(file_input).read_bytes()
            open_target = file_input
        else:
            pdf_bytes = bytes(file_input)
            open_target = io.BytesIO(pdf_bytes)

        text_parts = []
        page_count = 1

        if pdfplumber is not None:
            try:
                with pdfplumber.open(open_target) as pdf:
                    page_count = len(pdf.pages)
                    for page in pdf.pages:
                        try:
                            page_text = page.extract_text(layout=True)
                        except Exception:
                            page_text = page.extract_text()

                        if not page_text or len(page_text.strip()) < 30:
                            page_text = page.extract_text(x_tolerance=2, y_tolerance=2)

                        if page_text:
                            text_parts.append(page_text)

                        tables = page.extract_tables() or []
                        for table in tables:
                            for row in (table or []):
                                row_text = " | ".join(str(c) for c in (row or []) if c and str(c).strip())
                                if row_text.strip():
                                    text_parts.append(row_text)
            except Exception as e:
                logger.error("Local pdfplumber extraction failed", error=str(e))

        # Secondary fallback: pypdf (if pdfplumber unavailable or produced empty text)
        if not text_parts and pdf_bytes:
            try:
                import pypdf
                reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
                page_count = len(reader.pages)
                for p in reader.pages:
                    pt = p.extract_text() or ""
                    if pt.strip():
                        text_parts.append(pt)
            except Exception as e:
                logger.debug("pypdf fallback extraction failed", error=str(e))

        combined = "\n\n".join(text_parts).strip()
        return page_count, pdf_bytes, combined

    def _parse_docx(self, file_input: Union[str, Path, bytes], start_time: float) -> Dict[str, Any]:
        import io
        if isinstance(file_input, (str, Path)):
            doc = Document(file_input)
        else:
            doc = Document(io.BytesIO(file_input))

        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text:
                    paragraphs.append(row_text)

        full_text = "\n\n".join(paragraphs).strip()
        # Estimate page count for docx based on typical 3000 chars/page
        estimated_pages = max(1, math.ceil(len(full_text) / 2800))
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        return {
            "raw_text": self._clean_text(full_text),
            "page_count": estimated_pages,
            "source": "docx",
            "metadata": {
                "word_count": len(full_text.split()),
                "processing_time_ms": elapsed_ms,
            },
        }

    def _parse_txt(self, file_input: Union[str, Path, bytes], start_time: float) -> Dict[str, Any]:
        if isinstance(file_input, (str, Path)):
            text = Path(file_input).read_text(encoding="utf-8", errors="ignore")
        else:
            text = file_input.decode("utf-8", errors="ignore")

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return {
            "raw_text": self._clean_text(text),
            "page_count": 1,
            "source": "txt",
            "metadata": {
                "word_count": len(text.split()),
                "processing_time_ms": elapsed_ms,
            },
        }

    # ══════════════════════════════════════════════════════════════════════════
    # TEXT SANITIZATION
    # ══════════════════════════════════════════════════════════════════════════

    @staticmethod
    def _clean_text(text: str) -> str:
        if not text:
            return ""
        # Remove null and non-printable control characters
        cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", text)
        # Collapse excessive spaces and newlines
        cleaned = re.sub(r"[ \t]{3,}", "  ", cleaned)
        cleaned = re.sub(r"\n{4,}", "\n\n\n", cleaned)
        return cleaned.strip()


# Singleton instance
document_parser = DocumentParserService()
