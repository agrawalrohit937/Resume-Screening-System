"""
Unit tests for CareerPilot Resume Parser and NLP deterministic extraction.
All tests run with mocked LLM calls (pure unit tests, zero external network dependency).
"""

from unittest.mock import AsyncMock, patch
import pytest

from models.resume_model import ParsedResumeData, WorkExperience
from services.parser_service import (
    ParserService,
    _grounded,
    _norm,
)
from utils.nlp_utils import (
    calculate_experience_from_intervals,
    extract_contact_details,
    extract_phone,
)


# ============================================================================
# 1. Grounding Tests
# ============================================================================
def test_grounding_rejects_hallucinated_company_with_legal_suffixes():
    """
    Grounding must reject 'Acme Pvt Ltd' when the resume only contains 'Pvt Ltd'
    and does not mention 'Acme'.
    """
    raw_text = "Worked as a senior developer at some agency. Formally registered as Pvt Ltd in 2021."
    raw_norm = _norm(raw_text)

    # Fake company sharing only corporate suffix
    assert not _grounded(raw_norm, "Acme Pvt Ltd", ratio=0.6)
    assert not _grounded(raw_norm, "Acme Technologies Pvt Ltd", ratio=0.6)

    # Real company present in text
    assert _grounded(raw_norm, "agency", ratio=0.6)
    assert _grounded(raw_norm, "Pvt Ltd", ratio=0.6)


def test_grounding_name_exact_ratio():
    """Candidate name requires ratio 1.0."""
    raw_norm = _norm("Jane Doe is a software consultant based in Bangalore.")
    assert _grounded(raw_norm, "Jane Doe", ratio=1.0)
    assert not _grounded(raw_norm, "Jane Doe Smith", ratio=1.0)


# ============================================================================
# 2. Skills Merge & Unknown Grounded Skills
# ============================================================================
@pytest.mark.asyncio
async def test_skills_merge_keeps_unknown_grounded_and_drops_hallucinations():
    """
    Grounded unknown skills (e.g., proprietary or niche tools present in text)
    must be kept and logged. Hallucinated skills absent from text must be dropped.
    """
    resume_text = """
    Alice Walker
    Email: alice@example.com | Phone: +91 98765 43210
    
    Experience:
    Software Engineer at TechCorp (2020 - 2023)
    - Developed microservices using Python, Docker, and proprietary ToolX9000.
    - Managed relational data in PostgreSQL.
    """

    mock_llm_json = {
        "full_name": "Alice Walker",
        "summary": "Experienced software engineer.",
        "work_experience": [
            {
                "company": "TechCorp",
                "title": "Software Engineer",
                "start_date": "2020",
                "end_date": "2023",
                "description": "Developed microservices.",
                "technologies": ["Python", "Docker", "ToolX9000"],
            }
        ],
        "education": [],
        "projects": [],
        "certifications": [],
        "skills": [
            "Python",               # Known in ESCO
            "Docker",               # In custom aliases / tech matcher
            "ToolX9000",            # Grounded in text, but NOT in ESCO
            "Kubernetes",           # Hallucination: NOT in resume text at all
            "TensorFlow Quantum",   # Hallucination: NOT in resume text
        ],
    }

    parser = ParserService()
    with patch("services.parser_service._parse_resume_with_groq", new_callable=AsyncMock) as mock_groq:
        mock_groq.return_value = (mock_llm_json, False)
        result: ParsedResumeData = await parser._structure_resume(resume_text)

    skills_lower = [s.lower() for s in result.skills]

    # Grounded known skills present
    assert any("python" in s for s in skills_lower)
    assert any("docker" in s for s in skills_lower)

    # Grounded unknown skill MUST be preserved as lowercased string
    assert "toolx9000" in skills_lower

    # Hallucinated skills MUST be dropped
    assert "kubernetes" not in skills_lower
    assert "tensorflow quantum" not in skills_lower


# ============================================================================
# 3. Experience Intervals: Overlaps & 'Present'
# ============================================================================
def test_calculate_experience_overlapping_jobs():
    """
    Two overlapping jobs (2020-2022 and 2021-2023) must union to 3.0 years,
    preventing double-counting (not 4.0 years).
    """
    jobs = [
        WorkExperience(company="Alpha Inc", title="Developer", start_date="2020", end_date="2022"),
        WorkExperience(company="Beta LLC", title="Consultant", start_date="2021", end_date="2023"),
    ]
    total = calculate_experience_from_intervals(jobs)
    assert total == 3.0


def test_calculate_experience_present_current_job():
    """
    A job from Jan 2022 to 'Present' or is_current=True must compute experience
    accurately up to today's date.
    """
    job = WorkExperience(
        company="Omega Corp",
        title="Lead Engineer",
        start_date="2022-01-01",
        end_date="Present",
        is_current=True,
    )
    total = calculate_experience_from_intervals([job])
    # From 2022 to current year (>= 2024), duration must be at least 2.0 years
    assert total >= 2.0


def test_calculate_experience_no_dates_returns_zero():
    """Jobs without any parseable dates should return 0.0 without crashing."""
    job = WorkExperience(company="Acme", title="Intern", start_date=None, end_date=None)
    assert calculate_experience_from_intervals([job]) == 0.0


# ============================================================================
# 4. Phone Extraction: Strict Validation & Date Range Rejection
# ============================================================================
def test_extract_phone_rejects_calendar_year_ranges():
    """extract_phone must NOT mistake year ranges like '2020-2024' for phone numbers."""
    text_with_years = "Experience: Software Developer (2020-2024) at Acme Corp."
    assert extract_phone(text_with_years) is None

    text_with_slashed_dates = "Tenure: 2018/2022. Contact via email only."
    assert extract_phone(text_with_slashed_dates) is None


def test_extract_phone_accepts_valid_international_and_indian_numbers():
    """extract_phone properly extracts valid numbers."""
    text1 = "Rohit Agrawal | Mobile: +91 98765 43210 | Bangalore"
    phone1 = extract_phone(text1)
    assert phone1 is not None
    assert "9876543210" in phone1.replace(" ", "")

    text2 = "Contact: +1 650 253 0000 (US Office)"
    phone2 = extract_phone(text2)
    assert phone2 is not None


# ============================================================================
# 5. Portfolio Extraction: Header-Only Filtering
# ============================================================================
def test_portfolio_extracted_from_header_only():
    """
    URLs appearing only in project sections (> line 10) must NOT be captured
    as personal portfolio. Portfolio is only extracted from the first ~10 non-empty header lines.
    """
    resume_with_project_links_only = """
    John Smith
    Email: john@smith.com
    Phone: +91 98765 43210
    Location: Mumbai, India
    
    Summary:
    Passionate software architect with 5 years experience.
    
    Education:
    B.Tech Computer Science, IIT Bombay, 2019
    
    Projects:
    E-Commerce Microservices
    Built scalable checkout pipeline deployed at https://checkout-demo.vercel.app
    Source code at https://github.com/johnsmith/checkout
    """
    details = extract_contact_details(resume_with_project_links_only)
    assert details["portfolio"] is None
    assert details["github"] == "https://github.com/johnsmith/checkout"

    resume_with_header_portfolio = """
    John Smith
    Email: john@smith.com
    Portfolio: https://johnsmith.dev
    Phone: +91 98765 43210
    
    Experience:
    Developer at Tech (2021-2023)
    """
    details_header = extract_contact_details(resume_with_header_portfolio)
    assert details_header["portfolio"] == "https://johnsmith.dev"


# ============================================================================
# 6. Multi-Domain Tests (Software Engineer, Nurse, CA, Welder)
# ============================================================================
@pytest.mark.asyncio
async def test_multi_domain_software_engineer():
    resume_text = """
    Priya Sharma
    Email: priya.sharma@example.com | Phone: +91 98765 43210
    LinkedIn: linkedin.com/in/priyasharma | GitHub: github.com/priyasharma
    
    Experience:
    Backend Engineer at CloudScale Systems (2021 - 2024)
    Designed and deployed distributed REST APIs using Python, FastAPI, and PostgreSQL.
    
    Education:
    B.Tech in Computer Science, Delhi Technological University (2017 - 2021)
    
    Certifications:
    AWS Certified Solutions Architect
    
    Languages: English, Hindi
    """
    mock_llm_json = {
        "full_name": "Priya Sharma",
        "summary": "Backend engineer specializing in distributed systems.",
        "work_experience": [
            {
                "company": "CloudScale Systems",
                "title": "Backend Engineer",
                "start_date": "2021",
                "end_date": "2024",
                "description": "Designed and deployed distributed REST APIs.",
                "technologies": ["Python", "FastAPI", "PostgreSQL"],
            }
        ],
        "education": [
            {
                "institution": "Delhi Technological University",
                "degree": "B.Tech in Computer Science",
                "field_of_study": "Computer Science",
                "start_year": 2017,
                "end_year": 2021,
                "gpa": 8.5,
            }
        ],
        "projects": [],
        "certifications": [
            {
                "name": "AWS Certified Solutions Architect",
                "issuer": "Amazon Web Services",
                "issue_date": "2022",
                "credential_id": None,
            }
        ],
        "skills": ["Python", "FastAPI", "PostgreSQL", "REST APIs"],
    }

    parser = ParserService()
    with patch("services.parser_service._parse_resume_with_groq", new_callable=AsyncMock) as mock_groq:
        mock_groq.return_value = (mock_llm_json, False)
        parsed = await parser._structure_resume(resume_text)

    assert parsed.full_name == "Priya Sharma"
    assert parsed.contact_info.email == "priya.sharma@example.com"
    assert len(parsed.work_experience) == 1
    assert parsed.work_experience[0].company == "CloudScale Systems"
    assert len(parsed.education) == 1
    assert len(parsed.certifications) == 1
    assert parsed.total_experience_years == 3.0
    assert "English" in parsed.languages or "english" in [lang.lower() for lang in parsed.languages]
    assert "experience" in parsed.sections_detected
    assert "education" in parsed.sections_detected


@pytest.mark.asyncio
async def test_multi_domain_nurse():
    resume_text = """
    Sarah Jenkins, RN
    Email: s.jenkins@nursingcare.org | Phone: +1 415 555 2671
    
    Professional Summary:
    Registered Nurse with clinical expertise in emergency triage, patient monitoring, and medication administration.
    
    Clinical Experience:
    Staff Nurse at St. Jude Memorial Hospital (2019 - 2023)
    Administered critical emergency care, wound care, and electronic health records management.
    
    Education:
    Bachelor of Science in Nursing, Georgetown University (2015 - 2019)
    
    Certifications:
    Basic Life Support (BLS)
    Advanced Cardiovascular Life Support (ACLS)
    
    Languages:
    English, Spanish
    """
    mock_llm_json = {
        "full_name": "Sarah Jenkins",
        "summary": "Registered Nurse with clinical expertise in emergency triage.",
        "work_experience": [
            {
                "company": "St. Jude Memorial Hospital",
                "title": "Staff Nurse",
                "start_date": "2019",
                "end_date": "2023",
                "description": "Administered critical emergency care and wound care.",
                "technologies": ["Electronic Health Records"],
            }
        ],
        "education": [
            {
                "institution": "Georgetown University",
                "degree": "Bachelor of Science in Nursing",
                "field_of_study": "Nursing",
                "start_year": 2015,
                "end_year": 2019,
                "gpa": None,
            }
        ],
        "projects": [],
        "certifications": [
            {"name": "Basic Life Support (BLS)", "issuer": "AHA", "issue_date": "2020", "credential_id": None},
            {"name": "Advanced Cardiovascular Life Support (ACLS)", "issuer": "AHA", "issue_date": "2021", "credential_id": None},
        ],
        "skills": ["patient monitoring", "medication administration", "wound care", "triage"],
    }

    parser = ParserService()
    with patch("services.parser_service._parse_resume_with_groq", new_callable=AsyncMock) as mock_groq:
        mock_groq.return_value = (mock_llm_json, False)
        parsed = await parser._structure_resume(resume_text)

    assert parsed.full_name == "Sarah Jenkins"
    assert len(parsed.work_experience) == 1
    assert parsed.work_experience[0].company == "St. Jude Memorial Hospital"
    assert len(parsed.education) == 1
    assert len(parsed.certifications) == 2
    assert parsed.total_experience_years == 4.0
    assert "patient monitoring" in [s.lower() for s in parsed.skills]


@pytest.mark.asyncio
async def test_multi_domain_chartered_accountant():
    resume_text = """
    Rajesh Mehta, CA
    Email: rajesh.mehta@auditcorp.in | Phone: +91 98200 12345
    
    Profile:
    Chartered Accountant experienced in corporate statutory audit, direct taxation, and GST compliance.
    
    Employment:
    Senior Audit Associate at Deloitte Haskins & Sells (2018 - 2022)
    Conducted statutory audits for manufacturing clients under Ind AS and IFRS.
    
    Education:
    Chartered Accountancy, Institute of Chartered Accountants of India (2014 - 2018)
    B.Com, University of Mumbai (2011 - 2014)
    
    Certifications:
    DISA (ICAI)
    """
    mock_llm_json = {
        "full_name": "Rajesh Mehta",
        "summary": "Chartered Accountant experienced in corporate statutory audit.",
        "work_experience": [
            {
                "company": "Deloitte Haskins & Sells",
                "title": "Senior Audit Associate",
                "start_date": "2018",
                "end_date": "2022",
                "description": "Conducted statutory audits under Ind AS and IFRS.",
                "technologies": ["SAP", "Tally"],
            }
        ],
        "education": [
            {
                "institution": "Institute of Chartered Accountants of India",
                "degree": "Chartered Accountancy",
                "field_of_study": "Accounting and Finance",
                "start_year": 2014,
                "end_year": 2018,
                "gpa": None,
            },
            {
                "institution": "University of Mumbai",
                "degree": "B.Com",
                "field_of_study": "Commerce",
                "start_year": 2011,
                "end_year": 2014,
                "gpa": None,
            },
        ],
        "projects": [],
        "certifications": [
            {"name": "DISA (ICAI)", "issuer": "ICAI", "issue_date": "2019", "credential_id": None}
        ],
        "skills": ["statutory audit", "direct taxation", "gst compliance", "ifrs", "ind as"],
    }

    parser = ParserService()
    with patch("services.parser_service._parse_resume_with_groq", new_callable=AsyncMock) as mock_groq:
        mock_groq.return_value = (mock_llm_json, False)
        parsed = await parser._structure_resume(resume_text)

    assert parsed.full_name == "Rajesh Mehta"
    assert len(parsed.work_experience) == 1
    assert parsed.work_experience[0].company == "Deloitte Haskins & Sells"
    assert len(parsed.education) == 2
    assert len(parsed.certifications) == 1
    assert parsed.total_experience_years == 4.0


@pytest.mark.asyncio
async def test_multi_domain_welder():
    resume_text = """
    Marcus Vance
    Email: marcus.vance@metalworks.com | Phone: +1 312 555 8899
    
    Summary:
    Journeyman Welder with 6 years experience in MIG, TIG, and Shielded Metal Arc Welding (SMAW).
    
    Work History:
    Structural Welder at Apex Industrial Fabricators (2017 - 2023)
    Fabricated heavy structural steel beams according to blueprints and AWS D1.1 standards.
    
    Education:
    Vocational Diploma in Welding Technology, Lincoln Technical Institute (2015 - 2017)
    
    Certifications:
    AWS Certified Welder (SMAW / GMAW)
    OSHA 30 Construction Safety
    """
    mock_llm_json = {
        "full_name": "Marcus Vance",
        "summary": "Journeyman Welder with 6 years experience in MIG, TIG, and SMAW.",
        "work_experience": [
            {
                "company": "Apex Industrial Fabricators",
                "title": "Structural Welder",
                "start_date": "2017",
                "end_date": "2023",
                "description": "Fabricated heavy structural steel beams according to blueprints.",
                "technologies": ["MIG", "TIG", "SMAW"],
            }
        ],
        "education": [
            {
                "institution": "Lincoln Technical Institute",
                "degree": "Vocational Diploma in Welding Technology",
                "field_of_study": "Welding",
                "start_year": 2015,
                "end_year": 2017,
                "gpa": None,
            }
        ],
        "projects": [],
        "certifications": [
            {"name": "AWS Certified Welder", "issuer": "AWS", "issue_date": "2018", "credential_id": None},
            {"name": "OSHA 30 Construction Safety", "issuer": "OSHA", "issue_date": "2017", "credential_id": None},
        ],
        "skills": ["mig welding", "tig welding", "smaw", "blueprints", "structural steel"],
    }

    parser = ParserService()
    with patch("services.parser_service._parse_resume_with_groq", new_callable=AsyncMock) as mock_groq:
        mock_groq.return_value = (mock_llm_json, False)
        parsed = await parser._structure_resume(resume_text)

    assert parsed.full_name == "Marcus Vance"
    assert len(parsed.work_experience) == 1
    assert parsed.work_experience[0].company == "Apex Industrial Fabricators"
    assert len(parsed.education) == 1
    assert len(parsed.certifications) == 2
    assert parsed.total_experience_years == 6.0
    assert "experience" in parsed.sections_detected
    assert "education" in parsed.sections_detected
    assert "certifications" in parsed.sections_detected


# ============================================================================
# 7. Unit Tests for the 6 Critical Fixes
# ============================================================================
def test_fix_1_detect_skills_caching_speed():
    """Fix 1: detect_skills_in_text reuses global cached matcher and skill list."""
    from utils.nlp_utils import detect_skills_in_text, _get_cached_tech_skills_and_matcher
    skills1, matcher1 = _get_cached_tech_skills_and_matcher()
    skills2, matcher2 = _get_cached_tech_skills_and_matcher()
    assert skills1 is skills2
    assert matcher1 is matcher2

    res1_tech, res1_soft = detect_skills_in_text("Experienced Python and FastAPI backend engineer.")
    res2_tech, res2_soft = detect_skills_in_text("Experienced Python and FastAPI backend engineer.")
    assert "python" in res1_tech
    assert "fastapi" in res1_tech
    assert res1_tech == res2_tech


def test_fix_3_grounding_whole_word_boundary():
    """Fix 3: Grounding must match whole-word boundary so 'Java' != 'JavaScript' and 'C' != 'Docker'."""
    raw_norm = _norm("Frontend developer skilled in JavaScript, Docker, and React.")

    # 'Java' is a substring of 'JavaScript', but NOT a whole word -> must return False
    assert not _grounded(raw_norm, "Java", ratio=1.0)

    # 'C' or 'R' are substrings of Docker/React, but NOT standalone tokens -> must return False
    assert not _grounded(raw_norm, "C", ratio=1.0)
    assert not _grounded(raw_norm, "R", ratio=1.0)

    # Whole words present in text -> must return True
    assert _grounded(raw_norm, "JavaScript", ratio=1.0)
    assert _grounded(raw_norm, "Docker", ratio=1.0)
    assert _grounded(raw_norm, "React", ratio=1.0)

    # Check standalone C when actually present
    raw_norm_with_c = _norm("Systems programmer with C, C++, and Linux expertise.")
    assert _grounded(raw_norm_with_c, "C", ratio=1.0)
    assert _grounded(raw_norm_with_c, "C++", ratio=1.0)
    assert _grounded(raw_norm_with_c, "Linux", ratio=1.0)


@pytest.mark.asyncio
async def test_fix_4_technologies_in_work_and_project_are_grounded():
    """Fix 4: Hallucinated technologies in work_experience and projects must be dropped."""
    resume_text = """
    Liam Smith
    Email: liam@example.com | Phone: +1 555 123 4567
    
    Work Experience:
    Senior Developer at Acme Corp (2020 - 2023)
    Built backend microservices using Python and PostgreSQL.
    
    Projects:
    Analytics Dashboard (2022)
    Created dashboard using Redis for high throughput.
    """
    mock_llm_json = {
        "full_name": "Liam Smith",
        "work_experience": [
            {
                "company": "Acme Corp",
                "title": "Senior Developer",
                "start_date": "2020",
                "end_date": "2023",
                "description": "Built backend microservices.",
                # 'Kubernetes' and 'AWS' are hallucinated (not in resume text)
                "technologies": ["Python", "PostgreSQL", "Kubernetes", "AWS"],
            }
        ],
        "education": [],
        "projects": [
            {
                "name": "Analytics Dashboard",
                "description": "Created dashboard.",
                # 'GraphQL' is hallucinated (not in resume text)
                "technologies": ["Redis", "GraphQL"],
            }
        ],
        "certifications": [],
        "skills": ["Python"],
    }

    parser = ParserService()
    with patch("services.parser_service._parse_resume_with_groq", new_callable=AsyncMock) as mock_groq:
        mock_groq.return_value = (mock_llm_json, False)
        parsed = await parser._structure_resume(resume_text)

    # Work experience technologies: only Python and PostgreSQL must remain
    work_techs = parsed.work_experience[0].technologies
    assert "Python" in work_techs
    assert "PostgreSQL" in work_techs
    assert "Kubernetes" not in work_techs
    assert "AWS" not in work_techs

    # Project technologies: only Redis must remain
    proj_techs = parsed.projects[0].technologies
    assert "Redis" in proj_techs
    assert "GraphQL" not in proj_techs

    # Hallucinated skills must NOT leak into all_skills
    assert "kubernetes" not in parsed.skills
    assert "aws" not in parsed.skills
    assert "graphql" not in parsed.skills


@pytest.mark.asyncio
async def test_fix_5_freelance_and_self_employed_jobs_retained():
    """Fix 5: Freelance or self-employed job is kept if either title OR company is grounded."""
    resume_text = """
    Elena Rostova
    Email: elena@freelance.org | Phone: +1 202 555 0199
    
    Experience:
    Freelance UI/UX Designer (2021 - Present)
    Designed mobile apps and web design systems for multiple startup clients.
    """
    mock_llm_json = {
        "full_name": "Elena Rostova",
        "work_experience": [
            {
                "company": "",  # Empty company for freelance
                "title": "Freelance UI/UX Designer",
                "start_date": "2021",
                "end_date": "Present",
                "description": "Designed mobile apps and web design systems.",
                "technologies": ["Figma"],
                "is_current": True,
            }
        ],
        "education": [],
        "projects": [],
        "certifications": [],
        "skills": ["UI/UX Designer", "Figma"],
    }

    parser = ParserService()
    with patch("services.parser_service._parse_resume_with_groq", new_callable=AsyncMock) as mock_groq:
        mock_groq.return_value = (mock_llm_json, False)
        parsed = await parser._structure_resume(resume_text)

    assert len(parsed.work_experience) == 1
    job = parsed.work_experience[0]
    assert job.title == "Freelance UI/UX Designer"
    assert job.company == "Freelance / Self-Employed"
    assert job.is_current is True


@pytest.mark.asyncio
async def test_fix_2_normalize_skill_none_or_empty_does_not_crash_sorted():
    """Fix 2: normalize_skill returning None or empty string must not cause sorted() TypeError."""
    resume_text = """
    Dev User
    Email: dev@test.com | Phone: +1 415 555 0100
    Experience:
    Software Engineer at Tech Inc (2022 - 2023)
    Used Python.
    """
    mock_llm_json = {
        "full_name": "Dev User",
        "work_experience": [
            {
                "company": "Tech Inc",
                "title": "Software Engineer",
                "start_date": "2022",
                "end_date": "2023",
                "description": "Used Python.",
                "technologies": ["Python"],
            }
        ],
        "education": [],
        "projects": [],
        "certifications": [],
        "skills": ["Python"],
    }

    parser = ParserService()
    # Mock normalize_skill to return None and "" to test crash resistance
    with patch("services.parser_service._parse_resume_with_groq", new_callable=AsyncMock) as mock_groq, \
         patch("services.parser_service.normalize_skill", return_value=None):
        mock_groq.return_value = (mock_llm_json, False)
        parsed = await parser._structure_resume(resume_text)

    assert parsed.full_name == "Dev User"
    assert isinstance(parsed.skills, list)
    assert all(isinstance(s, str) for s in parsed.skills)


@pytest.mark.asyncio
async def test_fix_6_groq_failure_graceful_fallback():
    """Fix 6: When Groq fails after retries, return Python parsed contacts & ESCO skills with auto_fill_failed=True."""
    resume_text = """
    Siddharth Rao
    Email: siddharth.rao@example.com
    Phone: +91 98765 43210
    LinkedIn: linkedin.com/in/siddharthrao
    GitHub: github.com/siddharthrao
    
    Experienced Python and FastAPI backend developer.
    Fluent in English and Hindi.
    """
    parser = ParserService()

    # Mock _parse_resume_with_groq returning failure payload (as returned when attempts exhaust)
    failed_payload = {"_auto_fill_failed": True, "_error": "Groq API rate limit or key exhaustion"}
    with patch("services.parser_service._parse_resume_with_groq", new_callable=AsyncMock) as mock_groq:
        mock_groq.return_value = (failed_payload, False)
        parsed = await parser._structure_resume(resume_text)

    # Must NOT raise exception, must set auto_fill_failed=True
    assert parsed.auto_fill_failed is True
    # Pure Python contacts extracted deterministically
    assert parsed.contact_info.email == "siddharth.rao@example.com"
    assert parsed.contact_info.phone is not None and "98765" in parsed.contact_info.phone
    assert parsed.contact_info.linkedin is not None
    assert isinstance(parsed.skills, list)
    # Languages is list
    assert isinstance(parsed.languages, list)


@pytest.mark.asyncio
async def test_fix_7_llm_soft_skills_and_languages_grounding():
    """Fix 7: LLM extracts soft_skills and languages directly; Python strictly grounds and filters hallucinations."""
    resume_text = """
    Aarav Patel
    Email: aarav@example.com | Phone: +91 91234 56789
    
    Technical Proficiencies:
    Python, FastAPI, Docker
    
    Competencies & Soft Skills:
    Cross-functional team leadership, conflict resolution
    
    Languages:
    English, German
    """
    mock_llm_json = {
        "full_name": "Aarav Patel",
        "technical_skills": ["Python", "FastAPI", "Docker"],
        "soft_skills": [
            "Cross-functional team leadership",
            "Conflict resolution",
            "Time travel",  # Hallucinated!
        ],
        "languages": ["English", "German", "Japanese"],  # Japanese is hallucinated!
        "work_experience": [],
        "education": [],
        "projects": [],
        "certifications": [],
    }

    parser = ParserService()
    with patch("services.parser_service._parse_resume_with_groq", new_callable=AsyncMock) as mock_groq:
        mock_groq.return_value = (mock_llm_json, False)
        parsed = await parser._structure_resume(resume_text)

    # Technical skills grounded
    assert "python" in parsed.technical_skills
    assert "fastapi" in parsed.technical_skills
    assert "docker" in parsed.technical_skills

    # Soft skills grounded from LLM without needing hardcoded 15-word set
    assert "conflict resolution" in parsed.soft_skills
    assert "cross-functional team leadership" in parsed.soft_skills
    assert "time travel" not in parsed.soft_skills

    # Languages grounded from LLM
    assert "English" in parsed.languages
    assert "German" in parsed.languages
    assert "Japanese" not in parsed.languages


