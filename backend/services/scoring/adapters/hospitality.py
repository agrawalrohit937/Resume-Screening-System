"""
Hospitality & Retail Scoring Adapter.
Signals: availability windows, languages spoken, food-safety certification (FSSAI/ServSafe), customer volume.
"""

from typing import Dict, List, Set, Any
from services.scoring.adapters.base import OccupationAdapter, EligibilityRule


class HospitalityRetailAdapter(OccupationAdapter):
    adapter_name: str = "HospitalityRetailAdapter"
    family_codes: Set[str] = {
        "hospitality_retail", "hospitality", "retail", "food_beverage", "restaurant", "hotel", "customer_service"
    }

    def feature_weights(self) -> Dict[str, float]:
        """Hospitality and retail balance practical experience, shift flexibility, and customer skills."""
        return {
            "experience": 0.35,
            "skills": 0.30,
            "credentials": 0.25,
            "education": 0.10,
        }

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        return []

    def required_evidence(self) -> List[str]:
        return [
            "shift_availability_windows",
            "multilingual_fluency_languages",
            "food_safety_certifications_fssai_servsafe",
            "peak_customer_volume_handling",
            "pos_cash_handling_experience",
        ]
