"""
Requirement Criticality Weighting Module for CareerPilot ATS.
Infuse job requirements with criticality weights (3.0 must, 2.0 important, 1.0 nice-to-have)
based on explicit required skills and precomputed context windows in the JD text.
"""

from __future__ import annotations

import re
from typing import List, Optional, Set, Tuple, Union

HARD_LANGUAGE_PATTERN = re.compile(
    r"\b(required|requirements?|must(\s+have)?|must-have|mandatory|essential|minimum|at\s+least)\b",
    re.IGNORECASE,
)
SOFT_LANGUAGE_PATTERN = re.compile(
    r"\b(preferred|nice\s+to\s+have|nice-to-have|plus|bonus|desirable|ideally|good\s+to\s+have|good-to-have|exposure\s+to|familiarity)\b",
    re.IGNORECASE,
)


class JDCriticalityIndex:
    """
    Precomputes hard and soft language match spans once per JD.
    Time Complexity: O(L_jd) to build.
    Space Complexity: O(L_jd) to store spans and text representation.
    """

    def __init__(self, jd_text: str):
        self.jd_text = jd_text or ""
        self.length = len(self.jd_text)
        self.first_25_pct = self.length // 4

        # Precompute spans (start, end) once for the entire JD
        self.hard_spans: List[Tuple[int, int]] = [
            m.span() for m in HARD_LANGUAGE_PATTERN.finditer(self.jd_text)
        ]
        self.soft_spans: List[Tuple[int, int]] = [
            m.span() for m in SOFT_LANGUAGE_PATTERN.finditer(self.jd_text)
        ]

    def get_criticality(
        self,
        skill: str,
        explicit_required: Optional[Set[str]] = None,
    ) -> float:
        """Convenience method to compute requirement criticality using this precomputed index."""
        return infer_criticality(skill, self, explicit_required=explicit_required)


    def _is_valid_boundary(self, between_text: str, is_keyword_after: bool) -> bool:
        """Validates that text between keyword and skill does not cross invalid boundaries."""
        if re.search(r"\n\s*\n", between_text):
            return False
        # If keyword comes after skill, sentence ending (., ;, \n) invalidates the backward association
        if is_keyword_after and ("." in between_text or "\n" in between_text or ";" in between_text):
            return False
        # If keyword comes before skill, full stop with space (. ) or block break invalidates association
        if not is_keyword_after and re.search(r"[\.;]\s", between_text):
            return False
        return True


    def _is_within_window(
        self,
        skill_span: Tuple[int, int],
        target_spans: List[Tuple[int, int]],
        competing_spans: Optional[List[Tuple[int, int]]] = None,
        window: int = 120,
    ) -> bool:
        """
        Checks if skill_span is within +/- window characters of any target_span,
        without crossing sentence/paragraph boundaries and ensuring target is closer
        than any competing language span.
        """
        s_start, s_end = skill_span
        min_target_dist = float("inf")

        for t_start, t_end in target_spans:
            if s_start <= t_end + window and t_start <= s_end + window:
                between_start = min(t_end, s_end)
                between_end = max(t_start, s_start)
                between_text = self.jd_text[between_start:between_end]
                is_after = t_start >= s_end
                if not self._is_valid_boundary(between_text, is_after):
                    continue
                dist = max(0, max(t_start - s_end, s_start - t_end))
                if dist < min_target_dist:
                    min_target_dist = dist

        if min_target_dist == float("inf"):
            return False

        if competing_spans:
            for c_start, c_end in competing_spans:
                between_start = min(c_end, s_end)
                between_end = max(c_start, s_start)
                between_text = self.jd_text[between_start:between_end]
                is_after = c_start >= s_end
                if not self._is_valid_boundary(between_text, is_after):
                    continue
                c_dist = max(0, max(c_start - s_end, s_start - c_end))
                if c_dist < min_target_dist:
                    return False

        return True


    def get_skill_spans(self, skill: str) -> List[Tuple[int, int]]:
        """Finds word-bounded occurrences of skill in JD text."""
        if not skill or not skill.strip():
            return []
        try:
            pattern = re.compile(r"\b" + re.escape(skill.strip()) + r"\b", re.IGNORECASE)
            spans = [m.span() for m in pattern.finditer(self.jd_text)]
            if spans:
                return spans
        except Exception:
            pass

        # Substring fallback for punctuation-heavy skill names (e.g. C++, .NET)
        skill_lower = skill.strip().lower()
        jd_lower = self.jd_text.lower()
        spans = []
        pos = 0
        while True:
            idx = jd_lower.find(skill_lower, pos)
            if idx == -1:
                break
            spans.append((idx, idx + len(skill_lower)))
            pos = idx + len(skill_lower)
        return spans


def infer_criticality(
    skill: str,
    jd_source: Union[str, JDCriticalityIndex],
    explicit_required: Optional[Set[str]] = None,
) -> float:
    """
    Return weight in {3.0 must, 2.0 important, 1.0 nice_to_have}.

    Signals, highest priority first:
      1. skill appears in job.required_skills          -> 3.0
      2. within +/-120 chars of hard language          -> 3.0
         (required|must have|must-have|mandatory|essential|minimum|at least)
      3. within +/-120 chars of soft language          -> 1.0
         (preferred|nice to have|plus|bonus|desirable|ideally|good to have|exposure to|familiarity)
      4. appears in the first 25% of the JD body       -> 2.0
      5. default                                       -> 2.0

    Time: O(L_jd) per skill via a single precomputed match index. Space: O(L_jd).
    """
    # Signal 1: explicit required skills
    if explicit_required:
        explicit_lower = {s.lower() for s in explicit_required}
        if skill and skill.strip().lower() in explicit_lower:
            return 3.0

    # Ensure precomputed index is used
    if isinstance(jd_source, JDCriticalityIndex):
        jd_index = jd_source
    else:
        jd_index = JDCriticalityIndex(str(jd_source or ""))

    skill_spans = jd_index.get_skill_spans(skill)
    if not skill_spans:
        return 2.0

    # Signal 2: within +/-120 chars of hard language (and closer than soft language)
    for span in skill_spans:
        if jd_index._is_within_window(span, jd_index.hard_spans, competing_spans=jd_index.soft_spans, window=120):
            return 3.0

    # Signal 3: within +/-120 chars of soft language (and closer than hard language)
    for span in skill_spans:
        if jd_index._is_within_window(span, jd_index.soft_spans, competing_spans=jd_index.hard_spans, window=120):
            return 1.0


    # Signal 4: appears in the first 25% of the JD body
    for start, _ in skill_spans:
        if start <= jd_index.first_25_pct:
            return 2.0

    # Signal 5: default
    return 2.0
