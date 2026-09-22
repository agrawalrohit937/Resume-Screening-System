"""
Data & Analytics Scoring Adapter.
Signals: tool depth (SQL, Python, BI), domain of data (fintech, e-commerce, healthcare), statistical methods.
"""

from typing import Dict, List, Set, Any
from services.scoring.adapters.base import OccupationAdapter, EligibilityRule


class DataAnalyticsAdapter(OccupationAdapter):
    adapter_name: str = "DataAnalyticsAdapter"
    family_codes: Set[str] = {
        "data_analytics", "analytics", "bi", "data_science", "statistics", "business_intelligence"
    }

    def feature_weights(self) -> Dict[str, float]:
        """Analytics balances technical tools, statistical grounding, and hands-on analytical experience."""
        return {
            "skills": 0.35,
            "experience": 0.30,
            "semantic": 0.20,
            "education": 0.15,
        }

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        return []

    def required_evidence(self) -> List[str]:
        return [
            "analytical_tool_depth_sql_python_r",
            "bi_reporting_dashboards_powerbi_tableau",
            "domain_data_depth",
            "statistical_methods_applied",
            "predictive_modeling_experience",
        ]
