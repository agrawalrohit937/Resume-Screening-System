"""
Tests for Universal Location Graph, Compensation Normalization, and Work Authorization.
"""

from datetime import date, timedelta
import pytest
from services.location_service import (
    normalize_location,
    haversine_distance_km,
    commute_feasible,
    timezone_overlap_hours,
)
from services.compensation_service import (
    parse_compensation,
    convert_currency,
    compensation_compatibility,
    CompensationRange,
)
from services.work_auth_service import (
    evaluate_work_authorization,
    WorkAuthorizationRecord,
    format_e164_phone,
    parse_localized_date,
)


# ══════════════════════════════════════════════════════════════════════════════
# LOCATION SERVICE TESTS
# ══════════════════════════════════════════════════════════════════════════════

def test_location_normalization_aliases():
    # Bengaluru aliases
    loc1 = normalize_location("BLR")
    assert loc1.city == "Bengaluru"
    assert loc1.metro == "Bengaluru Urban"
    assert loc1.country_iso2 == "IN"

    loc2 = normalize_location("Whitefield, Bangalore")
    assert loc2.city == "Bengaluru"

    # Mumbai aliases
    loc_bom = normalize_location("Andheri East, Bombay")
    assert loc_bom.city == "Mumbai"

    # Remote detection
    loc_rem = normalize_location("Remote - Worldwide / WFH")
    assert loc_rem.is_remote is True
    assert loc_rem.city == "Remote"


def test_commute_feasibility():
    # Same metro (Koramangala to Electronic City)
    feasible, dist, reason = commute_feasible("Koramangala, Bangalore", "Electronic City, Bengaluru")
    assert feasible is True

    # Remote job is always feasible
    feasible, dist, reason = commute_feasible("Pune", "Remote")
    assert feasible is True
    assert "remote" in reason.lower()

    # Distant cities without remote
    feasible, dist, reason = commute_feasible("Delhi", "Bengaluru", radius_km=50.0)
    assert feasible is False
    assert dist > 1000.0


def test_timezone_overlap():
    # Same timezone
    overlap = timezone_overlap_hours("Asia/Kolkata", "Asia/Kolkata")
    assert overlap == 8.0

    # India to London (~5.5 hours diff -> ~2.5 hrs overlap out of 8)
    overlap_lon = timezone_overlap_hours("Asia/Kolkata", "Europe/London")
    assert overlap_lon == 2.5


# ══════════════════════════════════════════════════════════════════════════════
# COMPENSATION SERVICE TESTS
# ══════════════════════════════════════════════════════════════════════════════

def test_parse_indian_lpa():
    comp = parse_compensation("18 - 24 LPA")
    assert comp is not None
    assert comp.currency == "INR"
    assert comp.min_amount == 1800000.0
    assert comp.max_amount == 2400000.0
    assert comp.period == "annual"
    assert comp.annualized_min == 1800000.0
    assert comp.annualized_max == 2400000.0
    assert comp.annualized_min_usd > 20000.0


def test_parse_indian_lakhs_and_crores():
    comp_lakh = parse_compensation("15 Lakhs per annum")
    assert comp_lakh is not None
    assert comp_lakh.min_amount == 1500000.0

    comp_cr = parse_compensation("1.2 - 1.5 Cr")
    assert comp_cr is not None
    assert comp_cr.min_amount == 12000000.0
    assert comp_cr.max_amount == 15000000.0


def test_parse_global_compensation():
    comp_us = parse_compensation("$120k - $160k / year")
    assert comp_us is not None
    assert comp_us.currency == "USD"
    assert comp_us.min_amount == 120000.0
    assert comp_us.max_amount == 160000.0

    comp_mo = parse_compensation("5000 AED / month")
    assert comp_mo is not None
    assert comp_mo.currency == "AED"
    assert comp_mo.period == "monthly"
    assert comp_mo.annualized_min == 60000.0


def test_compensation_compatibility():
    job_comp = parse_compensation("18 - 24 LPA")
    cand_match = parse_compensation("20 LPA")
    compatible, score, msg = compensation_compatibility(cand_match, job_comp)
    assert compatible is True
    assert score == 1.0

    # Over budget within 15% tolerance
    cand_leeway = parse_compensation("26 LPA")  # 24 * 1.15 = 27.6
    compatible, score, msg = compensation_compatibility(cand_leeway, job_comp, tolerance_pct=0.15)
    assert compatible is True
    assert score == 0.75

    # Way over budget
    cand_excess = parse_compensation("40 LPA")
    compatible, score, msg = compensation_compatibility(cand_excess, job_comp)
    assert compatible is False
    assert score < 0.5


# ══════════════════════════════════════════════════════════════════════════════
# WORK AUTHORIZATION & LOCALE TESTS
# ══════════════════════════════════════════════════════════════════════════════

def test_work_authorization_valid_and_expired():
    today = date.today()
    cand_valid = [
        WorkAuthorizationRecord(
            country_iso2="US",
            status="work_visa",
            expires_on=today + timedelta(days=180)
        )
    ]
    ok, msg = evaluate_work_authorization(cand_valid, required_countries=["US"], reference_date=today)
    assert ok is True

    # Expired visa
    cand_expired = [
        WorkAuthorizationRecord(
            country_iso2="US",
            status="work_visa",
            expires_on=today - timedelta(days=10)
        )
    ]
    ok, msg = evaluate_work_authorization(cand_expired, required_countries=["US"], reference_date=today)
    assert ok is False
    assert "expired" in msg.lower()


def test_work_authorization_sponsorship():
    cand_needs_sponsor = [
        WorkAuthorizationRecord(country_iso2="US", status="student_visa", requires_sponsorship=True)
    ]
    # Employer does not sponsor -> Knockout
    ok, msg = evaluate_work_authorization(cand_needs_sponsor, required_countries=["US"], sponsorship_available=False)
    assert ok is False

    # Employer offers sponsorship -> Allowed
    ok, msg = evaluate_work_authorization(cand_needs_sponsor, required_countries=["US"], sponsorship_available=True)
    assert ok is True


def test_e164_phone_formatting():
    # Indian phone with 0 prefix
    assert format_e164_phone("09876543210", "IN") == "+919876543210"
    # Indian phone with spaces
    assert format_e164_phone("+91 98765 43210", "IN") == "+919876543210"
    # US phone with area code
    assert format_e164_phone("(415) 555-0199", "US") == "+14155550199"


def test_localized_date_parsing():
    # US format: MM/DD/YYYY
    d_us = parse_localized_date("04/05/2023", country_iso2="US")
    assert d_us == date(2023, 4, 5)

    # Indian format: DD/MM/YYYY
    d_in = parse_localized_date("04/05/2023", country_iso2="IN")
    assert d_in == date(2023, 5, 4)

    # Textual format
    d_text = parse_localized_date("15 Aug 2022")
    assert d_text == date(2022, 8, 15)
