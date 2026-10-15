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

from motor.motor_asyncio import AsyncIOMotorClient
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
    client = AsyncIOMotorClient(mongo_uri, serverSelectionTimeoutMS=5000)
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
    for job in DEMO_JOBS:
        # Avoid duplicate title + company
        existing = await db.jobs.find_one({"title": job["title"], "company": job["company"]})
        if not existing:
            await db.jobs.insert_one(job)
            inserted_jobs += 1

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
            "company": "HyperScale Labs",
            "created_at": datetime.now(timezone.utc)
        }
        await db.activities.update_one(
            {"user_id": user_id, "title": sample_activity["title"]},
            {"$set": sample_activity},
            upsert=True
        )
        print("    Attached sample parsed resume and activity to candidate@careershala.com.")

    client.close()
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
