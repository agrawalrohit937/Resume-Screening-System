"""
Fairness and Bias Audit Module (Phase 8).
Provides adverse-impact ratio (four-fifths rule), score-gap analysis, and
counterfactual perturbation testing across demographic attributes.
Audit attributes are computed on audit records ONLY and never used as scoring features.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import structlog

logger = structlog.get_logger(__name__)


def compute_adverse_impact_ratio(
    selection_rates: Dict[str, float],
    reference_group: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Computes the Adverse Impact Ratio (AIR) under the US EEOC Four-Fifths (80%) Rule.
    AIR = Selection_Rate(Protected) / Selection_Rate(Reference)
    AIR >= 0.80 indicates compliance with the four-fifths standard.
    
    Time Complexity: O(G) where G = number of groups
    """
    if not selection_rates:
        return {"compliant": True, "ratios": {}, "min_air": 1.0}

    ref_grp = reference_group or max(selection_rates, key=selection_rates.get)
    ref_rate = max(1e-6, selection_rates[ref_grp])

    ratios = {}
    is_compliant = True
    min_air = 1.0

    for grp, rate in selection_rates.items():
        air = rate / ref_rate
        ratios[grp] = round(air, 3)
        if air < min_air:
            min_air = air
        if air < 0.80:
            is_compliant = False

    return {
        "reference_group": ref_grp,
        "reference_rate": round(ref_rate, 4),
        "ratios": ratios,
        "min_air": round(min_air, 3),
        "four_fifths_compliant": is_compliant,
    }


def compute_group_score_gaps(
    group_scores: Dict[str, List[float]],
    min_sample_size: int = 30,
) -> Dict[str, Any]:
    """
    Computes statistical score gaps (mean difference, Cohen's d effect size) across groups.
    Enforces minimum sample-size guard to prevent unreliable metrics on small datasets.
    """
    results: Dict[str, Any] = {}

    all_groups = list(group_scores.keys())
    for i in range(len(all_groups)):
        for j in range(i + 1, len(all_groups)):
            g1, g2 = all_groups[i], all_groups[j]
            s1 = np.array(group_scores[g1], dtype=np.float64)
            s2 = np.array(group_scores[g2], dtype=np.float64)

            n1, n2 = len(s1), len(s2)
            pair_key = f"{g1}_vs_{g2}"

            if n1 < min_sample_size or n2 < min_sample_size:
                results[pair_key] = {
                    "sample_sizes": {g1: n1, g2: n2},
                    "insufficient_sample": True,
                    "min_required": min_sample_size,
                    "mean_diff": None,
                    "cohens_d": None,
                }
                continue

            m1, m2 = float(np.mean(s1)), float(np.mean(s2))
            var1, var2 = float(np.var(s1, ddof=1)), float(np.var(s2, ddof=1))
            pooled_std = math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / max(1, n1 + n2 - 2)) or 1e-6
            cohens_d = (m1 - m2) / pooled_std

            results[pair_key] = {
                "sample_sizes": {g1: n1, g2: n2},
                "insufficient_sample": False,
                "mean_diff": round(m1 - m2, 2),
                "cohens_d": round(cohens_d, 3),
                "group_means": {g1: round(m1, 2), g2: round(m2, 2)},
            }

    return results


def run_counterfactual_fairness_test(
    scoring_fn: Any,
    base_resume: Dict[str, Any],
    base_jd: Dict[str, Any],
    perturbations: List[Dict[str, Any]],
    tolerance: float = 0.5,
) -> Dict[str, Any]:
    """
    Evaluates counterfactual fairness by comparing the model score on a base resume
    against perturbed variants (swapping candidate names, gender-coded terms, college names).
    Asserts maximum score divergence is within strict numeric tolerance.
    """
    base_res = scoring_fn(base_resume, base_jd, mode="recruiter")
    base_score = float(base_res["final_score"])

    variant_results = []
    max_divergence = 0.0

    for p in perturbations:
        var_resume = dict(base_resume)
        # Apply perturbation overrides
        for k, v in p.items():
            var_resume[k] = v

        var_res = scoring_fn(var_resume, base_jd, mode="recruiter")
        var_score = float(var_res["final_score"])
        delta = abs(var_score - base_score)

        if delta > max_divergence:
            max_divergence = delta

        variant_results.append({
            "perturbation": p,
            "score": var_score,
            "delta": round(delta, 2),
            "is_fair": delta <= tolerance,
        })

    return {
        "base_score": base_score,
        "max_divergence": round(max_divergence, 2),
        "tolerance": tolerance,
        "passes_counterfactual_fairness": max_divergence <= tolerance,
        "variants": variant_results,
    }
