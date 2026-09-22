"""
Skilled Trades Scoring Adapter.
Signals: trade certifications (welding 6G, electrical wireman licence), physical requirements,
equipment operated, safety record, shift/travel willingness.
"""

from typing import Dict, List, Set, Any
from services.scoring.adapters.base import OccupationAdapter, EligibilityRule


class SkilledTradesAdapter(OccupationAdapter):
    adapter_name: str = "SkilledTradesAdapter"
    family_codes: Set[str] = {
        "skilled_trades", "trades", "construction", "welding", "electrical", "plumbing", "manufacturing"
    }

    def feature_weights(self) -> Dict[str, float]:
        """Trades prioritize practical skills and safety/trade certifications."""
        return {
            "credentials": 0.35,
            "skills": 0.35,
            "experience": 0.20,
            "education": 0.10,
        }

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        return []

    def required_evidence(self) -> List[str]:
        return [
            "trade_certifications",
            "welding_class_or_wireman_licence",
            "equipment_operated",
            "safety_record_osha_nebosh",
            "physical_stamina_indicators",
            "shift_travel_availability",
        ]
