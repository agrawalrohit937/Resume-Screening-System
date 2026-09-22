"""
Adapter Registry and Occupation-Family Detection.
Dispatches jobs to their appropriate domain adapter based on ESCO/NCO/SOC code,
graph ontology lookup, and JD semantic patterns.
"""

import re
from typing import Dict, Optional, List
import structlog

from services.scoring.adapters.base import OccupationAdapter
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

logger = structlog.get_logger(__name__)

# Singleton instances of each adapter
ADAPTER_INSTANCES: Dict[str, OccupationAdapter] = {
    "software_engineering": SoftwareEngineeringAdapter(),
    "healthcare": HealthcareAdapter(),
    "legal_finance": LegalFinanceAdapter(),
    "skilled_trades": SkilledTradesAdapter(),
    "creative_design": CreativeDesignAdapter(),
    "academic_research": AcademicResearchAdapter(),
    "sales": SalesAdapter(),
    "teaching": TeachingAdapter(),
    "hospitality_retail": HospitalityRetailAdapter(),
    "logistics_operations": LogisticsOperationsAdapter(),
    "data_analytics": DataAnalyticsAdapter(),
    "generic": GenericAdapter(),
}

# Inverted mapping from alias/family code to canonical adapter instance
_FAMILY_MAP: Dict[str, OccupationAdapter] = {}
for canonical_key, adapter in ADAPTER_INSTANCES.items():
    _FAMILY_MAP[canonical_key] = adapter
    for code in adapter.family_codes:
        _FAMILY_MAP[code.lower()] = adapter


def detect_occupation_adapter(
    job_title: str = "",
    jd_text: str = "",
    occupation_code: Optional[str] = None,
) -> OccupationAdapter:
    """
    Detects the job's occupation family and returns the appropriate OccupationAdapter.

    Detection Order:
      1. Exact ESCO / NCO / SOC code lookup via graph ontology
      2. Title match via graph ontology (NCO / ESCO alt titles)
      3. Rule-based keyword heuristic on Title + JD text
      4. Fallback to GenericAdapter
    """
    clean_title = (job_title or "").strip()
    full_text = f"{clean_title} {jd_text or ''}".lower()

    # 1. Exact occupation code lookup via graph
    if occupation_code:
        try:
            from services.ontology.graph import get_ontology_graph
            graph = get_ontology_graph()
            occ = graph.find_occupation(code=occupation_code)
            if occ and occ.family_code in _FAMILY_MAP:
                return _FAMILY_MAP[occ.family_code]
        except Exception as e:
            logger.debug("Code lookup failed in adapter detection", error=str(e))

    # 2. Graph title lookup
    if clean_title:
        try:
            from services.ontology.graph import get_ontology_graph
            graph = get_ontology_graph()
            occ = graph.find_occupation(query=clean_title)
            if occ and occ.family_code in _FAMILY_MAP:
                return _FAMILY_MAP[occ.family_code]
        except Exception as e:
            logger.debug("Title lookup failed in adapter detection", error=str(e))

    # 3. Rule-based keyword matching (Ordered by domain specificity)
    # Healthcare
    if re.search(r"\b(nurse|nursing|doctor|physician|clinical|medical|surgeon|hospital|patient care|icu|pharmacist)\b", full_text):
        return ADAPTER_INSTANCES["healthcare"]

    # Legal & Finance
    if re.search(r"\b(lawyer|attorney|paralegal|legal counsel|chartered accountant|statutory audit|tax consultant|cpa|cfa|advocate)\b", full_text):
        return ADAPTER_INSTANCES["legal_finance"]

    # Skilled Trades
    if re.search(r"\b(welder|welding|electrician|wireman|plumber|fitter|machinist|carpenter|fabricator|hvac technician)\b", full_text):
        return ADAPTER_INSTANCES["skilled_trades"]

    # Teaching
    if re.search(r"\b(teacher|school teacher|lecturer|educator|pedagogy|tgt|pgt|prt|b\.ed|ctet|faculty)\b", full_text):
        return ADAPTER_INSTANCES["teaching"]

    # Creative & Design
    if re.search(r"\b(ui/ux|ui designer|ux designer|product designer|graphic designer|visual designer|figma|art director|copywriter)\b", full_text):
        return ADAPTER_INSTANCES["creative_design"]

    # Academic Research
    if re.search(r"\b(postdoc|postdoctoral|research scientist|principal investigator|academic researcher|phd candidate)\b", full_text):
        return ADAPTER_INSTANCES["academic_research"]

    # Logistics & Operations
    if re.search(r"\b(hmv driver|truck driver|commercial driver|cdl|fleet manager|warehouse associate|freight dispatcher|logistics)\b", full_text):
        return ADAPTER_INSTANCES["logistics_operations"]

    # Hospitality & Retail
    if re.search(r"\b(chef|cook|sous chef|culinary|hotel manager|restaurant|waiter|bartender|retail associate|cashier)\b", full_text):
        return ADAPTER_INSTANCES["hospitality_retail"]

    # Sales
    if re.search(r"\b(account executive|sales executive|sales manager|business development|bdr|sdr|enterprise sales)\b", full_text):
        return ADAPTER_INSTANCES["sales"]

    # Data & Analytics
    if re.search(r"\b(data scientist|data analyst|bi analyst|business intelligence|machine learning engineer|analytics engineer)\b", full_text):
        return ADAPTER_INSTANCES["data_analytics"]

    # Software Engineering (Baseline)
    if re.search(r"\b(software|developer|engineer|frontend|backend|full stack|devops|cloud architect|sre|programmer)\b", full_text):
        return ADAPTER_INSTANCES["software_engineering"]

    # Fallback to Generic
    return ADAPTER_INSTANCES["generic"]
