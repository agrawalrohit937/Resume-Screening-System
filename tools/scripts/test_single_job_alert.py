"""
Quick Test Utility: Send Job Alert to a Single Candidate Email.
Usage:
    python backend/scripts/test_single_job_alert.py your_email@example.com
"""

import asyncio
import sys
from pathlib import Path

# Add backend to Python path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from config.db import connect_db, get_database
from scheduler.job_alerts import run_nightly_job_alerts


async def main():
    target_email = sys.argv[1] if len(sys.argv) > 1 else "agrawalrohit937@gmail.com"
    print(f"\n[+] Connecting to database...")
    await connect_db()
    db = get_database()

    print(f"[+] Running Job Alert matching ONLY for target: {target_email}")
    result = await run_nightly_job_alerts(db=db, target_email=target_email)

    print("\n[+] Result Summary:")
    print("--------------------------------------------------")
    for k, v in result.items():
        print(f"  {k}: {v}")
    print("--------------------------------------------------\n")


if __name__ == "__main__":
    asyncio.run(main())
