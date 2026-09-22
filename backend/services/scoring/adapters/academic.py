"""
Academic & Scientific Research Scoring Adapter.
Signals: publications, citations, h-index, grants, teaching load, advisor/PI, conferences.
"""

from typing import Dict, List, Set, Any
from services.scoring.adapters.base import OccupationAdapter, EligibilityRule


class AcademicResearchAdapter(OccupationAdapter):
    adapter_name: str = "AcademicResearchAdapter"
    family_codes: Set[str] = {
        "academic_research", "academia", "research", "scientific", "postdoc"
    }

    def feature_weights(self) -> Dict[str, float]:
        """Academic roles heavily weight publications, grants, and advanced degrees."""
        return {
            "publications": 0.30,
            "experience": 0.25,
            "education": 0.25,
            "skills": 0.20,
        }

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        return []

    def required_evidence(self) -> List[str]:
        return [
            "peer_reviewed_publications",
            "citation_metrics_h_index",
            "research_grants_funded",
            "teaching_load_pedagogy",
            "advisor_principal_investigator",
            "conference_proceedings",
        ]
