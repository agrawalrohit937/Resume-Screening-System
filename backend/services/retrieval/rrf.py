"""
Reciprocal Rank Fusion (RRF) for Multi-List Search Result Combination.
Fuses ranking outputs from BM25 lexical search and dense vector ANN search.
"""

from typing import Any, Dict, List, Optional
import structlog

logger = structlog.get_logger(__name__)

DEFAULT_RRF_K: int = 60


def reciprocal_rank_fusion(
    ranked_lists: List[List[Dict[str, Any]]],
    id_key: str = "id",
    k: int = DEFAULT_RRF_K,
    score_key_prefix: str = "rrf",
) -> List[Dict[str, Any]]:
    """
    Fuses multiple ranked result lists using Reciprocal Rank Fusion (RRF).

    Formula:
        RRF_score(d) = Σ_{m ∈ Rankers} 1.0 / (k + rank_m(d))
        where rank_m(d) is 1-based index of document d in ranked list m.

    Complexity:
        Time: O(M * N + U log U)
            where M = len(ranked_lists) (e.g. 2 for BM25 + Dense),
                  N = max list size (e.g. 500),
                  U = number of unique documents across all lists (U <= M * N).
        Space: O(U) to store fused scores and document metadata.

    Args:
        ranked_lists: List of ranked candidate lists (each item is a dict with at least `id_key`).
        id_key: Key uniquely identifying each document (e.g. "_id" or "id").
        k: Smoothing constant preventing high rank dominance (default 60).
        score_key_prefix: Prefix for RRF metadata fields added to merged results.

    Returns:
        Sorted list of document dicts with added fields:
        `f"{score_key_prefix}_score"`: combined RRF score
        `f"{score_key_prefix}_ranks"`: mapping of list index to 1-based rank
    """
    if not ranked_lists:
        return []

    fused_scores: Dict[str, float] = {}
    doc_lookup: Dict[str, Dict[str, Any]] = {}
    rank_history: Dict[str, Dict[int, int]] = {}

    for list_idx, r_list in enumerate(ranked_lists):
        if not r_list:
            continue
        for rank_zero, doc in enumerate(r_list):
            doc_id = str(doc.get(id_key, "") or doc.get("_id", ""))
            if not doc_id:
                continue

            rank_1based = rank_zero + 1
            reciprocal_value = 1.0 / (k + rank_1based)

            fused_scores[doc_id] = fused_scores.get(doc_id, 0.0) + reciprocal_value

            if doc_id not in doc_lookup:
                # Shallow copy to avoid mutating caller's original dict
                doc_lookup[doc_id] = dict(doc)
            else:
                # Merge any non-overlapping keys
                for key, val in doc.items():
                    if key not in doc_lookup[doc_id] or doc_lookup[doc_id][key] is None:
                        doc_lookup[doc_id][key] = val

            rank_history.setdefault(doc_id, {})[list_idx] = rank_1based

    # Sort documents by fused RRF score descending
    sorted_doc_ids = sorted(fused_scores.keys(), key=lambda d_id: fused_scores[d_id], reverse=True)

    result: List[Dict[str, Any]] = []
    for d_id in sorted_doc_ids:
        merged_item = doc_lookup[d_id]
        merged_item[f"{score_key_prefix}_score"] = round(fused_scores[d_id], 6)
        merged_item[f"{score_key_prefix}_ranks"] = rank_history[d_id]
        result.append(merged_item)

    return result
