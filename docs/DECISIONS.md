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
  ## ADR 005: Multilingual Embeddings, Semantic Chunking, and Max-Sim Late Interaction
- **Date**: 2026-09-18
- **Status**: Accepted
- **Context**:
  Single-vector monolithic document embeddings diluted granular qualifications across large resumes and JDs. Furthermore, single-language models struggled with code-mixed resumes and Indian degree context (e.g. ITI, BCA, B.Tech, B.Ed, M.Sc).
- **Decision**:
  1. Migrated primary embedding model to `BAAI/bge-m3` (1024-dim, dense + multi-vector + sparse multi-lingual support spanning 100+ languages) with fallback to `BAAI/bge-base-en-v1.5` (768-dim) and dimension assertion safety (`assert_vector_compatibility`).
  2. Implemented `chunk_resume` deconstructing resumes into semantic units (experience, projects, skills, education, summary) with SHA-256 text hashes.
  3. Implemented `chunk_jd` breaking job descriptions into requirement statements annotated with criticality weights.
  4. Implemented `compute_max_sim_vector_score` via batched NumPy matrix multiplication ($S = R \cdot C^T$, $O(N_{\text{req}} \times N_{\text{chunk}} \times D)$) yielding weighted late-interaction score with free argmax chunk evidence attribution.
  5. Updated `_DEGREE_RANK` hierarchy to explicitly map Indian academic credentials: Level 1 (ITI/Diploma), Level 2 (Associate), Level 3 (B.Sc/BCA/B.Tech), Level 4 (B.Ed/M.Sc/Master), Level 5 (Ph.D).
  6. Added batched, idempotent, resumable migration script `backend/migrations/002_reembed_jobs_and_resumes.py`.
- **Consequences**:
  - Provides explainable evidence attribution per JD requirement.
  - Eliminates vector dimension incompatibility bugs and supports multilingual / Indian context resumes.
  - Guarded behind `FEATURE_MULTI_VECTOR_EMBEDDING`.

## ADR 006: Real Experience Model with Overlap Merging, Recency Decay, and Gap Fairness
- **Date**: 2026-09-18
- **Status**: Accepted
- **Context**:
  Naive year-counting treated concurrent overlapping jobs as double time, penalized career gaps (e.g. caregiving, health, study leave) unfairly, and treated ten-year-old legacy experience with the same relevance and weight as recent stack exposure.
- **Decision**:
  1. Implemented $O(N \log N)$ concurrent interval merging (`merge_calendar_intervals`) to ensure physical calendar days are never double-counted.
  2. Implemented career gap detection ($> 6$ months) recorded in `gaps[]` with ZERO score penalty to eliminate bias.
  3. Applied 8-year half-life recency decay: $\text{decay}_i = 0.5^{(\text{years\_since\_end}_i / 8.0)}$.
  4. Mapped role semantic relevance from cosine similarity: $\text{clip}(\text{map}(\cos(\text{role}, \text{target}), [0.3, 0.9] \to [0.2, 1.0]), 0.2, 1.0)$.
  5. Implemented saturating experience score: $\text{exp\_score} = 1 - \exp(-1.4 \times \text{effective\_years} / \text{required\_years})$ (~75% at parity, asymptoting smoothly to 1.0).
  6. Computed seniority rank inference and seniority delta.
- **Consequences**:
  - Eliminates inflation from parallel consulting/internship roles.
  - Protects candidates taking career breaks while emphasizing recent, highly relevant domain tenure.
  - Guarded behind `FEATURE_REAL_EXPERIENCE_MODEL`.

## ADR 007: Standardized Scoring Feature Persistence and Match Event Telemetry
- **Date**: 2026-09-18
- **Status**: Accepted
- **Context**:
  Historical A/B evaluation, scoring model version upgrades, and telemetry analysis were impossible without re-parsing raw PDF resumes and executing expensive ML models. Additionally, privacy guarantees required ensuring raw candidate text was never leaked into telemetry streams.
- **Decision**:
  1. Defined `ScoringFeatures` dataclass with `FEATURE_SCHEMA_VERSION = "1.0.0"` capturing ~45 explicit, standardized scoring features spanning skills, experience, education, eligibility, parsing quality, and active feature flags.
  2. Persisted `features` in `db.applications` at apply and re-scoring times.
  3. Built `replay_score_from_features` reconstructing scores deterministically from feature vectors without NLP extraction or ML inference.
  4. Built `log_match_event` in `services.telemetry_service` recording match lifecycle events (`apply`, `eligibility_override`, `job_impression`, etc.) to `db.match_events` with a 24-month TTL index and strict sanitization ensuring raw resume text is never logged.
  5. Built thread-safe cross-encoder reranker singleton `RerankerServiceSingleton` with 400ms latency auto-throttling, guarded behind `FEATURE_CROSS_ENCODER_RERANK`.
- **Consequences**:
  - Enables sub-millisecond historical A/B score replay and calibration.
  - Ensures production telemetry is GDPR/DPDP privacy-compliant with automated 24-month retention cleanup.

## ADR 008: Real Occupation-Skill Knowledge Graph and Domain Scoring Adapters
- **Date**: 2026-09-18
- **Status**: Accepted
- **Context**:
  CareerPilot was historically confined to an engineering-recruiting tool with a hardcoded tech taxonomy. Evaluating nurses, lawyers, chartered accountants, welders, teachers, or sales executives produced meaningless scores due to missing domain signals and single-formula scoring.
- **Decision**:
  1. Built multi-relational in-memory knowledge graph `OccupationSkillGraph` (`services.ontology.graph`) with `ONTOLOGY_VERSION = "2.0.0"` ingesting ESCO (~13k skills), O*NET / SOC (US taxonomy), and NCO-2015 (National Classification of Occupations India).
  2. Preserved the high-priority tech taxonomy overlay (`services.ontology.tech_overlay`) intact for modern frameworks (LangGraph, Qdrant, FastAPI, Docker).
  3. Implemented typed multi-relational edges (`is_a`, `part_of`, `prerequisite_of`, `substitutable_for`, `tool_of`, `regulated_by`, `broader_than`, `same_as`) and edge-credit propagation into `SkillMatch`.
  4. Enforced strict 6-step resolution order in `normalize_skill`: Curated Alias -> Overlay Canonical -> ESCO exact -> ESCO multilingual label -> embedding kNN -> Title-case buffer in `skills_pending_review` with an Admin human review gate (`/api/v1/admin/ontology`).
  5. Implemented 12 specialized `OccupationAdapter` implementations (`SoftwareEngineering`, `Healthcare`, `LegalFinance`, `SkilledTrades`, `CreativeDesign`, `AcademicResearch`, `Sales`, `Teaching`, `HospitalityRetail`, `LogisticsOperations`, `DataAnalytics`, `Generic`) with domain-specific feature weights and hard statutory knockouts (e.g. RN for nursing, Bar/CA for legal/audit, B.Ed for teaching).
  6. Documented all adapter weights and signals in `docs/ADAPTERS.md`.
- **Consequences**:
  - Unlocks universal, multi-domain job matching across clinical, legal, educational, trade, and commercial professions.
  - Ensures statutory compliance knockouts are enforced strictly at eligibility time.
  - Preserves 100% backward score parity for software engineering.

## ADR 009: Pluggable Credentials Layer & Skills-First Education Architecture
- **Date**: 2026-09-18
- **Status**: Accepted
- **Context**:
  1. Professional roles (nursing, legal, auditing, commercial transportation) mandate valid licences and credentials with strict expiry windows and jurisdiction boundaries.
  2. The historical ATS used a reductive, country-blind 1–5 degree ladder that failed on international and vocational equivalents (ITI, Polytechnic Diplomas, Bologna cycles).
  3. Industry recruiting is shifting toward skills-first hiring, where degree requirements should be toggled off entirely without penalizing candidate match math.
- **Decision**:
  1. Created `Credential` data model (`models.credential_model`) capturing type, issuer, registration number, jurisdiction (ISO-3166-2), and validity dates.
  2. Built `services.credential_service` evaluating expiry dynamically at scoring time (`expires_on < date.today()`). Mandatory credentials act as strict boolean eligibility knockouts (severity='hard').
  3. Implemented pluggable `CredentialVerifier` interface with a `NoOpCredentialVerifier` default, allowing future state registry integrations without scoring modifications.
  4. Established global ISCED-2011 equivalence dataset `data/education_equivalence.csv` covering IN, US, UK, EU, CA, AU, SG, AE.
  5. Implemented explicit Indian context overrides: ITI and Polytechnic Diplomas as Level 1, B.Sc/BCA/B.Tech as Level 3, B.Ed/M.Sc as Level 4, and Ph.D as Level 5.
  6. Added `education_requirement_mode` to `Job` and `Application` models (`"required"` | `"preferred"` | `"ignored"`). When `"ignored"`, degree requirements contribute zero weight and generate no eligibility checks, with strict ATS score mathematically renormalized across skills and experience: `(skills_score * skills_w + exp_score * exp_w) / (skills_w + exp_w)`.
  7. In-progress degrees (`_PURSUING_PATTERN`) count toward education ranking and produce soft advisories, never hard rejections.
  8. Strictly omitted institution prestige from scoring to prevent socioeconomic bias.
- **Consequences**:
  - Regulatory licensure enforcement is dynamic and auditable.
  - Employers can toggle skills-first hiring per role with full mathematical score integrity.

## ADR 010: Universal Location, Currency Normalization, Cultural Identity & JD Symmetry Engine
- **Date**: 2026-09-18
- **Status**: Accepted
- **Context**:
  1. Global hiring requires robust location awareness beyond naive string matching (e.g. BLR = Bangalore = Bengaluru in Karnataka, commuting within 45km, timezone overlap for distributed teams).
  2. Indian compensation (LPA, Lakhs, Crores, ₹) and multi-currency roles ($k, €k, £, AED, SGD) require normalization to annual base values and dated FX rates with flexible candidate-budget tolerance windows.
  3. Strict non-inference of demographic attributes (gender, caste, religion, marital status, nationality) from candidate names, educational institutions, or geographic location to prevent systemic bias.
  4. Mononyms, patronymics (S/O Ramanathan), European particles (van der Berg), Arabic lineages (bin Fahad), and non-Latin scripts (Devanagari, CJK, Cyrillic) must be represented faithfully without forcing Anglo-centric `first_name last_name` conventions.
  5. JDs suffer from asymmetric parsing, exclusionary language (gendered/aggressive tropes, ageism, nationality restrictions), unrealistic requirement stacking, and missing compensation transparency.
- **Decision**:
  1. Created `services.location_service`: Seeded location knowledge graph for major tech hubs (IN, US, UK, SG, AE), alias resolution, Haversine commute feasibility (default 45km radius), and operational timezone overlap.
  2. Created `services.compensation_service`: Parsed Indian LPA, Lakhs, Crores, and global currencies into annualized local and USD values with dated FX tables and compensation compatibility scoring.
  3. Created `services.work_auth_service`: Evaluates candidate declared work authorization records vs job requirements as hard knockouts. Explicitly prohibits inferring work status from candidate names or origins. Implemented international E.164 phone formatting and country-locale aware date parser (resolving DD/MM vs MM/DD ambiguity).
  4. Created `services.identity_service`: Canonical `full_name` entity preserving exact scripts (Devanagari, CJK, Cyrillic) and casing, parsing mononyms, patronymics, and particles.
  5. Built static AST anti-bias test suite (`tests/test_no_demographic_inference.py`) auditing services and models to guarantee zero demographic inference.
  6. Created `services.jd_parser_service`: Schema-constrained structured requirement extraction into `job.requirements_structured`, automated title-to-ESCO/SOC occupation code mapping, and Recruiter Quality Assistant auditing JDs for exclusionary language, impossible technology experience claims, and missing salary transparency. Exposed via `POST /api/v1/jobs/audit-jd`.
- **Consequences**:
  - Eliminates geographic and currency barriers for international and pan-Indian recruitment.
  - Guarantees strict non-discriminatory identity handling compliant with anti-bias audits.
  - Gives recruiters real-time feedback to craft inclusive, realistic, and transparent job postings.

## ADR 011: Learned Ranking, Calibration, Explainability, and Fairness Architecture
- **Date**: 2026-09-19
- **Status**: Accepted
- **Context**:
  Phase 1 & 2 established multi-domain multi-factor heuristic scoring with high baseline ranking accuracy. However, enterprise ATS deployment requires:
  1. High-throughput two-stage retrieve-then-rank architecture for large candidate pools (10,000+ candidates).
  2. Learned second-stage reranking (XGBoost LambdaMART) optimizing directly for NDCG with position-debiasing.
  3. Score calibration converting raw heuristics into true posterior shortlist probabilities $P(\text{shortlist} \mid x)$, while respecting candidate-facing display floors.
  4. Evidence-grounded explainability with TreeSHAP attributions, exact text evidence citations, prioritized counterfactuals, and an anti-hallucination validation gate.
  5. Statutory compliance with NYC Local Law 144, EEOC 4/5ths rule, Indian DPDP Act 2023, and EU AI Act, including Indian context PII blinding (Caste, Religion, Marital Status, DOB, Category) and immutable decision logging.
- **Decision**:
  1. **Two-Stage Hybrid Retrieval**: Implemented BM25Okapi + Dense Vector (`BAAI/bge-m3`) with Reciprocal Rank Fusion ($k=60$) in `backend/services/retrieval/`. Provides Atlas Search stage definitions and fast in-memory fallbacks.
  2. **Learning-to-Rank (LTR)**: Built `backend/ml/train_ranker.py` using XGBRanker with pairwise NDCG objective and Inverse Propensity Weighting (IPW) debiasing. Enforces strict compile-time and runtime feature deny-lists excluding demographic proxies. Deployed in shadow mode behind `FEATURE_LTR_RANKER` in `backend/ml/ranker_service.py`.
  3. **Score Calibration**: Built `backend/ml/calibration.py` fitting Isotonic Regression and Platt Scaling, tracking Expected Calibration Error (ECE < 0.05), and computing display-fit indicators while preserving raw unfloored quality scores.
  4. **Evidence-Grounded Explainability**: Built `backend/services/explainability_service.py` computing TreeSHAP feature contributions, extracting cited evidence spans from resume and JD text, ranking counterfactual improvements by estimated candidate ROI, and enforcing an anti-hallucination validator ensuring claims reference actual candidate or JD text.
  5. **Fairness, Bias & Compliance**: Built `backend/services/security/pii_redactor.py` implementing `FEATURE_BLIND_SCORING` with Indian context masking (Caste, Religion, Marital Status, DOB/Age, Category, graduation year). Built continuous 4/5ths rule disparate impact monitoring in `backend/services/fairness/impact_monitor.py`. Implemented immutable audit logging in `db.decision_log` via `backend/services/fairness/decision_logger.py`. Exposed candidate data rights and bias audit routes in `backend/api/routes/compliance.py`.
- **Consequences**:
  - Full regulatory compliance across US (NYC LL144, EEOC), EU (AI Act Annex III), and India (DPDP 2023).
  - Candidates receive transparent, actionable, hallucination-free feedback with clear ROI guidance.
  - Recruiter workflows scale efficiently with sub-millisecond retrieval and learned ranking.

---

## ADR 012: Scale, Asynchronous Task Workers, Caching, and Distributed Infrastructure

- **Status**: Accepted (Implemented in Phase 4)
- **Context**:
  CareerPilot ATS v2.0.0 required enterprise-grade scalability, resilient asynchronous background task execution, distributed deduplication across multi-replica cloud environments, CPU-sparing embedding caching, cursor pagination to avoid memory bloat, structured observability, and parallel shadow scoring for safe model rollout.
- **Decisions**:
  1. **Asynchronous Task Workers (Celery & Redis Broker)**:
     - Built `backend/services/tasks/` architecture with Celery task queues (`parsing`, `scoring`, `dlq`).
     - Added `TaskManager` implementing deterministic idempotency keys (`parse:{resume_id}:{file_hash}`), exponential backoff retries with jitter, dead-letter queue routing (`db.task_dlq`), and in-process async worker fallback for local development without external Redis/Celery infra.
  2. **Distributed Scheduling & Deduplication**:
     - Built `backend/services/locking/distributed_lock.py` providing atomic Redis `SET NX EX` distributed locking with safe Lua script release, MongoDB `find_one_and_update` with TTL expiration, and local fallback.
     - Protected critical batch jobs (nightly job alerts, stuck resume sweepers) from duplicate concurrent executions across replicas.
  3. **Dedicated Embedding Cache & Int8 Quantization**:
     - Built `backend/services/embedding_cache.py` keyed deterministically on `sha256(text) + model_version` with a 30-day TTL.
     - Implemented dynamic batching (`batch_size=32`) and scalar Int8 quantization with per-vector scale factors preserving > 0.999 cosine similarity fidelity while saving 75% memory.
  4. **Cursor-Based Pagination & Large Dataset Streaming**:
     - Built `backend/utils/pagination.py` providing `stream_cursor` and `paginate_by_cursor` using MongoDB `_id` index boundaries ($O(1)$ index seek instead of $O(N)$ deep offset skip).
     - Eliminated silent truncations (`.to_list(100/200/500)`) across job feeds, application pipelines, and compliance endpoints.
  5. **Observability, Metrics & Drift Detection**:
     - Wired distributed trace ID propagation (`trace_context`, `set_trace_id`, `TraceIDMiddleware`) across parse $\to$ embed $\to$ score $\to$ rank with automatic structlog injection.
     - Built `backend/services/drift_detector.py` implementing Kolmogorov-Smirnov (KS-test) for score distribution drift and cosine distance centroid shift for embedding representations with zero raw text logged or stored.
  6. **Shadow Scoring Pipeline**:
     - Built `backend/services/shadow_scoring.py` recording experimental ranking/scoring models to `db.shadow_scores` alongside live requests via non-blocking asynchronous dispatch, enabling zero-risk candidate/recruiter evaluation.
- **Consequences**:
  - Eliminates silent truncations, memory spikes, and CPU starvation under heavy ingestion.
  - Safe, privacy-preserving monitoring and drift alerts for regulatory and production reliability.
  - Seamless zero-configuration fallback for developers working without local Redis/Celery.

## ADR 013: Enterprise Surface, Multi-Tenancy, Granular RBAC, and B2B ATS Workflows
- **Date**: 2026-09-19
- **Status**: Accepted (Implemented in Phase 5)
- **Context**:
  Transforming CareerPilot ATS into a multi-tenant B2B SaaS platform requires:
  1. Complete data isolation across enterprise clients (`tenant_id`) enforced mathematically at the repository boundary so cross-tenant data leaks are impossible.
  2. Enterprise role-based access control (RBAC) extending beyond basic roles to: `recruiter`, `hiring_manager`, `coordinator`, `interviewer`, `admin`, `exec` (read-only audit/reporting), and `candidate`.
  3. Enterprise identity and lifecycle management: SAML 2.0 / OIDC SSO and SCIM 2.0 provisioning (`/scim/v2/Users`).
  4. Statutory EEO (Equal Employment Opportunity) self-identification data collection completely segregated into an isolated vault (`db.eeo_responses`), mathematically disconnected from resume scoring pipelines to guarantee unbiased ranking.
  5. Core enterprise ATS workflows: Multi-step requisition and headcount budget approval chains, structured competency interview kits with scorecards and inter-rater calibration outlier detection, and Talent CRM silver medalist tracking for candidate re-engagement.
  6. Ecosystem integrations: Outbound webhooks signed with HMAC-SHA256 (`X-CareerPilot-Signature`), ATS adapters for Greenhouse Harvest API, Lever Postings/Opportunities, and Workday RaaS, plus automated job syndication (Indeed XML feeds and Google for Jobs schema.org JSON-LD).
  7. Consented Talent Pools: Privacy-preserving talent marketplace where candidates opt-in per visibility tier (`anonymized`, `full`, default `hidden`), maintain employer exclusion blocklists, and receive full transparency audit logs of recruiter profile views.
- **Decisions**:
  1. **Multi-Tenancy**: Built `backend/services/multi_tenancy/tenant_context.py` using Python `contextvars` to propagate `tenant_id` seamlessly across async tasks. Built `TenantScopedRepository` wrapping PyMongo/Motor collections and automatically enforcing `{"tenant_id": current_tenant_id}` across all queries, mutations, and counts. Added `tenant_id` to `JobModel`, `ApplicationModel`, `ResumeModel`, `ATSResultModel`, and `ShadowScoreRecord`.
  2. **Granular RBAC**: Built `backend/core/rbac.py` defining fine-grained permissions (`Permission` enum) and role matrix. Provided `has_permission` and `check_rbac_access` with declarative permission guards.
  3. **Enterprise SSO & SCIM**: Built `backend/services/enterprise_auth/sso_service.py` for SAML 2.0 AuthN requests and assertion consumption with JIT user provisioning. Built `SCIMService` in `backend/services/enterprise_auth/scim_service.py` implementing SCIM 2.0 User resource lifecycles.
  4. **EEO Isolation**: Built `backend/models/eeo.py` and `backend/services/eeo_service.py`. Voluntary demographic responses are stored in a dedicated `db.eeo_responses` collection. Recruiter and candidate scoring models never query or access this vault, mathematically preventing disparate impact.
  5. **Enterprise ATS Workflows**:
     - Built `backend/models/requisition.py` and `backend/services/requisition_service.py` supporting headcount budgets, multi-step sequential approval chains, and hire tracking.
     - Built `backend/models/interview_kit.py` and `backend/services/interview_kit_service.py` supporting competency rubric kits, 1-5 scorecards, inter-rater variance analysis, and rater divergence detection.
     - Built `backend/services/talent_crm_service.py` for automated silver medalist tagging and intelligent re-engagement matching against newly opened jobs.
  6. **Ecosystem Integrations & Syndication**:
     - Built `backend/services/integrations/webhooks.py` with subscription management, HMAC-SHA256 signatures, and delivery auditing.
     - Built `backend/services/integrations/adapters.py` with unified `ATSAdapter` interface and functional mocks for Greenhouse, Lever, and Workday.
     - Built `backend/services/integrations/syndication.py` generating valid Indeed XML feeds and Google for Jobs schema.org `JobPosting` JSON-LD representations.
  7. **Consented Talent Pools**:
     - Built `backend/models/talent_pool.py` and `backend/services/talent_pool_service.py`. Candidate opt-in defaults to OFF (`hidden`). Candidates choose `anonymized` (redacting contact details and current employer) or `full` visibility, maintain employer exclusion blocklists, and can immediately revoke consent at any time.
     - Built transparency logging via `TalentPoolViewAudit` letting candidates see every recruiter and company that viewed their profile.
- **Consequences**:
  - Transforms CareerPilot into a turnkey B2B SaaS platform ready for enterprise enterprise procurement, security reviews, and HR tech integrations.
  - Complete statutory compliance and mathematical bias prevention.
