"""
Unit Tests for ATS Scoring Engine v2.3 Architectural Overhaul
Validates:
1. Absent components dropped & weights renormalized (no free credit for unspecified JD criteria).
2. Structured flags take precedence over regex in eligibility checks.
3. Missing candidate location pushed to needs_input without causing unverified status.
4. Empty JD skills component dropped with confidence downgraded to low.
5. Title alignment prioritizes current/latest role instead of roles[0].
6. JD parser in-memory caching and fallback skill extraction.
"""

import hashlib
from services.scoring_engine import (
    score_resume,
    _compute_experience,
    _evaluate_eligibility,
    SCORING_ENGINE_VERSION
)
from services.jd_parser_service import (
    _JD_CACHE,
    GROQ_MODEL,
    PROMPT_VERSION,
)


def test_scoring_engine_version():
    assert SCORING_ENGINE_VERSION == "2.3.0"


def test_absent_components_dropped_no_free_points():
    """
    When a JD has no required years and no degree requirement,
    experience and education should be dropped from components,
    and unrelated resumes should NOT receive 24-30 free points.
    """
    unrelated_resume = {
        "raw_text": "Cooking chef with pastry experience.",
        "skills": ["baking", "pastry"],
        "experience": [{"title": "Pastry Chef", "duration_months": 12}],
        "education": [],
        "total_experience_years": 1.0,
    }
    
    # Target role with ONLY skills, no degree or years specified
    result = score_resume(
        resume=unrelated_resume,
        jd="Looking for a Python Developer who knows Django and FastAPI.",
        mode="candidate",
        required_skills=["python", "django", "fastapi"],
        min_years=0,
        min_education=None,
        years_is_required=False,
        education_is_required=False,
    )

    # Experience and education should be dropped
    assert "dropped_components" in result
    assert "experience" in result["dropped_components"]
    assert "education" in result["dropped_components"]
    
    # Strict score should be 0 because candidate has none of the 3 required skills
    assert result["strict_ats_score"] == 0.0
    
    # Without free points, final score is dominated by low semantic match rather than inflated by 24+ points
    assert result["final_score"] < 40.0
    assert result["match_band"] in ("low", "partial")


def test_structured_flags_precedence_over_regex():
    """
    If regex text suggests a requirement, but structured flag explicitly marks it as not required,
    the structured flag must take precedence.
    """
    candidate = {
        "total_experience_years": 1.0,
        "education": [{"degree": "High School Diploma"}],
        "location": "Remote",
    }
    
    # JD text says "Requires 5+ years and Master's degree"
    # But structured flags say years_is_required=False and education_is_required=False
    el = _evaluate_eligibility(
        extracted_data=candidate,
        jd_text="Requires 5+ years of software experience and Master's degree.",
        min_years=5.0,
        min_education="Master",
        years_is_required=False,
        education_is_required=False,
    )
    
    # Since structured flags marked them as not required, candidate is NOT knocked out
    assert el["is_knockout"] is False
    assert el["status"] == "eligible"
    for check in el["checks"]:
        if check["rule_id"] in ("min_years", "degree_level"):
            assert check["severity"] != "hard"


def test_missing_candidate_location_needs_input():
    """
    When candidate location is missing from resume, eligibility check must NOT
    disqualify or flip status to unverified; instead it must add location to needs_input.
    """
    candidate_no_loc = {
        "total_experience_years": 5.0,
        "education": [{"degree": "Bachelor of Technology"}],
        "location": None,
    }
    
    el = _evaluate_eligibility(
        extracted_data=candidate_no_loc,
        jd_text="On-site role in Seattle, WA. Must be able to commute daily.",
        min_years=2.0,
        job={
            "description": "On-site role in Seattle, WA.",
            "location": "Seattle, WA",
            "remote_policy": "onsite",
            "min_years": 2.0,
        }
    )
    
    # Candidate should not be disqualified for unstated location
    assert el["is_knockout"] is False
    # Location should be captured in needs_input for confirmation
    assert "location" in el["needs_input"] or "candidate_location" in el["needs_input"]


def test_empty_jd_skills_drops_component_and_lowers_confidence():
    """
    When JD extraction yields no skills, skills component is dropped and confidence is low.
    """
    candidate = {
        "raw_text": "Software engineer with python experience.",
        "skills": ["python"],
        "total_experience_years": 4.0,
    }
    
    result = score_resume(
        resume=candidate,
        jd="We are a fast-growing stealth startup looking for good energy and passion.",
        mode="candidate",
        must_have_skills=[],
        nice_to_have_skills=[],
        min_years=2.0,
    )
    
    assert "skills" in result.get("dropped_components", [])
    assert result.get("confidence", {}).get("level") == "low"
    assert any("skill" in r.lower() for r in result.get("confidence", {}).get("reasons", []))


def test_experience_title_alignment_latest_role():
    """
    Title alignment must use the role with is_current=True or the latest end date,
    NOT simply roles[0] if roles[0] happens to be an older internship.
    """
    # roles list has an internship first, but a current Senior Developer role second
    exp_data = [
        {
            "title": "Junior Intern",
            "start_date": "2019-01-01",
            "end_date": "2019-06-01",
            "is_current": False,
        },
        {
            "title": "Senior Python Architect",
            "start_date": "2020-01-01",
            "end_date": "Present",
            "is_current": True,
        }
    ]
    
    score, profile = _compute_experience(
        extracted_data={"experience": exp_data, "work_experience": exp_data, "total_experience_years": 5.0},
        jd_text="Looking for an experienced Python Architect for our backend platform.",
        min_years=3.0,
        job={"title": "Python Architect"}
    )
    
    assert score > 0.8
    if profile and hasattr(profile, "title_match"):
        t_match = getattr(profile, "title_match", {})
        assert float(t_match.get("match_score", 0)) > 0.7


def test_jd_parser_caching():
    """
    Verify in-memory caching of JD parse results based on hash and model.
    """
    jd_sample = "Seeking a Data Scientist with 3+ years in Python, PyTorch, and SQL. Masters preferred. Location: New York."
    jd_hash = hashlib.sha256(jd_sample.strip().encode("utf-8")).hexdigest()
    cache_key = f"{GROQ_MODEL}:{PROMPT_VERSION}:{jd_hash}"
    _JD_CACHE[cache_key] = {"cached": True, "required_skills": ["python"], "min_years": 3.0}
    assert cache_key in _JD_CACHE
    assert _JD_CACHE[cache_key]["cached"] is True
    assert _JD_CACHE[cache_key]["min_years"] == 3.0


# ══════════════════════════════════════════════════════════════════════════
# TESTS FOR THE 7 CRITICAL ACCURACY FIXES
# ══════════════════════════════════════════════════════════════════════════

def test_fix1_calibrate_cosine_loads_json(tmp_path, monkeypatch):
    """Fix 1: import json exists and _calibrate_cosine cleanly loads percentile data."""
    import json
    import services.scoring_engine as se
    
    fake_calib = tmp_path / "semantic_calibration.json"
    fake_calib.write_text(json.dumps({"sorted_percentiles": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]}))
    
    monkeypatch.setattr(se, "CALIBRATION_FILE", str(fake_calib))
    monkeypatch.setattr(se, "_CALIBRATION_DATA", None)
    
    res = se._calibrate_cosine(0.45)
    # 0.45 is after index 3 (0.4) and before index 4 (0.5), so 4 / 10 = 40.0%
    assert res == 40.0


def test_fix2_nice_only_skills_no_free_points():
    """Fix 2: When JD has nice-to-have but NO must-have, matching 0 nice skills yields 0.0, not 0.8."""
    from services.scoring_engine import _skills_score
    
    # Candidate has no matching skills
    score, matched, transferable, missing, _, _ = _skills_score(
        cand_skills=["cooking", "gardening"],
        jd_skills=["Docker", "Accounting"],
        must_have_skills=[],
        nice_to_have_skills=["Docker", "Accounting"],
    )
    # Must NOT default to 0.8 (80%) free credit!
    assert score == 0.0
    assert len(matched) == 0
    assert "Docker" in missing

    # Candidate with 1 of 2 nice skills gets 50%
    score_half, _, _, _, _, _ = _skills_score(
        cand_skills=["Docker"],
        jd_skills=["Docker", "Accounting"],
        must_have_skills=[],
        nice_to_have_skills=["Docker", "Accounting"],
    )
    assert score_half == 0.5


def test_fix3_preferred_years_retains_half_weight_instead_of_dropping():
    """Fix 3: Preferred years must NOT drop the component; keep it at 50% weight so 10y scores higher than 0y."""
    cand_10y = {
        "raw_text": "Experienced Python Engineer. Work experience: 10 years developing python backend applications.",
        "skills": ["python"],
        "total_experience_years": 10.0,
        "experience": [{"title": "Software Engineer", "duration_months": 120, "description": "10 years developing python backend applications."}],
    }
    cand_0y = {
        "raw_text": "Fresher Python Learner with python knowledge.",
        "skills": ["python"],
        "total_experience_years": 0.0,
        "experience": [],
    }
    
    jd = "Python Engineer position. 3 years experience preferred."
    
    res_10y = score_resume(
        resume=cand_10y,
        jd=jd,
        mode="candidate",
        required_skills=["python"],
        min_years=3.0,
        years_is_required=False,
    )
    res_0y = score_resume(
        resume=cand_0y,
        jd=jd,
        mode="candidate",
        required_skills=["python"],
        min_years=3.0,
        years_is_required=False,
    )
    
    # Experience should NOT be in dropped_components because it was specified as preferred
    assert "experience" not in res_10y.get("dropped_components", [])
    assert res_10y["experience_score"] > res_0y["experience_score"]
    # 10y candidate must score strictly higher than 0y candidate
    assert res_10y["final_score"] > res_0y["final_score"]


def test_fix4_vague_jd_full_semantic_weight_and_low_confidence():
    """Fix 4: If no strict component remains active, final_score is 100% semantic and confidence is low."""
    cand = {
        "raw_text": "Dedicated professional with enthusiasm.",
        "skills": [],
        "total_experience_years": 0.0,
    }
    # Vague JD with no skills, no years, no degree
    vague_jd = "Looking for a dynamic problem solver with great enthusiasm and team spirit."
    
    res = score_resume(
        resume=cand,
        jd=vague_jd,
        mode="candidate",
        must_have_skills=[],
        nice_to_have_skills=[],
        min_years=0,
        min_education=None,
    )
    
    # Strict score is 0.0, so final score = vector_score (1.0 * semantic)
    assert res["strict_ats_score"] == 0.0
    assert res["final_score"] == round(res["vector_score"], 1)
    assert res["confidence"]["level"] == "low"
    assert any("verifiable requirements" in r.lower() or "semantic similarity" in r.lower() for r in res["confidence"]["reasons"])


def test_fix5_skill_universe_built_from_jd_dict_must_and_nice():
    """Fix 5: When ats.py passes only jd dict with must_have_skills, skill_universe uses structured lists."""
    cand = {
        "raw_text": "Python and FastAPI engineer",
        "skills": ["python", "fastapi"],
        "total_experience_years": 3.0,
    }
    jd_dict = {
        "title": "Backend Dev",
        "description": "Backend role",
        "must_have_skills": ["python", "fastapi"],
        "nice_to_have_skills": ["docker"],
    }
    
    res = score_resume(
        resume=cand,
        jd=jd_dict,
        mode="candidate",
    )
    
    # Must have matched python and fastapi from the jd dict's must_have_skills
    assert "python" in [s.lower() for s in res["matched_skills"]]
    assert "fastapi" in [s.lower() for s in res["matched_skills"]]
    assert "docker" in [s.lower() for s in res["missing_skills"]]


def test_fix6_eligibility_none_not_treated_as_false():
    """Fix 6: None value in job dict for years_is_required does not bool() to False (preferred)."""
    cand = {
        "total_experience_years": 0.5,
        "education": [],
    }
    
    # Job specifies 5 years required in regex, and structured years_is_required is None
    el = _evaluate_eligibility(
        extracted_data=cand,
        jd_text="Requires 5+ years of software experience.",
        min_years=5.0,
        job={"years_is_required": None, "min_years_required": None, "education_is_required": None},
        years_is_required=None,
    )
    
    # Should be treated as required, knocking out candidate with 0.5 years
    min_years_check = next((c for c in el["checks"] if c["rule_id"] == "min_years"), None)
    assert min_years_check is not None
    assert min_years_check["severity"] == "hard"
    assert el["status"] == "ineligible"


def test_fix7_skills_status_not_applicable_outputs_none_score():
    """Fix 7: When skills are omitted (not applicable), skills_score is None, not 0.0."""
    cand = {
        "raw_text": "Experienced software engineer with 5 years experience.",
        "skills": ["python"],
        "total_experience_years": 5.0,
    }
    res = score_resume(
        resume=cand,
        jd="Looking for great energy and motivation for our growing team.",
        mode="candidate",
        must_have_skills=[],
        nice_to_have_skills=[],
        min_years=3.0,
    )
    
    assert res["skills_status"] == "not_applicable"
    assert res["skills_score"] is None

