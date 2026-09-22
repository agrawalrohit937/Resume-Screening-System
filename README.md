# 🚀 CareerShala — Next-Gen AI Applicant Tracking System (ATS) & Talent Cloud

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg?style=flat-square)](https://github.com/agrawalrohit937/Resume-Screening-System)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688.svg?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB.svg?style=flat-square&logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.3.3-646CFF.svg?style=flat-square&logo=vite)](https://vitejs.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%207.0-47A248.svg?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4.6-38B2AC.svg?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-2.0.0-blue.svg?style=flat-square)](https://github.com/agrawalrohit937/Resume-Screening-System)

> **CareerShala** is an enterprise-grade AI-powered recruitment, applicant tracking system (ATS), and career co-pilot platform. Engineered with **FastAPI**, **React 18**, **MongoDB**, and cutting-edge **LLM/RAG pipelines**, it bridges the gap between ambitious candidates and modern hiring teams with automated ATS scoring, knock-out screening, computer vision live mock interviews, and automated application outreach.

---

## 🌟 Live Demo & Quick Links

- 🌐 **Production Web Application**: [CareerShala Web App](https://resume-screening-system-lyart.vercel.app)
- ⚙️ **Interactive OpenAPI Swagger Docs**: `http://localhost:8000/docs`
- 📚 **Alternative ReDoc API Specs**: `http://localhost:8000/redoc`
- 📜 **Public Skill Certificate Verification**: `/verify/:certificateId`
- 💼 **Candidate Public Portfolio Showcase**: `/portfolio/:username`
- 🏢 **Employer Public Company Pages**: `/company/:companySlug`

---

## 📖 System Architecture & Overview

CareerShala is architected as a high-performance decoupled Single-Page Application (SPA) backed by asynchronous Python microservices:

```mermaid
graph TD
    subgraph Client Layer [Frontend SPA - React 18 + Vite 5 + Tailwind CSS]
        CandidateUI[Candidate Career Cockpit]
        RecruiterUI[Recruiter & Enterprise Kanban]
        CopilotUI[Interactive AI Copilot Drawer]
        ProctorUI[4-Layer Vision Proctor Canvas]
        PortfolioUI[Interactive 6-Theme Portfolio Studio]
    end

    subgraph Gateway Layer [FastAPI Asynchronous Gateway]
        TenantMW[Multi-Tenant Context Middleware]
        AuthMW[JWT HS256 & RBAC Security Guard]
        RateLimiter[SlowAPI Distributed Rate Limiter]
        UploadHandler[Magic-Byte File Sanitizer]
    end

    subgraph Intelligence & Scoring Engines
        ATS[Hybrid ATS Engine: Dense BGE + BM25 + Cross-Encoder]
        Scoring[Experience & Fresher Scoring Model]
        Knockout[Enterprise Gate & Knockout Validator]
        LangGraph[LangGraph Multi-Agent Application Dispatcher]
        Copilot[Multi-Provider LLM Cascade: Groq / Gemini / Mistral]
    end

    subgraph Cloud Storage & External Services
        MongoDB[(MongoDB Atlas 7.0)]
        Cloudinary[Cloudinary CDN]
        Brevo[Brevo Transactional Mailer - HTTPS Port 443]
        GmailOAuth[Google Gmail OAuth 2.0 Relay]
        ReportLab[Zero-Network Vector PDF Engine]
    end

    ClientLayer --> GatewayLayer
    GatewayLayer --> Intelligence & Scoring Engines
    GatewayLayer --> Cloud Storage & External Services
```

---

## ✨ Key Features

### 1. 📊 Dual-Engine ATS Resume Screening & Explainable AI (XAI)
- **Hybrid Matching Engine**: Blends dense semantic vector representations (768-D BGE embeddings) with sparse lexical TF-IDF/BM25 token density and deep Cross-Encoder re-ranking.
- **Fair Experience Scoring**: Dynamic models calibrated for both Entry-Level/Fresher candidates (0.0 years baseline) and Senior professionals.
- **Knock-Out Gate Verification**: Automated checks for must-have hard skills, minimum education degrees, and required certifications.
- **Actionable AI Feedback**: Categorized suggestions (Skill Match, Skill Gap, Degree in Progress, Formatting Fixes) with 1-click prompt copying.
- **Ghost Text & Keyword Stuffing Detection**: Uncovers hidden white text, micro-fonts, and timeline anomalies.

### 2. 🏢 Enterprise ATS & B2B SaaS Hiring Cloud
- **Multi-Tenant Isolation**: Rigorous tenant partitioning (`x-tenant-id`) across requisitions, candidates, and scorecards.
- **5 Role-Specific Dashboards**:
  - **Executive Cockpit**: Requisition velocity, cost-per-hire, offer acceptance rate, and department health.
  - **Recruiter Kanban**: 6-stage candidate pipeline (`Applied` ➔ `Reviewing` ➔ `Shortlisted` ➔ `Interview` ➔ `Hired` ➔ `Rejected`).
  - **Hiring Manager Portal**: Requisition sign-offs, scorecard calibration, and candidate advancement.
  - **Interviewer Workbench**: Structured interview kits with STAR competency rubrics.
  - **Team Management**: Role-Based Access Control (Owner, Admin, Recruiter, Hiring Manager, Interviewer, Executive).
- **EEOC & OFCCP Compliance Vault**: Demographics data is cryptographically isolated from hiring evaluators to eliminate bias.

### 3. 💬 Persistent AI Career Copilot
- **Universal Assistant**: Floating conversational co-pilot accessible on every view.
- **Dynamic Context Assembly (RAG)**: Gathers live candidate profile data, parsed resumes, ATS scores, and interview histories.
- **Multi-Provider Cascade Failover**: Seamless fallback sequence:
  $$\text{Groq (GPT-OSS-120B / Qwen)} \xrightarrow{\text{fallback}} \text{Google Gemini 2.5 Flash} \xrightarrow{\text{fallback}} \text{Mistral AI} \xrightarrow{\text{fallback}} \text{Rule-based Guidance}$$
- **Thread-Safe Key Pools**: Automatic round-robin rotation across up to 5 keys per provider on HTTP `429` rate limits.

### 4. 🎥 Real-Time Mock Interviewer & 4-Layer Vision Proctoring
- **Adaptive Conversational AI**: Generates technical and behavioral follow-up questions tailored to real-time candidate answers.
- **4-Layer In-Browser Proctoring**:
  1. *MediaPipe FaceMesh*: 3D head pose matrix calculation and iris gaze vector tracking.
  2. *COCO-SSD Real-Time Detector*: Identifies unauthorized smartphones, monitors, notes, and extra persons.
  3. *face-api.js Affect Recognition*: Facial expression analysis and posture anomaly tracking.
  4. *Telemetry Stream Aggregator*: Streams events to compute a real-time 0–100% Candidate Integrity Score.

### 5. 🎨 AI Portfolio Builder Studio
- **1-Click Extraction**: Converts uploaded PDF resumes into fully structured portfolio profiles.
- **6 Premium Visual Themes**: Bento Grid, Glassmorphic Pro, Cyberpunk Neon, Minimal Elegance, Terminal Developer, and 3D Interactive.
- **Public Showcase & Relay**: Hosted at `/portfolio/:username` with private recruiter-to-candidate email relay.

### 6. 🤖 AI Apply Assistant & Smart Outreach
- **Screenshot OCR Parser**: Extracts job details, required qualifications, and HR contact emails from job board screenshots.
- **LangGraph Multi-Agent Cover Letters**: Generates personalized cold emails and custom cover letter PDFs.
- **Dual-Engine Delivery**: Dispatches via Google Gmail OAuth or Brevo HTTPS REST API with candidate `replyTo` injection.

### 7. 📜 Cryptographically Verified Skill Certificates
- **Zero-Network ReportLab Engine**: Generates high-resolution vector PDF certificates locally without external API dependencies.
- **Tamper-Proof Verification**: Embedded SHA-256 verification hash, unique alphanumeric credential ID, and scannable QR code.

### 8. 🎮 Gamification & Career Quest
- **28-Day Heatmap Grid**: Visual activity tracking for daily mock interviews, ATS scans, and profile enhancements.
- **Streaks & XP Levels**: Milestone rewards, daily chest claims, and public candidate leaderboards.

---

## 🛠️ Technology Stack Matrix

| Layer | Technology | Purpose & Implementation |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 18** + **Vite 5** | High-performance SPA with client-side routing and instant HMR |
| **Styling & UI** | **Tailwind CSS** + **Lucide Icons** | Glassmorphic design system, dark mode, responsive SaaS layouts |
| **Data Visualization** | **Recharts** | Radar charts, score gauges, hiring velocity line charts |
| **In-Browser Vision** | **MediaPipe**, **COCO-SSD**, **face-api.js** | Client-side gaze estimation, multi-person detection, facial telemetry |
| **Backend Framework** | **FastAPI** (Python 3.10+) | Async ASGI web framework with OpenAPI/Swagger specifications |
| **Database & ODM** | **MongoDB Atlas** + **Motor** | Async non-blocking document database for multi-tenant data |
| **AI / LLM Providers** | **Groq**, **Google Gemini**, **Mistral** | Multi-model fallback cascade with key rotation for high availability |
| **Multi-Agent AI** | **LangGraph** + **LangChain** | Directed acyclic graph workflows for smart application generation |
| **NLP & Embeddings** | **BGE Dense Embeddings**, **Scikit-learn**, **NLTK** | Semantic document similarity, TF-IDF lexical search, Cross-Encoder |
| **Document Processing** | **pdfplumber**, **pypdf**, **python-docx** | Magic-byte verified parsing of resumes and job descriptions |
| **Vector PDF Engine** | **ReportLab** | Native local generation of verified certificates and cover letters |
| **Authentication** | **JWT (python-jose)** + **Passlib (Argon2/Bcrypt)** | Dual token auth, 6-digit OTP challenges, trusted device cookies |
| **Email Delivery** | **Brevo REST API v3** + **Gmail OAuth 2.0** | HTTPS Port 443 email delivery with custom `replyTo` candidate headers |
| **Payments** | **Razorpay SDK** | Secure checkout and webhook signature verification |
| **Media Storage** | **Cloudinary CDN** | Cloud asset storage for candidate avatars and badge images |
| **DevOps & Deploy** | **Docker**, **Azure App Service**, **Vercel** | Containerized backend deployment and CDN-backed frontend hosting |

---

## 📁 Project Structure

```text
Resume-Screening-System/
├── README.md                          # Enterprise Documentation (Single Source of Truth)
├── AI_COPILOT_ARCHITECTURE.md         # In-Depth AI Copilot Engineering Specification
├── package.json                       # Root workspace configuration
│
├── backend/                           # FastAPI Python Backend
│   ├── main.py                        # Application entry point, lifespan, CORS & middleware
│   ├── requirements.txt               # Backend Python dependencies
│   ├── Dockerfile                     # Production container manifest
│   ├── api/                           # API layer
│   │   ├── deps.py                    # JWT authentication, RBAC & tenant scoping dependencies
│   │   └── routes/                    # 30+ Modular Route Handlers
│   │       ├── auth.py                # User registration, login, token refresh & OTP
│   │       ├── ats.py                 # ATS match engine, score breakdowns & gap analysis
│   │       ├── copilot.py             # Context-aware streaming career co-pilot
│   │       ├── live_interview.py      # Real-time mock interview & vision proctoring stream
│   │       ├── portfolio.py           # Portfolio builder, themes & public showcase
│   │       ├── apply_assistant.py     # OCR screenshot extraction & job application drafts
│   │       ├── certificates.py        # Verified certificate issuance & QR verification
│   │       ├── requisitions.py        # Enterprise job requisitions & hiring workflows
│   │       ├── interview_kits.py      # Standardized interview scorecards & rubrics
│   │       ├── team.py                # Multi-tenant workspace team invitations & RBAC
│   │       ├── eeo.py                 # EEO-1 demographic compliance anonymization vault
│   │       ├── webhooks.py            # Signed HMAC-SHA256 outbound event notifications
│   │       └── payment.py             # Razorpay order creation & webhook verification
│   ├── certificates/                  # ReportLab zero-network vector PDF generator
│   ├── core/                          # Settings, security & LLM client managers
│   │   ├── config.py                  # Pydantic v2 settings & environment validation
│   │   ├── llm_client.py              # Thread-safe multi-key rotation pool for Groq & Gemini
│   │   ├── security.py                # Argon2/Bcrypt password hashing & JWT token handling
│   │   └── logging.py                 # Structured JSON logging (structlog)
│   ├── models/                        # MongoDB ODM Schemas (Users, Resumes, Portfolios, etc.)
│   ├── repositories/                  # Clean Architecture Data Access Layer
│   ├── services/                      # Core Business Logic & AI Engines
│   │   ├── scoring_engine.py          # Dual-engine ATS scoring, fresher models & gates
│   │   ├── copilot_service.py         # AI Copilot streaming & context aggregator
│   │   ├── email_service.py           # Brevo HTTP REST & Gmail OAuth dispatcher
│   │   ├── live_interview_service.py  # Adaptive AI mock interview engine
│   │   └── portfolio_service.py       # Resume parsing & portfolio theme formatter
│   ├── templates/email/               # Production HTML email templates (OTP, invites, alerts)
│   └── tests/                         # Pytest automated test suite (Unit & Integration)
│
└── frontend/                          # React 18 + Vite SPA
    ├── package.json                   # Frontend npm dependencies
    ├── vite.config.js                 # Vite bundler, proxy & path alias configuration
    ├── index.html                     # HTML5 root template
    └── src/
        ├── App.jsx                    # Route registry, protected routes & role guards
        ├── main.jsx                   # React Virtual DOM bootstrap
        ├── index.css                  # Tailwind CSS design system & custom animations
        ├── components/                # Reusable UI component modules
        │   ├── AICopilotWidget.jsx    # Persistent floating AI Copilot drawer
        │   ├── AppLayout.jsx          # Dashboard shell with responsive navigation
        │   ├── ats/                   # Unified ATS readiness scorecards & radar charts
        │   ├── detection/             # In-browser MediaPipe/COCO-SSD proctoring overlays
        │   ├── portfolio/             # 6 visual theme portfolio renderers & editor studio
        │   ├── recruiter/             # Requisition managers & candidate Kanban boards
        │   └── gamification/          # 28-day activity heatmap & XP progression rings
        ├── context/                   # React Contexts (AuthContext, TenantContext)
        ├── pages/                     # 30+ Application views & enterprise portals
        │   ├── Dashboard.jsx          # Candidate Career Dashboard
        │   ├── Results.jsx            # Deep ATS scoring report & keyword insights
        │   ├── LiveInterview.jsx      # Proctored AI live interview studio
        │   ├── PortfolioBuilder.jsx   # Interactive 6-step portfolio builder studio
        │   ├── PublicPortfolio.jsx    # Published candidate portfolio showcase
        │   ├── ApplyAssistant.jsx     # Smart job outreach & cover letter assistant
        │   ├── VerifyCertificate.jsx  # Public tamper-proof certificate validator
        │   └── enterprise/            # Enterprise B2B SaaS portals (Exec, Recruiter, Team)
        └── services/                  # Axios/Fetch API client layer
```

---

## 🚀 Getting Started & Local Installation

### Prerequisites
- **Node.js** `v18.x` or higher
- **Python** `3.10` or higher
- **MongoDB** instance running locally (`mongodb://localhost:27017`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster URI

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/agrawalrohit937/Resume-Screening-System.git
cd Resume-Screening-System
```

---

### Step 2: Backend Setup (FastAPI)

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create your `.env` configuration file:
   ```bash
   cp .env.example .env
   ```
   *(Configure your database and API keys as described in the Environment Variables section).*

5. Start the FastAPI development server:
   ```bash
   # Windows (PowerShell)
   $env:PYTHONPATH="."
   python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

   # Linux / macOS
   PYTHONPATH=. uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```
   - **Backend API**: `http://127.0.0.1:8000`
   - **Interactive API Docs (Swagger)**: `http://127.0.0.1:8000/docs`

---

### Step 3: Frontend Setup (React + Vite)

1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install the frontend dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   - **Local Web App**: `http://localhost:5173`

---

## 🔐 Environment Variables (`backend/.env`)

Copy the template and fill in your development or production credentials:

```env
# ── Application Settings ──
APP_NAME=CareerShala AI Career Platform
APP_VERSION=2.0.0
DEBUG=True
API_V1_PREFIX=/api/v1
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]

# ── Database (MongoDB) ──
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=ai_career_platform
MONGO_MIN_CONNECTIONS=10
MONGO_MAX_CONNECTIONS=100

# ── Security & JWT ──
SECRET_KEY=your_at_least_32_char_long_super_secret_jwt_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# ── File Uploads ──
MAX_FILE_SIZE_MB=10
UPLOAD_DIR=./uploads

# ── AI / LLM Keys (Supports 1-5 keys for automatic rotation) ──
GROQ_API_KEY=your_primary_groq_api_key
GROQ_API_KEY_1=your_groq_key_1
GROQ_API_KEY_2=your_groq_key_2
GOOGLE_API_KEY=your_primary_google_gemini_key
GOOGLE_API_KEY_1=your_gemini_key_1
MISTRAL_API_KEY=your_mistral_api_key

# ── Email Service (Brevo HTTP REST API - Port 443) ──
BREVO_API_KEY=your_brevo_v3_api_key
MAIL_FROM_EMAIL=admin@careershala.tech
MAIL_FROM_NAME=CareerShala
ADMIN_EMAIL=admin@careershala.tech
SUPPORT_EMAIL=support@careershala.tech

# ── OAuth 2.0 Credentials ──
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_GMAIL_REDIRECT_URI=http://localhost:5173/gmail-callback
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:5173/github-callback

# ── Cloud Media Storage (Cloudinary) ──
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# ── Payment Gateway (Razorpay) ──
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# ── Azure Document Intelligence (Optional OCR Fallback) ──
AZURE_DI_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com/
AZURE_DI_KEY=your_azure_document_intelligence_key
```

---

## 🧪 Testing & Quality Assurance

Run the comprehensive automated test suite across backend scoring engines, isolation security, and email pipelines:

```bash
# Run all backend unit and integration tests
pytest backend/tests/

# Run specific multi-tenancy and RBAC isolation tests
pytest backend/tests/test_multi_tenancy_and_rbac.py

# Run ATS scoring and bias audit tests
pytest backend/tests/test_ats_pipeline.py backend/tests/test_cultural_names.py

# Run frontend build verification
cd frontend && npm run build
```

---

## 🚢 Production Deployment

### Azure App Service (Backend Docker Container)
1. Build and push the Docker image:
   ```bash
   docker build -t your-registry.azurecr.io/careershala-backend:latest ./backend
   docker push your-registry.azurecr.io/careershala-backend:latest
   ```
2. Configure App Service with container runtime and inject the environment variables listed in `.env`.
3. Set `UPLOAD_DIR=/tmp/uploads` for optimized container execution.

### Vercel / Cloudflare Pages (Frontend SPA)
1. Set the **Root Directory** to `frontend`.
2. Set the **Build Command** to `npm run build` and **Output Directory** to `dist`.
3. Configure `VITE_API_URL` to point to your deployed backend API URL (e.g., `https://api.careershala.tech/api/v1`).

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1. **Fork** the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'feat: Add AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a **Pull Request**.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 📬 Contact & Support

- **Project Lead & Maintainer**: Rohit Agrawal
- **Email Inquiries**: [support@careershala.tech](mailto:support@careershala.tech) | [admin@careershala.tech](mailto:admin@careershala.tech)
- **GitHub Repository**: [https://github.com/agrawalrohit937/Resume-Screening-System](https://github.com/agrawalrohit937/Resume-Screening-System)

---

<p align="center">
  <b>Built with ❤️ by CareerShala Engineering</b>
</p>
