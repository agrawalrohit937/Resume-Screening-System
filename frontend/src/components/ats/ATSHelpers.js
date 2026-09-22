/**
 * ATSHelpers.js — Shared constants, file text extraction utilities, and formatters for ATS Matcher.
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import mammoth from 'mammoth/mammoth.browser'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

// ── Preset Role Templates for 1-Click Instant Testing ────────────────────────
export const PRESET_ROLES = [
  {
    title: 'Full Stack Engineer',
    icon: '💻',
    color: 'from-blue-500/10 to-indigo-500/10 border-blue-200 text-blue-700',
    skills: 'React, Node.js, TypeScript, PostgreSQL, Docker, REST APIs, Git',
    description: `We are looking for a passionate Full Stack Engineer to design and build scalable web applications.
Responsibilities:
- Build responsive, accessible frontend features using React, TypeScript, and modern CSS.
- Develop robust backend microservices with Node.js and PostgreSQL.
- Containerize and deploy applications using Docker and CI/CD pipelines.
Requirements:
- Strong proficiency in React, TypeScript, Node.js, and SQL databases.
- Familiarity with Git, RESTful API design, and containerization with Docker.
- Degree in Computer Science, IT, or equivalent hands-on project experience.`,
  },
  {
    title: 'Frontend React Dev',
    icon: '🎨',
    color: 'from-cyan-500/10 to-blue-500/10 border-cyan-200 text-cyan-700',
    skills: 'React, TypeScript, Next.js, Tailwind CSS, Redux, HTML5, CSS3',
    description: `Seeking a creative Frontend Developer to craft responsive, ultra-fast user experiences.
Responsibilities:
- Develop modern web components using React, Next.js, and Tailwind CSS.
- Optimize frontend web vitals, accessibility (a11y), and client state management.
Requirements:
- Proficiency in React, TypeScript, Next.js, and modern CSS frameworks.
- Experience with responsive layout design, mobile optimization, and state management.
- Portfolio or GitHub projects demonstrating high-quality web applications.`,
  },
  {
    title: 'Python / AI Backend',
    icon: '⚡',
    color: 'from-emerald-500/10 to-teal-500/10 border-emerald-200 text-emerald-700',
    skills: 'Python, FastAPI, Docker, PostgreSQL, Redis, LangChain, PyTorch',
    description: `Join our AI team as a Python Backend Engineer building high-throughput machine learning services.
Responsibilities:
- Build high-performance REST and asynchronous APIs with FastAPI and Python.
- Integrate vector databases and large language model workflows (RAG).
Requirements:
- Deep familiarity with Python, FastAPI, Docker, and PostgreSQL.
- Hands-on exposure to Redis caching and AI/ML libraries like PyTorch or LangChain.
- Bachelor's in CS or demonstrative capstone projects in AI/ML systems.`,
  },
  {
    title: 'Data Analyst',
    icon: '📊',
    color: 'from-violet-500/10 to-purple-500/10 border-violet-200 text-violet-700',
    skills: 'SQL, Python, Pandas, Tableau, Power BI, Excel, Data Visualization',
    description: `Looking for a Data Analyst to transform raw business metrics into actionable visual intelligence.
Responsibilities:
- Write complex SQL queries and build automated business analytics dashboards.
- Perform exploratory data analysis using Python, Pandas, and visualization tools.
Requirements:
- Strong command of SQL, Python (Pandas/NumPy), Tableau or Power BI.
- Solid understanding of statistical concepts, KPI tracking, and data modeling.`,
  },
  {
    title: 'DevOps & Cloud',
    icon: '☁️',
    color: 'from-sky-500/10 to-blue-500/10 border-sky-200 text-sky-700',
    skills: 'Docker, Kubernetes, AWS, CI/CD, Terraform, Linux, Git, Prometheus',
    description: `Seeking a DevOps & Cloud Engineer to build and maintain our high-availability cloud infrastructure.
Responsibilities:
- Manage multi-region AWS cloud infrastructure using Terraform and Infrastructure as Code.
- Orchestrate containerized workloads on Kubernetes (EKS) and optimize CI/CD pipelines.
Requirements:
- Strong proficiency with Docker, Kubernetes, AWS services, and Linux systems.
- Experience with GitHub Actions CI/CD pipelines and infrastructure monitoring.`,
  },
]

// ── Text Extraction Helpers ──────────────────────────────────────────────────
export async function extractPdfText(file) {
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const pageTexts = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items
      .map(item => (item.str || '').trim())
      .filter(Boolean)
      .join(' ')

    if (text) pageTexts.push(text)
  }

  const combined = pageTexts.join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!combined) {
    throw new Error('No text could be extracted from the PDF.')
  }
  return combined
}

export async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  const text = (result.value || '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!text) {
    throw new Error('No text could be extracted from the DOCX file.')
  }
  return text
}

export async function extractJobDescriptionText(file) {
  if (!file) return ''
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return extractPdfText(file)
  }
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx')
  ) {
    return extractDocxText(file)
  }
  if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
    return file.text()
  }
  throw new Error('Unsupported JD file type. Please use PDF, DOCX, or TXT.')
}

export function dedupeCaseInsensitive(items) {
  const seen = new Set()
  const out = []
  for (const raw of items || []) {
    const item = (raw || '').trim()
    const key = item.toLowerCase()
    if (item && !seen.has(key)) {
      seen.add(key)
      out.push(item)
    }
  }
  return out
}

export const formatApiError = (err) => {
  const data = err?.response?.data
  if (!data) return err?.message || 'Request failed'
  if (Array.isArray(data.detail)) {
    return data.detail.map(e => `${e.loc?.join('.') || 'Field'}: ${e.msg}`).join(' | ')
  }
  if (typeof data.detail === 'object' && data.detail !== null) {
    return data.detail.msg || JSON.stringify(data.detail)
  }
  if (typeof data.detail === 'string') return data.detail
  return JSON.stringify(data)
}
