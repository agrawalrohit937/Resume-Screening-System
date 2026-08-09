import json
import os

from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter
from PIL import Image as PILImage
import io
import structlog

logger = structlog.get_logger(__name__)

TEMPLATES_ROOT = os.path.join(os.path.dirname(__file__), "templates")

_registered_font_aliases: set[str] = set()  # avoid re-registering the same TTF across renders


def _detect_page_size(background_path: str) -> tuple[float, float]:
    """Auto-detect the page dimensions from the background asset.
    For PDFs: reads the MediaBox of page 0.
    For images: converts pixel dimensions to points at 72 DPI.
    Returns (width_pt, height_pt)."""
    ext = os.path.splitext(background_path)[1].lower()
    if ext == ".pdf":
        reader = PdfReader(background_path)
        box = reader.pages[0].mediabox
        return float(box.width), float(box.height)
    else:
        with PILImage.open(background_path) as img:
            w_px, h_px = img.size
            dpi = img.info.get("dpi", (72, 72))
            dpi_x = dpi[0] if isinstance(dpi, tuple) else dpi
            dpi_y = dpi[1] if isinstance(dpi, tuple) else dpi
            return w_px * 72.0 / dpi_x, h_px * 72.0 / dpi_y


def _load_layout(template_dir: str) -> dict:
    layout_path = os.path.join(TEMPLATES_ROOT, template_dir, "layout.json")
    with open(layout_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _register_fonts(template_dir: str, layout: dict) -> dict:
    """Registers each font declared in layout.json (once per alias) and
    returns {logical_name: actual_reportlab_font_name}, falling back to a
    built-in font if the TTF file is missing so a bad asset never crashes
    a render — it just looks slightly wrong, which is easy to spot."""
    font_dir = os.path.join(TEMPLATES_ROOT, template_dir)
    assets_font_dir = os.path.join(os.path.dirname(__file__), "assets", "fonts")

    resolved = {}
    for logical_name, spec in layout["fonts"].items():
        alias = spec["alias"]
        if alias not in _registered_font_aliases:
            candidate_paths = [
                os.path.join(font_dir, spec["file"]),
                os.path.join(assets_font_dir, spec["file"]),
            ]
            font_path = next((p for p in candidate_paths if os.path.exists(p)), None)
            if font_path:
                try:
                    pdfmetrics.registerFont(TTFont(alias, font_path))
                    _registered_font_aliases.add(alias)
                except Exception:
                    logger.warning("Failed to register font, falling back", alias=alias, path=font_path)
            else:
                logger.warning("Font file not found, falling back", alias=alias, file=spec["file"])

        resolved[logical_name] = alias if alias in _registered_font_aliases else spec["fallback"]
    return resolved


def _draw_auto_scaled_text(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    font_name: str,
    base_size: float,
    min_size: float,
    color: str,
    align: str = "center",
    max_width_pt: float = None,
    max_size: float = None,
) -> float:
    """Calculates rendered text width using pdfmetrics.stringWidth and scales font
    size down (or up towards max_size) to perfectly fit max_width_pt."""
    font_size = base_size
    if max_width_pt and max_width_pt > 0 and text:
        cur_width = pdfmetrics.stringWidth(text, font_name, base_size)
        if cur_width > max_width_pt:
            scale = max_width_pt / cur_width
            font_size = max(min_size, base_size * scale)
        elif max_size and cur_width < max_width_pt * 0.7:
            scale = (max_width_pt * 0.75) / cur_width
            font_size = min(max_size, base_size * scale)

    c.setFont(font_name, font_size)
    c.setFillColor(HexColor(color))

    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)

    return font_size


def _draw_text_fields(c: canvas.Canvas, layout: dict, fonts: dict, context: dict,
                      page_width: float, page_height: float) -> None:
    for field_name, cfg in layout["text_fields"].items():
        if field_name == "skill_name":
            continue  # skill_name is drawn separately in _draw_skill_name with custom scaling/wrapping logic

        value = context.get(field_name)
        if value in (None, ""):
            continue  # field not provided for this certificate_type — skip silently

        x = cfg["x_frac"] * page_width
        y = cfg["y_frac"] * page_height
        font_alias = fonts[cfg["font"]]
        base_size = cfg["size"]
        color = cfg["color"]
        align = cfg.get("align", "center")
        text = str(value)

        max_width_frac = cfg.get("max_width_frac")
        if max_width_frac:
            max_width_pt = max_width_frac * page_width
            min_size = cfg.get("min_size", 8)
            max_size = cfg.get("max_size", base_size)
            _draw_auto_scaled_text(c, text, x, y, font_alias, base_size, min_size, color, align, max_width_pt, max_size)
        else:
            c.setFont(font_alias, base_size)
            c.setFillColor(HexColor(color))
            if align == "center":
                c.drawCentredString(x, y, text)
            elif align == "right":
                c.drawRightString(x, y, text)
            else:
                c.drawString(x, y, text)


def _draw_image_fields(c: canvas.Canvas, layout: dict, context: dict,
                       page_width: float, page_height: float) -> None:
    for field_name, cfg in layout["image_fields"].items():
        image_source = context.get(f"{field_name}_image")  # PIL Image, path, or ImageReader
        if image_source is None:
            continue

        x = cfg["x_frac"] * page_width
        y = cfg["y_frac"] * page_height
        w = cfg["width_frac"] * page_width
        h = cfg["height_frac"] * page_height
        try:
            c.drawImage(ImageReader(image_source), x, y, width=w, height=h, mask="auto")
        except Exception as img_exc:
            logger.warning("Skipping image field (draw failed)", field=field_name, error=str(img_exc))


def _draw_skill_name(
    c,
    layout,
    fonts,
    context,
    page_width,
    page_height,
):
    skill = context.get("skill_name")

    if not skill:
        return

    cfg = layout["text_fields"]["skill_name"]

    x = cfg["x_frac"] * page_width
    y = cfg["y_frac"] * page_height
    font_alias = fonts[cfg["font"]]
    base_size = cfg.get("size", 12)
    color = cfg.get("color", "#FFFFFF")

    max_width_frac = cfg.get("max_width_frac", 0.138)
    max_width_pt = max_width_frac * page_width
    min_size = cfg.get("min_size", 7.5)
    max_size = cfg.get("max_size", 13.5)

    cur_width = pdfmetrics.stringWidth(skill, font_alias, base_size)
    words = skill.split()

    # If text is multi-word and would shrink too much on a single line, wrap onto 2 lines
    if len(words) >= 2 and (cur_width > max_width_pt * 1.35):
        mid = len(words) // 2
        line1 = " ".join(words[:mid])
        line2 = " ".join(words[mid:])

        w1 = pdfmetrics.stringWidth(line1, font_alias, base_size)
        w2 = pdfmetrics.stringWidth(line2, font_alias, base_size)
        max_w = max(w1, w2)

        line_font_size = base_size
        if max_w > max_width_pt:
            line_font_size = max(min_size, base_size * (max_width_pt / max_w))

        leading = line_font_size * 1.15
        y1 = y + (leading * 0.4)
        y2 = y - (leading * 0.6)

        c.setFont(font_alias, line_font_size)
        c.setFillColor(HexColor(color))
        c.drawCentredString(x, y1, line1)
        c.drawCentredString(x, y2, line2)
    else:
        _draw_auto_scaled_text(
            c,
            text=skill,
            x=x,
            y=y,
            font_name=font_alias,
            base_size=base_size,
            min_size=min_size,
            color=color,
            align="center",
            max_width_pt=max_width_pt,
            max_size=max_size,
        )


def _draw_overlay(layout: dict, fonts: dict, context: dict,
                  page_width: float, page_height: float) -> bytes:
    """Draws only the dynamic elements (no background) onto a blank
    transparent-origin page matching the given dimensions. Used when the
    background is a PDF — we overlay this on top of it via pypdf."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(page_width, page_height))
    _draw_text_fields(c, layout, fonts, context, page_width, page_height)
    _draw_image_fields(c, layout, context, page_width, page_height)

    _draw_skill_name(
        c,
        layout,
        fonts,
        context,
        page_width,
        page_height,
    )

    c.showPage()
    c.save()
    return buffer.getvalue()


def render_certificate_pdf(template_dir: str, context: dict) -> bytes:
    """template_dir e.g. 'default_v1'. `context` carries the dynamic
    values only (recipient_name, assessment_name, level, issued_date,
    cert_id, plus *_image entries for skill_logo/qr_code) — every other
    visual element (grade banner, seal, signatures, borders, ribbon) is
    permanently baked into the Canva-exported background and is never
    touched here.
    """
    layout = _load_layout(template_dir)
    fonts = _register_fonts(template_dir, layout)

    background_filename = layout["background"]
    background_path = os.path.join(TEMPLATES_ROOT, template_dir, background_filename)
    if not os.path.exists(background_path):
        raise FileNotFoundError(
            f"Background asset '{background_filename}' not found for template '{template_dir}'. "
            f"Place your certificate background at: {background_path}"
        )

    # Auto-detect page size from the actual background asset
    page_width, page_height = _detect_page_size(background_path)
    logger.info("Background page size detected",
                template=template_dir,
                background=background_filename,
                width_pt=round(page_width, 2),
                height_pt=round(page_height, 2))

    if background_filename.lower().endswith(".pdf"):
        pdf_bytes = _render_over_pdf_background(background_path, layout, fonts, context,
                                                page_width, page_height)
    else:
        pdf_bytes = _render_over_image_background(background_path, layout, fonts, context,
                                                  page_width, page_height)

    if not pdf_bytes or len(pdf_bytes) < 1024:
        raise RuntimeError("Certificate PDF render produced an unexpectedly small file")

    return pdf_bytes


def _render_over_image_background(background_path: str, layout: dict, fonts: dict,
                                   context: dict, page_width: float, page_height: float) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(page_width, page_height))
    c.setTitle(f"CareerShala Certificate - {context.get('recipient_name', '')}")
    c.setAuthor("CareerShala")

    c.drawImage(background_path, 0, 0, width=page_width, height=page_height)
    _draw_text_fields(c, layout, fonts, context, page_width, page_height)
    _draw_image_fields(c, layout, context, page_width, page_height)

    _draw_skill_name(
        c,
        layout,
        fonts,
        context,
        page_width,
        page_height,
    )

    c.showPage()
    c.save()
    return buffer.getvalue()


def _render_over_pdf_background(background_path: str, layout: dict, fonts: dict,
                                 context: dict, page_width: float, page_height: float) -> bytes:
    overlay_bytes = _draw_overlay(layout, fonts, context, page_width, page_height)

    background_reader = PdfReader(background_path)
    overlay_reader = PdfReader(io.BytesIO(overlay_bytes))

    writer = PdfWriter()
    bg_page = background_reader.pages[0]
    bg_page.merge_page(overlay_reader.pages[0])
    writer.add_page(bg_page)

    out_buffer = io.BytesIO()
    writer.write(out_buffer)
    return out_buffer.getvalue()
