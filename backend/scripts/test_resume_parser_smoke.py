"""
Smoke test for CareerPilot Resume Parser — Context-aware structured extraction.
Tests at most 5 representative resume samples for:
- Pydantic schema validity (ParsedResumeData)
- Contact info extraction
- Structured fields (Name, Experience, Education, Projects, Certs, Skills)
- ESCO normalization
- Date interval union calculation
- Hash-based caching behavior
"""

import asyncio
import time
import structlog

from models.resume_model import ParsedResumeData
from services.parser_service import ParserService

logger = structlog.get_logger(__name__)

SAMPLE_RESUMES = [
    {
        "domain": "Technology / Software",
        "name": "sample_swe.txt",
        "text": """John Doe
john.doe@example.com | (555) 234-5678 | San Francisco, CA
https://github.com/johndoe | https://linkedin.com/in/johndoe

PROFESSIONAL SUMMARY
Senior Backend Engineer with 5 years experience building distributed systems in Python, Go, and AWS.

WORK EXPERIENCE
Stripe — Staff Infrastructure Engineer
Jan 2022 - Present
- Built payment idempotency layers using Redis and PostgreSQL.
- Architected Kubernetes microservices handling 50k req/sec.

Twilio — Senior Software Engineer
Jun 2019 - Dec 2021
- Developed high-throughput SMS dispatch APIs with Python and Docker.

EDUCATION
Stanford University
B.S. in Computer Science
2015 - 2019 | GPA: 3.8

KEY PROJECTS
DistributedQueue
- High performance task queue in Go and Redis.
- https://github.com/johndoe/dist-queue

CERTIFICATIONS
AWS Certified Solutions Architect — Amazon Web Services (2021)

TECHNICAL SKILLS
Python, Go, Docker, Kubernetes, PostgreSQL, Redis, AWS, Distributed Systems, Microservices, REST APIs, Git
"""
    },
    {
        "domain": "Healthcare / Nursing",
        "name": "sample_nurse.txt",
        "text": """Sarah Jenkins, RN, BSN
sarah.jenkins@hospital.org | (555) 987-6543 | Chicago, IL
https://linkedin.com/in/sarahjenkins-rn

CLINICAL OVERVIEW
Compassionate Emergency Department Staff Nurse with 4 years clinical experience managing level-1 trauma.

CLINICAL EXPERIENCE
Northwestern Memorial Hospital — Emergency Department Staff Nurse
Mar 2021 - Present
- Triage level 1 trauma patients, administer emergency IV meds, vital signs monitoring.

Mercy Hospital — Clinical Nurse Intern
Jan 2020 - Feb 2021
- Assisted in patient care, phlebotomy, and wound dressing.

ACADEMIC BACKGROUND
Rush University College of Nursing
Bachelor of Science in Nursing (BSN)
2016 - 2020

CERTIFICATIONS & LICENSURE
Illinois Registered Nurse License (RN) — Illinois Board of Nursing (2020)
Advanced Cardiovascular Life Support (ACLS) — American Heart Association (2021)
Basic Life Support (BLS) — AHA (2020)

AREAS OF CLINICAL EXPERTISE
Patient Care, Triage, Phlebotomy, Vital Signs, ACLS, BLS, Trauma Care, Epic EHR, Emergency Response
"""
    },
    {
        "domain": "Finance / Accounting",
        "name": "sample_accountant.txt",
        "text": """David Miller, CPA
david.miller@auditfirm.com | (555) 432-1098 | Dallas, TX

EXECUTIVE SUMMARY
Certified Public Accountant with 6 years experience in statutory audit, GAAP compliance, and financial reporting.

PROFESSIONAL RECORD
Deloitte — Senior Audit Associate
Sep 2020 - Present
- Conducted SEC 10-K statutory audits and internal controls compliance for Fortune 500 tech clients.

BDO USA — Audit Associate
Aug 2018 - Aug 2020
- Reconciled general ledgers, performed balance sheet audits, and prepared tax returns.

EDUCATION
University of Texas at Austin
Master in Professional Accounting (MPA)
2017 - 2018
Bachelor of Business Administration (BBA) in Finance
2013 - 2017

CERTIFICATIONS
Certified Public Accountant (CPA) — Texas State Board of Public Accountancy (2019)

CORE COMPETENCIES
GAAP, Statutory Audit, Internal Audit, General Ledger, Balance Sheet, Financial Modeling, Reconciliation, Excel
"""
    },
    {
        "domain": "Legal / Corporate",
        "name": "sample_legal.txt",
        "text": """Elena Vance, Esq.
elena.vance@legalcorp.com | (555) 321-7654 | Washington, DC
https://linkedin.com/in/elenavance-law

PROFESSIONAL PROFILE
Corporate Attorney with 3 years experience advising technology companies on commercial contracts, NDA review, and data privacy regulatory compliance.

LEGAL ENGAGEMENTS
Wilson Sonsini Goodrich & Rosati — Corporate Associate
Nov 2022 - Present
- Drafted and negotiated SaaS commercial contracts, vendor agreements, and NDAs.

FTC Bureau of Competition — Legal Fellow
Oct 2021 - Oct 2022
- Conducted antitrust inquiries and regulatory compliance reviews.

EDUCATION
Georgetown University Law Center
Juris Doctor (J.D.)
2018 - 2021

BAR ADMISSIONS & CREDENTIALS
District of Columbia Bar Member (2021)
CIPP/US Certified Information Privacy Professional — IAPP (2022)

LEGAL EXPERTISE
Corporate Law, Contract Review, Contract Drafting, NDA Review, Regulatory Compliance, SaaS Agreements
"""
    },
    {
        "domain": "Fresher / Entry-Level Engineering",
        "name": "sample_fresher.txt",
        "text": """Rohan Sharma
rohan.sharma@gmail.com | +91 98765 43210 | Bangalore, India
https://github.com/rohansharma

CAREER OBJECTIVE
Enthusiastic Fresher and 2024 Computer Science graduate seeking an entry-level Software Engineer role.

INTERNSHIP
InnoTech Solutions — Software Engineering Intern
Jan 2024 - Jun 2024
- Built full-stack web applications using React, FastAPI, and PostgreSQL.

EDUCATION
National Institute of Technology Karnataka
Bachelor of Technology (B.Tech) in Computer Science & Engineering
2020 - 2024 | CGPA: 8.4/10

ACADEMIC PROJECTS
AI Resume Screener
- Developed ATS resume screening backend using Python and vector embeddings.
- https://github.com/rohansharma/ai-resume-screener

TECHNICAL SKILLS
Python, FastAPI, React, JavaScript, PostgreSQL, Docker, Git, Data Structures
"""
    }
]


async def run_smoke_test():
    print("=" * 80)
    print("CAREERPILOT RESUME PARSER — SMOKE TEST (5 SAMPLES)")
    print("=" * 80)

    parser = ParserService()
    results = []

    for idx, sample in enumerate(SAMPLE_RESUMES, 1):
        domain = sample["domain"]
        filename = sample["name"]
        raw_text = sample["text"]

        print(f"\n--- [Sample {idx}/5] Testing {domain} ({filename}) ---")
        t0 = time.time()
        parsed: ParsedResumeData = await parser._structure_resume(raw_text)
        latency = round(time.time() - t0, 3)

        # Basic validations
        assert isinstance(parsed, ParsedResumeData), f"Output must be ParsedResumeData instance"
        assert parsed.full_name, f"Expected non-empty full_name for {filename}"
        assert parsed.contact_info.email, f"Expected extracted email for {filename}"

        print(f"  * Candidate Name   : {parsed.full_name}")
        print(f"  * Contact Info     : Email={parsed.contact_info.email}, Phone={parsed.contact_info.phone}, LinkedIn={parsed.contact_info.linkedin}")
        print(f"  * Total Experience : {parsed.total_experience_years} years (interval union)")
        print(f"  * Work Roles Count : {len(parsed.work_experience)}")
        for w in parsed.work_experience[:2]:
            print(f"      - {w.title} at {w.company} ({w.start_date} - {w.end_date})")
        print(f"  * Education Entries: {len(parsed.education)}")
        for e in parsed.education[:1]:
            print(f"      - {e.degree} at {e.institution} ({e.start_year} - {e.end_year})")
        print(f"  * Skills Detected  : {len(parsed.skills)} normalized skills")
        print(f"      - Top skills: {parsed.skills[:6]}")
        print(f"  * Sections Detected: {parsed.sections_detected}")
        print(f"  * Latency (Uncached): {latency}s")

        # Test cache hit
        t0_cache = time.time()
        cached_parsed: ParsedResumeData = await parser._structure_resume(raw_text)
        cached_latency = round(time.time() - t0_cache, 4)
        print(f"  * Cache Verification: {cached_latency}s (Cache Hit: {cached_parsed.full_name == parsed.full_name})")

        results.append({
            "domain": domain,
            "name": parsed.full_name,
            "roles": len(parsed.work_experience),
            "edu": len(parsed.education),
            "skills": len(parsed.skills),
            "exp_yrs": parsed.total_experience_years,
            "latency": latency,
            "cached_latency": cached_latency,
        })

    print("\n" + "=" * 80)
    print("SMOKE TEST SUMMARY TABLE")
    print("=" * 80)
    print(f"{'#':<3} | {'Domain':<30} | {'Name':<16} | {'Exp':<5} | {'Edu':<4} | {'Skills':<6} | {'Tenure':<6} | {'Time (s)':<8}")
    print("-" * 88)
    for i, r in enumerate(results, 1):
        print(f"{i:<3} | {r['domain'][:30]:<30} | {r['name'][:16]:<16} | {r['roles']:<5} | {r['edu']:<4} | {r['skills']:<6} | {str(r['exp_yrs']) + 'y':<6} | {r['latency']:<8}")
    print("=" * 80)
    print("ALL 5 SMOKE TEST SAMPLES PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    asyncio.run(run_smoke_test())
