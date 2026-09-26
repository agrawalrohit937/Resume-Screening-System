import asyncio
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from config.db import connect_db, disconnect_db, get_database
from scheduler.job_alerts import run_nightly_job_alerts, run_external_job_scrape
from services.job_scraper import scrape_external_jobs
from services.job_matcher import find_jobs_for_candidate
import httpx

async def test_all():
    await connect_db()
    db = get_database()
    
    print("--- Testing JSearch Scraping Directly ---")
    try:
        scrape_res = await scrape_external_jobs(db)
        print(f"Scrape result: {scrape_res}")
    except Exception as e:
        print(f"Scrape error: {e}", exc_info=True)

    print("\n--- Testing Candidate Matching for 1 candidate ---")
    candidate = await db.users.find_one({
        "$or": [{"role": "candidate"}, {"role": "CANDIDATE"}, {"role": None}],
        "status": {"$ne": "deleted"}
    })
    if candidate:
        cid = str(candidate["_id"])
        print(f"Testing for candidate: {candidate.get('email')} (ID: {cid})")
        match_res = await find_jobs_for_candidate(candidate_id=cid, limit=5, db=db)
        recs = match_res.get("recommended_jobs", [])
        print(f"Found {len(recs)} recommended jobs. Total open in db: {match_res.get('total_open_jobs')}")
        for r in recs:
            print(f"  Job: {r.get('title')} at {r.get('company_name')} | Score: {r.get('match_score')}% | Applied: {r.get('is_applied')}")

    print("\n--- Checking Lock Status in DB or Redis ---")
    # check if there's any lock in db
    lock_doc = await db.locks.find().to_list(10) if hasattr(db, "locks") else []
    print(f"Locks in DB: {lock_doc}")
    
    await disconnect_db()

if __name__ == "__main__":
    asyncio.run(test_all())
