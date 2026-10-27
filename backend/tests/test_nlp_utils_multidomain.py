"""
Comprehensive tests for CareerPilot's Multi-Domain NLP Extraction Utilities (nlp_utils.py).
Tests Tech, Healthcare, Finance, Legal, contact parsing, experience calculations, and section detection.
"""

from utils.nlp_utils import (
    clean_text,
    detect_skills_in_text,
    extract_email,
    extract_phone,
    extract_urls,
    extract_sections,
    extract_years_of_experience,
    extract_name,
)


class TestNLPTextCleaning:
    def test_clean_text_basic(self):
        raw = "  Hello   WORLD!! Check http://example.com/test for more info.  "
        cleaned = clean_text(raw)
        assert "http" not in cleaned
        assert "hello world" in cleaned

    def test_clean_text_stopwords(self):
        raw = "This is a simple test of the text cleaning pipeline."
        cleaned = clean_text(raw)
        assert "this is a simple test" in cleaned
        assert "pipeline" in cleaned

    def test_clean_text_empty_and_none(self):
        assert clean_text("") == ""
        assert clean_text(None) == ""


class TestMultiDomainSkillDetection:
    def test_tech_skills_detection(self):
        text = "Built backend microservices using Python, FastAPI, Docker, and PostgreSQL on AWS."
        tech, soft = detect_skills_in_text(text)
        assert "python" in tech
        assert "fastapi" in tech
        assert "docker" in tech
        assert "postgresql" in tech
        assert "aws" in tech

    def test_special_characters_skills(self):
        text = "Expert in C++, C#, .NET, Go, and R programming with SQL backend."
        tech, _ = detect_skills_in_text(text)
        assert "c++" in tech
        assert "c#" in tech
        assert "sql" in tech

    def test_healthcare_clinical_skills_detection(self):
        text = "Registered nurse experienced in patient care, triage, vital signs, and phlebotomy procedures. Certified in ACLS and BLS."
        tech, _ = detect_skills_in_text(text)
        assert "triage" in tech
        assert "vital signs" in tech
        assert "phlebotomy" in tech
        assert "acls" in tech
        assert "patient care" in tech

    def test_finance_and_accounting_skills_detection(self):
        text = "Senior Accountant with deep knowledge of GAAP, statutory audit, internal audit, and balance sheet reconciliation."
        tech, _ = detect_skills_in_text(text)
        assert "gaap" in tech
        assert "statutory audit" in tech
        assert "internal audit" in tech
        assert "balance sheet" in tech

    def test_legal_and_compliance_skills_detection(self):
        text = "Corporate counsel handling contract review, NDA review, compliance, and corporate law matters."
        tech, _ = detect_skills_in_text(text)
        assert "contract review" in tech
        assert "compliance" in tech
        assert "corporate law" in tech

    def test_soft_skills_detection(self):
        text = "Demonstrated strong leadership, teamwork, problem solving, and effective communication skills."
        _, soft = detect_skills_in_text(text)
        assert "leadership" in soft
        assert "teamwork" in soft
        assert "problem solving" in soft
        assert "communication" in soft

    def test_empty_and_malformed_input(self):
        assert detect_skills_in_text("") == ([], [])
        assert detect_skills_in_text("   ") == ([], [])
        assert detect_skills_in_text(None) == ([], [])


class TestContactInfoExtraction:
    def test_extract_email_standard(self):
        assert extract_email("Reach out at john.doe@example.com") == "john.doe@example.com"

    def test_extract_email_subdomain_and_plus(self):
        assert extract_email("Contact nurse at sarah.smith+ward@hospital.nhs.co.uk today") == "sarah.smith+ward@hospital.nhs.co.uk"

    def test_extract_email_none(self):
        assert extract_email("No email present in this resume snippet") is None
        assert extract_email("") is None

    def test_extract_phone_international(self):
        assert extract_phone("Mobile: +1 (555) 345-6789") is not None
        assert extract_phone("India: +91 98765 43210") is not None
        assert extract_phone("UK: +44 20 7946 0958") is not None

    def test_extract_phone_none(self):
        assert extract_phone("No contact number given here") is None
        assert extract_phone("") is None

    def test_extract_urls(self):
        text = "Profile: https://linkedin.com/in/johndoe, code: github.com/johndoe/repo, portfolio: www.johndoe.dev"
        urls = extract_urls(text)
        assert len(urls) >= 3

    def test_extract_name_standard(self):
        resume_text = "John Doe\njohn.doe@email.com\n(555) 123-4567\nSummary:\nSoftware engineer..."
        assert extract_name(resume_text) == "John Doe"

    def test_extract_name_with_prefix(self):
        resume_text = "Curriculum Vitae\nAlice Developer\nalice@example.com"
        assert extract_name(resume_text) == "Alice Developer"

    def test_extract_name_mononym(self):
        resume_text = "Kavitha\nkavitha@example.com\nBangalore, India"
        assert extract_name(resume_text) == "Kavitha"

    def test_extract_name_none(self):
        assert extract_name("") is None
        assert extract_name(None) is None


class TestExperienceExtraction:
    def test_experience_standard_tenures(self):
        assert extract_years_of_experience("5 years of experience in software engineering") == 5.0
        assert extract_years_of_experience("3+ years of clinical experience in triage") == 3.0
        assert extract_years_of_experience("Over 7 years of work experience as CA") == 7.0

    def test_experience_range(self):
        assert extract_years_of_experience("2-4 years of experience with React") == 2.0
        assert extract_years_of_experience("3 to 5 years experience required") == 3.0

    def test_experience_fresher_zero(self):
        assert extract_years_of_experience("Looking for Freshers with Python knowledge") == 0.0
        assert extract_years_of_experience("Entry level developer (0-1 years of experience)") == 0.0
        assert extract_years_of_experience("No prior experience required for this role") == 0.0

    def test_experience_date_years_not_confused(self):
        text = "Worked at Acme Corp from 2020 to 2024. Total 4 years of experience."
        assert extract_years_of_experience(text) == 4.0


class TestSectionDetection:
    def test_tech_section_detection(self):
        text = """John Doe
SUMMARY
Experienced full-stack software engineer.
WORK EXPERIENCE
Software Engineer at Acme Corp (2021-Present)
Built scalable APIs in FastAPI.
EDUCATION
B.S. in Computer Science, Stanford
SKILLS
Python, Docker, SQL, Git"""
        sections = extract_sections(text)
        assert "summary" in sections
        assert "experience" in sections
        assert "education" in sections
        assert "skills" in sections

    def test_healthcare_section_detection(self):
        text = """Sarah Jenkins, RN
PROFESSIONAL SUMMARY
ICU and emergency triage nurse with 4 years tenure.
CLINICAL ROTATIONS
St. Jude Hospital - Acute Care & Trauma
LICENSURE & CREDENTIALS
Registered Nurse (RN) License #987654
Advanced Cardiac Life Support (ACLS)
CLINICAL SKILLS
Phlebotomy, Triage, Vital Signs Monitoring, ACLS"""
        sections = extract_sections(text)
        assert "summary" in sections
        assert "experience" in sections
        assert "certifications" in sections
        assert "skills" in sections

    def test_finance_section_detection(self):
        text = """David Miller
CAREER SUMMARY
Financial analyst specializing in statutory auditing and compliance.
EMPLOYMENT HISTORY
Senior Auditor at KPMG (2018-2023)
ACADEMIC BACKGROUND
Master of Commerce, Accounting
PROFESSIONAL CERTIFICATIONS
Certified Public Accountant (CPA)
CORE COMPETENCIES
GAAP, Statutory Audit, Financial Reporting"""
        sections = extract_sections(text)
        assert "summary" in sections
        assert "experience" in sections
        assert "education" in sections
        assert "certifications" in sections
        assert "skills" in sections
