"""Enterprise ATS Ecosystem Integrations & Syndication API Routes.
CareerPilot ATS v2.0.0 - Enterprise ATS Ecosystem.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel

from api.deps import get_database, get_current_user
from models.job import JobModel
from models.user_model import UserModel
from services.integrations.adapters import GreenhouseAdapter, LeverAdapter, WorkdayAdapter
from services.integrations.syndication import generate_indeed_xml_feed, generate_google_job_posting_ld_json

router = APIRouter()


class PushApplicationPayload(BaseModel):
    job_id: str
    candidate_name: str
    score: float = 0.0


@router.get("/greenhouse/jobs", response_model=List[Dict[str, Any]])
async def sync_greenhouse_jobs_route():
    """Syncs active jobs from Greenhouse Harvest API."""
    adapter = GreenhouseAdapter()
    return await adapter.sync_jobs()


@router.post("/greenhouse/applications", response_model=Dict[str, Any])
async def push_greenhouse_app_route(payload: PushApplicationPayload):
    """Pushes a screened candidate application into Greenhouse."""
    adapter = GreenhouseAdapter()
    return await adapter.push_application(payload.dict())


@router.get("/lever/jobs", response_model=List[Dict[str, Any]])
async def sync_lever_jobs_route():
    """Syncs active job postings from Lever API."""
    adapter = LeverAdapter()
    return await adapter.sync_jobs()


@router.post("/lever/opportunities", response_model=Dict[str, Any])
async def push_lever_opp_route(payload: PushApplicationPayload):
    """Pushes an opportunity into Lever."""
    adapter = LeverAdapter()
    return await adapter.push_application(payload.dict())


@router.get("/workday/jobs", response_model=List[Dict[str, Any]])
async def sync_workday_jobs_route():
    """Syncs job requisitions from Workday RaaS."""
    adapter = WorkdayAdapter()
    return await adapter.sync_jobs()


@router.get("/syndication/indeed.xml", response_class=Response)
async def get_indeed_feed_route(
    db: Any = Depends(get_database),
):
    """Generates an Indeed-compliant XML feed of active jobs."""
    cursor = db.jobs.find({"status": "open"})
    docs = await cursor.to_list(length=100)
    jobs = [JobModel(**d) for d in docs]
    xml_content = generate_indeed_xml_feed(jobs)
    return Response(content=xml_content, media_type="application/xml")


@router.get("/syndication/google-jobs/{job_id}", response_model=Dict[str, Any])
async def get_google_jobs_schema_route(
    job_id: str,
    db: Any = Depends(get_database),
):
    """Generates Google for Jobs schema.org/JobPosting JSON-LD structured data."""
    doc = await db.jobs.find_one({"id": job_id}) or await db.jobs.find_one({"_id": job_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    job = JobModel(**doc)
    return generate_google_job_posting_ld_json(job)
