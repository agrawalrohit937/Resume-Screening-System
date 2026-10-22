"""
Parser Service — Extract structured data from PDF and DOCX resumes
"""
# Yha parser 2 output deta h raw_text, structured_output
# but hum only raw_text ko sue kr rhe h baki structuring ka kaam LLM ko de diya h 
# in future structured output jo parsing ho rhi h usko delete kr dege  after proper testing
import gc
from typing import List, Optional, Tuple

import structlog

from models.resume_model import (
    ParsedResumeData, ContactInfo
)
from services.document_parser_service import document_parser
from utils.nlp_utils import (
    detect_skills_in_text, extract_email,
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
        Primary extractor using DocumentParserService (Azure Document Intelligence
        with automatic pdfplumber / docx fallback).
        """
        ft = (file_type or "").lower().lstrip(".")
        parsed_doc = await document_parser.parse_document(file_path, ft)
        raw_text = parsed_doc.get("raw_text", "")
        page_count = parsed_doc.get("page_count", 1)
        source = parsed_doc.get("source", "document_parser")

        if not raw_text or len(raw_text.strip()) < 10:
            raise ValueError(f"No extractable text found in file: {file_path}")

        return raw_text, page_count, source

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
