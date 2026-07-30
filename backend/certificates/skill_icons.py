import os
import re

ICON_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "assets", "skill_icons"))
DEFAULT_ICON = "default.png"


def slugify(text: str) -> str:
    """Converts input text into a sanitized kebab-case slug.

    1. Convert to lowercase & strip whitespace.
    2. Replace '&' with 'and'.
    3. Replace non-alphanumeric characters (including underscores/slashes) with hyphens.
    4. Collapse duplicate hyphens and strip leading/trailing hyphens.
    """
    if not text:
        return ""
    s = text.lower().strip()
    s = re.sub(r"&", "and", s)
    s = re.sub(r"[^\w\-]+", "-", s)  # Replaces spaces, slashes, special chars
    s = s.replace("_", "-")
    s = re.sub(r"-+", "-", s)
    return s.strip("-")


def resolve_skill_icon_path(assessment_slug: str) -> str:
    """Looks for `{slug}.png` in assets/skill_icons, safely falling back to
    `default.png` if the icon does not exist or if slug contains invalid/typo characters.

    Protects against directory traversal and ensures seamless fallback.
    """
    clean_slug = slugify(assessment_slug)

    if clean_slug:
        filename = f"{clean_slug}.png"
        target_path = os.path.normpath(os.path.join(ICON_DIR, filename))
        
        # Verify target_path is inside ICON_DIR and file exists
        if target_path.startswith(ICON_DIR) and os.path.isfile(target_path):
            return target_path

    # Fallback to default icon
    default_path = os.path.normpath(os.path.join(ICON_DIR, DEFAULT_ICON))
    return default_path

