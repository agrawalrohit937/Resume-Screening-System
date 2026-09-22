# CareerShala ATS Engine Compliance & Algorithmic Fairness Documentation

> **LEGAL NOTICE & DISCLAIMER**  
> *This document represents internal technical and engineering specifications describing the algorithmic matching architecture, fairness audits, and compliance safeguards of the CareerShala ATS matching engine. This document is provided for engineering transparency and system auditing purposes and does NOT constitute formal legal advice.*

---

## 1. Algorithmic Overview & Scope of Processing

The CareerShala ATS Engine operates as a deterministic, explainable resume-to-job matching and scoring engine. Its primary function is to compute skill relevance, verifiable experience duration, and educational alignment between candidate resumes and job descriptions.

### 1.1 Inputs & Data Fields Utilized in Scoring
The scoring mathematical formulas strictly utilize only the following structured attributes:
- **Technical & Domain Skills**: Extracted keywords normalized against the open ESCO/O*NET taxonomy and curated technology ontology.
- **Experience Duration & Timeline**: Cumulative calendar duration of relevant roles with saturating logarithmic/exponential curves.
- **Educational Attainment**: Standardized degree hierarchy rankings (e.g. Bachelor's, Master's, Doctorate) when explicitly required by the job posting.
- **Semantic Text Embeddings**: Dense representation matching using BGE-M3 embeddings for contextual requirement similarity.

### 1.2 Prohibited Features & Demographic Isolation
The engine strictly enforces demographic isolation. Under no circumstances are the following attributes used as inputs, features, weights, or ranking factors in any scoring calculation:
- Candidate Name, Gender, Pronouns, or Salutations
- Age, Date of Birth, or Graduation Year proxies
- Photograph, Physical Appearance, or Biometrics
- Caste, Religion, Race, Ethnicity, or Nationality
- Socioeconomic Status, Pin Code, or College Prestige Ranking
- Career Gaps (Maternity, medical, or caregiving breaks are never penalized; experience is computed purely on cumulative active service duration).

---

## 2. Human-in-the-Loop Architecture (No Automated Rejection)

In compliance with international automated employment decision regulations:
1. **Advisory Scoring Only**: Match scores and recommendations (`Strong Match`, `Good Match`, `Partial Match`, `Low Match`) are provided purely as ranking guidance for human recruiters.
2. **No Automated Disqualification**: Knockout checks (e.g., eligibility requirements) flag candidate profiles as `eligible`, `ineligible`, or `unverified` with explicit observed evidence. Candidates are never automatically rejected by the system without human review and confirmation.
3. **Audit Trail**: Every match score produces a deterministic component breakdown (`skills_score`, `experience_score`, `education_score`, `vector_score`, `skill_evidence`, `checks`) stored in immutable audit logs.

---

## 3. Regulatory Alignment & International Standards

### 3.1 EU Artificial Intelligence Act (EU AI Act - High-Risk AI Systems)
Under Annex III (Employment, Workers Management, and Access to Self-Employment), AI systems used for recruitment and candidate filtering are classified as **High-Risk AI Systems**. CareerShala adheres to EU AI Act compliance mandates:
- **Article 9 (Risk Management System)**: Continuous testing of score calibration, parsing confidence metrics, and drift detection.
- **Article 10 (Data Governance & Bias)**: Training datasets and ontology graphs are tested for demographic bias and representational parity.
- **Article 13 (Transparency & Provision of Information)**: Deterministic scoring formulas and reason explanations provide full explainability for every score calculation.
- **Article 14 (Human Oversight)**: System design prevents fully autonomous decisions; human recruiters retain ultimate hiring authority.
- **Article 15 (Accuracy, Robustness, & Cybersecurity)**: PII masking, cryptographic tenant isolation, and deterministic fallbacks.

### 3.2 NYC Local Law 144 (Automated Employment Decision Tools - AEDT)
Under New York City Local Law 144:
- **Independent Bias Audits**: Annual evaluation of selection rates and scoring distributions across gender and racial categories.
- **Four-Fifths Rule (Adverse Impact Ratio >= 0.80)**: System includes automated AIR calculation (`backend/eval/fairness.py`) ensuring selection rate ratios meet the 80% threshold across demographic groups.
- **Candidate Notice**: Candidates are notified of automated scoring mechanisms with clear opt-out and manual evaluation alternatives.

### 3.3 India Digital Personal Data Protection Act (DPDP Act 2023)
- **Notice and Consent**: Resumes are processed strictly pursuant to explicit candidate consent provided at application submission.
- **Purpose Limitation**: Resume data is used exclusively for candidate matching against authorized job requisitions.
- **Right to Correction and Erasure**: Candidates retain full rights to update their resumes or invoke complete cascade deletion of their personal and tenant records.
- **Data Minimization & PII Redaction**: Extended PII masking redacts sensitive candidate identifiers before external processing.

---

## 4. Algorithmic Fairness & Counterfactual Invariance

To guarantee parity, CareerShala maintains automated counterfactual unit tests (`backend/eval/fairness.py` and `tests/test_phase8_fairness_compliance.py`). 

```
Δ Score = | Score(Base Resume) - Score(Perturbed Resume) | ≡ 0.00
```

When candidate names (e.g., "Rahul Sharma" ↔ "Priya Patel" ↔ "John Smith"), gender-coded language, or educational institution names are swapped while preserving underlying skills and experience, the match score remains strictly identical within a 0.0 margin of tolerance.

---

## 5. Candidate Access, Transparency, and Explainability

Every candidate match response includes structured, non-opaque feedback:
- **Matched Competencies**: List of recognized technical skills with evidence source (e.g. `work_experience_metric`, `project`, `certification`).
- **Transferable Skills**: Related technologies identified via semantic domain equivalence.
- **Actionable Optimization Suggestions**: Specific, actionable guidance to improve profile clarity (e.g., clarifying date intervals, emphasizing capstone projects, adding missing prerequisite competencies).

---

*Version: 2.1.0*  
*Module: `services/scoring_engine.py` & `eval/fairness.py`*  
*Maintained by: CareerShala Engineering Team*
