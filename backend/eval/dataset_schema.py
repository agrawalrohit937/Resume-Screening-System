"""
Dataset Schema for ATS Evaluation Harness (Phase 2).
Defines standard labeled pair schema, relevance levels, and dataset validation.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import IntEnum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class RecruiterLabel(IntEnum):
    """
    Standard 4-point ordinal recruiter relevance label:
    0: Reject (completely unqualified or hard knockout)
    1: Maybe / Weak Match (marginal overlap, needs review)
    2: Shortlist / Strong Match (meets core requirements)
    3: Hire / Exceptional Match (exceeds all required and preferred criteria)
    """
    REJECT = 0
    MAYBE = 1
    SHORTLIST = 2
    HIRE = 3

    @classmethod
    def from_str(cls, val: str) -> "RecruiterLabel":
        s = str(val).strip().lower()
        if s in ("3", "hire", "exceptional", "perfect", "strong_match", "strong match"):
            return cls.HIRE
        elif s in ("2", "shortlist", "good", "match", "good_match", "good match"):
            return cls.SHORTLIST
        elif s in ("1", "maybe", "partial", "partial match", "partial_match", "fair"):
            return cls.MAYBE
        else:
            return cls.REJECT


class LabeledPair(BaseModel):
    """A single labeled Resume-JD pair for offline ranking and quality evaluation."""
    pair_id: str = Field(..., description="Unique ID of this evaluation sample")
    resume_id: str = Field(..., description="Unique identifier or hash of the candidate resume")
    jd_id: str = Field(..., description="Unique identifier or hash of the job description")
    recruiter_label: int = Field(..., ge=0, le=3, description="Ordinal label 0 (reject) to 3 (hire)")
    recruiter_rank: Optional[int] = Field(None, description="Optional ground-truth rank position within the job cohort")
    
    resume_data: Dict[str, Any] = Field(default_factory=dict, description="Parsed or raw resume payload")
    jd_data: Dict[str, Any] = Field(default_factory=dict, description="Job description payload")
    
    is_knockout_expected: Optional[bool] = Field(None, description="Ground truth whether candidate violates hard requirements")
    is_synthetic: bool = Field(default=False, description="Whether this pair was synthetically generated")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Optional audit metadata")


class EvaluationDataset(BaseModel):
    """Full container for an evaluation dataset with versioning and provenance."""
    dataset_name: str
    version: str = "1.0.0"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    description: str = ""
    is_synthetic_dataset: bool = False
    pairs: List[LabeledPair] = Field(default_factory=list)

    def total_count(self) -> int:
        return len(self.pairs)

    def group_by_jd(self) -> Dict[str, List[LabeledPair]]:
        """Groups pairs by job description for query-level ranking evaluation."""
        grouped: Dict[str, List[LabeledPair]] = {}
        for p in self.pairs:
            grouped.setdefault(p.jd_id, []).append(p)
        return grouped
