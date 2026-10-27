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
import re
from typing import Any, Dict, List, Optional, Union

import structlog
from jinja2 import Environment, FileSystemLoader
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None

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
        browser = pw.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--single-process",
                "--no-zygote",
            ]
        )
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
        contact = resume_data.get("contact") or resume_data.get("contact_info") or {}
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
                    item_copy = dict(item)
                    # Education normalization
                    if "institution" in item_copy or "degree" in item_copy or "school" in item_copy:
                        inst = (item_copy.get("institution") or item_copy.get("school") or item_copy.get("college") or "").strip()
                        deg = (item_copy.get("degree") or "").strip()
                        field = (item_copy.get("field_of_study") or item_copy.get("major") or "").strip()
                        if field and field.lower() not in deg.lower():
                            deg = f"{deg} — {field}".strip(" —")
                        item_copy["institution"] = inst
                        item_copy["degree"] = deg

                        start_y = item_copy.get("start_year")
                        end_y = item_copy.get("end_year")
                        edu_year = item_copy.get("year") or item_copy.get("dates") or item_copy.get("duration") or ""
                        if not edu_year and (start_y or end_y):
                            edu_year = f"{start_y} - {end_y}" if start_y and end_y else str(end_y or start_y)
                        item_copy["year"] = str(edu_year).strip()

                        gpa = item_copy.get("gpa") or item_copy.get("cgpa") or item_copy.get("score")
                        if gpa and str(gpa).strip().lower() != "none":
                            s_gpa = str(gpa).strip()
                            item_copy["score"] = s_gpa if ("cgpa" in s_gpa.lower() or "gpa" in s_gpa.lower()) else f"CGPA: {s_gpa}"

                        cw = item_copy.get("coursework") or item_copy.get("courses") or item_copy.get("relevant_coursework")
                        if cw:
                            if isinstance(cw, list):
                                item_copy["coursework"] = ", ".join(str(x).strip() for x in cw if x and str(x).strip())
                            else:
                                item_copy["coursework"] = str(cw).strip()

                    # Clean company string if location is duplicated at end
                    company = (item_copy.get("company") or "").strip()
                    loc = (item_copy.get("location") or "").strip()
                    if company and loc and company.lower().endswith(f", {loc.lower()}"):
                        item_copy["company"] = company[:-len(f", {loc}")].strip()

                    # Clean bullet highlights (strip leading •, -, ▸, *, ›)
                    hl = item_copy.get("highlights")
                    if isinstance(hl, list) and hl:
                        item_copy["highlights"] = [
                            re.sub(r"^[\s\u2022\u25b8\u25b6\u2013\u2014\-\*\>\›\.]+", "", str(h)).strip()
                            for h in hl
                            if h and str(h).strip()
                        ]
                    else:
                        # Fallback to description if highlights is empty
                        desc = (item_copy.get("description") or "").strip()
                        if desc:
                            sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', desc) if len(s.strip()) > 15]
                            item_copy["highlights"] = sentences[:3] if sentences else [desc]
                        else:
                            item_copy["highlights"] = []

                    # Normalize technologies list so Jinja2 never text-shreds a string
                    techs = item_copy.get("technologies") or item_copy.get("tech_stack") or item_copy.get("stack")
                    if isinstance(techs, str):
                        item_copy["technologies"] = [t.strip() for t in techs.split(",") if t and t.strip()]
                    elif isinstance(techs, list):
                        cleaned_techs = []
                        for t in techs:
                            if isinstance(t, str):
                                cleaned_techs.extend([sub.strip() for sub in t.split(",") if sub.strip()])
                            elif t:
                                cleaned_techs.append(str(t).strip())
                    # Ensure duration / dates / period / year is captured regardless of key name
                    duration = (item_copy.get("duration") or item_copy.get("dates") or item_copy.get("period") or item_copy.get("year") or "").strip()
                    item_copy["duration"] = duration
                    item_copy["dates"] = duration

                    # Preserve project links (link and github)
                    item_copy["name"] = (item_copy.get("name") or item_copy.get("title") or "").strip()
                    item_copy["link"] = (item_copy.get("link") or item_copy.get("live_demo") or item_copy.get("url") or "").strip()
                    item_copy["github"] = (item_copy.get("github") or item_copy.get("repo") or item_copy.get("github_url") or "").strip()
                    normalized.append(item_copy)
            return normalized

        def _format_cert_item(c: Any) -> str:
            if not c:
                return ""
            if isinstance(c, dict):
                name = (c.get("name") or c.get("title") or c.get("certificate") or c.get("award") or "").strip()
                issuer = (c.get("issuer") or c.get("organization") or c.get("authority") or c.get("event") or "").strip()
                desc = (c.get("description") or c.get("details") or "").strip()
                year = (c.get("issue_date") or c.get("year") or c.get("date") or "").strip()
                if year.lower() == "none":
                    year = ""
                res = name
                if issuer and issuer.lower() != "none" and issuer.lower() not in res.lower():
                    res += f" — {issuer}" if res else issuer
                if desc and desc.lower() != "none" and desc.lower() not in res.lower():
                    res += f": {desc}" if res else desc
                if year:
                    res += f" ({year})"
                return re.sub(r"^[\s\u2022\u25b8\u2013\u2014\-\*\>]+", "", res).strip()
            return re.sub(r"^[\s\u2022\u25b8\u2013\u2014\-\*\>]+", "", str(c)).strip()

        # Filter out education items that may have leaked into projects, and promote them to education if missing
        raw_projects = as_dict_list(resume_data.get("projects", []))
        raw_education = as_dict_list(resume_data.get("education", []))
        edu_leak_keywords = ("university", "college", "institute of", "school of", "b.tech", "m.tech", "bachelor")
        clean_projects = []
        for p in raw_projects:
            pname = (p.get("name") or "").lower()
            if any(k in pname for k in edu_leak_keywords) and not p.get("technologies") and not p.get("highlights"):
                # Misclassified education entry — promote to education if not already present
                if not any(pname in (e.get("institution") or "").lower() for e in raw_education):
                    raw_education.append({
                        "institution": p.get("name") or "",
                        "degree": p.get("role") or p.get("title") or "Bachelor of Technology",
                        "year": p.get("duration") or p.get("dates") or p.get("year") or "",
                        "score": p.get("score") or "",
                        "coursework": p.get("coursework") or "",
                    })
                continue
            clean_projects.append(p)

        return {
            "full_name": (resume_data.get("full_name") or contact.get("full_name") or "").strip(),
            "role_title": (resume_data.get("target_role") or resume_data.get("role_title") or "").strip(),
            "email": (contact.get("email") or resume_data.get("email") or "").strip(),
            "phone": (contact.get("phone") or resume_data.get("phone") or "").strip(),
            "location": (contact.get("location") or resume_data.get("location") or "").strip(),
            "linkedin": (contact.get("linkedin") or resume_data.get("linkedin") or "").strip(),
            "github": (contact.get("github") or resume_data.get("github") or "").strip(),
            "portfolio": (contact.get("portfolio") or resume_data.get("portfolio") or "").strip(),

            "summary": (resume_data.get("summary") or "").strip(),

            "experience": as_dict_list(resume_data.get("experience", [])),
            "projects": clean_projects,
            "education": raw_education,

            "skills": (
                resume_data.get("skills") or {}
                if isinstance(resume_data.get("skills"), dict)
                else self._dedupe_preserve_order(resume_data.get("skills", []))
            ),

            "certifications": [
                _format_cert_item(c)
                for c in (resume_data.get("certifications", []) or [])
                if _format_cert_item(c) and not _format_cert_item(c).startswith("{'")
            ],
            "achievements": [
                _format_cert_item(a)
                for a in (resume_data.get("achievements", []) or [])
                if _format_cert_item(a) and not _format_cert_item(a).startswith("{'")
            ],

            # Growth checklist only
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

    def render_html(self, resume_data: dict, template: str = "resume.html") -> str:
        context = self._normalize_resume_context(resume_data)
        template_dir = self._template_dir()
        env = Environment(loader=FileSystemLoader(template_dir), autoescape=True)
        template_obj = env.get_template(self._resolve_template_name(template))
        render_context = {k: v for k, v in context.items() if k != "recommended_skills"}
        return template_obj.render(**render_context)

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
        html_content = self.render_html(resume_data, template)

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