"""
Unit tests for Occupation-Family Scoring Adapters and Domain Dispatcher.
Tests all 12 domain adapters, feature weights, and domain-specific eligibility knockouts.
"""

import pytest
from services.scoring.adapters.registry import detect_occupation_adapter, ADAPTER_INSTANCES
from services.scoring.adapters.software import SoftwareEngineeringAdapter
from services.scoring.adapters.healthcare import HealthcareAdapter
from services.scoring.adapters.legal_finance import LegalFinanceAdapter
from services.scoring.adapters.skilled_trades import SkilledTradesAdapter
from services.scoring.adapters.creative_design import CreativeDesignAdapter
from services.scoring.adapters.academic import AcademicResearchAdapter
from services.scoring.adapters.sales import SalesAdapter
from services.scoring.adapters.teaching import TeachingAdapter
from services.scoring.adapters.hospitality import HospitalityRetailAdapter
from services.scoring.adapters.logistics import LogisticsOperationsAdapter
from services.scoring.adapters.data_analytics import DataAnalyticsAdapter
from services.scoring.adapters.generic import GenericAdapter
from services.scoring_engine import _evaluate_eligibility


def test_adapter_registry_contains_all_12_adapters():
    expected_adapters = [
        "software_engineering", "healthcare", "legal_finance", "skilled_trades",
        "creative_design", "academic_research", "sales", "teaching",
        "hospitality_retail", "logistics_operations", "data_analytics", "generic"
    ]
    for key in expected_adapters:
        assert key in ADAPTER_INSTANCES
        adapter = ADAPTER_INSTANCES[key]
        assert adapter.adapter_name is not None
        weights = adapter.feature_weights()
        assert isinstance(weights, dict)
        assert len(weights) >= 3
        # Weights should sum to ~1.0
        assert 0.95 <= sum(weights.values()) <= 1.05


def test_detect_occupation_adapter_by_title_and_keywords():
    cases = [
        ("Senior Python Backend Developer", SoftwareEngineeringAdapter),
        ("Registered Staff Nurse (ICU)", HealthcareAdapter),
        ("Corporate Lawyer & Legal Counsel", LegalFinanceAdapter),
        ("Chartered Accountant (Direct Tax)", LegalFinanceAdapter),
        ("Industrial Pipe Welder", SkilledTradesAdapter),
        ("Senior Product & UI/UX Designer", CreativeDesignAdapter),
        ("Postdoctoral Research Scientist in Genomics", AcademicResearchAdapter),
        ("Enterprise Account Executive (SaaS)", SalesAdapter),
        ("Secondary School Mathematics Teacher (TGT)", TeachingAdapter),
        ("Executive Head Chef", HospitalityRetailAdapter),
        ("Heavy Commercial Vehicle (HMV) Truck Driver", LogisticsOperationsAdapter),
        ("Senior Machine Learning & Data Scientist", DataAnalyticsAdapter),
        ("Administrative Operations Assistant", GenericAdapter),
    ]

    for title, expected_cls in cases:
        adapter = detect_occupation_adapter(job_title=title, jd_text="")
        assert isinstance(adapter, expected_cls), f"Expected {expected_cls.__name__} for '{title}', got {type(adapter).__name__}"


def test_healthcare_licence_hard_knockout():
    # Job requires RN
    job = {
        "title": "Registered Nurse - ICU",
        "description": "Seeking an experienced Registered Nurse with active RN licensure to handle critical care.",
    }

    # Candidate with no RN licence
    cand_no_rn = {
        "raw_text": "Experienced healthcare assistant with 5 years experience in hospital administration.",
        "skills": ["Patient Care", "Healthcare Administration"],
        "credentials": [],
        "total_experience_years": 5.0,
    }

    res_ineligible = _evaluate_eligibility(
        extracted_data=cand_no_rn,
        jd_text=job["description"],
        job=job,
    )
    assert res_ineligible["status"] == "ineligible"
    assert res_ineligible["is_knockout"] is True
    assert any("RN / Nursing / Medical Registration" in r for r in res_ineligible["reasons"])

    # Candidate with valid RN credential
    cand_with_rn = {
        "raw_text": "Registered Nurse with active State Nursing Council registration #RN-89421.",
        "skills": ["Nursing Care", "Clinical Pharmacology"],
        "credentials": [{"type": "RN", "registration_number": "RN-89421"}],
        "total_experience_years": 4.0,
    }

    res_eligible = _evaluate_eligibility(
        extracted_data=cand_with_rn,
        jd_text=job["description"],
        job=job,
    )
    assert res_eligible["status"] == "eligible"
    assert res_eligible["is_knockout"] is False


def test_legal_finance_charter_hard_knockout():
    job = {
        "title": "Senior Statutory Auditor",
        "description": "Must be a qualified Chartered Accountant (CA) with ICAI registration for audit sign-offs.",
    }

    cand_unqualified = {
        "raw_text": "Finance analyst with experience in Excel models and cost tracking.",
        "skills": ["Excel", "Financial Modeling"],
        "total_experience_years": 3.0,
    }

    res = _evaluate_eligibility(cand_unqualified, jd_text=job["description"], job=job)
    assert res["status"] == "ineligible"
    assert any("Charter" in r for r in res["reasons"])

    cand_ca = {
        "raw_text": "Qualified Chartered Accountant with ICAI membership #412093. Experienced in statutory audits.",
        "skills": ["Statutory Auditing", "Taxation Law"],
        "total_experience_years": 4.0,
    }
    res_ca = _evaluate_eligibility(cand_ca, jd_text=job["description"], job=job)
    assert res_ca["status"] == "eligible"


def test_teaching_bed_hard_knockout():
    job = {
        "title": "High School Science Teacher",
        "description": "Looking for a Science Teacher. B.Ed required with CTET qualification.",
    }

    cand_no_bed = {
        "raw_text": "Science enthusiast with private tutoring experience.",
        "skills": ["Physics", "Chemistry"],
        "total_experience_years": 2.0,
    }

    res = _evaluate_eligibility(cand_no_bed, jd_text=job["description"], job=job)
    assert res["status"] == "ineligible"
    assert any("B.Ed" in r for r in res["reasons"])

    cand_with_bed = {
        "raw_text": "Science teacher with Bachelor of Education (B.Ed) and CTET Paper 2 certified.",
        "skills": ["Classroom Pedagogy", "Educational Assessment"],
        "education": [{"degree": "B.Ed"}],
        "total_experience_years": 3.0,
    }
    res_bed = _evaluate_eligibility(cand_with_bed, jd_text=job["description"], job=job)
    assert res_bed["status"] == "eligible"


def test_creative_design_portfolio_rule():
    job = {
        "title": "Product Designer",
        "description": "Design user flows and visual systems for mobile app.",
    }

    cand_no_portfolio = {
        "raw_text": "Designed various screens for client projects.",
        "skills": ["Figma", "User Experience Design"],
        "total_experience_years": 3.0,
    }

    res = _evaluate_eligibility(cand_no_portfolio, jd_text=job["description"], job=job)
    # Portfolio is soft severity, so status should remain eligible but advisory recorded
    assert res["status"] == "eligible"
    assert any("Portfolio" in a for a in res["advisories"])

    cand_with_portfolio = {
        "raw_text": "Product Designer. View my work at https://dribbble.com/alexdesigns",
        "skills": ["Figma", "User Experience Design"],
        "total_experience_years": 3.0,
    }
    res_port = _evaluate_eligibility(cand_with_portfolio, jd_text=job["description"], job=job)
    assert res_port["status"] == "eligible"
    assert not any("Portfolio" in a for a in res_port["advisories"])
