from pathlib import Path

from PIL import Image, ImageDraw
import qrcode
from qrcode.constants import ERROR_CORRECT_H

from core.config import settings


# --------------------------------------------------------
# Assets
# --------------------------------------------------------

ASSETS_DIR = Path(__file__).parent / "assets"
QR_LOGO_PATH = ASSETS_DIR / "skill_icons" / "qr_logo.png"


# --------------------------------------------------------
# Verification URL
# --------------------------------------------------------

def build_verification_url(cert_id: str) -> str:
    return f"{settings.cert_verify_base_url}/{cert_id}"


# --------------------------------------------------------
# Premium QR Generator
# --------------------------------------------------------

def generate_qr_image(verification_url: str) -> Image.Image:

    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=8,
        border=2,
    )

    qr.add_data(verification_url)
    qr.make(fit=True)

    # --------------------------------------------------------
    # Navy QR
    # --------------------------------------------------------

    qr_img = qr.make_image(
        fill_color="#0F172A",
        back_color="white",
    ).convert("RGBA")

    # Make white transparent
    datas = qr_img.getdata()
    new_data = []

    for item in datas:
        r, g, b, a = item

        if r > 250 and g > 250 and b > 250:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)

    qr_img.putdata(new_data)

    # --------------------------------------------------------
    # Premium Center Logo
    # --------------------------------------------------------

    if QR_LOGO_PATH.exists():

        logo = Image.open(QR_LOGO_PATH).convert("RGBA")

        qr_width, qr_height = qr_img.size

        # 17% logo
        logo_size = int(qr_width * 0.17)
        logo.thumbnail((logo_size, logo_size), Image.LANCZOS)

        # --------------------------------------
        # White Circular Badge
        # --------------------------------------

        badge_size = int(logo_size * 1.45)

        badge = Image.new(
            "RGBA",
            (badge_size, badge_size),
            (0, 0, 0, 0),
        )

        draw = ImageDraw.Draw(badge)

        # Golden Ring
        draw.ellipse(
            (0, 0, badge_size - 1, badge_size - 1),
            fill=(196, 151, 72, 255),
        )

        # White Circle
        margin = 3

        draw.ellipse(
            (
                margin,
                margin,
                badge_size - margin - 1,
                badge_size - margin - 1,
            ),
            fill=(255, 255, 255, 255),
        )

        badge_x = (qr_width - badge_size) // 2
        badge_y = (qr_height - badge_size) // 2

        qr_img.alpha_composite(badge, (badge_x, badge_y))

        # --------------------------------------
        # Paste Logo
        # --------------------------------------

        logo_x = (qr_width - logo.width) // 2
        logo_y = (qr_height - logo.height) // 2

        qr_img.alpha_composite(logo, (logo_x, logo_y))

    return qr_img.convert("RGBA")