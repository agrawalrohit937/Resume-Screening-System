"""
CareerShala — One-Click Demo Data & Recruiter Evaluation Seeder
Populates demo users, diverse tech job listings, and sample parsed resume data.

Usage:
    cd backend
    python scripts/seed_demo_data.py
    
    # Or with custom MongoDB URI:
    python scripts/seed_demo_data.py --mongo-uri "mongodb://localhost:27017"
"""

import argparse
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List

# Ensure utf-8 encoding on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add parent directory to sys.path so backend modules can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pymongo import AsyncMongoClient
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
        "skills": ["python", "pytorch", "huggingface", "vector search", "mongodb", "fastapi", "langchain"],
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
        "skills": ["react", "fastapi", "python", "mongodb", "redis", "docker", "tailwind css"],
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
        "description": "Lead the modernization of multi-cloud Kubernetes clusters, automated zero-downtime deployment pipelines, telemetry monitoring, and high-availability distributed state layers.",
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


async def seed_data(mongo_uri: str, db_name: str) -> None:
    print(f"\n[*] Connecting to MongoDB: {mongo_uri} (Database: {db_name})...")
    client = AsyncMongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    db = client[db_name]

    # Test connection
    try:
        await client.admin.command("ping")
        print("[+] Connected to MongoDB successfully!")
    except Exception as e:
        print(f"[!] Failed to connect to MongoDB at {mongo_uri}: {e}")
        print("[i] Hint: Ensure MongoDB is running locally (mongod) or provide a valid URI with --mongo-uri.")
        return

    # 1. Seed Demo Users
    print("\n[+] Seeding Demo User Accounts...")
    for user_data in DEMO_USERS:
        email = user_data["email"]
        plain_pass = user_data.pop("plain_pass", None)
        user_data["hashed_password"] = hash_password(plain_pass)

        res = await db.users.update_one(
            {"email": email},
            {"$set": user_data},
            upsert=True
        )
        action = "Created" if res.upserted_id else "Updated"
        print(f"    - {action} {user_data['role'].upper()} user: {email} (Password: {plain_pass})")

    # 2. Seed Jobs
    print("\n[+] Seeding Tech Job Listings...")
    existing_jobs_count = await db.jobs.count_documents({})
    print(f"    Current jobs in database: {existing_jobs_count}")

    inserted_jobs = 0
    recruiter_user = await db.users.find_one({"email": "recruiter@careershala.com"})
    recruiter_id = str(recruiter_user["_id"]) if recruiter_user else None
    recruiter_tenant = (recruiter_user.get("tenant_id") if recruiter_user else None) or "tenant_careershala_talent"

    for job in DEMO_JOBS:
        # Standardize schema fields for both legacy and enterprise ATS pipelines
        job_doc = dict(job)
        job_doc["tenant_id"] = recruiter_tenant
        job_doc["created_by"] = recruiter_id
        job_doc["company_name"] = "CareerShala Cloud Technologies"
        job_doc["company"] = "CareerShala Cloud Technologies"
        job_doc["required_skills"] = job.get("required_skills") or job.get("skills") or []
        job_doc["jd_text_raw"] = job.get("jd_text_raw") or job.get("description") or ""
        job_doc["jd_text"] = job_doc["jd_text_raw"]

        # Avoid duplicate title + company
        existing = await db.jobs.find_one({
            "title": job["title"], 
            "$or": [
                {"company": job.get("company")},
                {"company_name": job_doc["company_name"]},
                {"company": "CareerShala Cloud Technologies"},
            ]
        })
        if not existing:
            await db.jobs.insert_one(job_doc)
            inserted_jobs += 1
        else:
            # Backfill any missing jd_text_raw, company_name, tenant_id, or created_by
            await db.jobs.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "tenant_id": recruiter_tenant,
                    "created_by": recruiter_id,
                    "company_name": "CareerShala Cloud Technologies",
                    "company": "CareerShala Cloud Technologies",
                    "required_skills": existing.get("required_skills") or job_doc["required_skills"],
                    "jd_text_raw": existing.get("jd_text_raw") or job_doc["jd_text_raw"],
                    "jd_text": existing.get("jd_text") or job_doc["jd_text_raw"],
                }}
            )

    # Global backfill for any existing scraped or dummy jobs without jd_text_raw
    await db.jobs.update_many(
        {"$or": [{"jd_text_raw": {"$exists": False}}, {"jd_text_raw": ""}, {"jd_text_raw": None}]},
        [{"$set": {"jd_text_raw": {"$ifNull": ["$description", "$jd_text", ""]}}}]
    )

    print(f"    Added {inserted_jobs} new curated job listings (Total now: {existing_jobs_count + inserted_jobs}).")

    # 3. Seed Sample Candidate Resume Data
    print("\n[+] Seeding Sample Candidate Profile & ATS Check...")
    candidate_user = await db.users.find_one({"email": "candidate@careershala.com"})
    if candidate_user:
        user_id = str(candidate_user["_id"])
        
        sample_resume = {
            "user_id": user_id,
            "filename": "Alex_Carter_FullStack_Resume.pdf",
            "file_size": 142050,
            "parsed_data": {
                "name": "Alex Carter",
                "email": "candidate@careershala.com",
                "phone": "+1-555-0199",
                "total_experience_years": 2.5,
                "technical_skills": ["python", "react", "fastapi", "mongodb", "tailwind css", "docker", "git", "rest api"],
                "soft_skills": ["problem solving", "team collaboration", "communication"],
                "education": [
                    {"degree": "Bachelor of Technology in Computer Science", "institution": "State University", "year": 2023}
                ],
                "work_experience": [
                    {"title": "Full Stack Developer", "company": "TechNova Solutions", "duration": "2023 - Present"}
                ]
            },
            "status": "ready",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.resumes.update_one(
            {"user_id": user_id},
            {"$set": sample_resume},
            upsert=True
        )

        # Activity timeline seed
        sample_activity = {
            "user_id": user_id,
            "type": "job_application",
            "title": "Application submitted for Full Stack Software Engineer",
            "company": "CareerShala Cloud Technologies",
            "created_at": datetime.now(timezone.utc)
        }
        await db.activities.update_one(
            {"user_id": user_id, "title": sample_activity["title"]},
            {"$set": sample_activity},
            upsert=True
        )
        print("    Attached sample parsed resume and activity to candidate@careershala.com.")

    # 4. Seed Multi-Stage Pipeline Candidates into db.applications
    print("\n[+] Seeding Rich Applicant Kanban Pipeline...")
    full_stack_job = await db.jobs.find_one({"title": "Full Stack Software Engineer (React + FastAPI)"})
    ml_job = await db.jobs.find_one({"title": "AI / Machine Learning Engineer (BGE & RAG Pipelines)"})

    pipeline_target_jobs = [j for j in [full_stack_job, ml_job] if j]
    if not pipeline_target_jobs:
        # Fallback to any job
        first_job = await db.jobs.find_one({"created_by": recruiter_id}) or await db.jobs.find_one({})
        if first_job:
            pipeline_target_jobs = [first_job]

    now = datetime.now(timezone.utc)
    demo_applicants = [
        {
            "name": "Alex Carter",
            "email": "candidate@careershala.com",
            "stage": "Applied",
            "match_score": 92.5,
            "recruiter_score": 92.5,
            "experience_years": 2.5,
            "skills": ["react", "fastapi", "python", "mongodb", "docker", "tailwind css", "redis"],
            "education": [{"degree": "B.Tech Computer Science", "institution": "State University", "year": 2023}],
            "work_experience": [{"title": "Full Stack Developer", "company": "TechNova Solutions", "duration": "2023 - Present"}],
            "phone": "+1-555-0199",
            "github": "alexcarter-dev",
            "linkedin": "https://linkedin.com/in/alexcarter-demo",
        },
        {
            "name": "Priya Sharma",
            "email": "priya.sharma@example.com",
            "stage": "Under Review",
            "match_score": 87.0,
            "recruiter_score": 87.0,
            "experience_years": 4.0,
            "skills": ["python", "fastapi", "postgresql", "docker", "redis", "kubernetes", "aws"],
            "education": [{"degree": "M.S. Software Systems", "institution": "National Institute", "year": 2021}],
            "work_experience": [{"title": "Backend Infrastructure Engineer", "company": "CloudNative Systems", "duration": "2021 - Present"}],
            "phone": "+91-98765-43210",
            "github": "priyasharma-code",
            "linkedin": "https://linkedin.com/in/priya-sharma-tech",
        },
        {
            "name": "Devon Vance",
            "email": "devon.vance@example.com",
            "stage": "Shortlisted",
            "match_score": 95.0,
            "recruiter_score": 95.0,
            "experience_years": 5.5,
            "skills": ["react", "typescript", "fastapi", "graphql", "microservices", "docker", "tailwind css"],
            "education": [{"degree": "B.S. Computer Engineering", "institution": "Tech Institute", "year": 2020}],
            "work_experience": [{"title": "Senior Frontend / Fullstack", "company": "HyperScale Labs", "duration": "2020 - Present"}],
            "phone": "+1-555-0842",
            "github": "devonvance",
            "linkedin": "https://linkedin.com/in/devon-vance",
        },
        {
            "name": "Marcus Thorne",
            "email": "marcus.thorne@example.com",
            "stage": "Interview",
            "match_score": 89.5,
            "recruiter_score": 89.5,
            "experience_years": 3.5,
            "skills": ["python", "fastapi", "react", "next.js", "ci/cd", "mongodb", "docker"],
            "education": [{"degree": "B.Tech Information Technology", "institution": "Metro University", "year": 2022}],
            "work_experience": [{"title": "Full Stack Engineer", "company": "Vertex Digital", "duration": "2022 - Present"}],
            "phone": "+44-20-7946-0912",
            "github": "marcusthorne",
            "linkedin": "https://linkedin.com/in/marcus-thorne",
        },
        {
            "name": "Ananya Iyer",
            "email": "ananya.iyer@example.com",
            "stage": "Rejected",
            "match_score": 46.0,
            "recruiter_score": 46.0,
            "experience_years": 1.0,
            "skills": ["c++", "embedded systems", "matlab"],
            "education": [{"degree": "B.E. Electronics", "institution": "City College", "year": 2024}],
            "work_experience": [{"title": "Hardware Intern", "company": "ChipTech Labs", "duration": "2024"}],
            "phone": "+91-98111-22334",
            "github": "ananyaiyer",
            "linkedin": "https://linkedin.com/in/ananya-iyer",
        },
    ]

    total_apps_seeded = 0
    for target_job in pipeline_target_jobs:
        job_id_str = str(target_job["_id"])
        job_title = target_job.get("title", "")
        
        for cand in demo_applicants:
            app_filter = {"job_id": job_id_str, "candidate_email": cand["email"]}
            app_doc = {
                "job_id": job_id_str,
                "candidate_name": cand["name"],
                "candidate_email": cand["email"],
                "stage": cand["stage"],
                "match_score": cand["match_score"],
                "recruiter_score": cand["recruiter_score"],
                "tenant_id": recruiter_tenant,
                "knockout_status": {"passed": cand["match_score"] >= 50.0, "reasons": []},
                "resume_snapshot": {
                    "filename": f"{cand['name'].replace(' ', '_')}_Resume.pdf",
                    "parsed_data": {
                        "name": cand["name"],
                        "email": cand["email"],
                        "skills": cand["skills"],
                        "total_experience_years": cand["experience_years"],
                        "education": cand["education"],
                        "work_experience": cand["work_experience"],
                        "contact_info": {
                            "phone": cand["phone"],
                            "github": cand["github"],
                            "linkedin": cand["linkedin"],
                            "email": cand["email"],
                        },
                    },
                },
                "created_at": now,
                "updated_at": now,
            }

            await db.applications.update_one(app_filter, {"$set": app_doc}, upsert=True)
            total_apps_seeded += 1

        # Synchronize live applicant count on job
        actual_cnt = await db.applications.count_documents({"job_id": job_id_str})
        await db.jobs.update_one({"_id": target_job["_id"]}, {"$set": {"applicant_count": actual_cnt}})
        print(f"    Seeded {len(demo_applicants)} applicants for role: '{job_title}' (Total on job: {actual_cnt})")

    print(f"    [OK] Successfully synchronized {total_apps_seeded} applicants across pipeline.")

    await client.close()
    print("\n[OK] Demo data seeding complete! Ready for evaluation.")
    print("=" * 60)
    print("DEMO EVALUATION CREDENTIALS:")
    print("  Candidate:  candidate@careershala.com  |  Candidate123!")
    print("  Recruiter:  recruiter@careershala.com  |  Recruiter123!")
    print("  Admin:      admin@careershala.com      |  Admin123!")
    print("=" * 60 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Seed CareerShala with sample demo accounts, jobs, and candidate data.")
    parser.add_argument("--mongo-uri", type=str, default=settings.MONGO_URI, help="MongoDB connection URI")
    parser.add_argument("--db-name", type=str, default=settings.MONGO_DB_NAME, help="MongoDB database name")
    args = parser.parse_args()

    asyncio.run(seed_data(args.mongo_uri, args.db_name))


if __name__ == "__main__":
    main()
