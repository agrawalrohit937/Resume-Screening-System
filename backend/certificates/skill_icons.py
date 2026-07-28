import os

ICON_DIR = os.path.join(os.path.dirname(__file__), "assets", "skill_icons")
DEFAULT_ICON = "default.png"


def resolve_skill_icon_path(assessment_slug: str) -> str:
    """Looks for `{slug}.png` in assets/skill_icons, falls back to a
    generic default icon if the assessment doesn't have a dedicated one
    yet. Returns a local filesystem path — ReportLab draws it directly,
    no network fetch involved, which is faster and removes a runtime
    dependency from the render path.

    PNG/JPG only: ReportLab has no native SVG support. If your Canva
    skill badges are exported as SVG, flatten them to PNG once (e.g. via
    `rsvg-convert` or Illustrator/Figma export) and drop the PNG here —
    the design itself doesn't change, just the file format.
    """
    filename = f"{assessment_slug}.png"
    local_path = os.path.join(ICON_DIR, filename)
    if os.path.exists(local_path):
        return local_path
    return os.path.join(ICON_DIR, DEFAULT_ICON)
