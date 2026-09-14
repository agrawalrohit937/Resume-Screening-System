# 🚀 CareerShala Platform — Comprehensive Workspace Audit & Production Readiness Report

**Date:** September 2026  
**Auditor:** Antigravity Agentic Audit Suite  
**Repository:** `agrawalrohit937/Resume-Screening-System`  
**Status:** ✅ **PRODUCTION READY & STARTUP READY**  
**Test Suite Status:** **99 / 99 PASSED (100%)**  
**Frontend Build Status:** **SUCCESS (`vite build` in 31.4s, exit code 0)**

---

## 1. Executive Summary

A comprehensive, end-to-end architectural, security, configuration, dependency, and code audit was conducted across the entire workspace (`backend`, `frontend`, Docker, Cloud configurations, and test suites).

The objective was to transform the platform from a multi-developer prototyping state into a **clean, secure, maintainable, resilient, and startup-ready codebase**.

### Key Highlights:
1. **Single Source of Configuration**: `backend/core/config.py` was completely refactored. Over 25 obsolete/dead environment variables and duplicated sections were removed. Added automatic multi-key rotation pools for Groq and Gemini (`GROQ_API_KEY_1`..`10`), HuggingFace token support, and structured defaults.
2. **Frontend Security**: Eliminated backend secrets and leaked LLM API keys (`GROQ_API_KEY`) from `frontend/.env`. Created `frontend/.env.example` defining only required client-safe variables (`VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_RAZORPAY_KEY_ID`).
3. **Hardcoded URLs & Sensitive Domains Removed**: Eliminated hardcoded production URLs (`https://careershala.com`, `https://careershala.tech`) from backend services (`portfolio.py`, `certificates/service.py`, etc.), routing all domain references dynamically through `settings.FRONTEND_URL` and `settings.cert_verify_base_url`.
4. **Dead Code & Dependency Pruning**:
   - Removed dead root-level mobile build artifact folder `app/` (over 2,000 stale compiled class files).
   - Removed orphaned debugging scripts (`test_full_issue.py`, `test_live_endpoint.py`).
   - Removed unneeded dependencies (`celery`, `redis`, `aiocache`, `sentry-sdk`, `sympy==1.12`).
   - Removed dead `celery_worker` from `docker-compose.yml`, obsolete `sentence_transformers` install line from `Dockerfile`, and unused `texlive` bundle from `render.yaml`.
5. **Security Hardening**:
   - Fixed `NameError: name 'logger'` in `backend/services/razorpay_service.py` during webhook signature validation.
   - Added global `ValueError` (HTTP 400) and `ValidationError` (HTTP 422) exception handlers in `backend/main.py`.
   - Hardened `get_current_user` dependency to strictly prioritize explicit `Authorization: Bearer <token>` headers over ambient browser cookies, preventing cross-session credential leakage.
   - Re-activated `/metrics` endpoint with official Prometheus format for observability.
6. **Zero-Regression Verification**:
   - All 99 backend integration and unit tests pass with zero errors.
   - Frontend compiles cleanly with `npm run build`.

---

## 2. Architecture & Configuration Audit

### Backend Configuration (`backend/core/config.py`)
- **Single Source of Truth**: Unified all environment variables into a single, clean Pydantic `Settings` model.
- **Removed Dead / Unused Configs**:
  - `BERT_*` and `TFIDF_*` legacy configurations (replaced by LangGraph and HuggingFace/Strict ATS pipeline).
  - `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` (Celery/Redis stack was removed; tasks run via FastAPI `BackgroundTasks`).
  - `SENTRY_DSN` (sentry-sdk is not utilized).
  - `RATE_LIMIT_STORAGE_URL` (in-memory rate limiter utilized).
  - `PDF_TIMEOUT_SECONDS` (replaced by timeout in `render_html_to_pdf`).
  - `PROFILE_UPLOAD_DIR` and `STATIC_UPLOADS_URL_PREFIX` (handled directly in `main.py`).
- **Added / Enhanced Configs**:
  - `load_dotenv` called at module top so environment variables are reliably populated prior to settings instantiation.
  - Numbered key discovery (`_1` through `_10`) for `GROQ_API_KEYS` and `GEMINI_API_KEYS` pools.
  - Added `HF_TOKEN` configuration for HuggingFace Inference API embeddings.
  - Added `cert_verify_base_url` property defaulting to `{FRONTEND_URL}/verify/cert`.

### Frontend Configuration (`frontend/.env`)
- **Vulnerability Remediated**: `frontend/.env` contained `GROQ_API_KEY` and commented-out Gemini keys. Exposing LLM API keys in client-side bundles allows users to inspect network storage/code and exhaust API quotas.
- **Remediation**:
  - Removed all backend secrets from `frontend/.env`.
  - Created `frontend/.env.example` specifying safe client variables (`VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_RAZORPAY_KEY_ID`).

---

## 3. Security & Vulnerability Remediation

| Component | Vulnerability / Issue | Severity | Status | Fix Details |
| :--- | :--- | :--- | :--- | :--- |
| `frontend/.env` | Backend API Key (`GROQ_API_KEY`) exposed in client bundle | **Critical** | **Fixed** | Removed secret from client `.env`; created `frontend/.env.example`. |
| `razorpay_service.py` | `NameError: name 'logger' is not defined` during webhook verification failure | **High** | **Fixed** | Imported `structlog` and instantiated module-level logger. Webhook signature verification verified. |
| `api/deps.py` | Ambient cookie took precedence over explicit `Authorization: Bearer` header | **High** | **Fixed** | Prioritized explicit `credentials.credentials` over ambient `request.cookies`. |
| `main.py` | Unhandled `ValueError` caused unhandled 500 exceptions on invalid IDs | **Medium** | **Fixed** | Added global `ValueError` exception handler returning clean HTTP 400 Bad Request. |
| `main.py` | Pydantic validation errors in endpoint bodies bubbled as internal errors | **Medium** | **Fixed** | Added global `ValidationError` exception handler returning HTTP 422 with structured JSON. |
| `main.py` | Missing Prometheus metrics endpoint | **Low** | **Fixed** | Implemented `/metrics` endpoint serving `generate_latest()` with `CONTENT_TYPE_LATEST`. |
| `portfolio.py` / `certificates` | Hardcoded production domains (`careershala.tech`, `careershala.com`) | **Medium** | **Fixed** | Replaced with dynamic `settings.FRONTEND_URL` and `settings.cert_verify_base_url`. |

---

## 4. Dead Code, File & Dependency Cleanup

### Deleted Dead Files & Directories
- **`app/` (Root Directory)**: Deleted legacy, unmaintained Android build output folder containing thousands of `.class` files.
- **`backend/test_full_issue.py`**: Removed standalone debugging scratch file.
- **`backend/test_live_endpoint.py`**: Removed standalone debugging scratch file.
- **`backend/test_render_*.pdf`**: Cleaned up temporary test artifacts.

### Dependency Pruning (`backend/requirements.txt` & root `requirements.txt`)
- **`sympy==1.12`**: Removed. Only referenced in an accidental unused import (`from sympy import pprint` in `certificates/service.py`).
- **`celery`**: Removed. Background processing is handled natively by FastAPI `BackgroundTasks`.
- **`redis` & `aiocache`**: Removed. In-memory cache backend (`fastapi_cache.backends.inmemory.InMemoryBackend`) is used.
- **`sentry-sdk`**: Removed unused telemetry package.

### Infrastructure & Deployment Files Cleaned
- **`backend/docker/Dockerfile`**: Removed line 20 (`sentence_transformers` pip install) which bloated Docker build times and was not imported.
- **`backend/docker/docker-compose.yml`**: Removed orphan `celery_worker` service block.
- **`backend/render.yaml` & `render.yaml`**: Removed unused `texlive` installation commands.

---

## 5. Test Suite Verification & Audit Results

Running the full test suite with `pytest tests/ -v`:

```text
============================= test session starts =============================
platform win32 -- Python 3.10.10, pytest-8.2.0, pluggy-1.6.0
rootdir: E:\FLASK_Clg\Resume-Screening-System\backend
configfile: pytest.ini
collected 99 items

tests/test_api.py::TestHealth::test_root PASSED                          [  1%]
tests/test_api.py::TestHealth::test_health PASSED                        [  2%]
tests/test_api.py::TestHealth::test_docs_available PASSED                [  3%]
tests/test_api.py::TestHealth::test_openapi_schema PASSED                [  4%]
tests/test_api.py::TestAuth::test_signup_success PASSED                  [  5%]
tests/test_api.py::TestAuth::test_signup_duplicate_email PASSED          [  6%]
tests/test_api.py::TestAuth::test_signup_weak_password PASSED            [  7%]
tests/test_api.py::TestAuth::test_signup_invalid_email PASSED            [  8%]
tests/test_api.py::TestAuth::test_login_success PASSED                   [  9%]
tests/test_api.py::TestAuth::test_login_wrong_password PASSED            [ 10%]
tests/test_api.py::TestAuth::test_login_nonexistent_user PASSED          [ 11%]
tests/test_api.py::TestAuth::test_get_me PASSED                          [ 12%]
tests/test_api.py::TestAuth::test_me_unauthorized PASSED                 [ 13%]
tests/test_api.py::TestAuth::test_update_profile PASSED                  [ 14%]
tests/test_api.py::TestAuth::test_refresh_token PASSED                   [ 15%]
tests/test_api.py::TestAuth::test_invalid_token_rejected PASSED          [ 16%]
tests/test_api.py::TestResume::test_list_resumes_empty PASSED            [ 17%]
tests/test_api.py::TestResume::test_upload_invalid_file_type PASSED      [ 18%]
tests/test_api.py::TestResume::test_upload_empty_file PASSED             [ 19%]
tests/test_api.py::TestResume::test_get_nonexistent_resume PASSED        [ 20%]
tests/test_api.py::TestResume::test_invalid_resume_id_format PASSED      [ 21%]
tests/test_api.py::TestATS::test_match_nonexistent_resume PASSED         [ 22%]
tests/test_api.py::TestATS::test_match_short_jd_rejected PASSED          [ 23%]
tests/test_api.py::TestATS::test_history_empty PASSED                    [ 24%]
tests/test_api.py::TestATS::test_bulk_match_empty_ids PASSED             [ 25%]
tests/test_api.py::TestSkills::test_market_demand PASSED                 [ 26%]
tests/test_api.py::TestSkills::test_analyze_skills_invalid_resume PASSED [ 27%]
tests/test_api.py::TestGitHub::test_invalid_username PASSED             [ 28%]
tests/test_api.py::TestGitHub::test_invalid_username_format PASSED      [ 29%]
tests/test_api.py::TestRecruiter::test_recruiter_rank_requires_role PASSED [ 30%]
tests/test_api.py::TestRecruiter::test_recruiter_stats_with_role PASSED  [ 31%]
tests/test_api.py::TestAnalytics::test_my_analytics PASSED               [ 32%]
tests/test_api.py::TestAnalytics::test_skills_market PASSED              [ 33%]
tests/test_api.py::TestAnalytics::test_platform_analytics_requires_admin PASSED [ 34%]
tests/test_api.py::TestNLPUtils::test_clean_text PASSED                  [ 35%]
tests/test_api.py::TestNLPUtils::test_extract_email PASSED               [ 36%]
tests/test_api.py::TestNLPUtils::test_extract_phone PASSED               [ 37%]
tests/test_api.py::TestNLPUtils::test_detect_skills PASSED               [ 38%]
tests/test_api.py::TestNLPUtils::test_extract_keywords PASSED            [ 39%]
tests/test_api.py::TestNLPUtils::test_tfidf_similarity_identical PASSED  [ 40%]
tests/test_api.py::TestNLPUtils::test_tfidf_similarity_different PASSED  [ 41%]
tests/test_api.py::TestNLPUtils::test_score_to_label PASSED              [ 42%]
tests/test_api.py::TestNLPUtils::test_score_to_grade PASSED              [ 43%]
tests/test_api.py::TestNLPUtils::test_normalize_score_clamp PASSED       [ 44%]
tests/test_api.py::TestNLPUtils::test_extract_sections PASSED            [ 45%]
tests/test_api.py::TestNLPUtils::test_extract_years_of_experience PASSED [ 46%]
tests/test_api.py::TestSecurity::test_password_hash_and_verify PASSED    [ 47%]
tests/test_api.py::TestSecurity::test_access_token_create_and_decode PASSED [ 48%]
tests/test_api.py::TestSecurity::test_refresh_token_type PASSED          [ 49%]
tests/test_api.py::TestSecurity::test_invalid_token_returns_none PASSED [ 50%]
tests/test_api.py::TestSecurity::test_expired_token PASSED               [ 51%]
tests/test_api.py::TestValidators::test_valid_object_id PASSED           [ 52%]
tests/test_api.py::TestValidators::test_github_username_validation PASSED [ 53%]
tests/test_api.py::TestValidators::test_clamp PASSED                     [ 54%]
tests/test_api.py::TestValidators::test_is_valid_url PASSED              [ 55%]
tests/test_apply_assistant.py::test_generate_draft_returns_ready_for_review PASSED [ 56%]
tests/test_apply_assistant.py::test_send_before_draft_ready_returns_404_or_409 PASSED [ 57%]
tests/test_apply_assistant.py::test_quality_validator_flags_placeholder_text PASSED [ 58%]
tests/test_apply_assistant.py::test_status_transition_guard PASSED       [ 59%]
tests/test_ats_pipeline.py::test_extract_skills_from_jd_deterministic PASSED [ 60%]
tests/test_ats_pipeline.py::test_ats_score_computation_bounds PASSED     [ 61%]
tests/test_nlp_extractor.py::test_extract_text_empty_input PASSED        [ 62%]
tests/test_nlp_extractor.py::test_normalize_text_special_characters PASSED [ 63%]
tests/test_nlp_extractor.py::test_extract_entities_empty_text PASSED     [ 64%]
tests/test_nlp_extractor.py::test_extract_keywords_limit PASSED          [ 65%]
tests/test_portfolio_service.py::test_generate_slug_basic PASSED         [ 66%]
tests/test_portfolio_service.py::test_generate_slug_special_characters PASSED [ 67%]
tests/test_portfolio_service.py::test_generate_slug_empty PASSED          [ 68%]
tests/test_revenue_recovery.py::test_health_endpoint PASSED              [ 69%]
tests/test_revenue_recovery.py::test_create_and_fetch_recovery_case PASSED [ 70%]
tests/test_revenue_recovery.py::test_trigger_recovery_workflow PASSED    [ 71%]
tests/test_revenue_recovery.py::test_process_dunning_step PASSED         [ 72%]
tests/test_revenue_recovery.py::test_update_case_status PASSED           [ 73%]
tests/test_revenue_recovery.py::test_predictive_risk_assessment PASSED   [ 74%]
tests/test_revenue_recovery.py::test_recovery_analytics_summary PASSED   [ 75%]
tests/test_revenue_recovery.py::test_offer_discount PASSED               [ 76%]
tests/test_revenue_recovery.py::test_brevo_dunning_email_delivery PASSED  [ 77%]
tests/test_revenue_recovery.py::test_razorpay_webhook_signature_verification PASSED [ 78%]
tests/test_revenue_recovery.py::test_voice_recovery_dialogue PASSED      [ 79%]
tests/test_revenue_recovery.py::test_recovery_case_model PASSED          [ 80%]
tests/test_scoring_engine.py::test_compute_vector_similarity PASSED       [ 81%]
tests/test_scoring_engine.py::test_compute_vector_similarity_low_match PASSED [ 82%]
tests/test_scoring_engine.py::test_evaluate_knockout_math PASSED         [ 83%]
tests/test_scoring_engine.py::test_run_strict_ats_check_dual_stage PASSED [ 84%]
tests/test_scoring_engine.py::test_flexible_pattern_multiline_wrapping PASSED [ 85%]
tests/test_skill_ontology.py::test_normalize_skill_aliases PASSED        [ 86%]
tests/test_skill_ontology.py::test_normalize_skill_casing_and_unknown PASSED [ 87%]
tests/test_skill_ontology.py::test_expand_skills PASSED                  [ 88%]
tests/test_skill_ontology.py::test_evaluate_skill_fulfillment_exact PASSED [ 89%]
tests/test_skill_ontology.py::test_evaluate_skill_fulfillment_taxonomy_parent PASSED [ 90%]
tests/test_skill_ontology.py::test_evaluate_skill_fulfillment_taxonomy_equivalent PASSED [ 91%]
tests/test_skill_ontology.py::test_evaluate_skill_fulfillment_none PASSED [ 92%]
tests/test_skill_ontology.py::test_get_all_known_skills PASSED           [ 93%]
tests/test_support_email_service.py::test_support_ticket_email_is_sent_after_save PASSED [ 94%]
tests/test_support_email_service.py::test_support_ticket_creation_continues_when_email_fails PASSED [ 95%]
tests/test_support_email_service.py::test_support_ticket_repo_normalizes_naive_datetimes_to_utc PASSED [ 96%]
tests/test_support_email_service.py::test_email_settings_are_loaded_from_env_file PASSED [ 97%]
tests/test_support_email_service.py::test_career_application_routes_to_careers_inbox PASSED [ 98%]
tests/test_support_email_service.py::test_support_ticket_routes_to_support_inbox_with_user_reply_to PASSED [100%]

============================= 99 passed in 4.74s ==============================
```

---

## 6. Production Readiness Checklist

| Category | Requirement | Status | Verification Notes |
| :--- | :--- | :--- | :--- |
| **Secrets Management** | No backend secrets exposed in frontend | ✅ Passed | Frontend `.env` sanitized; `.env.example` created. |
| **Secrets in Git** | No credentials in reports or public docs | ✅ Passed | Report contains zero keys, passwords, or tokens. |
| **Configuration** | Single source of truth | ✅ Passed | `backend/core/config.py` cleaned, structured, and validated. |
| **CORS Policy** | Production origins configurable via env | ✅ Passed | Managed via `ALLOWED_ORIGINS` & `CORS_ORIGIN_REGEX`. |
| **Error Masking** | No internal tracebacks exposed to users | ✅ Passed | Production middleware masks 500 error bodies; `ValueError`/`ValidationError` produce standard 400/422 responses. |
| **Webhooks** | Razorpay webhook signature verified | ✅ Passed | Signature verified; logger runtime error fixed. |
| **Dead Code** | Unused imports, dead packages, obsolete files | ✅ Passed | Purged `app/`, unused scripts, dead dependencies. |
| **Frontend Build** | `vite build` succeeds with zero errors | ✅ Passed | Built in 31.4s with exit code 0. |
| **Automated Tests** | Integration + unit test suites pass | ✅ Passed | 99/99 passed in 4.74s. |

---

## 7. Operational Recommendations for Deployment

1. **Environment Variables Deployment**: Ensure all secrets in production deployment environments (Render, AWS, Railway, etc.) are injected directly via environment variables rather than committed `.env` files.
2. **Key Rotation Readiness**: The backend now supports numbered keys (`GROQ_API_KEY_1` .. `_10` and `GEMINI_API_KEY_1` .. `_10`). Add backup keys in production to ensure high availability and rate limit mitigation.
3. **Database Indexes**: Ensure MongoDB production indexes are created during initial startup as defined in `config/db.py`.
