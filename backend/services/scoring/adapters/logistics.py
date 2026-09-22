"""
Logistics, Fleet & Operations Scoring Adapter.
Signals: licence class (LMV/HMV/CDL), endorsements, route familiarity, WMS systems.
"""

import re
from typing import Dict, List, Set, Any, Tuple
from services.scoring.adapters.base import OccupationAdapter, EligibilityRule


class CommercialDriverLicenceRule(EligibilityRule):
    def __init__(self, licence_class: str = "HMV / Commercial"):
        super().__init__(
            rule_id="commercial_driver_licence_required",
            label=f"Active Commercial Driving Licence ({licence_class}) Required",
            severity="hard",
            source="logistics_adapter",
            description="Freight and heavy vehicle operation mandates active statutory commercial driver licensure."
        )

    def evaluate(self, candidate_data: dict, job: Any) -> Tuple[bool, str, List[str]]:
        text = (
            str(candidate_data.get("raw_text") or "")
            + " "
            + " ".join(candidate_data.get("certifications", []) or [])
            + " "
            + " ".join(candidate_data.get("skills", []) or [])
        ).lower()

        patterns = [
            r"\b(hmv|lmv|cdl|heavy motor vehicle|commercial driv(?:er|ing) licen[sc]e|heavy vehicle licence)\b"
        ]
        evidence = []
        for p in patterns:
            m = re.search(p, text)
            if m:
                evidence.append(m.group(0))

        if evidence:
            return True, f"Found commercial driving licence: {evidence[0].upper()}", evidence
        return False, "No commercial driving licence (HMV/CDL) found on profile.", []


class LogisticsOperationsAdapter(OccupationAdapter):
    adapter_name: str = "LogisticsOperationsAdapter"
    family_codes: Set[str] = {
        "logistics_operations", "logistics", "supply_chain", "transportation", "warehousing", "fleet"
    }

    def feature_weights(self) -> Dict[str, float]:
        """Logistics emphasizes valid licences, operational experience, and warehouse systems."""
        return {
            "credentials": 0.35,
            "experience": 0.35,
            "skills": 0.20,
            "education": 0.10,
        }

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        jd_str = ""
        if isinstance(job, dict):
            jd_str = str(job.get("description", "")) + " " + str(job.get("title", ""))
        else:
            jd_str = str(getattr(job, "description", "")) + " " + str(getattr(job, "title", ""))

        jd_lower = jd_str.lower()
        if any(term in jd_lower for term in ("driver", "hmv", "cdl", "truck", "freight transport")):
            return [CommercialDriverLicenceRule()]
        return []

    def required_evidence(self) -> List[str]:
        return [
            "driving_licence_class_lmv_hmv_cdl",
            "hazardous_materials_endorsements",
            "regional_route_familiarity",
            "warehouse_management_systems_wms",
            "safety_dot_compliance_record",
        ]
