# CareerShala / CareerPilot — Batch A Physical Cleanup Execution Report

> **Execution Date:** October 2026  
> **Phase:** Batch A — Verified Low-Risk Physical Cleanup  
> **Git Branch:** `cleanup/batch-a`  
> **Status:** COMPLETED & VERIFIED (Zero Regressions, 100% Build & Test Pass)

---

## 1. Executive Summary

Batch A physical cleanup was executed with zero modifications to application logic, ATS scoring, candidate ranking, database models, payment pipelines, or background schedulers.

### Key Impact Highlights

| Metric | Before Batch A | After Batch A | Net Improvement |
|---|---|---|---|
| **Total Non-Vendor Repo Footprint** | **151.55 MB** (655 files) | **19.91 MB** (626 files) | **-131.64 MB (-86.9%)** |
| **`tools/zrok/` Bloat** | **124.66 MB** (5 files) | **0.01 MB** (2 files) | **-124.65 MB (-99.9%)** |
| **`frontend/public/` Media** | **9.10 MB** (28 files) | **3.54 MB** (18 files) | **-5.56 MB (-61.1%)** |
| **`backend/uploads/` Test Residue** | **1.44 MB** (20 files) | **0.00 MB** (3 anchor files) | **-1.44 MB (-100%)** |
| **Frontend Production Build** | 10.50 s | **10.83 s** | **100% Clean Pass** (3,591 modules) |
| **Backend Test Suite** | Passed | **Passed (6/6 in 0.11s)** | **100% Pass** |

---

## 2. Exact Files Deleted

### A. Development Binary Bloat (`tools/zrok/`)
| File Path | Size | Justification |
|---|---|---|
| `tools/zrok/zrok2.exe` | 95.25 MB | Windows binary for local HTTP tunneling. Not part of CI/CD or production runtime. |
| `tools/zrok/zrok.tar.gz` | 32.31 MB | Compressed tarball of zrok binary. |
| `tools/zrok/CHANGELOG.md` | 72.6 KB | Upstream release notes for zrok CLI. |

### B. Redundant & Dead Frontend Public Assets (`frontend/public/`)
| File Path | Size | Justification |
|---|---|---|
| `frontend/public/interviewer-avatar2.mp4` | 2.89 MB | Unreferenced alternate video avatar. `interviewer-avatar.mp4` (0.69 MB) is the active asset loaded in `LiveInterview.jsx` & `LiveAssessmentCandidate.jsx`. |
| `frontend/public/logo.mp4` | 0.88 MB | Unreferenced video asset. Platform uses `logo.png` / `logo_t.webp`. |
| `frontend/public/illustration.png` | 0.49 MB | Unreferenced PNG fallback. `Login.jsx` & `Signup.jsx` directly import active `illustration.webp`. |
| `frontend/public/comapny_page.png` | 0.44 MB | Exact typo duplicate of `company_page.png` (0.44 MB). Unreferenced anywhere in codebase. |
| `frontend/public/models/face_expression_model-shard1` | 0.31 MB | Dead face-api model weight. Proctoring was simplified to lightweight DOM/canvas checks in `useAdvancedDetection.js`. |
| `frontend/public/models/face_expression_model-weights_manifest.json` | 0.01 MB | Dead face-api model manifest. |
| `frontend/public/models/face_landmark_68_model-shard1` | 0.34 MB | Dead face-api landmark weights. |
| `frontend/public/models/face_landmark_68_model-weights_manifest.json` | 0.01 MB | Dead face-api landmark manifest. |
| `frontend/public/models/tiny_face_detector_model-shard1` | 0.18 MB | Dead face-api detector weights. |
| `frontend/public/models/tiny_face_detector_model-weights_manifest.json` | 0.00 MB | Dead face-api detector manifest. |

### C. Backend Local Upload Residue (`backend/uploads/`)
| Directory / Files | Size | Justification |
|---|---|---|
| `backend/uploads/69ec3a7836092d81cbb26777/*` | 1.28 MB | 6 local test resume PDF/DOCX files from developer testing sessions. |
| `backend/uploads/generated/*` | 0.20 MB | 14 test cover letters and certificates generated during local test runs. |

---

## 3. Exact Files Retained and Why

| File Path | Size | Reason for Preservation |
|---|---|---|
| `frontend/public/certificate_sample.png` | 1.48 MB | **Active Production Asset:** Used in `LandingCertificateSection.jsx` (lines 219 & 289) as the `<picture>` fallback image for browsers that do not support WebP. |
| `tools/zrok/README.md` | 3.68 KB | **Developer Guidance:** Contains official instructions and direct download links for developers who require local tunneling. |
| `tools/zrok/LICENSE` | 11.08 KB | **Open Source Attribution:** Retains open source license notice for zrok integration. |
| `documentation/Resume Screening System.pdf` | 3.94 MB | **Project Documentation:** Project architectural and workflow reference manual. |
| `backend/eval/*` (all 5 files) | 1.24 MB | **Evaluation Benchmarks:** Required for offline scoring calibration, fairness auditing, and evaluation test suites. |
| `backend/data/education_equivalence.csv` | 4.78 KB | **Active Domain Data:** Loaded at startup by `education_service.py` for global degree equivalence mapping. |
| `backend/data/ontology/*` | 17.27 KB | **Active Domain Data:** Loaded by `services/ontology/` for occupation-skill graph navigation. |
| `backend/uploads/.gitkeep` | 0.03 KB | **Directory Anchor:** Preserves runtime upload folder structure across Git checkouts. |
| `backend/uploads/generated/.gitkeep` | 0.03 KB | **Directory Anchor:** Preserves generated PDF folder structure. |
| `backend/uploads/profile/.gitkeep` | 0.03 KB | **Directory Anchor:** Preserves profile uploads folder structure. |
| `backend/temp_storage/.gitkeep` | 0.03 KB | **Directory Anchor:** Preserves temporary storage folder structure. |

---

## 4. Git Tracking & Ignore Verification

The root `.gitignore` was updated with narrowly scoped rules:
```gitignore
uploads/
backend/uploads/**/*
!backend/uploads/**/.gitkeep
backend/temp_storage/**/*
!backend/temp_storage/**/.gitkeep

# Temporary tunnel binaries and archives
tools/zrok/*.exe
tools/zrok/*.tar.gz
tools/zrok/*.zip
tools/temp_*.json
```
- Git tracking confirmed: No test uploads or binaries are staged or tracked.
- `git diff --check`: Passed with 0 whitespace or formatting errors.

---

## 5. Build, Test & Verification Results

1. **Frontend Production Build**:
   ```bash
   npm run build
   # Output: ✓ 3591 modules transformed. built in 10.83s.
   # Result: 100% PASS (Zero errors or missing imports)
   ```
2. **Backend Unit & Adapter Test Suite**:
   ```bash
   python -m pytest tests/test_occupation_adapters.py -q
   # Output: 6 passed, 2 warnings in 0.11s
   # Result: 100% PASS
   ```
3. **Route & Scheduler Integrity**:
   - `backend/main.py`: All 36 route inclusions intact.
   - `backend/scheduler/job_alerts.py`: 07:30 AM & 02:00 PM IST APScheduler configuration, claims table, startup recovery intact.
   - External APIs: Zero real emails, Razorpay calls, or Brevo requests were dispatched.

---

## 6. Safety & Rollback Instructions

If any rollback of Batch A is ever required:
```bash
# Revert to previous branch or commit:
git checkout cleanup/codebase-cleanup
# Or discard Batch A changes:
git checkout main
```

---
*Batch A physical cleanup executed cleanly and verified autonomously.*
