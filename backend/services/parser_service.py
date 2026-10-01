"""
Parser Service — Extract structured data from PDF and DOCX resumes
"""
# Yha parser 2 output deta h raw_text, structured_output
# but hum only raw_text ko sue kr rhe h baki structuring ka kaam LLM ko de diya h 
# in future structured output jo parsing ho rhi h usko delete kr dege  after proper testing
import asyncio
import gc
import re
from pathlib import Path
from typing import List, Optional, Tuple

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

import structlog
try:
    from docx import Document
except ImportError:
    Document = None

from models.resume_model import (
    ParsedResumeData, ContactInfo
)
from services.document_parser_service import document_parser
from utils.nlp_utils import (
    clean_text, detect_skills_in_text, extract_email,
    extract_phone, extract_urls, count_words,
    extract_years_of_experience, extract_sections
)

logger = structlog.get_logger(__name__)


class ParserService:
    """Parses resumes from PDF/DOCX into structured ParsedResumeData."""

    # ── Public Entry Point ─────────────────────────────────────────────────────
    async def parse_resume(self, file_path: str, file_type: str) -> ParsedResumeData:
        logger.info("Parsing resume", file_path=file_path, file_type=file_type)
        try:
            raw_text, page_count, parsing_source = await self._extract_raw_text_with_meta(file_path, file_type)
            result = await self._structure_resume(raw_text)
            result.page_count = page_count
            result.parsing_source = parsing_source
            logger.info("Resume structured successfully", source=parsing_source, page_count=page_count, word_count=result.word_count)
            return result
        except Exception as e:
            logger.error("Resume parse failed", error=str(e))
            raise RuntimeError(f"Failed to parse resume: {str(e)}")
        finally:
            gc.collect()

    # ── Text Extraction ────────────────────────────────────────────────────────
    async def _extract_raw_text(self, file_path: str, file_type: str) -> str:
        """Backward-compatible extraction helper returning raw_text string."""
        raw_text, _, _ = await self._extract_raw_text_with_meta(file_path, file_type)
        return raw_text

    async def _extract_raw_text_with_meta(self, file_path: str, file_type: str) -> Tuple[str, int, str]:
        """
        Primary extractor using DocumentParserService (Azure Document Intelligence for <=2 pages
        with 2-page guardrail and automatic pdfplumber / docx fallback).
        """
        ft = (file_type or "").lower().lstrip(".")
        try:
            parsed_doc = await document_parser.parse_document(file_path, ft)
            raw_text = parsed_doc.get("raw_text", "")
            page_count = parsed_doc.get("page_count", 1)
            source = parsed_doc.get("source", "pdfplumber")
            if raw_text and len(raw_text.strip()) > 30:
                return raw_text, page_count, source
        except Exception as e:
            logger.warning("DocumentParserService extraction failed, trying legacy fallback", error=str(e))

        # Secondary fallback if DocumentParserService threw an exception
        if ft == "pdf":
            raw_text = self._extract_pdf(file_path)
            return raw_text, 1, "pdfplumber"
        elif ft in ("docx", "doc"):
            raw_text = self._extract_docx(file_path)
            return raw_text, 1, "docx"
        elif ft == "txt":
            raw_text = Path(file_path).read_text(encoding="utf-8", errors="ignore")
            return raw_text, 1, "txt"
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

    def _extract_pdf(self, file_path: str) -> str:
        """Extract text from PDF using multiple strategies for best coverage."""
        text_parts = []
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    # Strategy 1: layout-aware extraction (better for columns/tables)
                    page_text = page.extract_text(
                        x_tolerance=3, y_tolerance=3,
                        layout=True, x_density=7.25, y_density=13
                    )
                    if not page_text or len(page_text.strip()) < 50:
                        # Strategy 2: simpler extraction as fallback
                        page_text = page.extract_text(x_tolerance=2, y_tolerance=2)
                    if page_text:
                        text_parts.append(page_text)

                    # Also extract text from tables (multi-column skill grids)
                    tables = page.extract_tables()
                    for table in (tables or []):
                        for row in (table or []):
                            row_text = " | ".join(str(cell) for cell in (row or []) if cell and str(cell).strip())
                            if row_text.strip():
                                text_parts.append(row_text)
        except TypeError:
            # Older pdfplumber doesn't support layout param — fallback
            try:
                with pdfplumber.open(file_path) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text(x_tolerance=2, y_tolerance=2)
                        if page_text:
                            text_parts.append(page_text)
            except Exception as e:
                raise RuntimeError(f"PDF extraction error: {e}")
        except Exception as e:
            raise RuntimeError(f"PDF extraction error: {e}")

        full_text = "\n".join(text_parts)
        # Clean up encoding artifacts and excessive whitespace
        full_text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", full_text)
        full_text = re.sub(r"[ \t]{3,}", "  ", full_text)
        full_text = re.sub(r"\n{4,}", "\n\n\n", full_text)

        if not full_text.strip():
            raise ValueError("PDF contains no extractable text (may be image-based or scanned).")
        gc.collect()
        return full_text

    def _extract_docx(self, file_path: str) -> str:
        try:
            doc = Document(file_path)
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            # Also extract from tables
            for table in doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        if cell.text.strip():
                            paragraphs.append(cell.text)
            extracted = "\n".join(paragraphs)
            gc.collect()
            return extracted
        except Exception as e:
            raise RuntimeError(f"DOCX extraction error: {e}")

    # ── Structure Parsing ─────────────────────────────────────────────────────
    async def _structure_resume(self, raw_text: str) -> ParsedResumeData:
        """Structures basic text statistics and NLP entity detection."""
        sections = extract_sections(raw_text)
        tech_skills, soft_skills = detect_skills_in_text(raw_text)
        email = extract_email(raw_text)
        phone = extract_phone(raw_text)
        urls = extract_urls(raw_text)
        linkedin = next((u for u in urls if "linkedin" in u.lower()), None)
        github = next((u for u in urls if "github" in u.lower()), None)
        portfolio = next(
            (u for u in urls if "linkedin" not in u.lower() and "github" not in u.lower()), None
        )
        contact = ContactInfo(
            email=email,
            phone=phone,
            linkedin=linkedin,
            github=github,
            portfolio=portfolio,
        )
        total_exp = extract_years_of_experience(raw_text)
        all_skills = list(set(tech_skills + soft_skills))

        return ParsedResumeData(
            raw_text=raw_text,
            contact_info=contact,
            summary=sections.get("summary", ""),
            skills=all_skills,
            technical_skills=tech_skills,
            soft_skills=soft_skills,
            total_experience_years=total_exp,
            word_count=count_words(raw_text),
            sections_detected=list(sections.keys()),
        )
