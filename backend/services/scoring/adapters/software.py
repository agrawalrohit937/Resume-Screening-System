"""
Software Engineering Scoring Adapter.
Preserves baseline system behavior: code repositories, stack depth, system scale.
"""

from typing import Dict, List, Set, Any
from services.scoring.adapters.base import OccupationAdapter, EligibilityRule


class SoftwareEngineeringAdapter(OccupationAdapter):
    adapter_name: str = "SoftwareEngineeringAdapter"
    family_codes: Set[str] = {
        "software_engineering", "tech", "it", "web_development", "devops", "cloud"
    }

    def feature_weights(self) -> Dict[str, float]:
        """Baseline software engineering feature weights."""
        return {
            "skills": 0.40,
            "experience": 0.30,
            "semantic": 0.20,
            "education": 0.10,
        }

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        # Standard software engineering does not have state registration knockouts
        return []

    def required_evidence(self) -> List[str]:
        return [
            "repositories",
            "github_profile",
            "tech_stack_depth",
            "system_scale_mentions",
            "architecture_experience",
        ]
