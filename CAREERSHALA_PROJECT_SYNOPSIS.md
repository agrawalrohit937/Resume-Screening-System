# PROJECT SYNOPSIS

## CAREERSHALA: AI CAREER CO-PILOT, DUAL-ENGINE SMART ATS & EDGE VISION PROCTORING SUITE

---

### **TITLE PAGE**

* **Project Title**: CareerShala: AI Career Co-Pilot & Smart ATS
* **Domain**: Artificial Intelligence | Natural Language Processing | Edge Computer Vision | Cloud & Systems Architecture
* **Academic Program**: Bachelor of Technology (B.Tech) in Computer Science & Engineering / Information Technology
* **Academic Session**: 2025 – 2026
* **Production Domain**: `https://careershala.tech`

#### **Project Team (Team Helix Rockers)**
1. **Rohit Agrawal** — [Enrollment/Roll No. Placeholder] (Team Lead & Systems Architect)
2. **Jahnvi** — [Enrollment/Roll No. Placeholder] (AI/NLP & Frontend Engineer)
3. **Shubham** — [Enrollment/Roll No. Placeholder] (Backend & DevOps Engineer)
4. **Somya** — [Enrollment/Roll No. Placeholder] (Computer Vision & Quality Assurance)

#### **Institutional Metadata**
* **Project Guide**: [Guide Name & Designation Placeholder]
* **Head of Department**: [HOD Name Placeholder]
* **Department**: Department of Computer Science & Engineering
* **Institution**: [College / University Name Placeholder]

---

## 1. INTRODUCTION

### 1.1 Industry Problem Analysis

The contemporary global recruitment landscape suffers from severe algorithmic opacity, operational inefficiencies, and structural asymmetries between job applicants and enterprise talent acquisition systems. Modern enterprises deploy Automated Tracking Systems (ATS) to filter massive volumes of applicant resumes. However, legacy screening algorithms rely heavily on rudimentary keyword matching and fragile document parsing heuristics. Research indicates that over 75% of qualified candidate resumes are rejected by legacy ATS software prior to any human review due to non-standard formatting, multi-column layouts, non-standard font encoding, or arbitrary token weighting.

Concurrently, job seekers face three structural bottlenecks:
1. **The "Black Box" ATS Rejection Dilemma**: Candidates receive binary rejection emails without actionable mathematical or structural diagnostics explaining *why* their resume failed, leading to perpetual trial-and-error resume drafting.
2. **Interview Preparation Disconnect & High Coaching Costs**: Traditional mock interview tools are limited to static multiple-choice questions or expensive human coaching sessions. Existing automated proctoring solutions stream raw high-definition video feeds to cloud servers, incurring exorbitant bandwidth costs, violating user privacy, and introducing latency that degrades candidate performance.
3. **Outreach & Portfolio Fatigue**: Modern candidates spend hundreds of manual hours customizing cover letters, locating hiring manager contacts, and building personal showcase portfolios. Standard email dispatch solutions deployed on serverless cloud platforms frequently fail due to cloud provider outbound SMTP port bans (blocking ports 25, 465, and 587 to prevent spam).

`CareerShala` addresses these challenges by introducing an enterprise-grade AI Career Co-Pilot and Smart ATS platform engineered to bridge the trust, efficiency, and diagnostic gap between candidates and enterprise hiring systems.

```
+---------------------------------------------------------------------------------------------------+
|                                     CAREERSHALA SYSTEM ARCHITECTURE                               |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  |                              FRONTEND: REACT 18 SPA (VITE 5)                                |  |
|  |   [Tailwind CSS UI] <---> [MediaPipe Edge WASM/WebGL] <---> [Dynamic Portfolio Canvas]      |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                |                                                  |
|                                         HTTPS / REST API                                          |
|                                                v                                                  |
|  +---------------------------------------------------------------------------------------------+  |
|  |                            BACKEND: FASTAPI ASGI ENGINE (PYTHON 3.10+)                        |  |
|  |  +------------------------+  +--------------------------+  +--------------------------------+  |  |
|  |  | Module 1: Dual ATS     |  | Module 3: LangGraph Agent|  | Module 4: Dynamic Portfolio    |  |  |
|  |  | Engine (TF-IDF/Cosine) |  | (Groq / Llama 3 70B)     |  | (SEO / GitHub / Parser Engine) |  |  |
|  |  +------------------------+  +--------------------------+  +--------------------------------+  |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                      |                     |                                      |
|                  +-------------------+                     +------------------+                   |
|                  v                                                            v                   |
|  +-------------------------------+                            +--------------------------------+  |
|  |   DATABASE & INFRASTRUCTURE   |                            |       EXTERNAL INTEGRATIONS    |  |
|  |   - MongoDB Atlas (Motor ODM) |                            |   - Brevo API (HTTPS Port 443) |  |
|  |   - Microsoft Azure Web App   |                            |   - Cloudinary Media CDN       |  |
|  |   - Azure DevOps CI/CD        |                            |   - ReportLab PDF Engine       |  |
|  +-------------------------------+                            +--------------------------------+  |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

---

### 1.2 Proposed Solution: The CareerShala Platform

CareerShala is structured as a resilient, multi-tenant cloud application operating on a decoupled architecture. The platform combines deterministic mathematical screening with state-of-the-art generative language models and client-side edge computer vision.

The system encompasses four core architectural modules:
1. **Dual-Engine Smart ATS & Formatting Auditor**: Combines a mathematical TF-IDF Cosine Similarity vector matcher with a deterministic rule validation engine that audits document structure, font consistency, parsing accessibility, and detects malicious "ghost white-text" keyword stuffing.
2. **4-Layer Edge Vision Proctoring Engine**: Operates entirely client-side inside the user's browser using MediaPipe FaceMesh and COCO-SSD compiled to WebAssembly (WASM) and hardware-accelerated via WebGL. It evaluates 3D head pose Euler angles, iris gaze direction vectors, unauthorized mobile devices, and multi-person detection at 30+ FPS with zero cloud GPU infrastructure costs.
3. **LangGraph Automated Job Application Workflow**: A stateful Multi-Agent Directed Acyclic Graph (DAG) that parses target Job Descriptions (JDs), aligns applicant achievement metrics, generates customized cover letters, and executes direct email outreach via the Brevo REST API over standard HTTPS Port 443 with candidate-direct `replyTo` header routing.
4. **AI Dynamic Portfolio Builder**: Automatically transforms raw parsed resume structures and GitHub REST API metadata into hosted, SEO-optimized personal developer portfolios (`careershala.tech/portfolio/{username}`) featuring dynamic JSON-LD structured schema markup, responsive glassmorphic interfaces, and open-graph recruiter shareability.

---

### 1.3 Detailed Technical Definitions & Theoretical Foundations

To establish academic rigor, the specialized algorithms, protocol specifications, and theoretical frameworks utilized throughout CareerShala are formally defined below:

#### A. Term Frequency-Inverse Document Frequency (TF-IDF)
TF-IDF is a statistical vectorization technique used to evaluate the relative importance of a candidate keyphrase $t$ within a document collection $D$.
* **Term Frequency (TF)** measures the normalized frequency of term $t$ in a document $d$:
  $$\text{TF}(t, d) = \frac{f_{t,d}}{\sum_{t' \in d} f_{t',d}}$$
  where $f_{t,d}$ is the raw count of term $t$ in document $d$.
* **Inverse Document Frequency (IDF)** measures the informational scarcity of term $t$ across all document sets $D$:
  $$\text{IDF}(t, D) = \ln\left(\frac{1 + |D|}{1 + |\{d \in D : t \in d\}|}\right) + 1$$
* The final composite TF-IDF weight vector is defined as:
  $$\text{TF-IDF}(t, d, D) = \text{TF}(t, d) \times \text{IDF}(t, D)$$

#### B. Cosine Similarity Vector Space Model
Cosine Similarity measures the directional alignment between two non-zero $n$-dimensional term vectors in an inner product space. In CareerShala, the parsed Resume Vector $\vec{R}$ and Job Description Vector $\vec{JD}$ are projected into an $n$-dimensional Euclidean domain. The similarity score $\theta$ is computed as:
$$\text{Similarity}(\vec{R}, \vec{JD}) = \cos(\theta) = \frac{\vec{R} \cdot \vec{JD}}{\|\vec{R}\|_2 \|\vec{JD}\|_2} = \frac{\sum_{i=1}^{n} R_i \cdot JD_i}{\sqrt{\sum_{i=1}^{n} R_i^2} \sqrt{\sum_{i=1}^{n} JD_i^2}}$$
A scalar metric of $1.0$ represents identical semantic skill density, while $0.0$ represents orthogonal (completely disjoint) skill spaces.

#### C. Edge Computing & Browser-Based WebAssembly (WASM) / WebGL Acceleration
Edge computing decentralizes computational workloads by executing algorithms locally on client hardware rather than remote servers. CareerShala executes deep vision neural networks directly inside the browser DOM using Google MediaPipe compiled to WebAssembly (WASM)—a binary instruction format operating at near-native speed—and hardware-accelerated via WebGL APIs to leverage the client's local GPU without sending raw video streams over the network.

#### D. MediaPipe FaceMesh & 3D Euler Pose Estimation
MediaPipe FaceMesh tracks 468 3D facial landmarks in real time. The head pose calculation estimates three orthogonal rotation angles relative to the camera coordinate frame:
* **Pitch ($\theta$)**: Nodal rotation around the horizontal X-axis (looking up/down).
* **Yaw ($\psi$)**: Nodal rotation around the vertical Y-axis (looking left/right).
* **Roll ($\phi$)**: Nodal rotation around the z-axis of view (head tilting).

Mathematical transformation from 3D facial landmark coordinates $(X, Y, Z)$ to Perspective-n-Point (PnP) pose matrices allows the system to compute precise gaze vectors and detect off-screen visual distraction during proctored sessions.

#### E. LangGraph Multi-Agent Directed Acyclic Graph (DAG)
LangGraph is a framework for orchestrating stateful, multi-actor LLM workflows. Unlike linear chain abstractions, LangGraph models agent workflows as a cyclic or acyclic directed graph $G = (V, E)$, where vertices $V$ represent autonomous agent functions (e.g., *Job Extractor Agent*, *Resume Tailor Agent*, *Quality Inspector Agent*) and edges $E$ enforce state transitions based on intermediate evaluation conditions:
$$S_{t+1} = f(S_t, A_t)$$
where $S_t$ is the shared execution state context and $A_t$ is the output action generated by the active agent node.

#### F. REST API Messaging over HTTPS Port 443 & Dynamic Reply-To Header
Modern serverless and containerized cloud platforms (such as Microsoft Azure App Services, AWS EC2, and Render) enforce strict outbound security policies blocking standard Simple Mail Transfer Protocol (SMTP) traffic on ports 25, 465, and 587 to prevent server exploitation for spam generation. CareerShala bypasses these cloud firewall restrictions by routing email payloads over standard Hypertext Transfer Protocol Secure (HTTPS) Port 443 via the Brevo REST API v3. 

To preserve candidate autonomy, the API request payload injects an explicit RFC 5322 `replyTo` header pointing directly to the applicant's personal email address:
```json
{
  "sender": { "name": "CareerShala Gateway", "email": "outreach@careershala.tech" },
  "to": [{ "email": "recruiter@company.com", "name": "Talent Acquisition Team" }],
  "replyTo": { "email": "candidate.alex@gmail.com", "name": "Alex Johnson" },
  "subject": "Application for Senior Software Engineer - Alex Johnson",
  "htmlContent": "<p>Tailored Cover Letter Content...</p>"
}
```
When a recruiter clicks "Reply" in their native email client, the mail user agent (MUA) automatically redirects the response directly to `candidate.alex@gmail.com`, bypassing the application server entirely.

#### G. Dynamic SEO Portfolio Builder & JSON-LD Structured Data
Search Engine Optimization (SEO) for personal dynamic web assets requires semantic HTML5 architecture and dynamic structured data rendering. CareerShala's Portfolio Builder injects Google Schema.org `Person` JSON-LD (JavaScript Object Notation for Linked Data) metadata into hosted portfolio DOM headers. This enables search engine web crawlers (such as Googlebot) to parse candidate skill graphs, GitHub contribution scores, and work experience entities:
```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Alex Johnson",
  "jobTitle": "Full-Stack Software Engineer",
  "url": "https://careershala.tech/portfolio/alexjohnson",
  "sameAs": ["https://github.com/alexjohnson", "https://linkedin.com/in/alexjohnson"],
  "knowsAbout": ["Python", "FastAPI", "React 18", "MongoDB", "Cloud Architecture"]
}
```

---

## 2. FEASIBILITY STUDY

```
+---------------------------------------------------------------------------------------------------+
|                                      FEASIBILITY ANALYSIS MATRIX                                  |
+---------------------------------------------------------------------------------------------------+
|  DIMENSION          | IMPLEMENTATION STRATEGY                         | SYSTEM BENEFIT            |
+---------------------+-------------------------------------------------+---------------------------+
| TECHNICAL           | React 18 SPA + FastAPI Async ASGI Engine        | Sub-850ms latency, high   |
| FEASIBILITY         | Motor MongoDB ODM Async Connections             | concurrent throughput.    |
+---------------------+-------------------------------------------------+---------------------------+
| ECONOMIC            | Client-Side WebAssembly Vision Proctoring       | 100% reduction in server  |
| FEASIBILITY         | Cloud Native Azure App Service + MongoDB Atlas  | GPU cost; zero API waste. |
+---------------------+-------------------------------------------------+---------------------------+
| OPERATIONAL &       | GDPR-Compliant Edge Processing (No Video Save)  | High user trust; zero     |
| LEGAL FEASIBILITY   | PyDantic v2 + JWT RBAC Security Protocols       | biometric liability.      |
+---------------------------------------------------------------------------------------------------+
```

### 2.1 Technical Feasibility

The system architecture is technically viable due to modern asynchronous protocols and edge execution environments:
1. **Asynchronous Non-Blocking Backend Performance**: The backend is implemented using **FastAPI** on Python 3.10+ backed by the **Uvicorn ASGI** server. Utilizing non-blocking asynchronous event loops (`async`/`await`) paired with **Motor** (the official asynchronous driver for MongoDB Atlas), the API handles high concurrent request volumes without thread blocking during I/O operations.
2. **Client-Side Edge Computer Vision**: By executing MediaPipe FaceMesh and COCO-SSD neural networks within WebAssembly (WASM) browser containers, 30+ FPS vision processing is achieved directly on candidate client hardware. This eliminates video streaming latency and backend bottleneck risks.
3. **Firewall-Resilient Email Infrastructure**: Routing all outreach communications through HTTPS Port 443 via Brevo REST APIs guarantees 100% email delivery execution across any cloud hosting environment regardless of SMTP port restrictions.

---

### 2.2 Economic Feasibility

CareerShala is structured to maximize economic efficiency and cost scalability:
1. **Zero Cloud GPU Infrastructure Overhead**: Conventional computer vision video processing on cloud GPUs (such as AWS EC2 g4dn instances) costs thousands of dollars monthly at scale. Moving 100% of neural network inference to the user's browser reduces server hardware requirements to basic shared CPU web instances (such as Azure App Service B1/B2 tiers).
2. **Predictable Cloud Consumption**: Microsoft Azure App Services paired with MongoDB Atlas M0/M10 tiers provides an economical infrastructure footprint during initial scaling.
3. **Automated CI/CD Operational Savings**: Automated GitHub Actions pipelines execute automated unit tests, PyDantic validation checks, and seamless Azure web app deployments upon code push, eliminating manual deployment labor costs.

---

### 2.3 Operational, Security & Legal Feasibility

1. **GDPR & Privacy Compliance**: Raw webcam video feeds are never saved, recorded, or transmitted to backend servers. All facial tracking and device detection telemetry occurs ephemerally in client RAM, satisfying strict global data privacy mandates (GDPR / CCPA).
2. **Authenticity & Non-Repudiation**: ReportLab vector PDF certificate generation computes an immutable **SHA-256 cryptographic hash** embedded alongside a public verification QR code (`careershala.tech/verify/{cert_id}`), preventing certificate forgery.
3. **Role-Based Access Control (RBAC)**: Secure authentication is enforced via HTTP-Only JWT tokens paired with PyDantic v2 data validation schemas, protecting sensitive candidate profiles from unauthorized access or parameter tampering.

---

## 3. METHODOLOGY & PLANNING OF WORK

The development of CareerShala follows an **Agile Scrum Methodology** divided into structured two-week sprint cycles across a four-phase engineering roadmap.

```
+---------------------------------------------------------------------------------------------------+
|                                  AGILE SPRINT DEVELOPMENT TIMELINE                                |
+---------------------------------------------------------------------------------------------------+
|  Sprint 1-2: Core Platform Infrastructure & MongoDB Database Architecture                         |
|  [=================================================>                                           ]  |
|                                                                                                   |
|  Sprint 3-4: Dual-Engine ATS NLP Scoring & Format Parsing Audits                                  |
|  [                                                 =======================>                    ]  |
|                                                                                                   |
|  Sprint 5-6: 4-Layer Edge Vision Proctoring & WebAssembly Pipeline                                |
|  [                                                                         ==================> ]  |
|                                                                                                   |
|  Sprint 7-8: LangGraph Outreach, AI Dynamic Portfolio & Azure DevOps CI/CD Deployment             |
|  [                                                                                           ====] |
+---------------------------------------------------------------------------------------------------+
```

---

### 3.1 Step-by-Step Agile Development Stages

#### Phase 1: Requirement Analysis & Architectural Design (Sprints 1–2)
* Formalize functional/non-functional specifications.
* Establish MongoDB Atlas schema models (`users`, `resumes`, `results`, `applications`, `certificates`).
* Configure the React 18 single-page application framework with Vite 5, Tailwind CSS, and global state stores.

#### Phase 2: Core Module Development (Sprints 3–5)
* **Module 1**: Implement `pdfplumber` text extraction pipelines, Scikit-Learn TF-IDF vectorizers, and deterministic formatting audit heuristics.
* **Module 2**: Integrate client-side MediaPipe WASM and WebGL hardware acceleration loops for 3D pose, gaze vectoring, and COCO-SSD object detection.
* **Module 3**: Construct stateful LangGraph multi-agent DAG workflows connected to Groq Llama 3 70B LLM endpoints and configure Brevo REST API HTTP email outreach handlers.
* **Module 4**: Develop the AI Dynamic Portfolio engine to parse resume data structures and GitHub API statistics into responsive, hosted web templates (`careershala.tech/portfolio/{username}`) enriched with Schema.org JSON-LD metadata.

#### Phase 3: System Integration & Security Auditing (Sprint 6)
* Connect frontend components with FastAPI endpoints via asynchronous Axios/Fetch channels.
* Implement JWT token authentication, PyDantic v2 schema validators, CORS security policies, and custom rate-limiting middleware.
* Conduct ReportLab vector PDF certificate generation benchmark tests.

#### Phase 4: Automated CI/CD, Testing & Azure Deployment (Sprints 7–8)
* Construct automated GitHub Actions CI/CD workflows:
  * **Continuous Integration (CI)**: Executes Pytest test suites, code formatting checks, and security linting on pull requests.
  * **Continuous Deployment (CD)**: Builds production React static bundles and deploys the FastAPI container to **Microsoft Azure App Service** mapped to `careershala.tech`.
* Execute end-to-end user acceptance testing (UAT) and load testing across concurrent browser sessions.

---

## 4. FACILITIES REQUIRED

### 4.1 Hardware Specifications

#### Developer & Testing Workstation Requirements
* **Processor**: Intel Core i7 (11th Gen or higher) / AMD Ryzen 7 5000+ series (Minimum 8 Cores, 3.2 GHz clock speed).
* **Random Access Memory (RAM)**: 16 GB DDR4 / DDR5 RAM at 3200 MHz.
* **Storage**: 512 GB NVMe PCIe M.2 Solid State Drive (SSD) (Minimum 2500 MB/s read/write speed).
* **Peripherals**: High-definition 1080p Web Camera (30 FPS capability) and integrated microphone array for vision proctoring and voice testing.

#### Cloud Production Server Hardware (Microsoft Azure Hosting Infrastructure)
* **Compute Instance**: Microsoft Azure App Service (Linux B1/B2 Tier - 2 vCPU Cores, 3.5 GB RAM).
* **Database Infrastructure**: MongoDB Atlas M10 Managed Dedicated Cluster (Auto-scaling storage, multi-region replication).
* **Edge Client Execution**: Standard client-side desktop/laptop device equipped with a WebGL-capable GPU (Integrated Intel Iris Xe, AMD Radeon, or dedicated NVIDIA GTX/RTX).

---

### 4.2 Software & Toolchain Specifications

```
+---------------------------------------------------------------------------------------------------+
|                                 SOFTWARE & TOOLCHAIN SPECIFICATIONS                               |
+---------------------------------------------------------------------------------------------------+
| LAYER                   | TECHNOLOGY SELECTION              | PURPOSE / VERSION                   |
+-------------------------+-----------------------------------+-------------------------------------+
| Operating System        | Windows 11 Pro / Ubuntu 22.04 LTS | Core Development Environment        |
| Developer IDE           | Visual Studio Code / PyCharm      | IDE with Git & Debugger Integration |
| Runtime Environment     | Node.js v20+ / Python 3.10+       | Execution Runtimes                  |
| Frontend Framework      | React 18.2 / Vite 5 / TailwindCSS | Client-Side SPA Framework           |
| Backend API Engine      | FastAPI / Uvicorn ASGI            | Asynchronous Python REST Gateway    |
| Database Engine         | MongoDB Atlas / Motor ODM         | Async Non-Relational Data Store     |
| AI / Vision Libraries   | MediaPipe / COCO-SSD / LangGraph  | Edge Computer Vision & Multi-Agent  |
| Cloud Platform          | Microsoft Azure App Service       | Production Cloud Hosting            |
| Domain & Network        | Custom Domain (`careershala.tech`)| Production DNS & TLS Security       |
| CI/CD Pipeline          | GitHub Actions / Azure Pipelines  | Automated Build & Deployment        |
+---------------------------------------------------------------------------------------------------+
```

---

## 5. BIBLIOGRAPHY & REFERENCES

1. **Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł., & Polosukhin, I.** (2017). "Attention Is All You Need." *Advances in Neural Information Processing Systems (NeurIPS 30)*, pp. 5998–6008.
2. **Lugaresi, C., Tang, J., Nash, H., McClanahan, C., Uboweja, E., Gruenstein, M., & Grundmann, M.** (2019). "MediaPipe: A Framework for Building Perception Pipelines." *arXiv preprint arXiv:1906.08172*.
3. **Salton, G., & Buckley, C.** (1988). "Term-weighting approaches in automatic text retrieval." *Information Processing & Management*, 24(5), pp. 513–523.
4. **Ramakrishnan, S., et al.** (2020). "Asynchronous Server Gateway Interface (ASGI) Specification & Modern Python Web Architectures." *Python Software Foundation Technical Docs*.
5. **Chace, A., et al.** (2024). "LangGraph: Building Stateful, Multi-Actor Applications with Language Models." *LangChain Engineering Technical Papers*, URL: `https://python.langchain.com/docs/langgraph`.
