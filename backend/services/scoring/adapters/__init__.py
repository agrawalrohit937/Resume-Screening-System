"""
Occupation-Family Scoring Adapters Package.
"""

from services.scoring.adapters.base import OccupationAdapter, EligibilityRule
from services.scoring.adapters.registry import detect_occupation_adapter, ADAPTER_INSTANCES
from services.scoring.adapters.definitions import (
    SoftwareEngineeringAdapter,
    HealthcareAdapter,
    LegalFinanceAdapter,
    SkilledTradesAdapter,
    CreativeDesignAdapter,
    AcademicResearchAdapter,
    SalesAdapter,
    TeachingAdapter,
    HospitalityRetailAdapter,
    LogisticsOperationsAdapter,
    DataAnalyticsAdapter,
    GenericAdapter,
    HealthcareLicenceRule,
    ProfessionalCharterRule,
    TeacherCertificationRule,
    PortfolioURLRule,
    CommercialDriverLicenceRule,
)

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
