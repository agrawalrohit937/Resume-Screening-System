# CareerPilot Architecture Decision Records (ADRs)

## ADR 001: Graded Skill Credit and Mutual Exclusion Bucket Partitioning
- **Date**: 2026-09-18
- **Status**: Accepted
- **Context**: 
  The legacy scoring engine used binary pass/fail skill matching (`(bool, match_type)`). This caused critical false positives (e.g., fulfilling FastAPI because a candidate knew Django since both share parent category `Backend Development`). Furthermore, binary credit destroyed recruiter trust and made partial qualification invisible.
- **Decision**:
  1. Replaced binary matching with `SkillMatch` dataclass returning graded credit:
     - `EXACT`, `ALIAS`, `VERSION_VARIANT`: 1.00 credit (`matched`)
     - `TAXONOMY_PARENT`: 0.90 credit (`matched`)
     - `TAXONOMY_SIBLING`: 0.40 credit (`transferable`)
     - `EMBEDDING_NEIGHBOR`: 0.30 credit (`transferable`)
     - `NONE`: 0.00 credit (`missing`)
  2. Renamed `TAXONOMY_EQUIVALENT` to `TAXONOMY_SIBLING`.
  3. Automatically exclude ultra-generic parents with > 40 children (along with `"Software Engineering"`) from bridging sibling matches.
  4. Generalized the mutual exclusion invariant: `matched_skills`, `transferable_skills`, and `missing_skills` are strictly pairwise disjoint, and their union equals the canonical required skill universe.
  5. Implemented backwards-compatible tuple unpacking (`__iter__`) on `SkillMatch` so legacy consumers unpacking `(is_fulfilled, match_type)` continue to function.
- **Consequences**:
  - Eliminates false positive match inflation.
  - Exposes `transferable_skills` for explainability and candidate development.
  - Prevents bridging across overly broad parent nodes.
  - Algorithms: `evaluate_skill_fulfillment` is $O(N_{\text{skills}})$, `_skills_score` is $O(N_{\text{jd}} \times N_{\text{cand}})$.
