"""
Single source of truth for "which certificate_type uses which template".

A "template" here is a folder under certificates/templates/ containing:
  - a Canva-exported background (background.png or background.pdf)
  - a layout.json describing where ReportLab draws the dynamic fields

Adding a new certificate category (hackathon, internship, recruiter award...)
means exporting a new background + writing a new layout.json. Nothing in
renderer.py or service.py changes.
"""

CERTIFICATE_REGISTRY = {
    "assessment": {
        "template": "default_v1",
        # Fields the context-builder for this type MUST populate before
        # the snapshot is frozen. Keeps a silent missing-field bug from
        # reaching WeasyPrint as a blank space on the PDF.
        "required_snapshot_fields": [
            "assessment_name",
            "assessment_slug",
            "assessment_icon",
            "difficulty",
            "score",
            "grade_label",
        ],
        "certificate_type_label": "CareerShala Assessment",
    },
    # Example of a second type sharing the SAME template/design.
    # Uncomment when course completion certs actually launch.
    # "course": {
    #     "template": "default_v1",
    #     "required_snapshot_fields": ["course_name", "completion_date"],
    #     "certificate_type_label": "CareerShala Course",
    # },
}


def get_registry_entry(certificate_type: str) -> dict:
    entry = CERTIFICATE_REGISTRY.get(certificate_type)
    if entry is None:
        raise ValueError(f"Unknown certificate_type '{certificate_type}'")
    return entry


def resolve_template_dir(certificate_type: str) -> str:
    """Returns the template folder name (e.g. 'default_v1'). Never lets a
    caller pass an arbitrary string straight into a filesystem path —
    it must come from this allow-list."""
    return get_registry_entry(certificate_type)["template"]
