# CareerShala Platform Configuration & Environment Variables

This document serves as the reference guide for environment variables, feature flags, security settings, and runtime switches in CareerShala.

---

## 1. Security & JWT Lifecycle
| Variable | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `SECRET_KEY` | `str` | *Required* | Primary HMAC-SHA256 signing secret (minimum 32 characters). |
| `ALGORITHM` | `str` | `HS256` | JWT cryptographic algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `int` | `15` | Short-lived access token TTL in minutes. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `int` | `7` | Rotating refresh token TTL in days. |
| `JWT_PREVIOUS_SECRET_KEY` | `str` | `None` | Secondary signing key accepted during secret rotation grace windows. |
| `JWT_SECRET_ROTATION_ENABLED` | `bool` | `True` | Enables dual-key verification for zero-downtime secret rollover. |

---

## 2. Rate Limiting (SlowAPI)
| Variable | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `RATELIMIT_DEFAULT` | `str` | `300/minute` | Default global per-IP request throttle. |
| `RATELIMIT_ATS` | `str` | `30/minute` | Tighter throttle on `/api/v1/ats/*` scoring endpoints. |
| `RATELIMIT_RESUME` | `str` | `20/minute` | Throttle on resume upload and parsing requests. |
| `RATELIMIT_COPILOT` | `str` | `30/minute` | Throttle on streaming Copilot chat completions. |
| `RATELIMIT_AUTH` | `str` | `10/minute` | Strict throttle on login, OTP, and registration endpoints. |
| `RATELIMIT_ENHANCE` | `str` | `20/minute` | Throttle on AI resume bullet enhancer & cover letter generator. |

---

## 3. Binary Upload & File Hardening
| Variable | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `MAX_FILE_SIZE_MB` | `int` | `10` | Maximum file size for resume uploads. |
| `MAX_PDF_PAGES` | `int` | `15` | Maximum allowable page count for PDF resumes to prevent processing exhaustion. |
| `ALLOWED_FILE_TYPES` | `list` | `[pdf, docx]` | Strict allowed MIME types validated with magic bytes (`%PDF-`, `PK\x03\x04`). |
| `UPLOAD_DIR` | `str` | `./uploads` | Local temporary and staging directory for sanitized uploads. |

---

## 4. Multi-Tenant Scoping
| Component | Behavior |
| :--- | :--- |
| `TenantMiddleware` | Extracts `tenant_id` exclusively from verified JWT access claims. Rejects `X-Tenant-ID` spoofing with HTTP 403. |
| `TenantScopedDatabase` | Injects active `tenant_id` filter across all tenant-scoped MongoDB collections. |
| `platform_admin` | The only root administrative role permitted cross-tenant query bypass. |
