# CareerShala Enterprise Role-Based Access Control (RBAC) Matrix

> **Auto-Generated Source of Truth**  
> Generated from `backend/core/rbac.py` and route dependencies. Every cell contains explicit `Allowed` or `Denied` status.

| Permission Token | Description | Platform Admin | Executive (Founder / Owner) | Recruiter (Pipeline Owner) | Hiring Manager (Decision Maker) | Coordinator | Interviewer (Restricted) | Candidate (Applicant) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `jobs:read` | Jobs Read | **Allowed** | **Allowed** | **Allowed** | **Allowed** | **Allowed** | **Allowed** | **Allowed** |
| `jobs:write` | Jobs Write | **Allowed** | **Allowed** | **Allowed** | Denied | Denied | Denied | Denied |
| `jobs:delete` | Jobs Delete | **Allowed** | **Allowed** | Denied | Denied | Denied | Denied | Denied |
| `applications:read` | Applications Read | **Allowed** | **Allowed** | **Allowed** | **Allowed** | **Allowed** | **Allowed** | Denied |
| `applications:score` | Applications Score | **Allowed** | **Allowed** | **Allowed** | **Allowed** | Denied | Denied | Denied |
| `applications:stage_update` | Applications Stage Update | **Allowed** | **Allowed** | **Allowed** | Denied | Denied | Denied | Denied |
| `interviews:schedule` | Interviews Schedule | **Allowed** | **Allowed** | **Allowed** | Denied | **Allowed** | Denied | Denied |
| `interviews:submit_scorecard` | Interviews Submit Scorecard | **Allowed** | **Allowed** | Denied | **Allowed** | Denied | **Allowed** | Denied |
| `requisitions:create` | Requisitions Create | **Allowed** | **Allowed** | **Allowed** | **Allowed** | Denied | Denied | Denied |
| `requisitions:approve` | Requisitions Approve | **Allowed** | **Allowed** | Denied | **Allowed** | Denied | Denied | Denied |
| `talent_crm:access` | Talent Crm Access | **Allowed** | **Allowed** | **Allowed** | Denied | Denied | Denied | Denied |
| `talent_pools:search` | Talent Pools Search | **Allowed** | **Allowed** | **Allowed** | Denied | Denied | Denied | Denied |
| `audit_log:read` | Audit Log Read | **Allowed** | **Allowed** | Denied | Denied | Denied | Denied | Denied |
| `settings:manage` | Settings Manage | **Allowed** | **Allowed** | Denied | Denied | Denied | Denied | Denied |

## Candidate Resource Scope Guardrails
- Candidates are strictly restricted to **own-only** resource access (`user_id == current_user.id`).
- Cross-candidate access to resumes, applications, ATS scoring replays, or interview recordings results in HTTP 403 / 404.

## Multi-Tenant Scope Guardrails
- All non-platform-admin roles are locked within their authenticated `tenant_id` context.
- Cross-tenant query tampering via `X-Tenant-ID` is rejected with HTTP 403 Forbidden.