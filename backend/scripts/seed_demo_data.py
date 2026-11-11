"""
CareerShala — One-Click Demo Data & Recruiter Evaluation Seeder
Populates demo users, diverse tech job listings, and sample parsed resume data.

Usage:
    cd backend
    python scripts/seed_demo_data.py
    
    # Automatically connects to PostgreSQL configured in .env
    # python scripts/seed_demo_data.py
"""

import argparse
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

# Ensure utf-8 encoding on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add parent directory to sys.path so backend modules can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.db import connect_db, disconnect_db
from core.config import settings
from core.security import hash_password


DEMO_USERS = [
    {
        "email": "candidate@careershala.com",
        "plain_pass": "Candidate123!",
        "full_name": "Alex Carter (Candidate Demo)",
        "role": "candidate",
        "roles": ["candidate"],
        "status": "active",
        "email_verified": True,
        "plan": "pro",
        "subscription_active": True,
        "subscription_status": "active",
        "phone": "+1-555-0199",
        "github_username": "alexcarter-dev",
        "linkedin_url": "https://linkedin.com/in/alexcarter-demo",
        "total_resumes": 1,
        "total_ats_checks": 4,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    },
    {
        "email": "recruiter@careershala.com",
        "plain_pass": "Recruiter123!",
        "full_name": "Sarah Jenkins (Talent Lead)",
        "role": "recruiter",
        "roles": ["recruiter"],
        "status": "active",
        "email_verified": True,
        "tenant_id": "tenant_careershala_talent",
        "company_name": "CareerShala Cloud Technologies",
        "plan": "enterprise",
        "subscription_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    },
    {
        "email": "admin@careershala.com",
        "plain_pass": "Admin123!",
        "full_name": "System Administrator",
        "role": "platform_admin",
        "roles": ["platform_admin"],
        "status": "active",
        "email_verified": True,
        "plan": "enterprise",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    },
]

DEMO_JOBS = [
    {
        "title": "Graduate Junior Python Developer (Fresher)",
        "company": "NextGen Systems",
        "location": "Bengaluru, India (Hybrid)",
        "job_type": "Full-time",
        "experience_level": "Fresher",
        "experience_min": 0,
        "experience_max": 1,
        "is_fresher": True,
        "skills": ["python", "fastapi", "sql", "git", "rest api", "docker"],
        "description": "We are seeking ambitious fresh graduates with strong core Python foundation, algorithmic thinking, and familiarity with FastAPI or Django to join our backend infrastructure team.",
        "salary_range": "INR 6,00,000 - 9,00,000 / year",
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    },
    {
        "title": "Junior Frontend Engineer (Fresher / 0-1 yr)",
        "company": "PixelCraft Studios",
        "location": "Remote",
        "job_type": "Full-time",
        "experience_level": "Fresher",
        "experience_min": 0,
        "experience_max": 1,
        "is_fresher": True,
        "skills": ["react", "javascript", "tailwind css", "html5", "css3", "git"],
        "description": "Exciting opening for passionate junior and fresher frontend web developers with hands-on React and modern CSS skills. Build sleek user interfaces and high-performance interactive dashboards.",
        "salary_range": "INR 5,50,000 - 8,50,000 / year",
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    },
    {
        "title": "AI / Machine Learning Engineer (BGE & RAG Pipelines)",
        "company": "Cognitive Cloud AI",
        "location": "Hyderabad, India (Hybrid)",
        "job_type": "Full-time",
        "experience_level": "Mid-Level",
        "experience_min": 2,
        "experience_max": 5,
        "is_fresher": False,
        "skills": ["python", "pytorch", "huggingface", "vector search", "postgresql", "fastapi", "langchain"],
        "description": "Design and deploy low-latency semantic search architectures, BGE-M3 embeddings, cross-encoder re-ranking, and retrieval-augmented generation (RAG) agents for high-scale enterprise applications.",
        "salary_range": "INR 18,00,000 - 28,00,000 / year",
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    },
    {
        "title": "Full Stack Software Engineer (React + FastAPI)",
        "company": "HyperScale Labs",
        "location": "Remote (Global)",
        "job_type": "Full-time",
        "experience_level": "Mid-Level",
        "experience_min": 2,
        "experience_max": 5,
        "is_fresher": False,
        "skills": ["react", "fastapi", "python", "postgresql", "redis", "docker", "tailwind css"],
        "description": "Join our fast-growing core product team. Own full product lifecycles across modern React SPA frontends and high-concurrency asynchronous Python microservices.",
        "salary_range": "$80,000 - $110,000 / year",
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    },
    {
        "title": "Senior Cloud & DevOps Engineer",
        "company": "AeroGrid Infrastructure",
        "location": "Pune, India (Hybrid)",
        "job_type": "Full-time",
        "experience_level": "Senior",
        "experience_min": 5,
        "experience_max": 9,
        "is_fresher": False,
        "skills": ["docker", "kubernetes", "aws", "terraform", "ci/cd", "linux", "prometheus"],
        "description": "Lead the modernization of multi-cloud Kubernetes clusters, automated zero-downtime deployment pipelines, system monitoring, and high-availability distributed state layers.",
        "salary_range": "INR 26,00,000 - 40,00,000 / year",
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    },
    {
        "title": "Associate Software Engineer - Campus Hire 2026",
        "company": "Zenith FinTech",
        "location": "Bengaluru, India",
        "job_type": "Full-time",
        "experience_level": "Fresher",
        "experience_min": 0,
        "experience_max": 1,
        "is_fresher": True,
        "skills": ["java", "python", "sql", "data structures", "algorithms", "problem solving"],
        "description": "Open to fresh college graduates (B.Tech / MCA / M.Sc). Work on high-throughput transactional payment systems, core databases, and microservices architecture.",
        "salary_range": "INR 7,50,000 - 11,00,000 / year",
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    },
    {
        "title": "Frontend UI/UX Developer",
        "company": "Aura Design Systems",
        "location": "Remote",
        "job_type": "Full-time",
        "experience_level": "Entry-Level",
        "experience_min": 1,
        "experience_max": 3,
        "is_fresher": False,
        "skills": ["react", "typescript", "tailwind css", "figma", "framer motion"],
        "description": "Translate rich UI prototypes into accessible, micro-animated, and state-of-the-art web components with Tailwind CSS and Framer Motion.",
        "salary_range": "INR 9,00,000 - 14,00,000 / year",
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    },
    {
        "title": "Data Analyst / Analytics Engineer",
        "company": "MetricsIQ",
        "location": "Mumbai, India (Hybrid)",
        "job_type": "Full-time",
        "experience_level": "Mid-Level",
        "experience_min": 2,
        "experience_max": 4,
        "is_fresher": False,
        "skills": ["python", "sql", "pandas", "tableau", "power bi", "data warehousing"],
        "description": "Design analytical metrics dashboards, clean data pipelines, and provide actionable business intelligence across customer conversion funnels.",
        "salary_range": "INR 10,00,000 - 16,00,000 / year",
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    },
]


async def seed_data(database_url: str = "") -> None:
    print("\n[*] Connecting to PostgreSQL Primary Database...")
    from config.db import get_pg_session_factory, get_pg_engine
    from sqlalchemy import select, update, func, text
    from models.tables import User, Job, Resume, CandidateApplication
    import uuid

    session_factory = get_pg_session_factory()
    try:
        engine = get_pg_engine()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        print("[+] Connected to PostgreSQL successfully!")
    except Exception as e:
        print(f"[!] Failed to connect to PostgreSQL: {e}")
        return

    # 1. Seed Demo Users
    print("\n[+] Seeding Demo User Accounts...")
    async with session_factory() as session:
        for user_data in DEMO_USERS:
            email = user_data["email"]
            plain_pass = user_data.pop("plain_pass", None)
            hashed = hash_password(plain_pass)
            stmt = select(User).where(User.email == email)
            existing_user = (await session.execute(stmt)).scalar_one_or_none()
            if existing_user:
                existing_user.hashed_password = hashed
                existing_user.role = user_data["role"]
                existing_user.roles = user_data["roles"]
                existing_user.status = user_data.get("status", "active")
                existing_user.plan = user_data.get("plan", "pro")
                existing_user.subscription_status = "active"
                action = "Updated"
            else:
                new_user = User(
                    id=str(uuid.uuid4()),
                    email=email,
                    hashed_password=hashed,
                    full_name=user_data.get("full_name", email),
                    role=user_data["role"],
                    roles=user_data["roles"],
                    status=user_data.get("status", "active"),
                    tenant_id=user_data.get("tenant_id", "default"),
                    plan=user_data.get("plan", "pro"),
                    subscription_status="active",
                )
                session.add(new_user)
                action = "Created"
            role_str = user_data['role'].upper()
            print(f"    - {action} {role_str} user: {email} (Password: {plain_pass})")
        await session.commit()

    # 2. Seed Jobs
    print("\n[+] Seeding Tech Job Listings...")
    async with session_factory() as session:
        existing_jobs_count = (await session.execute(select(func.count(Job.id)))).scalar() or 0
        print(f"    Current jobs in database: {existing_jobs_count}")

        recruiter_stmt = select(User).where(User.email == "recruiter@careershala.com")
        recruiter_user = (await session.execute(recruiter_stmt)).scalar_one_or_none()
        recruiter_id = str(recruiter_user.id) if recruiter_user else "recruiter_seed"
        recruiter_tenant = recruiter_user.tenant_id if recruiter_user else "tenant_careershala_talent"

        inserted_jobs = 0
        for job in DEMO_JOBS:
            title = job["title"]
            j_stmt = select(Job).where(Job.title == title)
            existing = (await session.execute(j_stmt)).scalar_one_or_none()
            if not existing:
                new_job = Job(
                    id=f"job_{uuid.uuid4().hex[:12]}",
                    title=title,
                    company_name="CareerShala Cloud Technologies",
                    jd_text_raw=job.get("jd_text_raw") or job.get("description") or "",
                    required_skills=job.get("required_skills") or job.get("skills") or [],
                    min_years=float(job.get("min_years") or 0.0),
                    location=job.get("location") or "Remote / Hybrid",
                    work_mode=job.get("work_mode") or "Hybrid",
                    salary_range=job.get("salary_range") or "Competitive",
                    status="active",
                    tenant_id=recruiter_tenant,
                    created_by=recruiter_id,
                )
                session.add(new_job)
                inserted_jobs += 1
            else:
                existing.tenant_id = recruiter_tenant
                existing.created_by = recruiter_id
                existing.company_name = "CareerShala Cloud Technologies"
                if not existing.jd_text_raw:
                    existing.jd_text_raw = job.get("jd_text_raw") or job.get("description") or ""
        await session.commit()
        print(f"    Added {inserted_jobs} new curated job listings (Total now: {existing_jobs_count + inserted_jobs}).")

    # 3. Seed Sample Candidate Resume Data
    print("\n[+] Seeding Sample Candidate Profile & ATS Check...")
    async with session_factory() as session:
        cand_user = (await session.execute(select(User).where(User.email == "candidate@careershala.com"))).scalar_one_or_none()
        if cand_user:
            user_id = str(cand_user.id)
            parsed_data = {
                "name": "Alex Carter",
                "email": "candidate@careershala.com",
                "phone": "+1-555-0199",
                "total_experience_years": 2.5,
                "technical_skills": ["python", "react", "fastapi", "postgresql", "tailwind css", "docker", "git", "rest api"],
                "soft_skills": ["problem solving", "team collaboration", "communication"],
                "education": [
                    {"degree": "Bachelor of Technology in Computer Science", "institution": "State University", "year": 2023}
                ],
                "work_experience": [
                    {"title": "Full Stack Developer", "company": "TechNova Solutions", "duration": "2023 - Present"}
                ]
            }
            res_stmt = select(Resume).where(Resume.user_id == user_id)
            existing_res = (await session.execute(res_stmt)).scalar_one_or_none()
            if existing_res:
                existing_res.filename = "Alex_Carter_FullStack_Resume.pdf"
                existing_res.parsed_data = parsed_data
                existing_res.status = "ready"
                existing_res.updated_at = datetime.now(timezone.utc)
            else:
                session.add(Resume(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    filename="Alex_Carter_FullStack_Resume.pdf",
                    file_size=142050,
                    status="ready",
                    parsed_data=parsed_data,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                ))
            await session.commit()
            print("    Attached sample parsed resume and activity to candidate@careershala.com.")

    # 4. Seed Multi-Stage Pipeline Candidates into CandidateApplication
    print("\n[+] Seeding Rich Applicant Kanban Pipeline...")
    async with session_factory() as session:
        jobs_stmt = select(Job).limit(2)
        pipeline_target_jobs = (await session.execute(jobs_stmt)).scalars().all()
        now = datetime.now(timezone.utc)
        demo_applicants = [
            {"name": "Alex Carter", "email": "candidate@careershala.com", "stage": "Applied", "match_score": 92.5},
            {"name": "Priya Sharma", "email": "priya.sharma@example.com", "stage": "Under Review", "match_score": 87.0},
            {"name": "Devon Vance", "email": "devon.vance@example.com", "stage": "Shortlisted", "match_score": 95.0},
            {"name": "Marcus Thorne", "email": "marcus.thorne@example.com", "stage": "Interview", "match_score": 89.5},
            {"name": "Ananya Iyer", "email": "ananya.iyer@example.com", "stage": "Rejected", "match_score": 46.0},
        ]
        total_apps_seeded = 0
        for target_job in pipeline_target_jobs:
            job_id_str = str(target_job.id)
            for cand in demo_applicants:
                app_stmt = select(CandidateApplication).where(
                    CandidateApplication.job_id == job_id_str,
                    CandidateApplication.candidate_email == cand["email"]
                )
                existing_app = (await session.execute(app_stmt)).scalar_one_or_none()
                if existing_app:
                    existing_app.stage = cand["stage"]
                    existing_app.match_score = cand["match_score"]
                    existing_app.updated_at = now
                else:
                    session.add(CandidateApplication(
                        id=f"app_{uuid.uuid4().hex[:12]}",
                        job_id=job_id_str,
                        candidate_name=cand["name"],
                        candidate_email=cand["email"],
                        stage=cand["stage"],
                        match_score=cand["match_score"],
                        quality_score=cand["match_score"],
                        tenant_id=target_job.tenant_id or "default",
                        created_at=now,
                        updated_at=now,
                    ))
                total_apps_seeded += 1
            await session.commit()
            cnt_stmt = select(func.count(CandidateApplication.id)).where(CandidateApplication.job_id == job_id_str)
            cnt = (await session.execute(cnt_stmt)).scalar() or 0
            target_job.applicant_count = cnt
            await session.commit()
            print(f"    Seeded {len(demo_applicants)} applicants for role: '{target_job.title}' (Total on job: {cnt})")

        print(f"    [OK] Successfully synchronized {total_apps_seeded} applicants across pipeline.")

    print("\n[OK] Demo data seeding complete! Ready for evaluation.")
    print("=" * 60)
    print("DEMO EVALUATION CREDENTIALS:")
    print("  Candidate:  candidate@careershala.com  |  Candidate123!")
    print("  Recruiter:  recruiter@careershala.com  |  Recruiter123!")
    print("  Admin:      admin@careershala.com      |  Admin123!")
    print("=" * 60 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Seed CareerShala with sample demo accounts, jobs, and candidate data.")
    parser.add_argument("--database-url", type=str, default="", help="PostgreSQL connection string")

    args = parser.parse_args()

    asyncio.run(seed_data())


if __name__ == "__main__":
    main()
