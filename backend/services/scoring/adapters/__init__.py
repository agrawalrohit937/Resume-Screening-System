"""
Occupation-Family Scoring Adapters Package.
"""

from services.scoring.adapters.base import OccupationAdapter, EligibilityRule
from services.scoring.adapters.registry import detect_occupation_adapter, ADAPTER_INSTANCES
from services.scoring.adapters.software import SoftwareEngineeringAdapter
from services.scoring.adapters.healthcare import HealthcareAdapter
from services.scoring.adapters.legal_finance import LegalFinanceAdapter
from services.scoring.adapters.skilled_trades import SkilledTradesAdapter
from services.scoring.adapters.creative_design import CreativeDesignAdapter
from services.scoring.adapters.academic import AcademicResearchAdapter
from services.scoring.adapters.sales import SalesAdapter
from services.scoring.adapters.teaching import TeachingAdapter
from services.scoring.adapters.hospitality import HospitalityRetailAdapter
from services.scoring.adapters.logistics import LogisticsOperationsAdapter
from services.scoring.adapters.data_analytics import DataAnalyticsAdapter
from services.scoring.adapters.generic import GenericAdapter

__all__ = [
    "OccupationAdapter",
    "EligibilityRule",
    "detect_occupation_adapter",
    "ADAPTER_INSTANCES",
    "SoftwareEngineeringAdapter",
    "HealthcareAdapter",
    "LegalFinanceAdapter",
    "SkilledTradesAdapter",
    "CreativeDesignAdapter",
    "AcademicResearchAdapter",
    "SalesAdapter",
    "TeachingAdapter",
    "HospitalityRetailAdapter",
    "LogisticsOperationsAdapter",
    "DataAnalyticsAdapter",
    "GenericAdapter",
]
