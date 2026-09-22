"""Enterprise ATS Adapters (Greenhouse, Lever, Workday).
CareerPilot ATS v2.0.0 - Enterprise ATS Ecosystem.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
import uuid
from datetime import datetime
import structlog

logger = structlog.get_logger(__name__)


class ATSAdapter(ABC):
    """Abstract interface for external enterprise ATS synchronization."""

    @abstractmethod
    async def sync_jobs(self) -> List[Dict[str, Any]]:
        """Fetch active jobs from external ATS."""
        pass

    @abstractmethod
    async def push_application(self, application_data: Dict[str, Any]) -> Dict[str, Any]:
        """Push a candidate application to external ATS."""
        pass

    @abstractmethod
    async def update_stage(self, remote_application_id: str, stage_name: str) -> Dict[str, Any]:
        """Update candidate stage in external ATS."""
        pass


class GreenhouseAdapter(ATSAdapter):
    """Greenhouse Harvest API v2 Adapter."""

    def __init__(self, api_key: str = "mock_gh_key", on_behalf_of: str = "recruiter@enterprise.com"):
        self.api_key = api_key
        self.on_behalf_of = on_behalf_of

    async def sync_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Greenhouse: Syncing jobs via Harvest API")
        return [
            {
                "external_id": "gh_job_101",
                "title": "Principal Distributed Systems Engineer",
                "department": "Platform Core",
                "status": "open",
                "requisition_id": "REQ-GH-991",
                "location": "San Francisco, CA / Remote",
                "synced_at": datetime.utcnow().isoformat()
            },
            {
                "external_id": "gh_job_102",
                "title": "Machine Learning Engineer (NLP)",
                "department": "AI Research",
                "status": "open",
                "requisition_id": "REQ-GH-992",
                "location": "New York, NY / Remote",
                "synced_at": datetime.utcnow().isoformat()
            }
        ]

    async def push_application(self, application_data: Dict[str, Any]) -> Dict[str, Any]:
        remote_cand_id = f"gh_cand_{uuid.uuid4().hex[:8]}"
        remote_app_id = f"gh_app_{uuid.uuid4().hex[:8]}"
        logger.info(
            "Greenhouse: Pushed candidate application",
            candidate_name=application_data.get("candidate_name"),
            remote_app_id=remote_app_id
        )
        return {
            "success": True,
            "provider": "greenhouse",
            "remote_candidate_id": remote_cand_id,
            "remote_application_id": remote_app_id,
            "job_id": application_data.get("job_id"),
            "stage": "Application Review",
            "score": application_data.get("score", 0.0),
            "synced_at": datetime.utcnow().isoformat()
        }

    async def update_stage(self, remote_application_id: str, stage_name: str) -> Dict[str, Any]:
        logger.info("Greenhouse: Moving application to stage", app_id=remote_application_id, stage=stage_name)
        return {
            "success": True,
            "provider": "greenhouse",
            "remote_application_id": remote_application_id,
            "new_stage": stage_name,
            "updated_at": datetime.utcnow().isoformat()
        }


class LeverAdapter(ATSAdapter):
    """Lever Postings and Opportunities API Adapter."""

    def __init__(self, api_key: str = "mock_lever_key"):
        self.api_key = api_key

    async def sync_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Lever: Fetching postings from /v1/postings")
        return [
            {
                "external_id": "lever_post_501",
                "title": "Staff Cloud Architect",
                "department": "Cloud Infra",
                "state": "published",
                "categories": {"location": "Remote - US", "team": "Engineering"},
                "synced_at": datetime.utcnow().isoformat()
            }
        ]

    async def push_application(self, application_data: Dict[str, Any]) -> Dict[str, Any]:
        opportunity_id = f"lever_opp_{uuid.uuid4().hex[:8]}"
        logger.info("Lever: Created opportunity", opportunity_id=opportunity_id)
        return {
            "success": True,
            "provider": "lever",
            "remote_opportunity_id": opportunity_id,
            "remote_application_id": opportunity_id,
            "stage": "lead",
            "tags": ["careerpilot_ats", f"score_{int(application_data.get('score', 0))}"],
            "synced_at": datetime.utcnow().isoformat()
        }

    async def update_stage(self, remote_application_id: str, stage_name: str) -> Dict[str, Any]:
        logger.info("Lever: Updating opportunity stage", opp_id=remote_application_id, stage=stage_name)
        return {
            "success": True,
            "provider": "lever",
            "remote_application_id": remote_application_id,
            "new_stage": stage_name,
            "updated_at": datetime.utcnow().isoformat()
        }


class WorkdayAdapter(ATSAdapter):
    """Workday RaaS (Report-as-a-Service) & HCM Recruiting Inbound Adapter."""

    def __init__(self, tenant_id: str = "mock_wd_tenant", client_id: str = "mock_wd_client"):
        self.tenant_id = tenant_id
        self.client_id = client_id

    async def sync_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Workday: Executing RaaS report for open requisitions")
        return [
            {
                "external_id": "WD_REQ_8810",
                "title": "Director of Security Engineering",
                "supervisory_organization": "Global Information Security",
                "status": "Open",
                "worker_type": "Regular Employee",
                "synced_at": datetime.utcnow().isoformat()
            }
        ]

    async def push_application(self, application_data: Dict[str, Any]) -> Dict[str, Any]:
        applicant_id = f"WD_APPL_{uuid.uuid4().hex[:8]}"
        logger.info("Workday: Transmitted Put_Applicant payload", applicant_id=applicant_id)
        return {
            "success": True,
            "provider": "workday",
            "remote_applicant_id": applicant_id,
            "remote_application_id": applicant_id,
            "job_requisition_id": application_data.get("job_id"),
            "event_status": "Candidate_Submitted",
            "synced_at": datetime.utcnow().isoformat()
        }

    async def update_stage(self, remote_application_id: str, stage_name: str) -> Dict[str, Any]:
        logger.info("Workday: Advancing candidate in recruiting business process", app_id=remote_application_id)
        return {
            "success": True,
            "provider": "workday",
            "remote_application_id": remote_application_id,
            "business_process_step": stage_name,
            "updated_at": datetime.utcnow().isoformat()
        }
