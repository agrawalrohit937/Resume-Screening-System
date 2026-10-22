"""
Unified Occupation-Family Scoring Adapters and Domain Rules.
Consolidates all 12 occupation families and specialized eligibility rules.
"""

import re
from typing import Dict, List, Set, Any, Tuple
from services.scoring.adapters.base import OccupationAdapter, EligibilityRule


# ==============================================================================
# Domain Eligibility Rules
# ==============================================================================

class HealthcareLicenceRule(EligibilityRule):
    """Verifies mandatory RN / medical registration for healthcare roles."""
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
        creds = candidate_data.get("credentials", []) or []
        for c in creds:
            c_type = str(c.get("type", "") if isinstance(c, dict) else getattr(c, "type", "")).lower()
            if self.required_licence in c_type or c_type in self.required_licence:
                reg_num = c.get("registration_number") if isinstance(c, dict) else getattr(c, "registration_number", None)
                return True, f"Verified active licence: {c_type.upper()} ({reg_num or 'attested'})", [f"{c_type.upper()}:{reg_num}"]

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


class ProfessionalCharterRule(EligibilityRule):
    """Verifies statutory charter (CA / CPA / Bar) for legal and accounting roles."""
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


class TeacherCertificationRule(EligibilityRule):
    """Verifies statutory B.Ed / TET / CTET for institutional teaching roles."""
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


class PortfolioURLRule(EligibilityRule):
    """Checks for design portfolio or case study URL (soft advisory)."""
    def __init__(self):
        super().__init__(
            rule_id="portfolio_url_required",
            label="Design Portfolio / Case Study Artifact Required",
            severity="soft",
            source="creative_design_adapter",
            description="Creative roles require direct visual demonstration of design thinking."
        )

    def evaluate(self, candidate_data: dict, job: Any) -> Tuple[bool, str, List[str]]:
        text = str(candidate_data.get("raw_text") or "")
        urls = candidate_data.get("links", []) or []
        for u in urls:
            text += f" {u}"

        portfolio_patterns = [
            r"https?://(?:www\.)?(?:behance\.net|dribbble\.com|figma\.com|notion\.so|github\.io|[a-z0-9\-]+\.design|[a-z0-9\-]+\.me)[^\s]*",
            r"\b(portfolio|case studies|design showcase)\b\s*[:\-]?\s*(https?://[^\s]+)"
        ]
        found = []
        for p in portfolio_patterns:
            matches = re.findall(p, text, re.IGNORECASE)
            for m in matches:
                found.append(m if isinstance(m, str) else m[1])

        if found:
            return True, f"Found portfolio artifact link: {found[0]}", found
        return False, "No design portfolio URL found (Dribbble/Behance/Figma/Personal).", []


class CommercialDriverLicenceRule(EligibilityRule):
    """Verifies commercial driver licence for logistics and freight roles."""
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


# ==============================================================================
# Domain Scoring Adapters (12 Families)
# ==============================================================================

class SoftwareEngineeringAdapter(OccupationAdapter):
    adapter_name: str = "SoftwareEngineeringAdapter"
    family_codes: Set[str] = {"software_engineering", "tech", "it", "web_development", "devops", "cloud"}

    def feature_weights(self) -> Dict[str, float]:
        return {"skills": 0.40, "experience": 0.30, "semantic": 0.20, "education": 0.10}

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        return []

    def required_evidence(self) -> List[str]:
        return ["repositories", "github_profile", "tech_stack_depth", "system_scale_mentions", "architecture_experience"]


class HealthcareAdapter(OccupationAdapter):
    adapter_name: str = "HealthcareAdapter"
    family_codes: Set[str] = {"healthcare", "nursing", "medical", "clinical", "pharmacy", "allied_health"}

    def feature_weights(self) -> Dict[str, float]:
        return {"credentials": 0.35, "experience": 0.35, "skills": 0.20, "education": 0.10}

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        jd_str = f"{job.get('description', '') if isinstance(job, dict) else getattr(job, 'description', '')} {job.get('title', '') if isinstance(job, dict) else getattr(job, 'title', '')}".lower()
        if any(term in jd_str for term in ("rn", "registered nurse", "licen", "nmc", "gmc", "mbbs")):
            return [HealthcareLicenceRule("RN / Nursing / Medical Registration")]
        return []

    def required_evidence(self) -> List[str]:
        return ["licence_number", "registry_verification_nmc_rn", "clinical_hours", "clinical_specialty", "shift_availability", "immunization_records"]


class LegalFinanceAdapter(OccupationAdapter):
    adapter_name: str = "LegalFinanceAdapter"
    family_codes: Set[str] = {"legal_finance", "legal", "finance", "accounting", "audit", "compliance", "tax"}

    def feature_weights(self) -> Dict[str, float]:
        return {"credentials": 0.35, "experience": 0.30, "skills": 0.25, "education": 0.10}

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        jd_str = f"{job.get('description', '') if isinstance(job, dict) else getattr(job, 'description', '')} {job.get('title', '') if isinstance(job, dict) else getattr(job, 'title', '')}".lower()
        if any(term in jd_str for term in ("chartered accountant", "ca required", "bar council", "cpa", "statutory audit")):
            return [ProfessionalCharterRule()]
        return []

    def required_evidence(self) -> List[str]:
        return ["bar_enrolment", "ca_cpa_cfa_level", "jurisdiction", "articleship_completion", "regulated_clearances"]


class SkilledTradesAdapter(OccupationAdapter):
    adapter_name: str = "SkilledTradesAdapter"
    family_codes: Set[str] = {"skilled_trades", "trades", "construction", "welding", "electrical", "plumbing", "manufacturing"}

    def feature_weights(self) -> Dict[str, float]:
        return {"experience": 0.40, "credentials": 0.35, "skills": 0.20, "education": 0.05}

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        return []

    def required_evidence(self) -> List[str]:
        return ["trade_certifications_iti_apprenticeship", "safety_certifications_osha", "hands_on_hours", "equipment_machinery_operated", "physical_site_clearance"]


class CreativeDesignAdapter(OccupationAdapter):
    adapter_name: str = "CreativeDesignAdapter"
    family_codes: Set[str] = {"creative_design", "design", "ui_ux", "graphic_design", "multimedia", "copywriting"}

    def feature_weights(self) -> Dict[str, float]:
        return {"portfolio": 0.35, "skills": 0.35, "experience": 0.15, "semantic": 0.10, "education": 0.05}

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        return [PortfolioURLRule()]

    def required_evidence(self) -> List[str]:
        return ["portfolio_url", "behance_dribbble_figma_links", "artifact_visual_design", "tool_fluency_figma_sketch", "user_research_deliverables"]


class AcademicResearchAdapter(OccupationAdapter):
    adapter_name: str = "AcademicResearchAdapter"
    family_codes: Set[str] = {"academic_research", "academia", "research", "scientific", "postdoc"}

    def feature_weights(self) -> Dict[str, float]:
        return {"publications": 0.30, "experience": 0.25, "education": 0.25, "skills": 0.20}

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        return []

    def required_evidence(self) -> List[str]:
        return ["peer_reviewed_publications", "citation_metrics_h_index", "research_grants_funded", "teaching_load_pedagogy", "advisor_principal_investigator", "conference_proceedings"]


class SalesAdapter(OccupationAdapter):
    adapter_name: str = "SalesAdapter"
    family_codes: Set[str] = {"sales", "business_development", "account_management", "commercial", "revenue"}

    def feature_weights(self) -> Dict[str, float]:
        return {"experience": 0.40, "skills": 0.30, "semantic": 0.20, "education": 0.10}

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        return []

    def required_evidence(self) -> List[str]:
        return ["quota_attainment_percentages", "revenue_generated_arr_acv", "deal_sizes_closed", "crm_systems_salesforce_hubspot", "territory_client_verticals"]


class TeachingAdapter(OccupationAdapter):
    adapter_name: str = "TeachingAdapter"
    family_codes: Set[str] = {"teaching", "education", "k12", "higher_ed", "pedagogy"}

    def feature_weights(self) -> Dict[str, float]:
        return {"credentials": 0.35, "education": 0.30, "experience": 0.20, "skills": 0.15}

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        jd_str = f"{job.get('description', '') if isinstance(job, dict) else getattr(job, 'description', '')} {job.get('title', '') if isinstance(job, dict) else getattr(job, 'title', '')}".lower()
        if any(term in jd_str for term in ("b.ed", "bed required", "ctet", "tet", "school teacher", "pgt", "tgt")):
            return [TeacherCertificationRule()]
        return []

    def required_evidence(self) -> List[str]:
        return ["b_ed_ctet_tet_qualifications", "subject_matter_expertise", "grade_band_primary_secondary", "curriculum_board_cbse_icse_ib", "medium_of_instruction_languages"]


class HospitalityRetailAdapter(OccupationAdapter):
    adapter_name: str = "HospitalityRetailAdapter"
    family_codes: Set[str] = {"hospitality_retail", "hospitality", "hotel", "restaurant", "retail", "culinary", "food_beverage"}

    def feature_weights(self) -> Dict[str, float]:
        return {"experience": 0.45, "skills": 0.30, "credentials": 0.15, "education": 0.10}

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        return []

    def required_evidence(self) -> List[str]:
        return ["food_safety_certifications_fssai_servsafe", "shift_availability_nights_weekends", "pos_systems_operated", "customer_service_volume_metrics", "culinary_station_proficiencies"]


class LogisticsOperationsAdapter(OccupationAdapter):
    adapter_name: str = "LogisticsOperationsAdapter"
    family_codes: Set[str] = {"logistics_operations", "logistics", "supply_chain", "transportation", "warehousing", "fleet"}

    def feature_weights(self) -> Dict[str, float]:
        return {"credentials": 0.35, "experience": 0.35, "skills": 0.20, "education": 0.10}

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        jd_str = f"{job.get('description', '') if isinstance(job, dict) else getattr(job, 'description', '')} {job.get('title', '') if isinstance(job, dict) else getattr(job, 'title', '')}".lower()
        if any(term in jd_str for term in ("driver", "hmv", "cdl", "truck", "freight transport")):
            return [CommercialDriverLicenceRule()]
        return []

    def required_evidence(self) -> List[str]:
        return ["driving_licence_class_lmv_hmv_cdl", "hazardous_materials_endorsements", "regional_route_familiarity", "warehouse_management_systems_wms", "safety_dot_compliance_record"]


class DataAnalyticsAdapter(OccupationAdapter):
    adapter_name: str = "DataAnalyticsAdapter"
    family_codes: Set[str] = {"data_analytics", "analytics", "bi", "data_science", "statistics", "business_intelligence"}

    def feature_weights(self) -> Dict[str, float]:
        return {"skills": 0.35, "experience": 0.30, "semantic": 0.20, "education": 0.15}

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        return []

    def required_evidence(self) -> List[str]:
        return ["analytical_tool_depth_sql_python_r", "bi_reporting_dashboards_powerbi_tableau", "domain_data_depth", "statistical_methods_applied", "predictive_modeling_experience"]


class GenericAdapter(OccupationAdapter):
    adapter_name: str = "GenericAdapter"
    family_codes: Set[str] = {"generic", "other", "general"}

    def feature_weights(self) -> Dict[str, float]:
        return {"skills": 0.40, "experience": 0.30, "semantic": 0.20, "education": 0.10}

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        return []

    def required_evidence(self) -> List[str]:
        return ["general_skills", "career_trajectory", "key_achievements", "education_credentials"]
