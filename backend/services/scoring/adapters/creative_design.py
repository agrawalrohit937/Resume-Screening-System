"""
Creative & Design Scoring Adapter.
Signals: Portfolio URL presence and artifact analysis, tool fluency — years are near-irrelevant.
"""

import re
from typing import Dict, List, Set, Any, Tuple
from services.scoring.adapters.base import OccupationAdapter, EligibilityRule


class PortfolioURLRule(EligibilityRule):
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


class CreativeDesignAdapter(OccupationAdapter):
    adapter_name: str = "CreativeDesignAdapter"
    family_codes: Set[str] = {
        "creative_design", "design", "ui_ux", "graphic_design", "multimedia", "copywriting"
    }

    def feature_weights(self) -> Dict[str, float]:
        """Years of experience are downweighted; portfolio and tool fluency dominate."""
        return {
            "portfolio": 0.35,
            "skills": 0.35,
            "experience": 0.15,
            "semantic": 0.10,
            "education": 0.05,
        }

    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        return [PortfolioURLRule()]

    def required_evidence(self) -> List[str]:
        return [
            "portfolio_url",
            "behance_dribbble_figma_links",
            "artifact_visual_design",
            "tool_fluency_figma_sketch",
            "user_research_deliverables",
        ]
