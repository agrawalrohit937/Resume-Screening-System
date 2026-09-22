"""
Teaching & Education Scoring Adapter.
Signals: B.Ed / TET / CTET, subject + grade band, board (CBSE / ICSE / State), medium of instruction.
"""

import re
from typing import Dict, List, Set, Any, Tuple
from services.scoring.adapters.base import OccupationAdapter, EligibilityRule


class TeacherCertificationRule(EligibilityRule):
    def __init__(self):
        super().__init__(
            rule_id="teacher_certification_required",
            label="Mandatory B.Ed / TET / CTET Teaching Certification",
            severity="hard",
            source="teaching_adapter",
            description="Institutional teaching positions mandate statutory B.Ed or TET eligibility."
        )

    def evaluate(self, candidate_data: dict, job: Any) -> Tuple[bool, str, List[str]]:
        text = (
            str(candidate_data.get("raw_text") or "")
            + " "
            + " ".join(candidate_data.get("certifications", []) or [])
            + " "
            + " ".join([str(e.get("degree", "")) for e in (candidate_data.get("education", []) or []) if isinstance(e, dict)])
        ).lower()

        patterns = [
            r"\b(b\.?ed|bed|bachelor of education|tet|ctet|pgt|tgt|prt|net|set|qts)\b"
        ]
        evidence = []
        for p in patterns:
            m = re.search(p, text)
            if m:
                evidence.append(m.group(0))

        if evidence:
            return True, f"Found teaching credential: {evidence[0].upper()}", evidence
        return False, "No B.Ed / CTET / TET teaching qualification found on profile.", []


class TeachingAdapter(OccupationAdapter):
    adapter_name: str = "TeachingAdapter"
    family_codes: Set[str] = {
        "teaching", "education", "k12", "higher_ed", "pedagogy"
    }

    def feature_weights(self) -> Dict[str, float]:
        """Teaching evaluates credentials, pedagogical subject knowledge, and education degree."""
        return {
            "credentials": 0.35,
            "education": 0.30,
            "experience": 0.20,
            "skills": 0.15,
        }

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        jd_str = ""
        if isinstance(job, dict):
            jd_str = str(job.get("description", "")) + " " + str(job.get("title", ""))
        else:
            jd_str = str(getattr(job, "description", "")) + " " + str(getattr(job, "title", ""))

        jd_lower = jd_str.lower()
        if any(term in jd_lower for term in ("b.ed", "bed required", "ctet", "tet", "school teacher", "pgt", "tgt")):
            return [TeacherCertificationRule()]
        return []

    def required_evidence(self) -> List[str]:
        return [
            "b_ed_ctet_tet_qualifications",
            "subject_matter_expertise",
            "grade_band_primary_secondary",
            "curriculum_board_cbse_icse_ib",
            "medium_of_instruction_languages",
        ]
