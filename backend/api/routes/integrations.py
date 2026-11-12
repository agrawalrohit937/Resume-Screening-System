"""Enterprise Job Syndication API Routes (Indeed XML & Google for Jobs).
CareerShala ATS v2.0.0.
"""

from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Response

from api.deps import get_job_repo
from repositories.job_repo import JobRepository
from services.integrations.syndication import generate_indeed_xml_feed, generate_google_job_posting_ld_json

router = APIRouter()


@router.get("/syndication/indeed.xml", response_class=Response)
async def get_indeed_feed_route(
    job_repo: JobRepository = Depends(get_job_repo),
):
    """Generates an Indeed-compliant XML feed of active jobs."""
    jobs = await job_repo.list_jobs(status="open", limit=100)
    xml_content = generate_indeed_xml_feed(jobs)
    return Response(content=xml_content, media_type="application/xml")


@router.get("/syndication/google-jobs/{job_id}", response_model=Dict[str, Any])
async def get_google_jobs_schema_route(
    job_id: str,
    job_repo: JobRepository = Depends(get_job_repo),
):
    """Generates Google for Jobs schema.org/JobPosting JSON-LD structured data."""
    job = await job_repo.get_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return generate_google_job_posting_ld_json(job)
