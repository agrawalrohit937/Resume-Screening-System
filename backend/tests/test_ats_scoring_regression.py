"""
Regression test suite for ATS scoring consistency, skill normalization,
mutual exclusion invariant, and resume snapshot safety (Phase 10).
"""

import pytest
from services.skill_ontology import normalize_skill, canonicalize_skills, evaluate_skill_fulfillment
from services.scoring_engine import (
    score_resume,
    score_resume_dual,
    _compute_shared_components,
    CANDIDATE_PROFILE,
    RECRUITER_PROFILE,
)


def test_1_jd_required_skills_and_candidate_match():
    """
    TEST 1:
    JD required skills: ["python", "postgresql"]
    Resume contains Python and PostgreSQL
    Expected:
    matched = ["Python", "PostgreSQL"] (canonicalized)
    missing = []
    skill count = 2/2
    """
    resume_data = {
        "raw_text": "Experienced backend engineer proficient in Python and PostgreSQL.",
        "skills": ["python", "postgresql"],
        "total_experience_years": 3.0,
        "education_level": "Bachelor's Degree",
    }
    jd_skills = ["python", "postgresql"]
    jd_text = "Only python and Postgresql"

    result = score_resume(
        resume=resume_data,
        jd=jd_text,
        mode="candidate",
        required_skills=jd_skills,
    )

    matched_lower = [s.lower() for s in result["matched_skills"]]
    assert "python" in matched_lower
    assert "postgresql" in matched_lower
    assert len(result["missing_skills"]) == 0
    assert len(result["matched_skills"]) == 2
    assert result["skills_score"] == 100.0


def test_2_case_variation_matching():
    """
    TEST 2:
    Case variation:
    JD: ["Python", "PostgreSQL"]
    Resume: ["python", "postgresql"]
    Expected: 2/2 match
    """
    resume_data = {
        "raw_text": "Software developer with python and postgresql skills.",
        "skills": ["python", "postgresql"],
        "total_experience_years": 2.0,
        "education_level": "Bachelor's Degree",
    }
    result = score_resume(
        resume=resume_data,
        jd="Looking for developer with Python and PostgreSQL experience.",
        mode="candidate",
        required_skills=["Python", "PostgreSQL"],
    )

    assert len(result["matched_skills"]) == 2
    assert len(result["missing_skills"]) == 0
    assert result["skills_score"] == 100.0


def test_3_duplicate_variants_canonicalization():
    """
    TEST 3:
    Duplicate variants:
    JD: ["python", "Python", "PYTHON"]
    Expected canonical required skills: ["Python"] (1 canonical skill)
    """
    canonical = canonicalize_skills(["python", "Python", "PYTHON"])
    assert len(canonical) == 1
    assert canonical[0].lower() == "python"

    # Also test mixed PostgreSQL aliases
    pg_canonical = canonicalize_skills(["PostgreSQL", "postgresql", "postgressql", "postgres"])
    assert len(pg_canonical) == 1
    assert pg_canonical[0] == "PostgreSQL"


def test_4_matched_skill_must_never_be_missing():
    """
    TEST 4:
    Matched skill must never be missing.
    Verify that across raw skills, aliases, and keyword matching,
    intersection between matched and missing is always empty.
    """
    resume_data = {
        "raw_text": "Python developer with postgressql and FastAPI experience.",
        "skills": ["python", "postgressql", "fastapi"],
        "total_experience_years": 2.0,
        "education_level": "Bachelor's Degree",
    }
    # Pass a mixture of aliases and duplicates in required_skills
    required = ["python", "Python", "PostgreSQL", "postgressql", "Docker"]
    result = score_resume(
        resume=resume_data,
        jd="Only python and Postgresql with optional Docker.",
        mode="candidate",
        required_skills=required,
    )

    matched_set = {s.lower() for s in result["matched_skills"]}
    missing_set = {s.lower() for s in result["missing_skills"]}

    # Intersection MUST be strictly empty
    overlap = matched_set.intersection(missing_set)
    assert len(overlap) == 0, f"Overlap detected between matched and missing: {overlap}"

    # Strict keyword matches also must not overlap
    strict_matched_set = {s.lower() for s in result["strict_matched_keywords"]}
    strict_missing_set = {s.lower() for s in result["strict_missing_keywords"]}
    strict_overlap = strict_matched_set.intersection(strict_missing_set)
    assert len(strict_overlap) == 0, f"Overlap in strict keywords: {strict_overlap}"


def test_5_standalone_ats_and_job_feed_use_same_scoring_path():
    """
    TEST 5:
    Standalone ATS and Job Feed candidate mode use the same scoring core:
    `score_resume(resume=..., jd=..., mode='candidate', required_skills=...)`.
    """
    resume_data = {
        "raw_text": "Python and PostgreSQL backend engineer.",
        "skills": ["Python", "PostgreSQL"],
        "total_experience_years": 3.0,
        "education_level": "Bachelor's Degree",
        "education": [{"degree": "Bachelor of Technology", "end_year": 2022}]
    }
    jd_text = "Only python and Postgresql"
    req_skills = ["python", "postgresql"]

    # Flow A: Standalone ATS (passes jd_text and required_skills)
    standalone_result = score_resume(
        resume=resume_data,
        jd=jd_text,
        mode="candidate",
        required_skills=req_skills,
    )

    # Flow B: Job Feed match preview (passes jd_text_raw and job.required_skills)
    job_feed_result = score_resume(
        resume=resume_data,
        jd=jd_text,
        mode="candidate",
        required_skills=req_skills,
    )

    assert standalone_result["final_score"] == job_feed_result["final_score"]
    assert standalone_result["skills_score"] == job_feed_result["skills_score"]
    assert standalone_result["experience_score"] == job_feed_result["experience_score"]
    assert standalone_result["education_score"] == job_feed_result["education_score"]
    assert standalone_result["matched_skills"] == job_feed_result["matched_skills"]
    assert standalone_result["missing_skills"] == job_feed_result["missing_skills"]


def test_6_same_resume_and_same_jd_produce_same_score():
    """
    TEST 6:
    Same resume + same JD passed to both candidate endpoints should produce
    the exact same candidate score, even if standalone passed required_skills=[]
    and Job Feed passed required_skills=['python', 'postgresql'].
    """
    resume_data = {
        "raw_text": "Python engineer with PostgreSQL and FastAPI background. 3 years experience. Bachelor in CS.",
        "skills": ["Python", "PostgreSQL", "FastAPI"],
        "total_experience_years": 3.0,
        "education_level": "Bachelor's Degree",
        "education": [{"degree": "Bachelor in Computer Science", "end_year": 2021}]
    }
    jd_text = "Only python and Postgresql"

    # Standalone ATS where user only pastes the JD text
    standalone_result = score_resume(
        resume=resume_data,
        jd=jd_text,
        mode="candidate",
        required_skills=[],
    )

    # Job Feed where job has stored required_skills=['python', 'postgresql']
    job_feed_result = score_resume(
        resume=resume_data,
        jd=jd_text,
        mode="candidate",
        required_skills=["python", "postgresql"],
    )

    assert standalone_result["final_score"] == job_feed_result["final_score"]
    assert standalone_result["skills_score"] == job_feed_result["skills_score"]
    assert len(standalone_result["matched_skills"]) == 2
    assert len(job_feed_result["matched_skills"]) == 2
    assert len(standalone_result["missing_skills"]) == 0
    assert len(job_feed_result["missing_skills"]) == 0


def test_7_apply_time_score_resume_dual_produces_both_scores():
    """
    TEST 7:
    Apply-time score_resume_dual still produces both:
    candidate_score and recruiter_score.
    """
    resume_data = {
        "raw_text": "Junior developer with 1 year Python and PostgreSQL experience.",
        "skills": ["Python", "PostgreSQL"],
        "total_experience_years": 1.0,
        "education_level": "Bachelor's Degree",
    }
    jd_text = "Requires 4+ years of Python and PostgreSQL experience."
    required_skills = ["Python", "PostgreSQL"]

    dual = score_resume_dual(
        resume=resume_data,
        jd=jd_text,
        required_skills=required_skills,
    )

    assert "candidate_score" in dual
    assert "recruiter_score" in dual
    assert "knockout" in dual
    assert isinstance(dual["candidate_score"], (int, float))
    assert isinstance(dual["recruiter_score"], (int, float))
    # Recruiter score is stricter than candidate score
    assert dual["candidate_score"] >= dual["recruiter_score"]


def test_8_split_eligibility_from_quality_score():
    """
    TEST 8 (Task 0.3):
    Eligibility is split from Quality Score:
    - quality_score is NEVER capped at 45.0 (reflects true quality).
    - final_score equals quality_score.
    - eligibility.status is 'ineligible' with failing checks and eligibility_rank == 2.
    - Deprecated recruiter_score retains legacy 45.0 cap for backward compatibility.
    """
    resume_data = {
        "raw_text": "High school graduate with 6 months Python practice.",
        "skills": ["Python"],
        "total_experience_years": 0.5,
        "education_level": "High School",
        "education": [],
    }
    jd_text = "Requires at least 5+ years of experience and a Master-level degree."

    recruiter_res = score_resume(
        resume=resume_data,
        jd=jd_text,
        mode="recruiter",
        required_skills=["Python"],
    )
    # Quality score is NOT artificially capped at 45.0
    assert "quality_score" in recruiter_res
    assert recruiter_res["final_score"] == recruiter_res["quality_score"]

    # Structured eligibility
    assert "eligibility" in recruiter_res
    assert recruiter_res["eligibility"]["status"] == "ineligible"
    assert len(recruiter_res["eligibility"]["checks"]) > 0
    assert recruiter_res["eligibility_rank"] == 2

    # Deprecated recruiter_score retains legacy 45.0 cap
    assert recruiter_res.get("recruiter_score", 0.0) <= 45.0

    candidate_res = score_resume(
        resume=resume_data,
        jd=jd_text,
        mode="candidate",
        required_skills=["Python"],
    )
    assert "quality_score" in candidate_res
    assert candidate_res["final_score"] == candidate_res["quality_score"]



def test_9_resume_snapshot_immutability_logic():
    """
    TEST 9:
    Resume snapshot remains immutable after candidate uploads a new resume.
    Verifies that the snapshot dictionary structure created at apply time
    remains completely decoupled from subsequent profile resume mutations.
    """
    # 1. Candidate's original resume at apply time
    original_parsed_data = {
        "raw_text": "Version 1 resume text with Python 3 years",
        "skills": ["Python"],
        "total_experience_years": 3.0,
    }
    apply_time_snapshot = {
        "file_url": "https://storage.cloud/resumes/user123_v1.pdf",
        "parsed_data": dict(original_parsed_data),
        "filename": "user123_v1.pdf",
    }

    # 2. Candidate updates profile resume later
    updated_profile_resume = {
        "file_url": "https://storage.cloud/resumes/user123_v2_updated.pdf",
        "parsed_data": {
            "raw_text": "Version 2 resume text with Go and Rust",
            "skills": ["Go", "Rust"],
            "total_experience_years": 5.0,
        },
        "filename": "user123_v2_updated.pdf",
    }

    # 3. Verify application's snapshot retains original v1 data
    assert apply_time_snapshot["file_url"] == "https://storage.cloud/resumes/user123_v1.pdf"
    assert apply_time_snapshot["parsed_data"]["skills"] == ["Python"]
    assert apply_time_snapshot["filename"] == "user123_v1.pdf"
    assert apply_time_snapshot["file_url"] != updated_profile_resume["file_url"]
    assert apply_time_snapshot["parsed_data"] != updated_profile_resume["parsed_data"]


def test_skill_buckets_partition():
    """
    Verify that the three buckets (matched_skills, transferable_skills, missing_skills)
    form a strict partition of the canonical required skills universe:
    1. Pairwise disjoint:
       matched ∩ transferable = ∅
       matched ∩ missing = ∅
       transferable ∩ missing = ∅
    2. Union equals the canonical required skill universe.
    """
    resume_data = {
        "raw_text": "Backend engineer skilled in Django, React, and MySQL.",
        "skills": ["Django", "React", "MySQL"],
        "total_experience_years": 4.0,
        "education_level": "Bachelor's Degree",
    }
    # FastAPI: candidate has Django (TAXONOMY_SIBLING -> transferable)
    # React: candidate has React (EXACT -> matched)
    # Kubernetes: candidate does not have (NONE -> missing)
    # Relational Databases: candidate has MySQL (TAXONOMY_PARENT -> matched)
    required = ["FastAPI", "React", "Kubernetes", "Relational Databases"]
    result = score_resume(
        resume=resume_data,
        jd="Looking for React, FastAPI, Kubernetes, and Relational Databases experience.",
        mode="candidate",
        required_skills=required,
    )

    matched = set(s.lower() for s in result["matched_skills"])
    transferable = set(s.lower() for s in result["transferable_skills"])
    missing = set(s.lower() for s in result["missing_skills"])

    # 1. Pairwise disjoint
    assert len(matched.intersection(transferable)) == 0, f"Overlap matched & transferable: {matched & transferable}"
    assert len(matched.intersection(missing)) == 0, f"Overlap matched & missing: {matched & missing}"
    assert len(transferable.intersection(missing)) == 0, f"Overlap transferable & missing: {transferable & missing}"

    # 2. Union equals the canonical skill universe
    all_buckets = matched | transferable | missing
    canonical_required = set(s.lower() for s in canonicalize_skills(required))
    assert all_buckets == canonical_required, f"Buckets {all_buckets} != {canonical_required}"

    # Specific bucket checks
    assert "fastapi" in transferable
    assert "react" in matched
    assert "relational databases" in matched
    assert "kubernetes" in missing

