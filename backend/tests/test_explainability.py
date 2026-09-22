"""
Unit tests for Task 3.4: Evidence-Grounded Explainability & SHAP Attribution.
Tests SHAP top-5 positive/negative feature breakdown, cited evidence spans,
counterfactual prioritization, and anti-hallucination validation.
"""

import pytest

from services.explainability_service import (
    compute_shap_contributions,
    generate_requirement_explanations,
    rank_prioritized_counterfactuals,
    validate_explanation_text,
)


def test_shap_contributions_top_positive_and_negative():
    features = {
        "quality_score": 82.5,
        "skills_score": 0.90,
        "experience_score": 0.40,
        "education_score": 0.85,
        "vector_score": 0.88,
        "skill_match_ratio": 0.85,
        "experience_parity_ratio": 0.45,
        "is_knockout": False,
        "hard_check_failures_count": 0,
    }

    shap_res = compute_shap_contributions(model=None, features_dict=features, top_k=3)

    assert "top_positive_features" in shap_res
    assert "top_negative_features" in shap_res
    assert len(shap_res["top_positive_features"]) <= 3
    assert len(shap_res["top_negative_features"]) <= 3

    # Strong skills (0.90) and vector match (0.88) should be among positive contributors
    pos_names = [f["feature"] for f in shap_res["top_positive_features"]]
    assert "skills_score" in pos_names or "vector_score" in pos_names

    # Lower experience (0.40) should be among negative contributors
    neg_names = [f["feature"] for f in shap_res["top_negative_features"]]
    assert "experience_score" in neg_names or "experience_parity_ratio" in neg_names


def test_requirement_level_cited_evidence_spans():
    resume_text = "Senior Python Developer with 4 years experience building microservices using Python and Docker."
    scoring_result = {
        "matched_skills": ["Python", "Docker"],
        "transferable_skills": ["Kubernetes"],
        "missing_skills": ["AWS"],
        "eligibility": {
            "checks": [
                {
                    "rule_id": "min_years",
                    "label": "5+ years required",
                    "passed": False,
                    "observed": "~4.0 years",
                }
            ]
        }
    }

    explanations = generate_requirement_explanations(
        extracted_data={},
        scoring_result=scoring_result,
        raw_resume_text=resume_text,
    )

    assert len(explanations) == 5  # 2 matched + 1 transferable + 1 missing + 1 exp

    # Check matched Python explanation
    py_exp = next(e for e in explanations if "Python" in e.requirement)
    assert py_exp.verdict == "full"
    assert py_exp.credit == 1.0
    assert len(py_exp.evidence) > 0
    ev = py_exp.evidence[0]
    assert ev.source == "skills_block"
    assert ev.quote_len == len("Python")
    assert ev.char_start >= 0
    assert "Python" in resume_text[ev.char_start:ev.char_end]

    # Check missing AWS explanation
    aws_exp = next(e for e in explanations if "AWS" in e.requirement)
    assert aws_exp.verdict == "missing"
    assert aws_exp.credit == 0.0
    assert aws_exp.counterfactual is not None


def test_prioritized_counterfactuals_roi_ranking():
    resume_text = "Python engineer with 2 years experience."
    scoring_result = {
        "matched_skills": ["Python"],
        "transferable_skills": [],
        "missing_skills": ["Docker", "PostgreSQL"],
        "eligibility": {
            "checks": [
                {
                    "rule_id": "min_years",
                    "label": "5+ years required",
                    "passed": False,
                    "observed": "~2.0 years",
                }
            ]
        }
    }

    explanations = generate_requirement_explanations(
        extracted_data={},
        scoring_result=scoring_result,
        raw_resume_text=resume_text,
    )

    actions = rank_prioritized_counterfactuals(explanations)
    assert len(actions) >= 2

    # High ROI (quick skill acquisitions) must be prioritized above multi-year tenure accumulation
    assert actions[0].effort_estimate == "low"
    assert actions[0].priority_score >= actions[-1].priority_score


def test_anti_hallucination_explanation_validator():
    allowed_skills = {"Python", "FastAPI", "Docker"}
    allowed_numbers = {85.0, 4.0, 100.0}

    # Valid grounded text
    valid_text = "Candidate scored 85.0 quality score with 4.0 years of experience."
    is_valid, violations = validate_explanation_text(valid_text, allowed_skills, allowed_numbers)
    assert is_valid is True
    assert len(violations) == 0

    # Invalid text making up an ungrounded number (e.g. 99.9% or 15 years)
    hallucinated_text = "Candidate has 15.0 years of experience and a 99.9 rating."
    is_valid_bad, violations_bad = validate_explanation_text(hallucinated_text, allowed_skills, allowed_numbers)
    assert is_valid_bad is False
    assert any("15.0" in v or "99.9" in v for v in violations_bad)
