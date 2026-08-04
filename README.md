# 🚀 CareerShala — AI Career Co-Pilot, Smart ATS & Automated Job Application Platform

> **Single Source of Truth (SSOT) Architectural & Technical Specification Manual**  
> *Exhaustive Production Documentation for Enterprise AI Career Acceleration, ATS Intelligence, Vision Proctoring & Brevo Mailer Infrastructure*

---

## 📖 Executive Summary & Verified Tech Stack Matrix

**CareerShala** is an enterprise-grade AI career copilot, automated ATS resume optimizer, visual cheating-proctored mock interviewer, and automated job application suite built with **FastAPI (Python 3.10+)** and **React 18 (Vite 5)**.

The system integrates multi-agent **LangGraph** workflows, state-of-the-art browser computer vision proctoring (**MediaPipe FaceMesh**, **COCO-SSD**, **face-api.js**), zero-network **ReportLab** dynamic PDF generation, **Brevo HTTP REST API (v3 / Port 443)** email infrastructure, and **MongoDB** async ODMs to deliver an integrated career development experience.

```mermaid
graph TD
    Client[React 18 + Vite Frontend] -->|REST API / WebSockets| Gateway[FastAPI Backend Engine]
    Gateway -->|Async Driver| DB[(MongoDB Atlas)]
    Gateway -->|Multi-Agent State Machine| LangGraph[LangGraph Workflows]
    LangGraph -->|LLM Completion| LLM[Groq Llama 3 / Anthropic Claude / Gemini 1.5]
    Gateway -->|Local Canvas Renderer| PDF[ReportLab Vector PDF Engine]
    Gateway -->|Cloud Storage| Cloudinary[Cloudinary CDN]
    Gateway -->|HTTPS REST API / Port 443| Brevo[Brevo HTTP Mailer API]
    Gateway -->|OAuth 2.0 Token Refresh| Gmail[Google Gmail API]
    Client -->|4-Layer Vision Stream| Vision[Browser Proctoring: MediaPipe + COCO-SSD + face-api.js]
```

### End-to-End Candidate User Journey Flowchart

```mermaid
flowchart LR
    A[👤 Signup & OTP Verify] --> B[📄 Resume Parse & ATS Match]
    B --> C[✨ AI Resume Enhancer]
    C --> D[🎥 Visual-Proctored Mock Interview]
    D --> E[📜 Verified Skill Certificate]
    E --> F[🚀 Automated HR Job Outreach]
```

### Verified Technology Stack Matrix

| Category | Primary Technology / Library | Version / Spec | Operational Role & Architectural Purpose |
| :--- | :--- | :--- | :--- |
| **Backend Core** | FastAPI | `^0.110.0` | Asynchronous, high-performance web framework for API routing & OpenAPI spec |
| **Server Engine** | Uvicorn (Standard) | `^0.29.0` | ASGI web server with Windows `ProactorEventLoop` support for subprocesses |
| **Async ODM / DB** | Motor & PyMongo | `motor==3.4.0`, `pymongo==4.7.2` | Non-blocking async MongoDB driver for database collections & aggregation |
| **Data Validation** | PyDantic v2 | `^2.6.4` | Strict schema validation, data serialization, and settings management |
| **AI Orchestration** | LangGraph & LangChain | `langgraph>=0.0.50`, `langchain-core>=0.1.52` | Multi-agent stateful workflow graphs for ATS analysis & application drafting |
| **LLM Inference** | Groq & Google GenAI | `groq>=0.5.0`, `google-genai>=0.1.1` | High-speed LLM completion (Llama 3 70B, Gemini 1.5 Pro/Flash, Mistral) |
| **NLP & Vectors** | NLTK, Scikit-learn, NumPy | `nltk==3.8.1`, `scikit-learn==1.4.2` | TF-IDF vectorization, cosine similarity, skill ontology matching, tokenization |
| **Proctoring Engine** | MediaPipe FaceMesh & COCO-SSD | `@mediapipe/face_mesh`, `coco-ssd@2.2.3` | Browser 3D head pose estimation, iris gaze tracking, and object detection |
| **Emotion Vision** | face-api.js | `@vladmandic/face-api` | Facial expression analysis & suspicious affect detection |
| **PDF Generation** | ReportLab | `^4.1.0` | Zero-network local vector rendering for verified skill certificates |
| **Doc Parsing** | PDFPlumber, PyPDF, Docx | `pdfplumber==0.11.0`, `python-docx==1.1.2` | Structural extraction of resume text, tables, headers, and metadata |
| **Auth & Security** | Passlib (Bcrypt), Argon2, Jose | `passlib==1.7.4`, `python-jose==3.3.0` | JWT token authorization, password hashing, and OAuth token validation |
| **Email Infrastructure** | Brevo HTTP REST API & Google Auth | `httpx==0.27.0`, `google-auth>=2.29.0` | Production email dispatch over HTTPS Port 443 with candidate `replyTo` routing |
| **Payments** | Razorpay SDK | `^2.0.1` | Secure subscription tier checkout, webhook verification, and order processing |
| **Media CDN** | Cloudinary SDK | `^1.40.0` | Permanent cloud storage for candidate avatars, resume PDFs, and badges |
| **Frontend UI** | React 18 & Vite 5 | `react^18.3.1`, `vite^5.3.3` | Single-Page Application (SPA) framework with HMR and optimized asset bundling |
| **UI Components** | Tailwind CSS & Framer Motion | `tailwindcss^3.4.6`, `framer-motion^11.18.2` | Dark-mode visual hierarchy, glassmorphism, micro-interactions, animations |
| **Data Viz** | Recharts | `^2.12.7` | Dynamic candidate analytics, skill breakdown radar charts, ATS score gauges |

---

## 📁 Complete Workspace Tree & File Responsibility Map

```text
Resume-Screening-System/
├── README.md                          # Root Single Source of Truth Documentation
├── OPTIMIZATION.md                    # Performance & Caching Optimization Plan
├── package.json                       # Root NPM Metadata
├── requirements.txt                   # Production Python Dependencies
├── render.yaml                        # Multi-Service Cloud Deployment Manifest
├── backend/
│   ├── main.py                        # FastAPI Application Bootstrap & Middleware Lifecycle
│   ├── requirements.txt               # Backend Production Dependencies
│   ├── api/
│   │   ├── deps.py                    # Auth Dependents, JWT Verification, Role RBAC
│   │   └── routes/                    # FastAPI API Route Modules (Auth, Resumes, ATS, Apply, etc.)
│   ├── certificates/                  # Zero-Network ReportLab PDF Generator Engine & QR Builder
│   ├── config/                        # Database Connection & Cloud Service Configs
│   ├── core/                          # Settings Schema & Structlog Configuration
│   ├── models/                        # Asynchronous MongoDB ODM Schemas
│   ├── services/                      # Business Logic & Integration Services (25 files)
│   ├── utils/                         # Text, Image, File & Validator Helpers
│   └── workflows/                     # LangGraph Stateful AI Multi-Agent Graphs
└── frontend/
    ├── package.json                   # Frontend React + Vite Dependencies
    ├── vite.config.js                 # Vite Bundler & Dev Proxy Configuration
    ├── src/
    │   ├── App.jsx                    # Route Registry & Auth Provider Guard Rails
    │   ├── main.jsx                   # React Virtual DOM Entrypoint
    │   ├── index.css                  # Global Tailwind CSS Design System & Utility Classes
    │   ├── components/                # Modular React Components
    │   ├── context/                   # Global React State Context Providers (AuthContext)
    │   ├── hooks/                     # Custom React Hooks & Detection Engines
    │   ├── pages/                     # Application Page Views & Interfaces (25 views)
    │   └── services/                  # Frontend API HTTP Abstraction Layer
```

### File-by-File Responsibility Matrix

#### 1. Backend Core & Configuration
| File Path | Description & Responsibility Scope |
| :--- | :--- |
| [backend/main.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/main.py) | Bootstrap entrypoint for FastAPI app, CORS middleware setup, exception handlers, static mount. |
| [backend/core/config.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/core/config.py) | Central Pydantic v2 `Settings` object loading `.env` variables (`BREVO_API_KEY`, `APP_BASE_URL`, `SECRET_KEY`, etc.). |
| [backend/core/security.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/core/security.py) | Password hashing via Bcrypt/Argon2, JWT token creation (`create_access_token`), and payload decoding. |
| [backend/config/db.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/config/db.py) | Motor async MongoDB client initialization, database connection lifecycle, and index creation. |

#### 2. Backend Models (`/backend/models/`)
| Model File | File Path | Architectural Responsibility & Schema Scope |
| :--- | :--- | :--- |
| `user_model.py` | [user_model.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/models/user_model.py) | User auth model containing credentials, roles (`candidate`, `recruiter`), plan tiers, gamification XP/levels, 28-day heatmaps (`🔥`), 7-day reward streak state. |
| `resume_model.py` | [resume_model.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/models/resume_model.py) | Parsed resume data model storing candidate user ID, raw extracted text, parsed skill vectors, work experience objects, education history, file URLs, and cloud metadata. |
| `result_model.py` | [result_model.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/models/result_model.py) | ATS analysis results collection storing overall score (0–100), skill match percentages, missing skill arrays, section score breakdowns, and recommendations. |
| `certificate_model.py` | [certificate_model.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/models/certificate_model.py) | Verified skill certificate record storing unique hex codes, user references, issue timestamps, skill lists, verification URLs, and immutable cryptographic SHA-256 hashes. |
| `application_model.py` | [application_model.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/models/application_model.py) | Job application tracker schema storing candidate applications, company names, targeted roles, draft cover letters/emails, status (`ready_for_review`, `sending`, `sent`, `failed`), provider message IDs. |
| `interview_session_model.py` | [interview_session_model.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/models/interview_session_model.py) | Mock interview tracking model storing session IDs, job titles, target experience levels, transcripts, AI evaluations, score breakdowns, and proctoring integrity logs. |
| `support_ticket_model.py` | [support_ticket_model.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/models/support_ticket_model.py) | Support ticket model managing issue categories, priorities (`low`, `medium`, `high`, `urgent`), message threads, assigned agent IDs, SLA status, and browser/OS metadata. |
| `otp_model.py` | [otp_model.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/models/otp_model.py) | Temporary OTP schema storing 6-digit verification codes, target email addresses, action types (`SIGNUP_VERIFICATION`, `LOGIN_VERIFICATION`, `PASSWORD_RESET`), TTL expiration index (10 min). |

#### 3. Backend Services (`/backend/services/`)
| Service File | File Path | Architectural Responsibility & Logic Scope |
| :--- | :--- | :--- |
| `email_service.py` | [email_service.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/services/email_service.py) | **Brevo HTTP REST API Mailer Service**: Sends OTPs, certificates, support ticket alerts, and HR job outreach emails over HTTPS Port 443 with candidate-direct `replyTo` routing. |
| `certificate_service.py` | [certificate_service.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/services/certificate_service.py) | Skill certificate issuance, verification code validation, Cloudinary uploads, and Brevo PDF certificate delivery. |
| `apply_assistant_service.py` | [apply_assistant_service.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/services/apply_assistant_service.py) | Manages automated job application tailoring, cold email generation, cover letter drafting, and outreach dispatching via Gmail API / Brevo HTTP mailer. |
| `ai_interview_service.py` | [ai_interview_service.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/services/ai_interview_service.py) | Dynamic interactive mock interviews, contextual follow-up questions using LLMs, transcript evaluations for technical depth, clarity, and relevance. |
| `cheating_service.py` | [cheating_service.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/services/cheating_service.py) | Ingests real-time browser video proctoring event telemetry (gaze direction, face counts, suspicious objects) and updates session cheating severity scores. |
| `evaluation_service.py` | [evaluation_service.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/services/evaluation_service.py) | Core ATS scoring engine calculating cosine similarity between job description embeddings/TF-IDF vectors and candidate resume content. |
| `strict_ats_service.py` | [strict_ats_service.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/services/strict_ats_service.py) | Deterministic strict ATS scanner enforcing exact keyword matches, hard section presence (Education, Experience), and structural formatting rules. |
| `fake_detection_service.py` | [fake_detection_service.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/services/fake_detection_service.py) | Analyzes resumes for fraudulent credentials, non-existent companies, buzzword stuffing, timeline overlaps, and ghost white-text ATS hacks. |
| `enhancer_service.py` | [enhancer_service.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/services/enhancer_service.py) | Orchestrates resume bullet point rewrite logic using action verbs, metrics quantification, and ATS keyword density optimization. |
| `gamification_service.py` | [gamification_service.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/services/gamification_service.py) | Executes level calculations, XP gains, streak mechanics, 28-day monthly heatmap state preservation (`🔥`), 7-day rolling rewards, and recruiter leaderboards. |
| `support_service.py` | [support_service.py](file:///e:/FLASK_Clg/Resume-Screening-System/backend/services/support_service.py) | Manages support ticket creation, priority handling, agent replies, automated ticket routing, and Brevo support notification dispatching. |

#### 4. Frontend Modules (`/frontend/src/`)
| Module File | File Path | Architectural Responsibility |
| :--- | :--- | :--- |
| `App.jsx` | [App.jsx](file:///e:/FLASK_Clg/Resume-Screening-System/frontend/src/App.jsx) | React Router registry defining public landing routes, protected dashboard routes, and lazy-loaded callback handlers. |
| `AuthContext.jsx` | [AuthContext.jsx](file:///e:/FLASK_Clg/Resume-Screening-System/frontend/src/context/AuthContext.jsx) | Central authentication state handling JWT storage, auto login, OTP verification steps, and user profile sync. |
| `ApplyAssistant.jsx` | [ApplyAssistant.jsx](file:///e:/FLASK_Clg/Resume-Screening-System/frontend/src/pages/ApplyAssistant.jsx) | AI Application Assistant view supporting ATS pre-check, cover letter drafting, Gmail OAuth state preservation, and 1-click HR dispatch. |
| `CareerPilotLanding.jsx` | [CareerPilotLanding.jsx](file:///e:/FLASK_Clg/Resume-Screening-System/frontend/src/pages/CareerPilotLanding.jsx) | Dynamic landing page with real-time role scanner simulation, live certificate verification tool, and dynamic auth CTAs. |
| `VerifyCertificate.jsx` | [VerifyCertificate.jsx](file:///e:/FLASK_Clg/Resume-Screening-System/frontend/src/pages/VerifyCertificate.jsx) | Public skill certificate verification view rendering certificate metadata, authenticity badges, and score breakdowns. |
| `useProctoringEngine.js` | [useProctoringEngine.js](file:///e:/FLASK_Clg/Resume-Screening-System/frontend/src/hooks/useProctoringEngine.js) | Custom computer vision hook running MediaPipe FaceMesh & COCO-SSD in a canvas loop for real-time cheating telemetry. |

---

## 🗄️ Database Architecture & ODM Collections

The MongoDB database (`ai_career_platform`) uses Motor async drivers to manage 8 primary collections:

```mermaid
erDiagram
    users ||--o{ resumes : owns
    users ||--o{ results : triggers
    users ||--o{ certificates : earns
    users ||--o{ applications : dispatches
    users ||--o{ interview_sessions : attempts
    users ||--o{ support_tickets : creates
    users ||--o{ otps : requests
    
    users {
        string _id PK
        string email
        string password_hash
        string role
        string plan
        int xp_points
        int current_streak
        array heatmap_active_days
    }
    
    resumes {
        string _id PK
        string user_id FK
        string raw_text
        array skills
        string file_path
        string status
    }
    
    certificates {
        string _id PK
        string user_id FK
        string cert_id
        string topic
        float score
        string verification_hash
    }

    applications {
        string _id PK
        string user_id FK
        string company_name
        string hr_email
        string status
        string provider_message_id
    }
```

---

## 🛣️ Comprehensive API Route Registry

All backend routes are prefixed with `/api/v1`:

### 1. Authentication & Security (`/api/v1/auth`)
- `POST /auth/register`: Register new candidate or recruiter account.
- `POST /auth/login`: Authenticate credentials, trigger OTP if new device detected.
- `POST /auth/verify-email`: Verify 6-digit email signup OTP code.
- `POST /auth/verify-login-otp`: Verify 6-digit trusted device login OTP challenge.
- `POST /auth/refresh`: Refresh JWT access token.
- `GET /auth/me`: Get active user profile, gamification stats, and heatmap array.

### 2. Resume & Parsing Services (`/api/v1/resumes`)
- `POST /resumes/upload`: Upload PDF/Docx resume to server and extract raw text.
- `GET /resumes`: List parsed candidate resumes.
- `GET /resumes/{id}`: Get parsed resume structure and skill taxonomy array.

### 3. ATS Analysis & Gap Engine (`/api/v1/ats`)
- `POST /ats/match`: Compute TF-IDF & semantic keyword compatibility score against job description.
- `POST /ats/strict-match`: Enforce strict ATS formatting and mandatory section presence rules.
- `GET /ats/history`: List candidate's past ATS evaluation reports.

### 4. AI Apply Assistant (`/api/v1/apply`)
- `POST /apply/ats-score`: Pre-check ATS match score before drafting outreach.
- `POST /apply/draft`: Generate customized cover letter PDF and cold email body via LangGraph.
- `PUT /apply/draft/{id}`: Save user edits to email subject, body, or cover letter.
- `GET /apply/draft/{id}`: Retrieve stored application draft.
- `GET /apply/active-draft`: Retrieve active `ready_for_review` application draft.
- `POST /apply/draft/{id}/send`: Dispatch HR application email via Gmail API or Brevo HTTP mailer with candidate `replyTo`.
- `GET /apply/history`: Paginated history of dispatched job applications.

### 5. Verified Certificates (`/api/v1/certificates`)
- `POST /certificates/issue`: Issue skill certificate and render vector PDF.
- `GET /certificates/verify/{certificate_id}`: Public rate-limited endpoint to verify certificate authenticity.
- `GET /certificates/download/{certificate_id}`: Download verified PDF certificate file.

### 6. Support Tickets (`/api/v1/support`)
- `POST /support/tickets`: Submit technical support ticket with attachments & metadata.
- `GET /support/tickets`: List user's support tickets.
- `GET /support/tickets/{ticket_id}`: Get detailed ticket message history.

---

## ⚡ Email Infrastructure: Brevo HTTP REST API (v3)

To prevent cloud platform outbound SMTP port-blocking (ports 25, 465, 587 are frequently blocked on Vercel, Render, AWS, and Heroku), CareerShala utilizes the **Brevo HTTP REST API (v3)** operating over standard HTTPS (**Port 443**).

### Features & Workflow Integration:
1. **Candidate-Direct `replyTo` Routing**:
   When emailing recruiters on behalf of a candidate, Brevo HTTP API injects:
   ```json
   {
     "sender": { "name": "CareerShala", "email": "admin@careershala.tech" },
     "to": [{ "email": "recruiter@company.com", "name": "HR Manager" }],
     "replyTo": { "email": "candidate@gmail.com", "name": "Candidate Name" },
     "subject": "Application for Senior Developer",
     "htmlContent": "<p>Cover Letter Content...</p>",
     "attachment": [{ "name": "Resume.pdf", "content": "<base64_encoded_pdf>" }]
   }
   ```
   When HR clicks "Reply" in their email client, their response routes **directly to the candidate's personal inbox**!

2. **Environment-Aware Certificate Verification Links**:
   Verification links embedded in Brevo emails dynamically adapt:
   - **Production**: `https://resume-screening-system-lyart.vercel.app/verify/{cert_id}`
   - **Development**: `http://localhost:5173/verify/{cert_id}`

---

## 👁️ Computer Vision Proctoring Architecture

During interactive mock interviews, the browser executes a 4-layer vision proctoring loop:

1. **MediaPipe FaceMesh**: Computes 3D head pose matrix (pitch, yaw, roll) and iris gaze direction to detect candidates looking away from screen.
2. **COCO-SSD Object Detection**: Scans video frames for unauthorized smartphones, extra human faces, or hidden devices.
3. **face-api.js Affect Analysis**: Monitors facial expressions and flags suspicious micro-expressions or posture anomalies.
4. **Telemetry Ingest**: Telemetry events are continuously dispatched to `POST /api/v1/proctoring/telemetry`, updating session integrity scores.

---

## 🛠️ Environment Configuration (`.env`)

Create `backend/.env` from `backend/.env.example`:

```bash
cp backend/.env.example backend/.env
```

### Complete Environment Variable Registry

| Variable Name | Required | Default / Example Value | Operational Purpose |
| :--- | :---: | :--- | :--- |
| **`APP_NAME`** | No | `"AI Career Co-Pilot & Smart ATS Platform"` | Display title of platform |
| **`ENV` / `ENVIRONMENT`** | Yes | `development` / `production` | Active application environment |
| **`APP_BASE_URL`** | **Yes** | `https://resume-screening-system-lyart.vercel.app` | Base URL used for public certificate verification links |
| **`FRONTEND_URL`** | **Yes** | `http://localhost:5173` | Allowed CORS frontend origin |
| **`API_V1_PREFIX`** | No | `/api/v1` | API route version prefix |
| **`MONGO_URI`** | **Yes** | `mongodb+srv://user:pass@cluster.mongodb.net` | MongoDB Atlas URI |
| **`MONGO_DB_NAME`** | Yes | `ai_career_platform` | Target MongoDB database name |
| **`SECRET_KEY`** | **Yes** | `256-bit-hex-secret-key` | JWT token encryption key (32+ chars) |
| **`ALGORITHM`** | No | `HS256` | JWT signing algorithm |
| **`BREVO_API_KEY`** | **Yes** | `xkeysib-...` | Brevo REST API v3 key (port 443 HTTPS) |
| **`MAIL_FROM_EMAIL`** | **Yes** | `admin@careershala.tech` | Verified sender email address |
| **`MAIL_FROM_NAME`** | Yes | `CareerShala` | Sender display name in email clients |
| **`SUPPORT_EMAIL`** | Yes | `admin@careershala.tech` | Target inbox for candidate support tickets |
| **`GOOGLE_CLIENT_ID`** | **Yes** | `...apps.googleusercontent.com` | Google OAuth Client ID |
| **`GOOGLE_CLIENT_SECRET`** | Yes | `GOCSPX-...` | Google OAuth Client Secret |
| **`GOOGLE_GMAIL_REDIRECT_URI`** | Yes | `http://localhost:5173/gmail-callback` | Gmail OAuth redirect URI |
| **`CLOUDINARY_CLOUD_NAME`** | Yes | `docxk5qop` | Cloudinary CDN cloud name |
| **`CLOUDINARY_API_KEY`** | Yes | `348829864291724` | Cloudinary API key |
| **`CLOUDINARY_API_SECRET`** | Yes | `OasM1p92MK5jtkLnRqqgWznZBHo` | Cloudinary API secret |
| **`RAZORPAY_KEY_ID`** | **Yes** | `rzp_test_T6sfAlbO1GCGeq` | Razorpay API Key ID |
| **`RAZORPAY_KEY_SECRET`** | **Yes** | `nfh6u8a5gmsAVrxIlkcD7Y4q` | Razorpay API Key Secret |
| **`GROQ_API_KEY`** | Yes | `gsk_11ppkwQCWOwWmihD1iqY...` | Groq Llama 3 API Key |
| **`MISTRAL_API_KEY`** | Yes | `pCVvGkfNxnFaDM5X8vUhvLD...` | Mistral AI API Key |
| **`GITHUB_TOKEN`** | Yes | `ghp_vyKUEnAA1SRJG9P...` | GitHub REST API Access Token |

---

## 💻 Local Development Setup & Execution

### 1. Repository Setup & Virtual Environment

```bash
# Clone repository
git clone https://github.com/agrawalrohit937/Resume-Screening-System.git
cd Resume-Screening-System

# Create virtual environment
python -m venv backend/venv

# Activate virtual environment (Windows PowerShell):
.\backend\venv\Scripts\Activate.ps1
# Linux/macOS:
# source backend/venv/bin/activate

# Install backend dependencies
pip install -r backend/requirements.txt
```

### 2. Backend Server Execution

```bash
# Copy and configure environment variables
cp backend/.env.example backend/.env

# Start FastAPI server via Uvicorn
$env:PYTHONPATH="backend"
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
Interactive API Documentation: `http://localhost:8000/docs`

### 3. Frontend Web Application Execution

Open a separate terminal window:

```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```
Frontend Web Application: `http://localhost:5173`

---

## 🧪 Automated Testing Suite

Run Pytest tests for email delivery, support ticket notifications, and application assistant:

```bash
$env:PYTHONPATH="backend"
backend/venv/Scripts/python.exe -m pytest backend/tests/test_support_email_service.py backend/tests/test_apply_assistant.py
```

Run Python syntax and compilation check across core backend modules:

```bash
python -m py_compile backend/core/config.py backend/services/email_service.py backend/services/certificate_service.py backend/certificates/email.py backend/api/routes/apply_assistant.py
```

Build production bundle for frontend:

```bash
cd frontend && npm run build
```

---

## 🌐 Cloud Deployment Guide

### Frontend Deployment (Vercel)
- Set Root Directory to `frontend`.
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables:
  - `VITE_API_URL`: `https://resume-screening-system-hb2d.onrender.com/api/v1`

### Backend Deployment (Render / Docker)
- Deploy `backend` as a Web Service.
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Set Production Environment Variables:
  - `ENV`: `production`
  - `APP_BASE_URL`: `https://resume-screening-system-lyart.vercel.app`
  - `FRONTEND_URL`: `https://resume-screening-system-lyart.vercel.app`
  - `BREVO_API_KEY`: `xkeysib-...`
  - `MAIL_FROM_EMAIL`: `admin@careershala.tech`
  - `MAIL_FROM_NAME`: `CareerShala`

---

## 📄 License & Ownership

Designed and engineered with ❤️ by **CareerShala**.  
Copyright © 2026. All rights reserved.
