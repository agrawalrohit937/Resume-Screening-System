# CareerPilot ATS v2.0.0 — Model Card: Learned Ranking & Calibration

## Model Details
- **Model Name**: CareerPilot LTR Ranker & Calibrator
- **Model Version**: `v2.0.0-phase3`
- **Architecture**:
  - Two-Stage Retrieval: BM25Okapi + Dense Vector (`BAAI/bge-m3`) fused via Reciprocal Rank Fusion ($k=60$).
  - Second-Stage Ranker: XGBoost LambdaMART (`rank:ndcg` objective, tree depth 4, 100 estimators) with Inverse Propensity Weighting (IPW) for positional click-bias correction.
  - Calibration: Isotonic Regression & Platt Scaling mapping raw scores to calibrated probability $P(\text{shortlist} \mid x) \in [0, 1]$.
  - Explainability: TreeSHAP feature contribution attribution with anti-hallucination evidence span citation.

## Intended Use
- **Primary Use**: Ranking candidate pools against job descriptions for recruiter workflows and generating transparent, actionable feedback for job applicants.
- **Out-of-Scope**: Automated rejection without human-in-the-loop review. Fully autonomous hiring decisions are strictly prohibited.

## Training Data & Inputs
- **Dataset**: Curated real-world pair evaluations (`backend/eval/resumeJD2_pairs.csv`), augmented with historical interaction telemetry.
- **Feature Set**: Numerical and categorical features strictly extracted from `ScoringFeatures`:
  - `skills_score`, `keyword_score`, `vector_score`, `effective_years`, `seniority_delta`, `credential_score`, `domain_congruence_score`.
- **Protected Attribute Deny-List**:
  - Zero demographic or proxy attributes are admitted to the ranker feature store.
  - Deny-list: `gender`, `sex`, `age`, `dob`, `caste`, `religion`, `race`, `ethnicity`, `nationality`, `marital_status`, `disability`, `photo_url`, `institution_name`, `graduation_year`.

## Quantitative Performance
- **Ranking Quality**: NDCG@10 $\ge 0.53$ across diverse job domains (Engineering, Finance, Healthcare, Legal, Trades).
- **Calibration**: Expected Calibration Error (ECE) $< 0.05$ across 10 evaluation bins.
- **Inference Latency**:
  - Retrieval (BM25 + Dense RRF): $< 50\,\text{ms}$ for 1,000 candidates.
  - LTR Inference: $< 5\,\text{ms}$ per candidate.
  - Full pipeline (Retrieval + Ranking + Calibration + SHAP): $< 120\,\text{ms}$.

## Fairness, Bias & Compliance
- **NYC Local Law 144**: Automated continuous audit of selection rates across demographic categories. Enforces the EEOC 4/5ths (80%) impact ratio threshold.
- **Indian Context PII Blinding**: Explicit regex redaction of Caste, Category (SC/ST/OBC/EWS), Religion, Marital Status, DOB, and graduation years before embedding or LLM extraction.
- **Auditability**: All scoring inputs, model versions, and human recruiter overrides are logged immutably to `db.decision_log`.

## Limitations & Mitigations
- **Cold-Start Roles**: For novel niche roles with unmapped ontology terms, fallback to Dense Semantic Vector similarity prevents degradation.
- **Model Drift**: Calibrator and Ranker are monitored via monthly ECE checks; telemetry drift triggers alerts when Jensen-Shannon divergence $> 0.15$.
