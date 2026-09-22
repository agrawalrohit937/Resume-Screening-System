"""
Base classes for Occupation-Family Scoring Adapters.
Defines domain-specific feature weights, eligibility knockouts, and evidence attribution.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Set, Tuple, Optional, Any, Callable


@dataclass
class EligibilityRule:
    """Represents a domain-specific eligibility rule."""
    rule_id: str
    label: str
    severity: str = "hard"  # "hard" | "soft"
    source: str = "adapter_rule"
    description: str = ""

    def evaluate(self, candidate_data: dict, job: Any) -> Tuple[bool, str, List[str]]:
        """
        Default stub. Subclasses or rule instances supply evaluation logic.
        Returns: (passed, observed_text, evidence_list)
        """
        return True, "Default pass", []


class OccupationAdapter(ABC):
    """
    Abstract Base Class for domain scoring adapters.
    Each adapter customizes:
      1. feature_weights(): relative weight distribution
      2. eligibility_rules(job): hard/soft knockouts specific to the domain
      3. required_evidence(): key signals extracted for recruiter review
      4. score_domain_signals(): scoring bonus or penalties for domain specific assets
    """
    adapter_name: str = "BaseAdapter"
    family_codes: Set[str] = set()

    @abstractmethod
    def feature_weights(self) -> Dict[str, float]:
        """Returns feature weights dictionary."""
        pass

    @abstractmethod
    def eligibility_rules(self, job: Any) -> List[EligibilityRule]:
        """Returns domain-specific eligibility rules for the given job."""
        pass

    @abstractmethod
    def required_evidence(self) -> List[str]:
        """Returns list of evidence types to extract from the candidate's profile."""
        pass

    def score_domain_signals(
        self, candidate_data: dict, job_data: dict, shared_features: dict
    ) -> float:
        """
        Computes domain-specific score adjustment [0.0 - 1.0].
        Defaults to 1.0 (no penalty).
        """
        return 1.0
