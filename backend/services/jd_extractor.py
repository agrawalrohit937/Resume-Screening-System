"""
External Job Description Extraction and Embedding Service.

Enables ATS scoring for external job postings by:
1. Scraping and extracting clean job description text from external URLs using BeautifulSoup / trafilatura.
2. Persisting the extracted JD text to MongoDB (jd_text_raw & jd_text).
3. Computing dense 768-dim embeddings via local BAAI/bge-base-en-v1.5 and storing them.
"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import httpx
import structlog

from services.embedding_service import embedding_model, EMBEDDING_DIMENSIONS

logger = structlog.get_logger(__name__)

# Realistic browser headers to prevent basic bot blocks
SCRAPER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def _clean_extracted_text(text: str) -> str:
    """Removes excessive whitespace, newlines, and non-printable characters."""
    if not text:
        return ""
    # Collapse multiple consecutive newlines and spaces
    text = re.sub(r"\r\n|\r", "\n", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


async def extract_jd_from_url(url: str, timeout: float = 12.0) -> Optional[str]:
    """
    Extracts core job description text from an external job listing URL.
    Tries trafilatura extraction first, then falls back to BeautifulSoup DOM parsing.
    """
    if not url or not isinstance(url, str):
        return None

    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return None

    try:
        async with httpx.AsyncClient(
            headers=SCRAPER_HEADERS,
            follow_redirects=True,
            timeout=timeout,
            verify=False,
        ) as client:
            response = await client.get(url)
            if response.status_code >= 400:
                logger.warning("Failed to fetch external JD URL", url=url, status_code=response.status_code)
                return None
            html = response.text
    except Exception as fetch_err:
        logger.warning("HTTP error while extracting external JD", url=url, error=str(fetch_err))
        return None

    extracted_text = None

    # 1. Try trafilatura if installed
    try:
        import trafilatura
        extracted_text = trafilatura.extract(
            html,
            include_links=False,
            include_images=False,
            include_tables=True,
            favor_recall=True,
        )
    except Exception:
        extracted_text = None

    # 2. Fallback to BeautifulSoup DOM parsing
    if not extracted_text or len(extracted_text.strip()) < 80:
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "html.parser")

            # Strip non-content tags
            for tag in soup(["script", "style", "noscript", "header", "footer", "nav", "svg", "button", "input", "form"]):
                tag.decompose()

            # Check common job description container selectors
            container = None
            selectors = [
                "div.job-description",
                "div.description",
                "div.show-more-less-html",
                "div[data-automation='jobDescription']",
                "div#job-details",
                "section.job-description",
                "article",
                "main",
            ]
            for sel in selectors:
                container = soup.select_one(sel)
                if container and len(container.get_text(strip=True)) >= 100:
                    break

            if container:
                extracted_text = container.get_text(separator="\n", strip=True)
            else:
                # Extract all body paragraphs and list items
                body = soup.find("body") or soup
                paragraphs = [p.get_text(separator=" ", strip=True) for p in body.find_all(["p", "li", "h1", "h2", "h3", "h4"])]
                extracted_text = "\n".join(p for p in paragraphs if len(p) > 20)
        except Exception as bs_err:
            logger.warning("BeautifulSoup parsing failed", url=url, error=str(bs_err))

    cleaned = _clean_extracted_text(extracted_text or "")
    return cleaned if len(cleaned) >= 50 else None


async def ensure_external_job_jd(job_doc: Dict[str, Any], db: Any = None) -> str:
    """
    Ensures that an external job document has full JD text and dense embeddings.
    If jd_text_raw is missing or sparse, automatically scrapes the external URL,
    persists the text and vector embedding to MongoDB, and updates job_doc in-place.
    """
    jd_raw = (job_doc.get("jd_text_raw") or job_doc.get("jd_text") or "").strip()

    # If we already have substantial JD text (>= 80 chars), generate embedding if missing and return
    if len(jd_raw) >= 80:
        if not job_doc.get("jd_embedding_bge") or len(job_doc.get("jd_embedding_bge", [])) != EMBEDDING_DIMENSIONS:
            await _generate_and_save_job_embedding(job_doc, jd_raw, db)
        return jd_raw

    # Otherwise, attempt to extract full JD text from external URL
    external_url = job_doc.get("external_apply_url") or job_doc.get("apply_url") or job_doc.get("company_website")
    extracted_jd = None

    if external_url:
        logger.info("Extracting full external JD text from URL", job_id=str(job_doc.get("_id")), url=external_url)
        extracted_jd = await extract_jd_from_url(external_url)

    # Fallback to synthesized structured JD text if URL scrape fails
    if not extracted_jd:
        title = job_doc.get("title", "Software Engineer")
        company = job_doc.get("company_name", "Tech Company")
        skills = ", ".join(job_doc.get("required_skills") or [])
        loc = job_doc.get("location", "Remote")
        exp = job_doc.get("min_years", 0)
        salary = job_doc.get("salary_range", "Competitive")
        extracted_jd = (
            f"Role: {title}\nCompany: {company}\nLocation: {loc}\n"
            f"Experience Required: {exp} years\nSalary: {salary}\n"
            f"Required Skills & Technologies: {skills}\n"
            f"Job Overview: {company} is looking for a qualified {title} skilled in {skills}."
        )

    job_doc["jd_text_raw"] = extracted_jd
    job_doc["jd_text"] = extracted_jd

    # Update MongoDB and compute embedding
    if db is not None:
        raw_db = getattr(db, "raw_db", getattr(db, "_raw_db", db))
        job_id = job_doc.get("_id")
        if job_id:
            try:
                from bson import ObjectId
                doc_id = ObjectId(str(job_id)) if ObjectId.is_valid(str(job_id)) else str(job_id)
                op = raw_db.jobs.update_one(
                    {"_id": doc_id},
                    {"$set": {"jd_text_raw": extracted_jd, "jd_text": extracted_jd}},
                )
                if hasattr(op, "__await__"):
                    await op
            except Exception as update_err:
                logger.warning("Failed to persist scraped JD text to MongoDB", error=str(update_err))

        await _generate_and_save_job_embedding(job_doc, extracted_jd, db)

    return extracted_jd


async def _generate_and_save_job_embedding(job_doc: Dict[str, Any], jd_text: str, db: Any = None) -> None:
    """Generates 768-dim normalized embedding for the JD and saves it to MongoDB."""
    try:
        title = job_doc.get("title", "")
        req_skills = ", ".join(job_doc.get("required_skills") or [])
        text_for_embedding = f"{title}. Skills: {req_skills}. {jd_text[:1200]}"

        vectors = embedding_model.encode([text_for_embedding])
        if vectors and len(vectors[0]) == EMBEDDING_DIMENSIONS:
            emb = vectors[0]
            job_doc["jd_embedding_bge"] = emb
            job_doc["jd_embedding"] = emb

            if db is not None:
                raw_db = getattr(db, "raw_db", getattr(db, "_raw_db", db))
                job_id = job_doc.get("_id")
                if job_id:
                    from bson import ObjectId
                    doc_id = ObjectId(str(job_id)) if ObjectId.is_valid(str(job_id)) else str(job_id)
                    op = raw_db.jobs.update_one(
                        {"_id": doc_id},
                        {"$set": {"jd_embedding_bge": emb, "jd_embedding": emb}},
                    )
                    if hasattr(op, "__await__"):
                        await op
    except Exception as emb_err:
        logger.warning("Failed to generate JD embedding", error=str(emb_err))
