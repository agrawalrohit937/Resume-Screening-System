"""
Anti-Bias and Demographic Non-Inference Invariant Verification Suite.
Validates via AST and static code inspection that the ATS engine NEVER infers
gender, caste, religion, marital status, ethnicity, or age from candidate names,
educational institutions, or locations.
"""

import ast
import os
import re
from pathlib import Path
import pytest
from services.identity_service import parse_cultural_name
from services.work_auth_service import evaluate_work_authorization, WorkAuthorizationRecord
from services.scoring_engine import score_resume_dual


# Prohibited demographic inference identifiers / keywords
FORBIDDEN_INFERENCE_PATTERNS = [
    r"\bpredict_gender\b",
    r"\binfer_gender\b",
    r"\bdetect_gender\b",
    r"\binfer_caste\b",
    r"\bdetect_caste\b",
    r"\binfer_religion\b",
    r"\bdetect_religion\b",
    r"\binfer_race\b",
    r"\bdetect_ethnicity\b",
    r"\bget_gender_from_name\b",
]


def test_ast_audit_no_demographic_inference():
    """
    Scans all Python source files in backend/services and backend/models
    to verify that no functions, variables, or logic attempt to infer
    protected demographic attributes.
    """
    services_dir = Path(__file__).resolve().parent.parent / "services"
    models_dir = Path(__file__).resolve().parent.parent / "models"

    scanned_files = list(services_dir.glob("**/*.py")) + list(models_dir.glob("**/*.py"))
    assert len(scanned_files) > 10, "Should scan substantial codebase"

    violations = []

    for file_path in scanned_files:
        content = file_path.read_text(encoding="utf-8", errors="ignore")

        # Regex scan
        for pattern in FORBIDDEN_INFERENCE_PATTERNS:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                violations.append(f"{file_path.name}: matched forbidden pattern '{pattern}'")

        # AST scan: ensure no functions named like 'infer_gender'
        try:
            tree = ast.parse(content, filename=str(file_path))
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    name_lower = node.name.lower()
                    if any(term in name_lower for term in ["gender", "caste", "religion", "ethnicity", "horoscope"]):
                        violations.append(f"{file_path.name}: forbidden function definition '{node.name}'")
        except SyntaxError:
            pass

    assert not violations, f"Demographic inference violations detected: {violations}"


def test_identity_service_does_not_infer_demographics():
    """
    Verifies that IdentityRecord contains only name structural fields and
    strictly NO demographic fields (gender, caste, religion, marital status).
    """
    test_names = [
        "Kavitha Ramanathan",
        "A. P. J. Abdul Kalam",
        "Deepak Sharma",
        "Fatima Al-Zahra",
        "John Smith",
        "Priya Patel",
        "रोहित अग्रवाल",
    ]

    for name in test_names:
        record = parse_cultural_name(name)
        rec_dict = record.dict()

        assert "gender" not in rec_dict
        assert "caste" not in rec_dict
        assert "religion" not in rec_dict
        assert "marital_status" not in rec_dict
        assert "age" not in rec_dict
        assert "ethnicity" not in rec_dict
        assert record.full_name == name


def test_work_auth_service_does_not_infer_from_location_or_name():
    """
    Verifies that work authorization requires explicit declarations
    and fails closed if not declared (never assumed based on origin).
    """
    # Candidate with declared US authorization
    cand_us = [WorkAuthorizationRecord(country_iso2="US", status="citizen")]
    ok, msg = evaluate_work_authorization(cand_us, required_countries=["US"])
    assert ok is True

    # Candidate with empty records (e.g. Name is 'John Doe', location is 'New York')
    # Must NOT automatically infer US citizen; must evaluate to False
    cand_empty = []
    ok, msg = evaluate_work_authorization(cand_empty, required_countries=["US"])
    assert ok is False
    assert "does not hold declared" in msg.lower()
