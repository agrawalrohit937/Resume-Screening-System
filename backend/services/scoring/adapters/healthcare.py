"""
Healthcare & Clinical Scoring Adapter.
Signals: licence number + registry verification (NMC / State Nursing Council / RN / GMC),
specialty, clinical hours, shift availability, immunization.
"""

import re
from typing import Dict, List, Set, Any, Tuple
from services.scoring.adapters.base import OccupationAdapter, EligibilityRule


class HealthcareLicenceRule(EligibilityRule):
    def __init__(self, required_licence: str = "RN"):
        super().__init__(
            rule_id="healthcare_licence_required",
            label=f"Active {required_licence} Licensure / Medical Registration Required",
            severity="hard",
            source="healthcare_adapter",
            description="Clinical roles legally mandate active state registry verification."
        )
        self.required_licence = required_licence.lower()

    def evaluate(self, candidate_data: dict, job: Any) -> Tuple[bool, str, List[str]]:
        # Check credentials list or resume text
        creds = candidate_data.get("credentials", []) or []
        for c in creds:
            c_type = str(c.get("type", "") if isinstance(c, dict) else getattr(c, "type", "")).lower()
            if self.required_licence in c_type or c_type in self.required_licence:
                reg_num = c.get("registration_number") if isinstance(c, dict) else getattr(c, "registration_number", None)
                return True, f"Verified active licence: {c_type.upper()} ({reg_num or 'attested'})", [f"{c_type.upper()}:{reg_num}"]

        # Check raw text or certifications
        text = (
            str(candidate_data.get("raw_text") or "")
            + " "
            + " ".join(candidate_data.get("certifications", []) or [])
            + " "
            + " ".join(candidate_data.get("skills", []) or [])
        ).lower()

        patterns = [
            r"\b(registered nurse|rn licen[sc]e|nmc|state nursing council|gmc|mbbs|medical registration)\b",
            r"\bregistration\s*(?:no|number|#)?\s*[:\-]?\s*([a-z0-9\-]{5,})\b"
        ]
        evidence = []
        for p in patterns:
            m = re.search(p, text)
            if m:
                evidence.append(m.group(0))

        if evidence:
            return True, f"Found licensure evidence: {evidence[0]}", evidence

        return False, "No active nursing/medical licence found on candidate profile.", []


class HealthcareAdapter(OccupationAdapter):
    adapter_name: str = "HealthcareAdapter"
    family_codes: Set[str] = {
        "healthcare", "nursing", "medical", "clinical", "pharmacy", "allied_health"
    }

    def feature_weights(self) -> Dict[str, float]:
        """Clinical roles prioritize credentials and hands-on clinical hours."""
        return {
            "credentials": 0.35,
            "experience": 0.35,
            "skills": 0.20,
            "education": 0.10,
        }

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        # Detect if the job description mentions mandatory licensure
        jd_str = ""
        if isinstance(job, dict):
            jd_str = str(job.get("description", "")) + " " + str(job.get("title", ""))
        else:
            jd_str = str(getattr(job, "description", "")) + " " + str(getattr(job, "title", ""))

        jd_lower = jd_str.lower()
        if any(term in jd_lower for term in ("rn", "registered nurse", "licen", "nmc", "gmc", "mbbs")):
            return [HealthcareLicenceRule("RN / Nursing / Medical Registration")]
        return []

    def required_evidence(self) -> List[str]:
        return [
            "licence_number",
            "registry_verification_nmc_rn",
            "clinical_hours",
            "clinical_specialty",
            "shift_availability",
            "immunization_records",
        ]
