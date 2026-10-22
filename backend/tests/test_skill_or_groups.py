import pytest
from services.nlp_extractor import extract_skill_or_groups
from services.scoring_engine import score_resume


def test_extract_skill_or_groups_detection():
    jd_text = """
    We are looking for a Software Development Engineer.
    Required Skills:
    • Strong proficiency in at least one programming language such as Java, Python, C++, or JavaScript.
    • Strong understanding of Data Structures & Algorithms.
    • Understanding of DBMS, SQL, and database design.
    • Familiarity with Git and software development tools.
    """
    or_groups = extract_skill_or_groups(jd_text)
    assert len(or_groups) >= 1
    # Check that Java, Python, C++, JavaScript are in the detected group
    first_group = or_groups[0]
    first_group_lower = {s.lower() for s in first_group}
    assert "python" in first_group_lower
    assert "java" in first_group_lower
    assert "c++" in first_group_lower
    assert "javascript" in first_group_lower


def test_or_group_satisfied_candidate_not_penalized_for_missing_alternatives():
    """
    Candidate knows Python, Java, JavaScript, but NOT C++.
    JD specifies: 'at least one programming language such as Java, Python, C++, or JavaScript'.
    Expected behavior:
    - 'C++' MUST NOT be in missing_skills
    - 'C++' MUST NOT be in strict_missing_keywords
    - Python, Java, JavaScript should be in matched_skills
    """
    resume_data = {
        "raw_text": "Software Engineer with Python, Java, JavaScript, Git, and SQL skills.",
        "skills": ["Python", "Java", "JavaScript", "Git", "SQL"],
        "total_experience_years": 2.0,
        "education_level": "Bachelor's Degree",
    }
    jd_text = "Must have strong proficiency in at least one programming language such as Java, Python, C++, or JavaScript. Git and SQL required."

    result = score_resume(
        resume=resume_data,
        jd=jd_text,
        mode="candidate",
    )

    matched_lower = {s.lower() for s in result["matched_skills"]}
    missing_lower = {s.lower() for s in result["missing_skills"]}
    strict_missing_lower = {s.lower() for s in result["strict_missing_keywords"]}

    # Candidate fulfilled the group through Python, Java, JavaScript
    assert "python" in matched_lower
    assert "java" in matched_lower
    assert "javascript" in matched_lower

    # C++ was an unneeded alternative and MUST NOT be marked missing
    assert "c++" not in missing_lower
    assert "c++" not in strict_missing_lower
