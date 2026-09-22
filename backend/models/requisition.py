"""Requisition and Headcount Approval Models.
CareerPilot ATS v2.0.0 - Enterprise ATS Workflows.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid


class RequisitionStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    OPEN = "open"
    FILLED = "filled"
    CANCELLED = "cancelled"


class ApprovalDecision(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ApprovalStep(BaseModel):
    step_order: int = 1
    approver_id: str
    approver_role: str = "hiring_manager"  # hiring_manager, finance, exec
    status: ApprovalDecision = ApprovalDecision.PENDING
    decided_at: Optional[datetime] = None
    comments: Optional[str] = None


class RequisitionModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = "default"
    title: str
    department: str
    headcount: int = 1
    filled_count: int = 0
    target_hire_date: Optional[datetime] = None
    budget_currency: str = "USD"
    budget_min: float = 0.0
    budget_max: float = 0.0
    hiring_manager_id: str
    recruiter_id: Optional[str] = None
    approval_chain: List[ApprovalStep] = Field(default_factory=list)
    status: RequisitionStatus = RequisitionStatus.DRAFT
    linked_job_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
