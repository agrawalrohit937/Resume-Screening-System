"""
Continuous Adverse-Impact Monitoring and NYC Local Law 144 Compliance Engine.
Monitors selection rates and impact ratios per demographic group across recruitment stages,
enforcing the EEOC / OFCCP 4/5ths Rule (80% rule) and generating NYC LL144 audit tables.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple
import structlog

logger = structlog.get_logger(__name__)

# Statutory 4/5ths (80%) Rule Threshold
FOUR_FIFTHS_RULE_THRESHOLD: float = 0.80


@dataclass
class GroupMetric:
    group_name: str
    total_applicants: int
    selected_count: int
    selection_rate: float
    impact_ratio: float
    adverse_impact: bool

    def to_dict(self) -> Dict[str, Any]:
        return {
            "group_name": self.group_name,
            "total_applicants": self.total_applicants,
            "selected_count": self.selected_count,
            "selection_rate": round(self.selection_rate, 4),
            "impact_ratio": round(self.impact_ratio, 4),
            "adverse_impact": self.adverse_impact,
        }


@dataclass
class AdverseImpactReport:
    demographic_dimension: str
    stage: str
    total_pool_size: int
    baseline_group: str
    baseline_selection_rate: float
    group_metrics: List[GroupMetric] = field(default_factory=list)
    adverse_impact_detected: bool = False
    regulatory_verdict: str = "PASS"  # "PASS" | "WARNING_ADVERSE_IMPACT"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "demographic_dimension": self.demographic_dimension,
            "stage": self.stage,
            "total_pool_size": self.total_pool_size,
            "baseline_group": self.baseline_group,
            "baseline_selection_rate": round(self.baseline_selection_rate, 4),
            "group_metrics": [g.to_dict() for g in self.group_metrics],
            "adverse_impact_detected": self.adverse_impact_detected,
            "regulatory_verdict": self.regulatory_verdict,
        }


def compute_adverse_impact_report(
    records: List[Dict[str, Any]],
    demographic_key: str = "gender",
    stage: str = "shortlisted",
    selected_stages: Optional[Set[str]] = None,
) -> AdverseImpactReport:
    """
    Computes selection rates and 4/5ths impact ratios for a given demographic dimension.

    Formula:
        Selection_Rate(G) = Count(G ∩ Selected) / Count(G)
        Baseline_Rate = max_{G} Selection_Rate(G)
        Impact_Ratio(G) = Selection_Rate(G) / Baseline_Rate
        Adverse_Impact(G) = True iff Impact_Ratio(G) < 0.80

    Complexity:
        Time: O(N_records) single pass aggregation.
        Space: O(G) unique demographic groups.
    """
    valid_selected = selected_stages or {"shortlisted", "interview", "hired", "offer", "accepted"}

    group_totals: Dict[str, int] = {}
    group_selected: Dict[str, int] = {}

    for item in records:
        group_val = str(item.get(demographic_key) or "unspecified").strip().lower()
        if not group_val or group_val in ("unknown", "prefer_not_to_say"):
            group_val = "unspecified"

        group_totals[group_val] = group_totals.get(group_val, 0) + 1

        app_stage = str(item.get("stage") or item.get("status") or "").strip().lower()
        if app_stage in valid_selected:
            group_selected[group_val] = group_selected.get(group_val, 0) + 1

    if not group_totals:
        return AdverseImpactReport(
            demographic_dimension=demographic_key,
            stage=stage,
            total_pool_size=0,
            baseline_group="none",
            baseline_selection_rate=0.0,
        )

    # Compute selection rate per group
    selection_rates: Dict[str, float] = {}
    for g, total in group_totals.items():
        sel = group_selected.get(g, 0)
        selection_rates[g] = (sel / total) if total > 0 else 0.0

    # Baseline group has the highest selection rate (with at least min samples)
    eligible_baseline_groups = [g for g, count in group_totals.items() if count >= 5]
    if not eligible_baseline_groups:
        eligible_baseline_groups = list(group_totals.keys())

    baseline_group = max(eligible_baseline_groups, key=lambda g: selection_rates[g])
    baseline_rate = selection_rates[baseline_group]

    any_adverse = False
    metrics: List[GroupMetric] = []

    for g, total in sorted(group_totals.items()):
        rate = selection_rates[g]
        if baseline_rate > 0:
            ratio = rate / baseline_rate
        else:
            ratio = 1.0

        is_adverse = bool(ratio < FOUR_FIFTHS_RULE_THRESHOLD and total >= 5)
        if is_adverse:
            any_adverse = True

        metrics.append(GroupMetric(
            group_name=g,
            total_applicants=total,
            selected_count=group_selected.get(g, 0),
            selection_rate=rate,
            impact_ratio=ratio,
            adverse_impact=is_adverse,
        ))

    verdict = "WARNING_ADVERSE_IMPACT" if any_adverse else "PASS"

    return AdverseImpactReport(
        demographic_dimension=demographic_key,
        stage=stage,
        total_pool_size=len(records),
        baseline_group=baseline_group,
        baseline_selection_rate=baseline_rate,
        group_metrics=metrics,
        adverse_impact_detected=any_adverse,
        regulatory_verdict=verdict,
    )


def compute_impact_ratios(
    selections: Dict[str, Dict[str, int]],
    benchmark_group: Optional[str] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    Computes selection rates and impact ratios from group summary counts.

    selections format:
      {"group_name": {"total": int, "selected": int}}
    """
    rates: Dict[str, float] = {}
    for g, counts in selections.items():
        tot = counts.get("total", 0)
        sel = counts.get("selected", 0)
        rates[g] = (sel / tot) if tot > 0 else 0.0

    if not benchmark_group:
        benchmark_group = max(rates.keys(), key=lambda g: rates[g]) if rates else "none"

    benchmark_rate = rates.get(benchmark_group, 0.0)

    report: Dict[str, Dict[str, Any]] = {}
    for g, counts in selections.items():
        rate = rates[g]
        ratio = (rate / benchmark_rate) if benchmark_rate > 0 else 1.0
        adverse = bool(ratio < FOUR_FIFTHS_RULE_THRESHOLD)
        report[g] = {
            "total": counts.get("total", 0),
            "selected": counts.get("selected", 0),
            "selection_rate": rate,
            "impact_ratio": ratio,
            "adverse_impact": adverse,
        }
    return report


def check_selection_rate_equity(
    selections: Dict[str, Dict[str, int]],
    benchmark_group: Optional[str] = None,
) -> Dict[str, Any]:
    """Checks 4/5ths rule equity across candidate demographic groups."""
    report = compute_impact_ratios(selections, benchmark_group=benchmark_group)
    flagged = [g for g, metrics in report.items() if metrics["adverse_impact"]]
    return {
        "has_adverse_impact": len(flagged) > 0,
        "flagged_groups": flagged,
        "detail": report,
    }

