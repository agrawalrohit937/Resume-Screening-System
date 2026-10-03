"""
RBAC Matrix Introspection & Generator Script.
Introspects `backend/core/rbac.py` and produces `docs/RBAC_MATRIX.md`
with explicit Allowed / Denied text across all roles.
"""

from pathlib import Path
import sys
import os

# Ensure backend root is on PYTHONPATH
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.rbac import Permission, ROLE_PERMISSIONS_MAP
from models.user_model import UserRole


def generate_rbac_matrix_md() -> str:
    roles = [
        ("Platform Admin", UserRole.PLATFORM_ADMIN.value),
        ("Executive (Founder / Owner)", UserRole.EXECUTIVE.value),
        ("Recruiter (Pipeline Owner)", UserRole.RECRUITER.value),
        ("Hiring Manager (Decision Maker)", UserRole.HIRING_MANAGER.value),
        ("Coordinator", UserRole.COORDINATOR.value),
        ("Interviewer (Restricted)", UserRole.INTERVIEWER.value),
        ("Candidate (Applicant)", UserRole.CANDIDATE.value),
    ]

    permissions = list(Permission)

    lines = [
        "# CareerShala Enterprise Role-Based Access Control (RBAC) Matrix",
        "",
        "> **Auto-Generated Source of Truth**  ",
        "> Generated from `backend/core/rbac.py` and route dependencies. Every cell contains explicit `Allowed` or `Denied` status.",
        "",
        "| Permission Token | Description | " + " | ".join(r[0] for r in roles) + " |",
        "| :--- | :--- | " + " | ".join(":---:" for _ in roles) + " |",
    ]

    for perm in permissions:
        token = perm.value
        desc = token.replace(":", " ").replace("_", " ").title()
        row_cells = [f"`{token}`", desc]
        for _, role_key in roles:
            perms_for_role = ROLE_PERMISSIONS_MAP.get(role_key, frozenset())
            if token in perms_for_role:
                row_cells.append("**Allowed**")
            else:
                row_cells.append("Denied")
        lines.append("| " + " | ".join(row_cells) + " |")

    lines.extend([
        "",
        "## Candidate Resource Scope Guardrails",
        "- Candidates are strictly restricted to **own-only** resource access (`user_id == current_user.id`).",
        "- Cross-candidate access to resumes, applications, ATS scoring replays, or interview recordings results in HTTP 403 / 404.",
        "",
        "## Multi-Tenant Scope Guardrails",
        "- All non-platform-admin roles are locked within their authenticated `tenant_id` context.",
        "- Cross-tenant query tampering via `X-Tenant-ID` is rejected with HTTP 403 Forbidden.",
    ])

    return "\n".join(lines)


if __name__ == "__main__":
    docs_dir = Path(__file__).resolve().parent.parent.parent / "docs"
    docs_dir.mkdir(exist_ok=True)
    output_path = docs_dir / "RBAC_MATRIX.md"
    content = generate_rbac_matrix_md()
    output_path.write_text(content, encoding="utf-8")
    print(f"RBAC Matrix successfully written to {output_path}")
