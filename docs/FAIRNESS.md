# CareerPilot ATS v2.0.0 — Fairness, Anti-Bias & Regulatory Compliance

## 1. Regulatory Frameworks Addressed
CareerPilot ATS is designed to comply with global algorithmic accountability and employment equity regulations:
- **NYC Local Law 144 (AEDT)**: Annual independent bias audits, publicly accessible summary tables of selection rates and impact ratios, 10 business-day candidate notice.
- **EEOC Uniform Guidelines on Employee Selection Procedures (UGESP)**: Monitoring the **Four-Fifths (80%) Rule** across gender, race, and ethnicity.
- **EU AI Act (High-Risk AI Systems — Annex III, Employment)**: Transparency, human oversight, logging of automated decision paths, and non-discriminatory design.
- **India Digital Personal Data Protection Act (DPDP 2023)**: Purpose limitation, data minimization, candidate right to correction and erasure, explicit consent.

## 2. Multi-Layer Anti-Bias Architecture

### Layer A: Pre-Extraction PII Blinding (`FEATURE_BLIND_SCORING`)
Before any resume text is parsed, embedded, or analyzed:
- **Contact Info**: Candidate Name, Email addresses, Phone numbers are masked.
- **Indian Context Demographics**:
  - **Caste & Category**: Explicit redaction of caste names and reservation categories (`SC`, `ST`, `OBC`, `EWS`, `General`, `Non-Creamy Layer`).
  - **Religion**: Redaction of religious markers (`Hindu`, `Muslim`, `Christian`, `Sikh`, `Jain`, `Buddhist`, etc.).
  - **Marital Status**: Redaction of marital indicators (`Married`, `Single`, `Unmarried`, `Widowed`, `Divorced`).
  - **Date of Birth & Age**: Removal of DOB and declared age expressions.
  - **Socioeconomic Proxies**: Masking of graduation years to prevent age discrimination.

### Layer B: Feature Store Deny-Listing
The Learning-to-Rank (LTR) model enforces a compile-time and runtime deny-list:
- Features related to demographics, educational institution prestige, or personal identity are strictly blocked.
- Permitted features represent job competence: skill match percentage, verified credentials, effective experience, domain congruence, and semantic vector match.

### Layer C: Continuous Disparate Impact Monitoring
- The `impact_monitor.py` service aggregates candidate stage progressions (Applied $\to$ Shortlisted $\to$ Interview $\to$ Offer).
- Selection rates are calculated for each demographic cohort against the highest-scoring baseline group.
- Impact Ratio:
  $$\text{Impact Ratio} = \frac{\text{Selection Rate}_{\text{group}}}{\text{Selection Rate}_{\text{baseline}}}$$
- Any cohort exhibiting an impact ratio $< 0.80$ triggers an administrative warning and flags the recruitment pipeline for HR review.

### Layer D: Immutable Audit Trail (`db.decision_log`)
- Every scoring event is recorded with an append-only contract.
- The log captures:
  - `job_id` and `candidate_id`
  - `quality_score` and `eligibility_status`
  - Granular checks evaluated (work authorization, minimum years, required degree)
  - Scoring engine and embedding model version hashes
  - Any human recruiter overrides and justification notes.

## 3. Candidate Rights & Transparency
- Candidates have full access to their data via `/api/v1/compliance/candidate-portal/{candidate_id}`:
  - View all stored evaluation records and scores.
  - Request data download or permanent erasure (Right to be Forgotten).
  - Inspect evidence-grounded scoring verdicts and counterfactual recommendations.
