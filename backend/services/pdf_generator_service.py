"""
PDF Generator Service — Render resume HTML and convert it to PDF with Playwright.

WeasyPrint was replaced because its PDF text layer corrupts ligatures and
misencodes glyphs, causing strict-match ATS scores to drop.  Playwright uses
headless Chromium — the same engine as "Print to PDF" in Chrome — which
produces a clean, fully-selectable text layer that ATS parsers can parse
without any glyph-merging artefacts.

Post-install step (one-time, also in Dockerfile):
    playwright install chromium
"""

import gc
import asyncio
import os

import structlog
from jinja2 import Environment, FileSystemLoader
from playwright.sync_api import sync_playwright

from core.config import settings
from services.cloudinary_service import upload_ats_resume

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Core PDF utility
# ---------------------------------------------------------------------------

def _sync_generate_pdf(html_content: str, output_path: str) -> None:
    """
    Blocking Playwright call that runs inside a worker thread.

    sync_playwright creates its own internal event loop inside the thread,
    so it is completely unaffected by which asyncio loop policy the parent
    process uses.  This is the recommended pattern for Windows + FastAPI.
    """
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = None
        try:
            page = browser.new_page()
            # wait_until="networkidle" lets Google Fonts finish loading.
            # Falls back gracefully to system fonts if network is unavailable.
            page.set_content(html_content, wait_until="networkidle")
            page.pdf(
                path=output_path,
                format="A4",
                print_background=True,
            )
            logger.info("Playwright PDF written", path=output_path)
        finally:
            if page:
                try:
                    page.close()
                except Exception:
                    pass
            browser.close()
            gc.collect()


async def generate_pdf_from_html(html_content: str, output_path: str) -> None:
    """
    Async wrapper — offloads the blocking Playwright call to a thread so the
    FastAPI event loop is never blocked.

    Windows note: async_playwright raises NotImplementedError on SelectorEventLoop
    because it needs asyncio.create_subprocess_exec which is not supported.
    Running sync_playwright in a thread bypasses this entirely.
    """
    output_path = os.path.abspath(output_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    # asyncio.to_thread offloads to the default ThreadPoolExecutor.
    # The thread gets its own OS-level event loop context, safe on Windows.
    await asyncio.to_thread(_sync_generate_pdf, html_content, output_path)


# ---------------------------------------------------------------------------
# Cloudinary helpers
# ---------------------------------------------------------------------------

async def upload_to_cloudinary(local_file_path: str, remote_filename: str) -> str:
    """Read PDF from local path, upload to Cloudinary, return secure_url."""
    with open(local_file_path, "rb") as f:
        pdf_bytes = f.read()
    secure_url, _public_id = await upload_ats_resume(pdf_bytes, remote_filename)
    logger.info("Cloudinary ATS resume upload complete", url=secure_url)
    return secure_url


# Keep the old name as an alias so that any remaining callers that import
# upload_to_ftp from this module continue to work.
upload_to_ftp = upload_to_cloudinary


# ---------------------------------------------------------------------------
# Service class
# ---------------------------------------------------------------------------

class PDFGeneratorService:

    def _template_dir(self) -> str:
        return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "templates"))

    def _dedupe_preserve_order(self, items) -> list:
        """Dedupe case-insensitively while preserving the LLM's priority order."""
        seen = set()
        result = []
        for item in items or []:
            cleaned = (item or "").strip()
            key = cleaned.lower()
            if cleaned and key not in seen:
                seen.add(key)
                result.append(cleaned)
        return result

    def _normalize_resume_context(self, resume_data: dict) -> dict:
        contact = resume_data.get("contact") or {}
        if hasattr(contact, "model_dump"):
            contact = contact.model_dump()
        elif hasattr(contact, "__dict__"):
            contact = contact.__dict__

        def as_dict_list(items):
            normalized = []
            for item in items or []:
                if hasattr(item, "model_dump"):
                    item = item.model_dump()
                elif hasattr(item, "__dict__"):
                    item = item.__dict__
                if item:
                    normalized.append(item)
            return normalized

        return {
            "full_name": (resume_data.get("full_name") or "").strip(),
            "role_title": (resume_data.get("target_role") or "").strip(),
            "email": (contact.get("email") or "").strip(),
            "phone": (contact.get("phone") or "").strip(),
            "linkedin": (contact.get("linkedin") or "").strip(),
            "github": (contact.get("github") or "").strip(),
            "portfolio": (contact.get("portfolio") or "").strip(),

            "summary": (resume_data.get("summary") or "").strip(),

            "experience": as_dict_list(resume_data.get("experience", [])),
            "projects": as_dict_list(resume_data.get("projects", [])),
            "education": as_dict_list(resume_data.get("education", [])),

            # skills may be a Dict[str, List[str]] (categorised, new format) or
            # a flat List[str] (legacy).  Never run the dict through the list
            # deduper — iterating a dict yields only keys, losing all values.
            "skills": (
                resume_data.get("skills") or {}
                if isinstance(resume_data.get("skills"), dict)
                else self._dedupe_preserve_order(resume_data.get("skills", []))
            ),

            "certifications": resume_data.get("certifications", []) or [],
            "achievements": resume_data.get("achievements", []) or [],

            # Growth checklist only — the template intentionally does NOT
            # print this on the resume.
            "recommended_skills": self._dedupe_preserve_order(
                resume_data.get("recommended_skills", [])
            ),
        }

    def _resolve_template_name(self, template: str) -> str:
        template_aliases = {
            "modern": "resume.html",
            "classic": "resume.html",
            "minimal": "resume.html",
        }
        resolved_template = template_aliases.get(template, template)
        template_path = os.path.join(self._template_dir(), resolved_template)

        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Resume template not found: {resolved_template}")

        return resolved_template

    async def generate_resume_pdf(
        self,
        resume_data: dict,
        output_path: str,
        template: str = "resume.html",
    ) -> str:
        """
        1. Render HTML from the Jinja2 template
        2. Convert HTML → PDF using Playwright (headless Chromium)
        3. Upload the PDF to Cloudinary
        4. Return the Cloudinary secure_url
        """
        context = self._normalize_resume_context(resume_data)

        template_dir = self._template_dir()
        env = Environment(loader=FileSystemLoader(template_dir))
        template_obj = env.get_template(self._resolve_template_name(template))
        render_context = {k: v for k, v in context.items() if k != "recommended_skills"}
        html_content = template_obj.render(**render_context)

        output_path = os.path.abspath(output_path)

        # --- Playwright replaces WeasyPrint here ---
        await generate_pdf_from_html(html_content, output_path)

        logger.info(
            "PDF generated locally via Playwright",
            path=output_path,
            full_name=context.get("full_name"),
        )

        # Upload to Cloudinary and return the public URL
        filename = os.path.basename(output_path)
        cloudinary_url = await upload_to_cloudinary(output_path, filename)

        # Clean up the local temp file
        try:
            os.remove(output_path)
        except Exception:
            pass

        return cloudinary_url


# ---------------------------------------------------------------------------
# Standalone helper (used by email / certificate services)
# ---------------------------------------------------------------------------

async def render_html_to_pdf(template_name: str, context: dict, output_key: str) -> str:
    """
    Renders a Jinja2 HTML template to a local PDF file for email attachment /
    preview.  Previously used WeasyPrint; now delegates to generate_pdf_from_html
    so the entire codebase uses a single, consistent rendering engine.
    """
    template_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "templates")
    )
    env = Environment(loader=FileSystemLoader(template_dir))
    template_obj = env.get_template(template_name)
    html_content = template_obj.render(**context)

    out_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "uploads", "generated")
    )
    os.makedirs(out_dir, exist_ok=True)
    clean_key = output_key.replace("/", "_")
    output_path = os.path.join(out_dir, f"{clean_key}.pdf")

    # --- Playwright replaces WeasyPrint here ---
    await generate_pdf_from_html(html_content, output_path)
    return output_path