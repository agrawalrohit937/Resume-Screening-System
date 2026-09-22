"""
Generic Conservative Fallback Scoring Adapter.
Used when job title and description cannot be unambiguously classified into a specialized domain.
Applies conservative weights and never assumes domain-specific requirements.
"""

from typing import Dict, List, Set, Any
from services.scoring.adapters.base import OccupationAdapter, EligibilityRule


class GenericAdapter(OccupationAdapter):
    adapter_name: str = "GenericAdapter"
    family_codes: Set[str] = {"generic", "general", "other", "unclassified"}

    def feature_weights(self) -> Dict[str, float]:
        """Conservative, balanced generalist weights."""
        return {
            "skills": 0.40,
            "experience": 0.30,
            "semantic": 0.20,
            "education": 0.10,
        }

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        # Never guess domain-specific requirements
        return []

    def required_evidence(self) -> List[str]:
        return [
            "core_skills",
            "employment_experience",
            "education_credentials",
        ]
