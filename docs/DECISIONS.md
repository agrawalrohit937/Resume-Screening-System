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

## ADR 002: Requirement Criticality Weighting
- **Date**: 2026-09-18
- **Status**: Accepted
- **Context**:
  Uniform skill weighting treats secondary skills (e.g. Docker mentioned as "nice to have") identically to core prerequisites (e.g. Python specified under "Required: Must have"). This penalized candidates who missed optional skills just as harshly as those missing core technical capabilities.
- **Decision**:
  1. Implemented `JDCriticalityIndex` in `services.scoring.criticality` which precomputes regex spans for hard language (`required`, `must have`, `mandatory`, `essential`, `minimum`, `at least`) and soft language (`preferred`, `nice to have`, `plus`, `bonus`, `desirable`, `ideally`, `good to have`, `exposure to`, `familiarity`) in a single $O(L_{\text{jd}})$ pass.
  2. Implemented `infer_criticality(skill, jd_index, explicit_required)` assigning weights:
     - 3.0: Explicit `job.required_skills` or within +/-120 characters of hard language (respecting section/sentence boundaries).
     - 1.0: Within +/-120 characters of soft language (respecting section/sentence boundaries and proximity precedence).
     - 2.0: Standard requirement in first 25% of JD or neutral context.
  3. Formulated skills score as $\sum(\text{credit}_i \times w_i) / \sum(w_i)$.
  4. Guarded under `FEATURE_CRITICALITY_WEIGHTING` feature flag (defaults to True; falls back to uniform weights when disabled).
- **Consequences**:
  - Core requirements dominate candidate ranking while nice-to-have capabilities provide marginal uplift.
  - Context evaluation is strictly bounded at $O(L_{\text{jd}})$ per JD with zero LLM invocations.

## ADR 003: Split Eligibility from Quality Score and 45.0 Cap Removal
- **Date**: 2026-09-18
- **Status**: Accepted
- **Context**:
  The legacy scoring engine applied an artificial 45.0 score cap (`final_score = min(final_score, 45.0)`) on hard knockout failures (e.g. missing 5+ years of experience). This conflated "ineligible for this specific role" with "low quality candidate", destroyed true qualification signals, caused rank ties at 45.0, and prevented meaningful candidate rediscovery across other openings.
- **Decision**:
  1. Decoupled candidate assessment into two orthogonal dimensions:
     - `quality_score` (0-100, float): Independent, uncapped qualification score reflecting technical skill depth, experience, and education quality.
     - `eligibility` (dict): Structured eligibility check with `status` (`eligible` | `ineligible` | `unverified`), `checks` (rule_id, label, passed, severity, observed, evidence, source), and `eligibility_rank` (0 = eligible, 1 = unverified, 2 = ineligible) for Kanban and sorting.
  2. Maintained deprecated `recruiter_score` (capped at 45.0 on hard failures) and deprecated `knockout_status` for backwards compatibility with existing UI components.
  3. Added recruiter discretion endpoint `POST /api/v1/jobs/{job_id}/applications/{app_id}/override-eligibility` enabling human review to override automated status while logging an immutable audit record to `db.audit_logs`.
- **Consequences**:
  - Eliminates artificial score clipping; high-potential candidates who miss an arbitrary tenure filter retain accurate quality scores (e.g., 85%).
  - Applications collection and response models now record `quality_score`, `eligibility`, `eligibility_rank`, and `eligibility_override`.
  - Recruiter Kanban views can partition by `eligibility_rank` and sort by `quality_score` descending.

## ADR 004: Atlas Vector Search Migration with ANN HNSW Indexing
- **Date**: 2026-09-18
- **Status**: Accepted
- **Context**:
  Candidate job recommendations ("Jobs For You") previously executed full in-memory cosine scans over open jobs by querying MongoDB for all active postings, downloading 768-dim embeddings across the network, and computing dot products in Python. This scaled at $O(N_{\text{jobs}} \times D)$ in network traffic, database I/O, and CPU memory.
- **Decision**:
  1. Added MongoDB Atlas `$vectorSearch` pipeline support in `services.job_matcher` utilizing HNSW graph approximate nearest neighbors on `jobs.jd_embedding_bge` with cosine similarity.
  2. Complexity reduced from $O(N_{\text{jobs}} \times D)$ linear scan to $O(\log N_{\text{jobs}} \times D)$ logarithmic graph retrieval.
  3. Filtered candidate applied jobs to eliminate recommendation slot waste.
  4. Guarded under `FEATURE_ATLAS_VECTOR_SEARCH` feature flag (defaults to False in local dev/CI without Atlas Search; gracefully falls back to in-memory cosine scan when unsupported).
  5. Created idempotent PyMongo migration script `backend/migrations/001_create_vector_indexes.py` with `--dry-run` capability.
- **Consequences**:
  - Near-instantaneous candidate recommendation queries on large job catalogs with minimal server memory footprint.
  - Zero disruption to local developer setups and unit tests running against standalone MongoDB instances.

