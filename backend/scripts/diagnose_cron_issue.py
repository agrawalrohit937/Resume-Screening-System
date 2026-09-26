import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from config.db import connect_db, disconnect_db, get_database
from core.config import settings

async def main():
    await connect_db()
    db = get_database()
    
    print("=== 1. USERS & CANDIDATES ===")
    total_users = await db.users.count_documents({})
    candidate_cursor = db.users.find({
        "$or": [{"role": "candidate"}, {"role": "CANDIDATE"}, {"role": None}],
        "status": {"$ne": "deleted"}
    })
    candidates = await candidate_cursor.to_list(100)
    print(f"Total Users: {total_users}, Active Candidates: {len(candidates)}")
    for c in candidates[:5]:
        print(f"  Candidate: {c.get('email')} - Name: {c.get('full_name') or c.get('name')} - Role: {c.get('role')} - Status: {c.get('status')}")

    print("\n=== 2. RESUMES ===")
    parsed_resumes = await db.resumes.count_documents({"status": "parsed", "parsed_data": {"$ne": None}})
    total_resumes = await db.resumes.count_documents({})
    print(f"Total Resumes: {total_resumes}, Parsed Resumes: {parsed_resumes}")
    for c in candidates:
        cid = str(c["_id"])
        r = await db.resumes.find_one({"user_id": cid, "status": "parsed", "parsed_data": {"$ne": None}})
        print(f"  Candidate {c.get('email')}: Has parsed resume? {'YES' if r else 'NO'}")

    print("\n=== 3. JOBS ===")
    total_jobs = await db.jobs.count_documents({})
    external_jobs = await db.jobs.count_documents({"is_external": True})
    active_jobs = await db.jobs.count_documents({"status": "active"})
    print(f"Total Jobs: {total_jobs}, External Jobs: {external_jobs}, Active Jobs: {active_jobs}")
    
    latest_jobs = await db.jobs.find().sort("created_at", -1).limit(5).to_list(5)
    print("Latest 5 Jobs in DB:")
    for j in latest_jobs:
        print(f"  Job: {j.get('title')} | Company: {j.get('company_name') or j.get('company')} | External: {j.get('is_external')} | Created: {j.get('created_at')} | Updated: {j.get('updated_at')}")

    print("\n=== 4. REDIS LOCKS & CACHE ===")
    try:
        from services.redis_service import get_redis
        redis = await get_redis()
        if redis:
            keys = await redis.keys("*")
            print(f"Redis keys ({len(keys)}): {keys}")
            for k in keys:
                if b"lock" in k or b"cron" in k or "cron" in str(k) or "lock" in str(k):
                    val = await redis.get(k)
                    ttl = await redis.ttl(k)
                    print(f"  Lock Key: {k} = {val} (TTL: {ttl}s)")
        else:
            print("Redis client is None or not connected")
    except Exception as e:
        print(f"Redis check error: {e}")

    print("\n=== 5. RAPIDAPI KEY & JSEARCH TEST ===")
    rapid_key = os.getenv("RAPIDAPI_KEY", settings.RAPIDAPI_KEY if hasattr(settings, "RAPIDAPI_KEY") else "")
    print(f"RAPIDAPI_KEY present: {bool(rapid_key)} (length: {len(rapid_key) if rapid_key else 0})")
    
    import httpx
    try:
        headers = {
            "X-RapidAPI-Key": rapid_key or "",
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://jsearch.p.rapidapi.com/search-v2",
                headers=headers,
                params={"query": "Python Developer in India", "page": 1, "num_pages": 1}
            )
            print(f"JSearch API Response Status: {resp.status_code}")
            if resp.status_code != 200:
                print(f"JSearch API Response Body: {resp.text[:300]}")
            else:
                data = resp.json()
                print(f"JSearch API returned jobs count: {len(data.get('data', [])) if isinstance(data, dict) else 'non-dict'}")
    except Exception as e:
        print(f"JSearch test error: {e}")

    print("\n=== 6. BREVO EMAIL API TEST ===")
    brevo_key = os.getenv("BREVO_API_KEY", settings.BREVO_API_KEY if hasattr(settings, "BREVO_API_KEY") else "")
    print(f"BREVO_API_KEY present: {bool(brevo_key)} (length: {len(brevo_key) if brevo_key else 0})")
    try:
        headers = {
            "accept": "application/json",
            "api-key": brevo_key,
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get("https://api.brevo.com/v3/account", headers=headers)
            print(f"Brevo Account Status: {resp.status_code}")
            if resp.status_code == 200:
                acct = resp.json()
                print(f"Brevo Account Email: {acct.get('email')}, Plan: {acct.get('plan', [])}")
            else:
                print(f"Brevo Error: {resp.text[:300]}")
    except Exception as e:
        print(f"Brevo test error: {e}")

    await disconnect_db()

if __name__ == "__main__":
    asyncio.run(main())
