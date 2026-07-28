import uuid


def generate_certificate_id() -> str:
    """UUID4 — not sequential, so certificates can't be enumerated by
    guessing nearby IDs on the public verify endpoint."""
    return str(uuid.uuid4())


# Threshold -> (grade label, accent hex), checked top-down.
# This table is "live config" — it can change over time. It must ONLY be
# used at issuance time to compute grade_label, which then gets frozen into
# the snapshot. Never call this again for an already-issued certificate.
GRADE_THRESHOLDS = [
    (95, "Highest Distinction", "#B45309"),
    (90, "Distinction", "#6366F1"),
    (80, "Merit", "#0EA5E9"),
    (0, "Pass", "#475569"),
]


def resolve_grade(score: int) -> tuple[str, str]:
    for threshold, label, color in GRADE_THRESHOLDS:
        if score >= threshold:
            return label, color
    return "Pass", "#475569"
