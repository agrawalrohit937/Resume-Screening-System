"""
Sales & Revenue Growth Scoring Adapter.
Signals: quota attainment %, ACV, deal cycle length, territory, industry vertical.
"""

from typing import Dict, List, Set, Any
from services.scoring.adapters.base import OccupationAdapter, EligibilityRule


class SalesAdapter(OccupationAdapter):
    adapter_name: str = "SalesAdapter"
    family_codes: Set[str] = {
        "sales", "business_development", "account_executive", "growth", "revenue"
    }

    def feature_weights(self) -> Dict[str, float]:
        """Sales roles prioritize quantifiable revenue attainment and commercial experience."""
        return {
            "track_record": 0.35,
            "experience": 0.30,
            "skills": 0.25,
            "education": 0.10,
        }

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        return []

    def required_evidence(self) -> List[str]:
        return [
            "quota_attainment_percentage",
            "annual_contract_value_acv",
            "sales_cycle_length",
            "assigned_territory_geography",
            "industry_vertical_focus",
            "b2b_vs_b2c_classification",
        ]
