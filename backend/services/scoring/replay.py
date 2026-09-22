"""
Scoring Replay Engine Module.

Phase 1.5:
- Recomputes historical candidate scores deterministically from stored feature vectors
  without re-parsing raw PDF/text or re-running expensive ML inference.
- Enables cheap historical A/B evaluation, model version migrations, and score backfills.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from services.scoring.features import ScoringFeatures


def replay_score_from_features(
    features_data: Dict[str, Any],
    profile_mode: str = "candidate",
    strict_weight: Optional[float] = None,
    semantic_weight: Optional[float] = None,
    target_model_version: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Reconstructs candidate quality and final scores deterministically from stored features.
    """
    features = ScoringFeatures.from_dict(features_data)

    # Resolve profile weights
    if strict_weight is None or semantic_weight is None:
        if profile_mode == "recruiter":
            s_weight = 0.60
            v_weight = 0.40
        else:
            s_weight = 0.80
            v_weight = 0.20
    else:
        s_weight = strict_weight
        v_weight = semantic_weight

    # Reconstruct strict component score
    # Standard profile skills: 70%, exp: 15%, edu: 15% (candidate) vs 50%, 30%, 20% (recruiter)
    if profile_mode == "recruiter":
        skills_w, exp_w, edu_w = 0.50, 0.30, 0.20
    else:
        skills_w, exp_w, edu_w = 0.70, 0.15, 0.15

    strict_component = (
        (features.skills_score * skills_w)
        + (features.experience_score * exp_w)
        + (features.education_score * edu_w)
    )

    reconstructed_quality = round((strict_component * s_weight) + (features.vector_score * v_weight), 1)

    # Blend reranker score if active
    final_score = reconstructed_quality
    if features.reranker_score is not None:
        final_score = round(reconstructed_quality * 0.70 + features.reranker_score * 0.30, 1)

    return {
        "replayed": True,
        "profile_mode": profile_mode,
        "feature_schema_version": features.feature_schema_version,
        "original_quality_score": features.quality_score,
        "reconstructed_quality_score": reconstructed_quality,
        "final_score": final_score,
        "original_model_version": features.embedding_model_version,
        "target_model_version": target_model_version or features.embedding_model_version,
        "eligibility_status": features.eligibility_status,
        "eligibility_rank": features.eligibility_rank,
        "is_knockout": features.is_knockout,
        "score_delta": round(reconstructed_quality - features.quality_score, 2),
    }
