"""
Legal & Finance Scoring Adapter.
Signals: Bar enrolment, CA / CPA / CFA level and jurisdiction, articleship, regulated-role clearances.
"""

import re
from typing import Dict, List, Set, Any, Tuple
from services.scoring.adapters.base import OccupationAdapter, EligibilityRule


class ProfessionalCharterRule(EligibilityRule):
    def __init__(self, designation: str = "CA / CPA / Bar"):
        super().__init__(
            rule_id="professional_charter_required",
            label=f"Mandatory {designation} Charter / Bar Enrolment",
            severity="hard",
            source="legal_finance_adapter",
            description="Regulated legal or accounting practice requires statutory registration."
        )
        self.designation = designation

    def evaluate(self, candidate_data: dict, job: Any) -> Tuple[bool, str, List[str]]:
        text = (
            str(candidate_data.get("raw_text") or "")
            + " "
            + " ".join(candidate_data.get("certifications", []) or [])
            + " "
            + " ".join(candidate_data.get("skills", []) or [])
        ).lower()

        patterns = [
            r"\b(chartered accountant|icai|cpa|cfa|bar council|advocate|solicitor|llb|llm|bar enrolment)\b",
            r"\b(membership\s*(?:no|number|#)?\s*[:\-]?\s*[a-z0-9\-]{4,})\b"
        ]
        evidence = []
        for p in patterns:
            m = re.search(p, text)
            if m:
                evidence.append(m.group(0))

        if evidence:
            return True, f"Found charter / Bar registration evidence: {evidence[0]}", evidence
        return False, "No statutory charter (CA/CPA/Bar) found on profile.", []


class LegalFinanceAdapter(OccupationAdapter):
    adapter_name: str = "LegalFinanceAdapter"
    family_codes: Set[str] = {
        "legal_finance", "legal", "finance", "accounting", "audit", "compliance", "tax"
    }

    def feature_weights(self) -> Dict[str, float]:
        return {
            "credentials": 0.35,
            "experience": 0.30,
            "skills": 0.25,
            "education": 0.10,
        }

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        jd_str = ""
        if isinstance(job, dict):
            jd_str = str(job.get("description", "")) + " " + str(job.get("title", ""))
        else:
            jd_str = str(getattr(job, "description", "")) + " " + str(getattr(job, "title", ""))

        jd_lower = jd_str.lower()
        if any(term in jd_lower for term in ("chartered accountant", "ca required", "bar council", "cpa", "statutory audit")):
            return [ProfessionalCharterRule()]
        return []

    def required_evidence(self) -> List[str]:
        return [
            "bar_enrolment",
            "ca_cpa_cfa_level",
            "jurisdiction",
            "articleship_completion",
            "regulated_clearances",
        ]
