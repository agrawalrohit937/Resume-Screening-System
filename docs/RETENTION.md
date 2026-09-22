# CareerPilot ATS v2.0.0 — Data Retention & Telemetry Policy

## 1. Scope & Principles
This document outlines data retention schedules and lawful bases under **GDPR Art. 5(1)(e)**, **India DPDP Act 2023**, and **EEOC Recordkeeping Requirements**.

CareerPilot operates under three core principles:
1. **Purpose Limitation**: Candidate data is processed strictly for job matching, qualification evaluation, and audit compliance.
2. **Storage Minimization**: Unnecessary personal identifiers are stripped prior to model telemetry storage.
3. **Audit Integrity**: Compliance logs required by law are maintained in immutable, append-only stores.

## 2. Retention Schedules

| Data Category | Purpose | Retention Period | Storage Location | Deletion Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **Candidate Resumes & PII** | Active application processing | 180 days post-application closure | `db.resumes`, S3 / Azure Blob | Automated TTL purge or candidate self-service erasure |
| **Parsed Candidate Data** | Skill matching & ranking | 180 days post-application closure | `db.parsed_resumes` | Cascading delete on resume erasure |
| **Anonymized Scoring Features** | Model training, calibration, drift detection | 24 months | `db.scoring_telemetry` | Hashed identifier, demographic-blind feature vectors |
| **Decision Audit Records** | Regulatory compliance (NYC LL144, EEOC, GDPR Art 22) | 36 months (3 years) | `db.decision_log` (append-only) | Scheduled regulatory purge after statutory limit |
| **Session & Access Logs** | Security monitoring | 90 days | CloudWatch / Graylog | Rolling retention window |

## 3. Candidate Right to Erasure (DPDP & GDPR)
- Candidates can trigger self-service erasure via `/api/v1/compliance/candidate-portal/{candidate_id}/data`.
- Upon request:
  - Personal resumes, parsed profiles, contact details, and application records are hard-deleted within 72 hours.
  - Hashed records in `db.decision_log` have personal IDs replaced with cryptographic one-way hashes (`[ANONYMIZED_CANDIDATE]`) to preserve statutory compliance audit trails without retaining PII.
