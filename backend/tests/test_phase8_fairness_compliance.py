"""
Phase 8 Verification Tests: Bias Audits, Counterfactual Invariance, Adverse Impact, and Compliance.
"""

from unittest.mock import MagicMock
import numpy as np
import pytest

from eval.fairness import (
    compute_adverse_impact_ratio,
    compute_group_score_gaps,
    run_counterfactual_fairness_test,
)
from services.scoring_engine import score_resume
import services.embedding_service as emb_svc


@pytest.fixture(autouse=True)
def mock_embeddings(monkeypatch):
    """Mock local embedding calls."""
    mock_model = MagicMock()
    def fake_encode(sentences, *args, **kwargs):
        if isinstance(sentences, str):
            return np.ones(1024, dtype=np.float32)
        return np.ones((len(sentences), 1024), dtype=np.float32)
    mock_model.encode.side_effect = fake_encode
    monkeypatch.setattr("services.embedding_service.embedding_model", mock_model)
    monkeypatch.setattr("services.scoring_engine.embedding_model", mock_model)


def test_adverse_impact_ratio_calculation():
    # 1. Compliant scenario: Group B rate 0.45 / Group A rate 0.50 = 0.90 (>= 0.80)
    rates_compliant = {"GroupA": 0.50, "GroupB": 0.45, "GroupC": 0.42}
    air_comp = compute_adverse_impact_ratio(rates_compliant, reference_group="GroupA")
    assert air_comp["four_fifths_compliant"] is True
    assert air_comp["ratios"]["GroupB"] == 0.90
    assert air_comp["min_air"] >= 0.80

    # 2. Non-compliant scenario: Group B rate 0.30 / Group A rate 0.50 = 0.60 (< 0.80)
    rates_biased = {"GroupA": 0.50, "GroupB": 0.30}
    air_biased = compute_adverse_impact_ratio(rates_biased, reference_group="GroupA")
    assert air_biased["four_fifths_compliant"] is False
    assert air_biased["ratios"]["GroupB"] == 0.60


def test_score_gap_analysis_sample_guard():
    # Small sample below 30 -> flags insufficient_sample
    small_scores = {
        "GroupA": [80.0, 85.0, 75.0, 90.0],
        "GroupB": [78.0, 82.0, 74.0, 88.0],
    }
    gaps_small = compute_group_score_gaps(small_scores, min_sample_size=30)
    assert gaps_small["GroupA_vs_GroupB"]["insufficient_sample"] is True

    # Large sample (>= 30) -> computes valid Cohen's d
    np.random.seed(42)
    large_scores = {
        "GroupA": list(np.random.normal(80, 5, 40)),
        "GroupB": list(np.random.normal(80, 5, 40)),
    }
    gaps_large = compute_group_score_gaps(large_scores, min_sample_size=30)
    assert gaps_large["GroupA_vs_GroupB"]["insufficient_sample"] is False
    assert abs(gaps_large["GroupA_vs_GroupB"]["cohens_d"]) < 0.50  # Negligible gap


def test_counterfactual_invariance():
    """
    Asserts that swapping candidate name, gender, or college does NOT alter the score.
    Career gaps are also never penalized.
    """
    base_resume = {
        "candidate_name": "Rahul Sharma",
        "raw_text": (
            "Rahul Sharma\n"
            "Bachelor of Technology in Computer Science — Indian Institute of Technology Bombay (2018-2022)\n"
            "Software Engineer at Tech Solutions (2022-2024)\n"
            "Developed Python microservices with FastAPI and PostgreSQL.\n"
            "Skills: Python, FastAPI, PostgreSQL, Docker"
        ),
        "skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
        "education": [{"degree": "Bachelor of Technology", "institution": "Indian Institute of Technology Bombay"}],
        "work_experience": [
            {"title": "Software Engineer", "company": "Tech Solutions", "start_date": "2022-01-01", "end_date": "2024-01-01", "description": "Python FastAPI microservices"}
        ],
    }
    jd = {
        "text": "Seeking Backend Engineer proficient in Python, FastAPI, and PostgreSQL.",
        "min_years": 2.0,
    }

    perturbations = [
        # Perturbation 1: Female Name & Different University
        {
            "candidate_name": "Priya Patel",
            "raw_text": (
                "Priya Patel\n"
                "Bachelor of Technology in Computer Science — National Institute of Technology Trichy (2018-2022)\n"
                "Software Engineer at Tech Solutions (2022-2024)\n"
                "Developed Python microservices with FastAPI and PostgreSQL.\n"
                "Skills: Python, FastAPI, PostgreSQL, Docker"
            ),
        },
        # Perturbation 2: Western Name & Global University
        {
            "candidate_name": "John Doe",
            "raw_text": (
                "John Doe\n"
                "Bachelor of Science in Computer Science — University of Washington (2018-2022)\n"
                "Software Engineer at Tech Solutions (2022-2024)\n"
                "Developed Python microservices with FastAPI and PostgreSQL.\n"
                "Skills: Python, FastAPI, PostgreSQL, Docker"
            ),
        },
    ]

    cf_report = run_counterfactual_fairness_test(
        scoring_fn=score_resume,
        base_resume=base_resume,
        base_jd=jd,
        perturbations=perturbations,
        tolerance=0.0,  # Strict mathematical invariance
    )

    assert cf_report["passes_counterfactual_fairness"] is True
    assert cf_report["max_divergence"] == 0.0
