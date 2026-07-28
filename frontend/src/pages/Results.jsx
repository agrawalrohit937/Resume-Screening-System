/**
 * Results.jsx — Unified ATS + AI Enhancer workflow
 * Modernized layout with responsive fluid cards and smooth Framer Motion transitions.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import mammoth from 'mammoth/mammoth.browser'
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react'

import api, { uploadResume, getResumes, matchATS, enhanceResume, generatePDF, setPrimaryResume } from '../services/api'
import ScoreRing from '../components/ScoreRing'
import { AnimatedBar } from '../components/AnimatedNumber'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

// ── Tutorial links for skill gaps ─────────────────────────────────────────────
const TUTORIAL_MAP = {
  kubernetes: [{ title: 'Kubernetes Official Docs', url: 'https://kubernetes.io/docs/tutorials/' }, { title: 'KodeKloud K8s Course (Free)', url: 'https://kodekloud.com/courses/kubernetes-for-the-absolute-beginners-hands-on/' }],
  terraform: [{ title: 'HashiCorp Learn Terraform', url: 'https://developer.hashicorp.com/terraform/tutorials' }, { title: 'Terraform on AWS – Free', url: 'https://www.youtube.com/watch?v=SLB_c_ayRMo' }],
  docker: [{ title: 'Docker Official Getting Started', url: 'https://docs.docker.com/get-started/' }, { title: 'Docker for Beginners – freeCodeCamp', url: 'https://www.youtube.com/watch?v=fqMOX6JJhGo' }],
  python: [{ title: 'Python Official Tutorial', url: 'https://docs.python.org/3/tutorial/' }, { title: 'Python Full Course – freeCodeCamp', url: 'https://www.youtube.com/watch?v=rfscVS0vtbw' }],
  aws: [{ title: 'AWS Free Training', url: 'https://aws.amazon.com/training/digital/' }, { title: 'AWS Cloud Practitioner Free', url: 'https://www.youtube.com/watch?v=SOTamWNgDKc' }],
  react: [{ title: 'React Official Docs', url: 'https://react.dev/learn' }, { title: 'React Full Course – freeCodeCamp', url: 'https://www.youtube.com/watch?v=bMknfKXIFA8' }],
  graphql: [{ title: 'GraphQL Official Tutorial', url: 'https://graphql.org/learn/' }, { title: 'GraphQL Crash Course', url: 'https://www.youtube.com/watch?v=ed8SzALpx1Q' }],
  rust: [{ title: 'The Rust Book (Free)', url: 'https://doc.rust-lang.org/book/' }, { title: 'Rust Crash Course', url: 'https://www.youtube.com/watch?v=zF34dRivLOw' }],
  kafka: [{ title: 'Apache Kafka Docs', url: 'https://kafka.apache.org/documentation/' }, { title: 'Kafka Basics – Confluent', url: 'https://developer.confluent.io/courses/apache-kafka/events/' }],
  postgresql: [{ title: 'PostgreSQL Tutorial', url: 'https://www.postgresqltutorial.com/' }, { title: 'SQL Full Course – freeCodeCamp', url: 'https://www.youtube.com/watch?v=qw--VYLpxG4' }],
  mongodb: [{ title: 'MongoDB University (Free)', url: 'https://learn.mongodb.com/' }, { title: 'MongoDB Crash Course', url: 'https://www.youtube.com/watch?v=ofme2o29ngU' }],
  typescript: [{ title: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/handbook/intro.html' }, { title: 'TypeScript Full Course', url: 'https://www.youtube.com/watch?v=30LWjhZzg50' }],
  'ci/cd': [{ title: 'GitHub Actions Docs', url: 'https://docs.github.com/en/actions' }, { title: 'CI/CD Explained', url: 'https://www.youtube.com/watch?v=scEDHsr3APg' }],
  microservices: [{ title: 'Microservices Pattern Book', url: 'https://microservices.io/patterns/index.html' }, { title: 'Microservices Full Course', url: 'https://www.youtube.com/watch?v=lTAcCNbJ7KE' }],
}

function getTutorials(skill) {
  const key = skill.toLowerCase()
  return TUTORIAL_MAP[key] || [
    { title: `Search "${skill}" on freeCodeCamp`, url: `https://www.freecodecamp.org/news/search/?query=${encodeURIComponent(skill)}` },
    { title: `"${skill}" on YouTube`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(skill + ' tutorial')}` },
  ]
}

// ── Score Helpers ─────────────────────────────────────────────────────────
function scoreColor(pct) {
  if (pct >= 80) return '#10B981'
  if (pct >= 60) return '#6366F1'
  if (pct >= 40) return '#F59E0B'
  return '#F43F5E'
}

async function extractPdfText(file) {
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

    if (text) {
      pageTexts.push(text)
    }
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

async function extractDocxText(file) {
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

async function extractJobDescriptionText(file) {
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

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function Chip({ word, matched }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
      borderRadius: 12, fontSize: 13, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
      margin: 4, border: '1px solid', transition: 'all 0.2s',
      ...(matched
        ? { background: '#ECFDF5', borderColor: '#A7F3D0', color: '#065F46', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.05)' }
        : { background: '#FFF1F2', borderColor: '#FECDD3', color: '#9F1239', textDecoration: 'line-through', opacity: 0.8 }
      ),
    }}>
      {matched ? '✓' : '✕'} {word}
    </span>
  )
}

function KeywordsTab({ result }) {
  const matched = result?.matched_skills || []
  const missing = dedupeCaseInsensitive([
    ...(result?.missing_skills || []),
    ...(result?.strict_missing_keywords || [])
  ]).filter(skill => !matched.map(s => s.toLowerCase()).includes(skill.toLowerCase()))
  const total = matched.length + missing.length
  const rate = total > 0 ? Math.round((matched.length / total) * 100) : 0

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Match rate bar */}
      <div style={{ padding: '24px', borderRadius: 20, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
          <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 600, color: '#475569' }}>Skill Match Rate</span>
          <span style={{ fontFamily: "'Poppins',sans-serif", fontSize: 22, fontWeight: 800, color: scoreColor(rate) }}>{rate}%</span>
        </div>
        <AnimatedBar value={rate} color={scoreColor(rate)} height={12} />
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#64748B', marginTop: 12 }}>
          <strong>{matched.length}</strong> core skills matched out of <strong>{total}</strong> required/preferred skills.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        {matched.length > 0 && (
          <div style={{ flex: '1 1 300px', padding: '20px', borderRadius: 20, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: '#15803D', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ✓ Found in Your Resume ({matched.length})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', margin: '-4px' }}>
              {matched.slice(0, 30).map(k => <Chip key={k} word={k} matched />)}
            </div>
          </div>
        )}

        {missing.length > 0 && (
          <div style={{ flex: '1 1 300px', padding: '20px', borderRadius: 20, background: '#FFF1F2', border: '1px solid #FECDD3' }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: '#9F1239', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ✕ Missing from Your Resume ({missing.length})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', margin: '-4px' }}>
              {missing.slice(0, 30).map(k => <Chip key={k} word={k} matched={false} />)}
            </div>
            <div style={{ marginTop: 16, padding: '12px', background: '#FFE4E6', borderRadius: 12 }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#881337', fontWeight: 500 }}>
                💡 Tip: Let the AI Enhancer weave these missing skills naturally into your experience.
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function SkillsTab({ result }) {
  const matched = result?.matched_skills || []
  const missing = result?.missing_skills || []
  // const gaps    = result?.skill_gaps || []
  const gaps = missing.map((skill, index) => ({
    skill: skill,
    importance: index < 3 ? 'critical' : 'important', // First 3 missing skills marked as critical
    estimated_learning_weeks: 4 // Default generic timeline
  }))

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Engine label banner */}
      <div style={{ padding: '16px 20px', borderRadius: 16, background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 24 }}>🧠</span>
        <div>
          <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 14, color: '#1E40AF', margin: 0 }}>AI Semantic Match Engine</p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#3B82F6', margin: '4px 0 0', lineHeight: 1.5 }}>
            This tab uses AI to understand context and synonyms — it's the "smart" match. 
            The <strong>Strict ATS Check</strong> tab (next tab) shows literal keyword counts that may differ from these numbers.
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ flex: '1 1 250px', padding: '20px', borderRadius: 20, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: '#15803D', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ✓ AI-Confirmed Skills ({matched.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {matched.slice(0, 12).map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: '#15803D', fontWeight: 800 }}>✓</span>
                </div>
                <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: '#166534', fontWeight: 500, textTransform: 'capitalize' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

<div style={{ flex: '1 1 250px', padding: '20px', borderRadius: 20, background: '#FFF1F2', border: '1px solid #FECDD3' }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: '#9F1239', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ○ AI-Identified Gaps ({missing.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {missing.slice(0, 12).map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#FFE4E6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: '#9F1239', fontWeight: 800 }}>✕</span>
                </div>
                <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: '#9F1239', fontWeight: 500, textTransform: 'capitalize' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {gaps.length > 0 && (
        <div style={{ background: '#F8FAFC', borderRadius: 20, padding: 24, border: '1px solid #E2E8F0' }}>
          <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>
            Detailed Gap Analysis
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
            {gaps.slice(0, 9).map((g, i) => {
              const impCfg = {
                critical: { bg: '#FFF1F2', border: '#FECDD3', text: '#9F1239', badge: 'Critical' },
                important: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', badge: 'Important' },
                nice_to_have: { bg: '#F1F5F9', border: '#CBD5E1', text: '#475569', badge: 'Nice to have' },
              }[g.importance] || { bg: '#F1F5F9', border: '#CBD5E1', text: '#475569', badge: 'Optional' }
              return (
                <div key={i} style={{ padding: '16px', borderRadius: 16, background: impCfg.bg, border: `1px solid ${impCfg.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 600, fontSize: 14, color: '#0F172A', textTransform: 'capitalize' }}>{g.skill}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 20, background: `${impCfg.text}15`, color: impCfg.text, fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap', marginLeft: 8 }}>
                      {impCfg.badge}
                    </span>
                  </div>
                  {g.estimated_learning_weeks && (
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      ~{g.estimated_learning_weeks}w to learn
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function RoadmapTab({ result }) {
  const suggestions = result?.feedback_suggestions || []
  const missing = result?.missing_skills || []
  const gaps = result?.skill_gaps || []

  // Generate dynamic strengths based on AI scores
  const strengths = []
  if ((result?.experience_score || 0) >= 0.7) strengths.push("Strong experience alignment with JD")
  if ((result?.education_score || 0) >= 0.7) strengths.push("Education meets or exceeds requirements")
  if (missing.length <= 2) strengths.push("Excellent core skill coverage")

  // Generate dynamic weaknesses
  const weaknesses = []
  if ((result?.experience_score || 0) < 0.5) weaknesses.push("Experience duration/relevance falls short")
  if (missing.length > 5) weaknesses.push("Missing several critical technical skills")

  const skillsToLearn = [
    ...gaps.map(g => g.skill),
    ...missing.slice(0, 6),
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 8)

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ flex: '1 1 250px', padding: '20px', borderRadius: 20, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: '#15803D', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            💪 Your Strengths
          </p>
          {strengths.slice(0, 4).map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, fontFamily: "'Inter',sans-serif", fontSize: 14, color: '#166534', alignItems: 'flex-start', lineHeight: 1.5 }}>
              <span style={{ color: '#10B981', flexShrink: 0, fontWeight: 800 }}>✓</span>{s}
            </div>
          ))}
          {strengths.length === 0 && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: '#64748B' }}>Run analysis to see strengths</p>}
        </div>

        <div style={{ flex: '1 1 250px', padding: '20px', borderRadius: 20, background: '#FFF1F2', border: '1px solid #FECDD3' }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: '#9F1239', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🎯 Areas to Improve
          </p>
          {weaknesses.slice(0, 4).map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, fontFamily: "'Inter',sans-serif", fontSize: 14, color: '#9F1239', alignItems: 'flex-start', lineHeight: 1.5 }}>
              <span style={{ flexShrink: 0, fontWeight: 800 }}>→</span>{w}
            </div>
          ))}
          {weaknesses.length === 0 && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: '#64748B' }}>Run analysis to see areas</p>}
        </div>
      </div>

      {suggestions.length > 0 && (
        <div>
          <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>
            📋 Improvement Action Plan
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {suggestions.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                style={{ display: 'flex', gap: 16, padding: '16px 20px', background: '#F8FAFC', borderRadius: 16, border: '1px solid #E2E8F0' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#3B82F6' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: '#334155', lineHeight: 1.6, flex: 1 }}>{s}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {skillsToLearn.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 16 }}>🎓</span>
            </div>
            <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
              Curated Learning Resources
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
            {skillsToLearn.map((skill) => {
              const tutorials = getTutorials(skill)
              return (
                <div key={skill} style={{ padding: '16px', borderRadius: 16, background: 'white', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366F1', display: 'inline-block' }} />
                    <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 15, fontWeight: 700, color: '#0F172A', textTransform: 'capitalize' }}>{skill}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tutorials.map((t, ti) => (
                      <a key={ti} href={t.url} target="_blank" rel="noopener noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12,
                          background: '#F8FAFC', border: '1px solid #F1F5F9', textDecoration: 'none',
                          transition: 'all 0.2s', cursor: 'pointer'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.borderColor = '#BFDBFE'; e.currentTarget.style.transform = 'translateX(4px)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#F1F5F9'; e.currentTarget.style.transform = 'translateX(0)' }}>
                        <span style={{ fontSize: 15, flexShrink: 0 }}>{ti === 0 ? '📖' : '▶'}</span>
                        <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, color: '#4338CA', flex: 1 }}>
                          {t.title}
                        </span>
                        <svg width="14" height="14" fill="none" stroke="#94A3B8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                      </a>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function ScoreHero({ result }) {
  // [BUG-001] final_score is on a 0-100 scale from the backend — pass directly to ScoreRing.
  // experience_score and education_score are 0-1 sub-scores → multiply by 100 for display.
  const final = Math.round(result?.final_score || 0)
  const expScore = Math.round((result?.experience_score || 0) * 100)
  const eduScore = Math.round((result?.education_score || 0) * 100)

  const matchedCount = result?.matched_skills?.length || 0
  const missingCount = result?.missing_skills?.length || 0
  const totalSkills = matchedCount + missingCount
  const skillRate = totalSkills > 0 ? Math.round((matchedCount / totalSkills) * 100) : 0

  const rec = result?.recommendation || 'Low Match'

  const cfg = {
    'Strong Match': { label: 'Strong Match ✅', bg: '#ECFDF5', border: '#34D399', text: '#065F46', accent: '#059669' },
    'Good Match': { label: 'Good Match 👍', bg: '#EFF6FF', border: '#60A5FA', text: '#1E40AF', accent: '#2563EB' },
    'Partial Match': { label: 'Partial Match 🔶', bg: '#FFFBEB', border: '#FBBF24', text: '#92400E', accent: '#D97706' },
    'Low Match': { label: 'Low Match ❌', bg: '#FFF1F2', border: '#FB7185', text: '#881337', accent: '#E11D48' },
  }[rec] || { label: 'Analyzed', bg: '#F8FAFC', border: '#CBD5E1', text: '#334155', accent: '#475569' }

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      style={{
        padding: '32px', borderRadius: 24, background: cfg.bg, border: `1px solid ${cfg.border}`,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 32, position: 'relative', overflow: 'hidden',
        boxShadow: `0 10px 30px -10px ${cfg.accent}30`, flex: '1 1 460px'
      }}>

      <div style={{
        position: 'absolute', right: '-5%', top: '-20%', width: 300, height: 300, borderRadius: '50%',
        background: `${cfg.accent}`, opacity: 0.04, filter: 'blur(40px)', pointerEvents: 'none'
      }} />

      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', width: '100%', maxWidth: '160px', margin: '0 auto' }}>
        <ScoreRing score={final} size={150} label="AI Potential" />
      </div>

      <div style={{ flex: 1, minWidth: 260 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 30, marginBottom: 12,
          background: 'white', border: `1px solid ${cfg.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 14, color: cfg.accent
        }}>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", opacity: 0.7, letterSpacing: '0.04em' }}>AI</span>
          {cfg.label}
        </span>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, color: '#334155', lineHeight: 1.6, marginBottom: 20 }}>
          {result?.feedback_suggestions?.[0] || 'Analysis complete based on semantic AI matching.'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12 }}>
          {[
            { l: 'Experience', v: expScore, c: '#3B82F6', tooltip: 'Years & Relevance Match' },
            { l: 'Education', v: eduScore, c: '#10B981', tooltip: 'Degree Requirement Match' },
            { l: 'Skills', v: skillRate, c: '#F59E0B', tooltip: 'Semantic Skill Match Rate' },
          ].map(({ l, v, c, tooltip }) => (
            <div key={l} title={tooltip} style={{
              padding: '12px', borderRadius: 16, background: 'white',
              border: '1px solid rgba(0,0,0,0.05)', textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              transition: 'transform 0.2s', cursor: 'help'
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <p style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#64748B', marginBottom: 4,
                textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>{l}</p>
              <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 800, fontSize: 22, color: c }}>{v}%</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ── Strict / Corporate ATS card — deliberately "stamped document" styling
// (dashed border, monospace, rotated corner stamp) to read as bureaucratic
// and literal in contrast to the AI card's soft rounded gradient look.
function StrictScoreCard({ result }) {
  const matched = result?.strict_matched_keywords || []
  const missing = result?.strict_missing_keywords || []
  const total = matched.length + missing.length
  const strictScore = total > 0 ? Math.round((matched.length / total) * 100) : Math.round(result?.strict_ats_score ?? 0)
  const isKnockout = !!result?.is_knockout

  const cfg = isKnockout
    ? { label: 'REJECTED', bg: '#FFF1F2', border: '#FB7185', text: '#881337', accent: '#E11D48', stamp: '#E11D48' }
    : strictScore >= 70
      ? { label: 'PASSED', bg: '#F8FAFC', border: '#334155', text: '#0F172A', accent: '#0F172A', stamp: '#15803D' }
      : { label: 'AT RISK', bg: '#FFFBEB', border: '#D97706', text: '#78350F', accent: '#B45309', stamp: '#B45309' }

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      style={{
        padding: '32px', borderRadius: 24, background: cfg.bg, border: `1.5px dashed ${cfg.border}`,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 32, position: 'relative', overflow: 'hidden',
        flex: '1 1 460px'
      }}>

      {/* Rotated corner stamp — the "signature element" for the strict engine */}
      <div style={{
        position: 'absolute', top: 18, right: -34, transform: 'rotate(38deg)',
        padding: '4px 40px', background: cfg.stamp, color: 'white',
        fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
      }}>
        {cfg.label}
      </div>

      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', width: '100%', maxWidth: '160px', margin: '0 auto' }}>
        <ScoreRing score={strictScore} size={150} label="Strict Match" />
      </div>

      <div style={{ flex: 1, minWidth: 260 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 4, marginBottom: 12,
          background: 'white', border: `1px solid ${cfg.border}`,
          fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 13, color: cfg.text
        }}>
          ⚙ STRICT CORPORATE ATS
        </span>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, color: '#334155', lineHeight: 1.6, marginBottom: 20 }}>
          {isKnockout
            ? 'A literal keyword bot would reject this resume before a human ever sees it. See reasons below.'
            : 'This simulates a literal, no-AI keyword scanner — the same blunt check many real corporate ATS tools run.'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12 }}>
          <div style={{ padding: '12px', borderRadius: 8, background: 'white', border: '1px solid rgba(0,0,0,0.08)', textAlign: 'center' }}>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#64748B', marginBottom: 4, textTransform: 'uppercase' }}>Exact Matched</p>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: 22, color: '#15803D' }}>{matched.length}</p>
          </div>
          <div style={{ padding: '12px', borderRadius: 8, background: 'white', border: '1px solid rgba(0,0,0,0.08)', textAlign: 'center' }}>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#64748B', marginBottom: 4, textTransform: 'uppercase' }}>Exact Missing</p>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: 22, color: '#9F1239' }}>{missing.length}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Parsing-health warning banner — shown above the dashboard when the
// extractor likely mangled the resume (e.g. multi-column template).
function ParsingHealthBanner({ result }) {
  const warnings = result?.parsing_warnings || []
  if (!warnings.length) return null

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      style={{ padding: '18px 22px', borderRadius: 16, background: '#FFFBEB', border: '1px solid #FDE68A', display: 'flex', gap: 14 }}>
      <div style={{ fontSize: 20, flexShrink: 0 }}>📄⚠️</div>
      <div>
        <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 14, color: '#92400E', marginBottom: 6 }}>
          Resume Parsing Quality Warning
        </p>
        {warnings.map((w, i) => (
          <p key={i} style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#78350F', lineHeight: 1.5, marginBottom: 4 }}>{w}</p>
        ))}
      </div>
    </motion.div>
  )
}

// ── Knockout alert modal — the "reality check" popup ──────────────────────
function KnockoutAlert({ result, onDismiss, onEnhance }) {
  const reasons = result?.knockout_reasons || []
  const advisories = result?.knockout_advisories || []

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,10,10,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ background: 'white', borderRadius: 20, maxWidth: 460, width: '100%', border: '1.5px dashed #FB7185', overflow: 'hidden' }}>
        <div style={{ background: '#FFF1F2', padding: '22px 28px', borderBottom: '1px solid #FECDD3' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <h3 style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 800, fontSize: 18, color: '#881337', margin: 0 }}>
              Rejected by Corporate ATS
            </h3>
          </div>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#9F1239', marginTop: 8, lineHeight: 1.5 }}>
            A strict, literal keyword-and-rules bot — the kind many companies still run before a human ever opens your resume — would screen this out for the following reason(s):
          </p>
        </div>
        <div style={{ padding: '20px 28px' }}>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reasons.map((r, i) => (
              <li key={i} style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: '#334155', lineHeight: 1.5 }}>{r}</li>
            ))}
          </ul>

          {advisories.length > 0 && (
            <div style={{ marginTop: 16, padding: '12px 14px', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
              {advisories.map((a, i) => (
                <p key={i} style={{ fontFamily: "'Inter',sans-serif", fontSize: 12.5, color: '#64748B', marginBottom: i === advisories.length - 1 ? 0 : 6, lineHeight: 1.5 }}>ℹ️ {a}</p>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button onClick={onDismiss}
              style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #E2E8F0', background: 'white', color: '#334155', fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              I understand
            </button>
            <button onClick={onEnhance}
              style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#D97706', color: 'white', fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              ✨ Try to Fix with AI
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Strict keyword tab — the exact-match, no-mercy view ───────────────────
function StrictTab({ result }) {
  const matched = result?.strict_matched_keywords || []
  const missing = result?.strict_missing_keywords || []
  const total = matched.length + missing.length
  const score = total > 0 ? Math.round((matched.length / total) * 100) : Math.round(result?.strict_ats_score ?? 0)
  const isKnockout = !!result?.is_knockout
  const reasons = result?.knockout_reasons || []
  const advisories = result?.knockout_advisories || []

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ padding: '24px', borderRadius: 20, background: '#F8FAFC', border: '1px dashed #CBD5E1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 600, color: '#475569' }}>Exact Keyword Match Rate</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, color: scoreColor(score) }}>{score}%</span>
        </div>
        <AnimatedBar value={score} color={scoreColor(score)} height={12} />
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#64748B', marginTop: 12 }}>
          <strong>{matched.length}</strong> of <strong>{total}</strong> JD keywords found as a literal substring in your resume text — no synonyms, no AI judgment.
        </p>
      </div>

      {(reasons.length > 0 || advisories.length > 0) && (
        <div style={{ padding: '18px 22px', borderRadius: 16, background: isKnockout ? '#FFF1F2' : '#F8FAFC', border: `1px solid ${isKnockout ? '#FECDD3' : '#E2E8F0'}` }}>
          <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 13, color: isKnockout ? '#9F1239' : '#334155', marginBottom: 8 }}>
            {isKnockout ? '⚠️ Knockout Reasons' : 'ℹ️ Advisory Notes'}
          </p>
          {[...reasons, ...advisories].map((r, i) => (
            <p key={i} style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#475569', marginBottom: 4, lineHeight: 1.5 }}>{r}</p>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        {matched.length > 0 && (
          <div style={{ flex: '1 1 300px', padding: '20px', borderRadius: 20, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#15803D', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ✓ Literal Matches ({matched.length})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', margin: '-4px' }}>
              {matched.slice(0, 30).map(k => <Chip key={k} word={k} matched />)}
            </div>
          </div>
        )}

        {missing.length > 0 && (
          <div style={{ flex: '1 1 300px', padding: '20px', borderRadius: 20, background: '#FFF1F2', border: '1px solid #FECDD3' }}>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#9F1239', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ✕ Literal Misses ({missing.length})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', margin: '-4px' }}>
              {missing.slice(0, 30).map(k => <Chip key={k} word={k} matched={false} />)}
            </div>
            <div style={{ marginTop: 16, padding: '12px', background: '#FFE4E6', borderRadius: 12 }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#881337', fontWeight: 500 }}>
                💡 These are the exact phrases a literal keyword scanner is looking for. The AI Enhancer prioritizes weaving these in verbatim wherever it's truthful to do so.
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Invalid Document Guard — the "fake resume" empty state ────────────────
// Shown instead of the dashboard when the backend's signal is too thin to
// be a real resume (a receipt, ID scan, random PDF, etc). Deliberately a
// full replacement for the dashboard, not a toast — there's nothing useful
// to show underneath it, so pretending otherwise just confuses people.
function InvalidDocumentError({ confidence, warnings = [], onReset }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
      style={{
        borderRadius: 28, background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF5F5 100%)',
        border: '1.5px solid #FECDD3', padding: '56px 40px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        boxShadow: '0 20px 50px -20px rgba(225,29,72,0.15)', maxWidth: 640, margin: '0 auto',
      }}>

      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, rotate: [0, -8, 8, -6, 0] }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          width: 84, height: 84, borderRadius: '50%', background: '#FFF1F2',
          border: '2px solid #FECDD3', display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 8,
        }}>
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 13.5l5 5m0-5l-5 5" stroke="#E11D48" />
        </svg>
      </motion.div>

      <h2 style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 800, fontSize: 24, color: '#881337', margin: 0 }}>
        Oops! That doesn't look like a Resume
      </h2>

      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, color: '#9F1239', lineHeight: 1.6, maxWidth: 440, margin: '4px 0 0' }}>
        We couldn't find the standard sections a resume should have — things like Experience,
        Education, or Skills. This file might be a receipt, ID scan, or another document type
        that got uploaded by mistake.
      </p>

      {(warnings.length > 0 || typeof confidence === 'number') && (
        <div style={{
          marginTop: 12, padding: '14px 18px', borderRadius: 14, background: 'white',
          border: '1px solid #FECDD3', textAlign: 'left', maxWidth: 440, width: '100%',
        }}>
          {typeof confidence === 'number' && (
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#9F1239', margin: 0, marginBottom: warnings.length ? 8 : 0 }}>
              Parsing confidence: {Math.round(confidence * 100)}%
            </p>
          )}
          {warnings.slice(0, 2).map((w, i) => (
            <p key={i} style={{ fontFamily: "'Inter',sans-serif", fontSize: 12.5, color: '#64748B', margin: 0, marginTop: i === 0 ? 0 : 4, lineHeight: 1.5 }}>
              • {w}
            </p>
          ))}
        </div>
      )}

      <motion.button
        onClick={onReset}
        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
        style={{
          marginTop: 24, padding: '14px 32px', borderRadius: 16, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #E11D48, #F43F5E)', color: 'white',
          fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 15,
          boxShadow: '0 10px 25px -8px rgba(225,29,72,0.5)',
        }}>
        🔄 Upload a Real Resume
      </motion.button>
    </motion.div>
  )
}

// ── HITL Enhancement Wizard ─────────────────────────────────────────────────
// A short, dynamic questionnaire shown before enhancement runs. Only asks
// about what's actually missing (a resume with every link already present
// and no skill gaps skips straight to the 2 generic metric questions).
// Everything collected here is passed to the backend as `user_verified` and
// treated by the LLM as human-confirmed ground truth — never invented.

const METRIC_QUESTIONS = [
  "Did you improve efficiency, speed, or performance anywhere? If so, by roughly what percentage or number?",
  "Did you grow a user base, team, dataset, revenue, or scope of ownership? By roughly what number?",
]

function dedupeCaseInsensitive(items) {
  const seen = new Set()
  const out = []
  for (const raw of items || []) {
    const item = (raw || '').trim()
    const key = item.toLowerCase()
    if (item && !seen.has(key)) { seen.add(key); out.push(item) }
  }
  return out
}

function SelectableSkillChip({ skill, selected, onToggle }) {
  return (
    <button type="button" onClick={onToggle} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px',
      borderRadius: 12, fontSize: 13, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
      margin: 4, border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s',
      ...(selected
        ? { background: '#EEF2FF', borderColor: '#818CF8', color: '#3730A3' }
        : { background: 'white', borderColor: '#E2E8F0', color: '#64748B' })
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${selected ? '#4F46E5' : '#CBD5E1'}`,
        background: selected ? '#4F46E5' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        {selected && <span style={{ color: 'white', fontSize: 10, fontWeight: 800 }}>✓</span>}
      </span>
      {skill}
    </button>
  )
}

const wizardInputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0',
  fontFamily: "'Inter',sans-serif", fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#0F172A',
}

const wizardLabelStyle = {
  fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block',
}

function EnhancementWizard({ result, onClose, onSubmit, onSkip }) {
  const contact = result?.contact_snapshot || {}
  const missingLinks = ['linkedin', 'github', 'portfolio'].filter(k => !contact[k])

  // Combine literal missing keywords from strict scanner AND general missing skills
  const rawMissing = [
    ...(result?.strict_missing_keywords || []),
    ...(result?.missing_skills || [])
  ]

  // Filter out ONLY terms that were literally matched verbatim in the raw resume text
  const strictMatchedSet = new Set(
    (result?.strict_matched_keywords || []).map(s => (s || '').toLowerCase().trim())
  )

  const skillOptions = dedupeCaseInsensitive(rawMissing)
    .filter(skill => !strictMatchedSet.has((skill || '').toLowerCase().trim()))
    .slice(0, 15)

  const groups = []
  if (missingLinks.length > 0) groups.push('identity')
  if (skillOptions.length > 0) groups.push('skills')
  groups.push('metrics')

  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [links, setLinks] = useState({ linkedin: '', github: '', portfolio: '' })
  const [selectedSkills, setSelectedSkills] = useState([])
  const [metrics, setMetrics] = useState({ m0: '', m1: '' })

  const goNext = () => { setDirection(1); setStep(s => Math.min(s + 1, groups.length - 1)) }
  const goBack = () => { setDirection(-1); setStep(s => Math.max(s - 1, 0)) }

  const toggleSkill = (skill) => {
    setSelectedSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill])
  }

  const handleFinish = () => {
    const hasAnyLink = !!(links.linkedin.trim() || links.github.trim() || links.portfolio.trim())
    const linkPayload = missingLinks.length > 0 && hasAnyLink
      ? {
        linkedin: links.linkedin.trim() || undefined,
        github: links.github.trim() || undefined,
        portfolio: links.portfolio.trim() || undefined,
      }
      : undefined

    const impactMetrics = METRIC_QUESTIONS
      .map((q, i) => ({ question: q, answer: (metrics[`m${i}`] || '').trim() }))
      .filter(m => m.answer)

    onSubmit({
      links: linkPayload,
      verified_skills: selectedSkills,
      impact_metrics: impactMetrics,
    })
  }

  const isLastStep = step === groups.length - 1
  const currentGroup = groups[step]

  const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
      <motion.div initial={{ scale: 0.94, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        style={{ background: 'white', borderRadius: 24, maxWidth: 520, width: '100%', overflow: 'hidden', boxShadow: '0 30px 60px -15px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ padding: '24px 28px 20px', background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)', color: 'white', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>✕</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 20 }}>🧠</span>
            <h3 style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 800, fontSize: 18, margin: 0 }}>Quick Verification</h3>
          </div>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#C7D2FE', margin: 0, lineHeight: 1.5 }}>
            A few quick questions so the AI can enhance your resume with real, verified details — never invented ones.
          </p>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
            {groups.map((g, i) => (
              <div key={g} style={{
                flex: 1, height: 4, borderRadius: 4,
                background: i <= step ? '#818CF8' : 'rgba(255,255,255,0.2)', transition: 'background 0.3s'
              }} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '28px', minHeight: 260 }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div key={currentGroup} custom={direction} variants={slideVariants}
              initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>

              {currentGroup === 'identity' && (
                <div>
                  <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 15, color: '#0F172A', marginBottom: 6 }}>
                    Fill in any missing links
                  </p>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#64748B', marginBottom: 18 }}>
                    We couldn't find these on your resume. Optional, but recruiters love them.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {missingLinks.includes('linkedin') && (
                      <div>
                        <label style={wizardLabelStyle}>LinkedIn</label>
                        <input value={links.linkedin} onChange={e => setLinks(l => ({ ...l, linkedin: e.target.value }))}
                          placeholder="linkedin.com/in/yourname" style={wizardInputStyle} />
                      </div>
                    )}
                    {missingLinks.includes('github') && (
                      <div>
                        <label style={wizardLabelStyle}>GitHub</label>
                        <input value={links.github} onChange={e => setLinks(l => ({ ...l, github: e.target.value }))}
                          placeholder="github.com/yourusername" style={wizardInputStyle} />
                      </div>
                    )}
                    {missingLinks.includes('portfolio') && (
                      <div>
                        <label style={wizardLabelStyle}>Portfolio</label>
                        <input value={links.portfolio} onChange={e => setLinks(l => ({ ...l, portfolio: e.target.value }))}
                          placeholder="yourname.dev" style={wizardInputStyle} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentGroup === 'skills' && (
                <div>
                  <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 15, color: '#0F172A', marginBottom: 6 }}>
                    We noticed these skills are required
                  </p>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#64748B', marginBottom: 18 }}>
                    Select the ones you actually possess — we'll weave them in natively. Leave the rest unchecked and we'll list them as a growth area instead.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', margin: '-4px' }}>
                    {skillOptions.map(skill => (
                      <SelectableSkillChip key={skill} skill={skill} selected={selectedSkills.includes(skill)} onToggle={() => toggleSkill(skill)} />
                    ))}
                  </div>
                </div>
              )}

              {currentGroup === 'metrics' && (
                <div>
                  <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 15, color: '#0F172A', marginBottom: 6 }}>
                    Any real numbers we should know about?
                  </p>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#64748B', marginBottom: 18 }}>
                    Totally optional — rough estimates are fine. This is what makes bullets sound quantified instead of generic.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {METRIC_QUESTIONS.map((q, i) => (
                      <div key={i}>
                        <label style={{ ...wizardLabelStyle, lineHeight: 1.4 }}>{q}</label>
                        <input value={metrics[`m${i}`]} onChange={e => setMetrics(m => ({ ...m, [`m${i}`]: e.target.value }))}
                          placeholder="e.g. reduced load time by ~30%" style={wizardInputStyle} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer — primary step navigation. "Next" always works even with
            blank fields, so it doubles as an implicit "skip this step". */}
        <div style={{ padding: '18px 28px 10px', display: 'flex', alignItems: 'center', justifyContent: step > 0 ? 'space-between' : 'flex-end', gap: 12 }}>
          {step > 0 && (
            <button onClick={goBack} style={{ padding: '12px 20px', borderRadius: 12, border: '1.5px solid #E2E8F0', background: 'white', color: '#334155', fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Back
            </button>
          )}
          {isLastStep ? (
            <button onClick={handleFinish} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#4F46E5,#6366F1)', color: 'white', fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              ✨ Enhance My Resume
            </button>
          ) : (
            <button onClick={goNext} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: '#4F46E5', color: 'white', fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Next →
            </button>
          )}
        </div>

        {/* Full-wizard bypass — deliberately separated from the step nav
            above (own row, muted text-link styling, no button chrome) so
            it can't be mistaken for "skip this step" and clicked by
            accident. This is the rare "I don't want to answer anything"
            escape hatch, not the normal flow. */}
        <div style={{ padding: '2px 28px 18px', textAlign: 'center' }}>
          <button onClick={onSkip} style={{
            background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer',
            fontFamily: "'Inter',sans-serif", fontSize: 11.5, fontWeight: 500, color: '#CBD5E1',
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}>
            Skip entire wizard
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Set as Primary Resume Popup (Task 4) ──────────────────────────────────
// Bright-themed modal that appears after enhancement, asking the user if
// they want to set the enhanced resume as their primary profile resume.
function SetAsPrimaryPopup({ resumeUrl, resumeName, onNotNow, onYesUpdate }) {
  const [updating, setUpdating] = useState(false)

  const handleYes = async () => {
    setUpdating(true)
    try {
      await onYesUpdate()
    } finally {
      setUpdating(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1300, padding: 20,
      }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{
          background: 'linear-gradient(135deg, #FEF9C3 0%, #FDE68A 50%, #FCD34D 100%)',
          borderRadius: 28, maxWidth: 480, width: '100%',
          overflow: 'hidden', boxShadow: '0 30px 60px -15px rgba(0,0,0,0.3), 0 0 0 1px rgba(234, 179, 8, 0.2)',
        }}
      >
        {/* Sparkle accents */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', pointerEvents: 'none' }} />

        <div style={{ padding: '32px 32px 24px', textAlign: 'center', position: 'relative' }}>
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
            style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', boxShadow: '0 10px 30px -8px rgba(217,119,6,0.4)',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </motion.div>

          <h3 style={{
            fontFamily: "'Poppins',sans-serif", fontWeight: 800, fontSize: 22,
            color: '#78350F', margin: '0 0 8px',
          }}>
            ✨ Enhanced Resume Ready!
          </h3>
          <p style={{
            fontFamily: "'Inter',sans-serif", fontSize: 14, color: '#92400E',
            lineHeight: 1.6, margin: '0 0 6px',
          }}>
            Would you like to set this enhanced resume as your <strong>primary profile resume</strong>?
          </p>
          {resumeName && (
            <p style={{
              fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#B45309',
              margin: '0 0 4px', fontWeight: 500,
            }}>
              📄 {resumeName}
            </p>
          )}
          <p style={{
            fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#B45309',
            margin: '0 0 24px', opacity: 0.8,
          }}>
            It will be used across all AI features — Profile, ATS Matcher, and more.
          </p>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onNotNow}
              disabled={updating}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 16,
                border: '1.5px solid #A16207', background: 'rgba(255,255,255,0.6)',
                color: '#78350F', fontFamily: "'Poppins',sans-serif",
                fontWeight: 700, fontSize: 14, cursor: updating ? 'wait' : 'pointer',
                transition: 'all 0.2s', backdropFilter: 'blur(4px)',
              }}
            >
              Not Now
            </button>
            <button
              onClick={handleYes}
              disabled={updating}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 16,
                border: 'none',
                background: updating
                  ? '#B45309'
                  : 'linear-gradient(135deg, #F59E0B, #D97706)',
                color: 'white', fontFamily: "'Poppins',sans-serif",
                fontWeight: 700, fontSize: 14, cursor: updating ? 'wait' : 'pointer',
                boxShadow: '0 8px 20px -6px rgba(217,119,6,0.5)',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {updating ? (
                <><Loader2 size={16} className="animate-spin" /> Updating...</>
              ) : (
                '✅ Yes, Update'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function Results() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  useEffect(() => {
    fetch("https://resume-screening-system-hb2d.onrender.com/health")
      .catch(() => console.log("Warmup check failed"))
  }, [])

  // ── States ────────────────────────────────────────────────────────────────
  const [resumeFile, setResumeFile] = useState(null)
  const [resumeId, setResumeId] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)

  const [jdMode, setJdMode] = useState('paste')
  const [jdText, setJdText] = useState('')
  const [jdFile, setJdFile] = useState(null)
  const [jobTitle, setJobTitle] = useState('')
  const [requiredSkills, setRequiredSkills] = useState('')

  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const [enhanceResult, setEnhanceResult] = useState(null)

  const [enhancing, setEnhancing] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)

  // Magic Wizard States
  const [missingFields, setMissingFields] = useState([])
  const [manualInput, setManualInput] = useState('')

  // Dual-engine ATS states
  const [showKnockoutAlert, setShowKnockoutAlert] = useState(false)

  // HITL enhancement wizard state
  const [showWizard, setShowWizard] = useState(false)

  // "Fake document" guard state (receipts, IDs, etc. mistaken for a resume)
  const [invalidDocument, setInvalidDocument] = useState(false)
  const [invalidDocData, setInvalidDocData] = useState(null)

  // ── Primary Resume Popup State (Task 4) ─────────────────────────────────
  const [showPrimaryPopup, setShowPrimaryPopup] = useState(false)
  const [primaryResumeData, setPrimaryResumeData] = useState(null)

  const resultRef = useRef(null)
  const enhanceRef = useRef(null)

  // Auto-show the knockout popup the moment a fresh result comes back rejected
  useEffect(() => {
    if (result?.is_knockout) {
      setShowKnockoutAlert(true)
    }
  }, [result])

  const submitManualInput = async () => {
    toast.loading("Applying your details...");
    try {
      const { data } = await api.post('/enhance/enhance-and-download', {
        resume_id: resumeId,
        job_description: jdText,
        manual_data: manualInput,
        strict_missing_keywords: result?.strict_missing_keywords || [],
        save_enhanced: true
      });

      if (data.status === "SUCCESS") {
        window.open(data.pdf_url + "?fl_attachment=true", "_blank");
        toast.dismiss();
        toast.success("Resume Enhanced! 🚀");
        setMissingFields([]);
      }
    } catch (err) {
      toast.error("Failed to update and enhance.");
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const onResumeDrop = useCallback(async (accepted) => {
    const file = accepted[0]
    if (!file) return

    setResumeFile(file)
    setUploading(true)
    setUploadProgress(0)

    try {
      await uploadResume(file, pct => setUploadProgress(pct))

      let parsed = null
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const { data: list } = await getResumes({ page: 1, page_size: 1 })
        const latest = list.resumes?.[0]
        if (latest && latest.status === 'parsed') {
          parsed = latest
          break
        }
      }

      if (parsed) {
        setResumeId(parsed.id)
        setUploadDone(true)
        toast.success('Resume uploaded and parsed successfully')
      } else {
        toast('Parsing taking longer than expected...', { icon: '⏳' })
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [])

  const { getRootProps: getResumeRootProps, getInputProps: getResumeInputProps, isDragActive: resumeDrag } = useDropzone({
    onDrop: onResumeDrop, multiple: false, disabled: uploading,
    accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
    maxSize: 10 * 1024 * 1024,
  })

  const { getRootProps: getJDRootProps, getInputProps: getJDInputProps, isDragActive: jdDrag } = useDropzone({
    onDrop: async (accepted) => {
      const file = accepted[0]; if (!file) return
      setJdFile(file)
      setJdText('')

      try {
        const extracted = await extractJobDescriptionText(file)
        setJdText(extracted)
        toast.success(`Extracted ${extracted.length} characters from ${file.name}`)
      } catch (err) {
        toast.error(err.message || 'Could not extract text from the selected file')
      }
    },
    multiple: false, accept: {
      'application/pdf': ['.pdf'], 'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    }
  })

  const handleAnalyze = async () => {
    if (!resumeId) { toast.error('Please upload a resume first'); return }
    const jd = jdText.trim()
    if (jd.length < 50 && !jdFile) { toast.error('Please provide a sufficient job description'); return }

    // State reset
    setAnalyzing(true);
    setResult(null);
    setShowKnockoutAlert(false);
    setInvalidDocument(false);
    setInvalidDocData(null);

    try {
      const payload = {
        resume_id: resumeId,
        job_title: jobTitle || 'Target Role',
        job_description: jd || `Attached file: ${jdFile?.name}`,
        required_skills: requiredSkills.split(',').map(s => s.trim()).filter(Boolean),
        save_result: true,
      }

      let data;
      try {
        const res = await matchATS(payload)
        data = res.data
      } catch (err) {
        toast('Retrying analysis...', { icon: '🔄' })
        await new Promise(r => setTimeout(r, 3000))
        const res = await matchATS(payload)
        data = res.data
      }

      // ── [DEBUG] Log full API response for gap-analysis sync bug ────────
      console.group('%c[RESULTS_DEBUG] ATS Match API Response', 'background:#1E40AF;color:white;padding:4px 8px;border-radius:4px;font-weight:bold');
      console.log('Full payload sent:', payload);
      console.log('Full response data:', data);
      console.log('matched_skills:', data.matched_skills);
      console.log('missing_skills:', data.missing_skills);
      // Check for overlap between matched and missing
      if (data.matched_skills && data.missing_skills) {
        const matchedLower = new Set(data.matched_skills.map(s => s.toLowerCase().trim()));
        const missingLower = new Set(data.missing_skills.map(s => s.toLowerCase().trim()));
        const overlap = [...matchedLower].filter(s => missingLower.has(s));
        if (overlap.length > 0) {
          console.warn('⚠️ OVERLAP DETECTED — skills in BOTH matched and missing:', overlap);
        } else {
          console.log('✅ No overlap between matched and missing sets.');
        }
      }
      console.log('strict_matched_keywords:', data.strict_matched_keywords);
      console.log('strict_missing_keywords:', data.strict_missing_keywords);
      console.log('parsing_confidence:', data.parsing_confidence);
      console.log('final_score:', data.final_score);
      console.groupEnd();

      // ── "Fake Document" guard ──────────────────────────────────────────
      // A payment receipt, ID card, or other non-resume PDF will parse
      // "successfully" but produce near-zero usable signal. Catch that
      // here and halt before the dashboard tries to render on empty data.
      const confidence = data.parsing_confidence ?? 1
      const noSkillSignal = (data.matched_skills?.length || 0) === 0 && (data.missing_skills?.length || 0) === 0
      if (confidence <= 0.35 || noSkillSignal) {
        setInvalidDocData(data)
        setInvalidDocument(true)
        setAnalyzing(false)
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
        return
      }

      setResult(data)
      setActiveTab(0)

      if (data.is_knockout) {
        toast.error('⚠️ Strict ATS check: this resume would be rejected. See details below.')
      } else {
        toast.success('Analysis Complete! 🎯')
      }

      // UI scroll into view
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    } catch (err) {
      toast.error(formatApiError(err) || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  const handleResetInvalidDocument = () => {
    setInvalidDocument(false)
    setInvalidDocData(null)
    setResult(null)
    setResumeFile(null)
    setResumeId('')
    setUploadDone(false)
    setUploadProgress(0)
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100)
  }

  // userVerified: the bundle collected by <EnhancementWizard>, or null for
  // the "skip wizard" quick-enhance path. Only sent to the backend when
  // there's actually something in it — an empty bundle is the same as
  // not sending the field at all.
  const handleEnhance = async (userVerified = null) => {
    if (!resumeId) { toast.error('Resume required'); return }

    const hasVerifiedData = !!(userVerified && (
      userVerified.links ||
      (userVerified.verified_skills && userVerified.verified_skills.length > 0) ||
      (userVerified.impact_metrics && userVerified.impact_metrics.length > 0)
    ))

    setEnhancing(true)
    toast.loading("Crafting your premium resume & generating PDF... ✨")

    try {
      const { data } = await api.post('/enhance/enhance-and-download', {
        resume_id: resumeId,
        job_description: jdText,
        required_skills: requiredSkills.split(',').map(s => s.trim()).filter(Boolean),
        // Feed the strict engine's exact misses back in so the enhancer
        // prioritizes literal JD phrasing wherever it's truthful to do so.
        strict_missing_keywords: result?.strict_missing_keywords || [],
        // Human-confirmed ground truth from the HITL wizard, if the user
        // went through it. Omitted entirely on the quick-enhance path.
        ...(hasVerifiedData ? { user_verified: userVerified } : {}),
        save_enhanced: true
      })

      if (data.status === "SUCCESS" && data.pdf_url) {
        const pdfUrl = data.pdf_url

        // Local API fallback URL (starts with /api) — use full backend URL
        if (pdfUrl.startsWith('/api')) {
          const backendBase = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:8000'
          const fullUrl = backendBase + pdfUrl
          const a = document.createElement('a')
          a.href = fullUrl
          a.download = 'enhanced_resume.pdf'
          a.target = '_blank'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        } else {
          // FTP / CDN URL — open in new tab
          window.open(pdfUrl + "?fl_attachment=true", "_blank")
        }

        toast.dismiss()
        toast.success('Resume Enhanced & PDF Ready! 🚀')

        // ── Show the "Set as Primary Resume" popup (Task 4) ──────────────
        setPrimaryResumeData({
          resume_url: data.pdf_url,
          resume_name: resumeFile?.name || 'Enhanced Resume.pdf',
        })
        setShowPrimaryPopup(true)
      } else if (data.status === "MISSING_INFO") {
        toast.dismiss()
        setMissingFields(data.missing_fields || [])
      } else {
        toast.dismiss()
        toast.error('Unexpected response from server')
      }
    } catch (err) {
      toast.dismiss()
      const msg = err.response?.data?.detail || err.message || 'Enhancement failed'
      toast.error(msg)
      console.error('[Enhance] Error:', err.response?.data || err.message)
    } finally {
      setEnhancing(false)
    }
  }

  const handleEnhanceFromAlert = () => {
    setShowKnockoutAlert(false)
    setShowWizard(true)
  }

  const handleWizardSubmit = (userVerified) => {
    setShowWizard(false)
    handleEnhance(userVerified)
  }

  const handleWizardSkip = () => {
    setShowWizard(false)
    handleEnhance(null)
  }

  const handlePrimaryYes = async () => {
    if (!primaryResumeData) return
    const resumeUrl = primaryResumeData.resume_url
    const fileName = primaryResumeData.resume_name || 'Enhanced Resume.pdf'
    try {
      await setPrimaryResume({ resume_url: resumeUrl, resume_name: fileName })
      await refreshUser()
      toast.success(`✅ "${fileName}" is now your primary resume!`)
      setShowPrimaryPopup(false)
      setPrimaryResumeData(null)
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to set primary resume'
      toast.error(msg)
    }
  }

  const handlePrimaryNotNow = () => {
    setShowPrimaryPopup(false)
    setPrimaryResumeData(null)
  }

  const handleDownloadPDF = async () => {
    try {
      setGeneratingPDF(true)
      const rid = result?.resume_id || result?.id
      if (!rid) { toast.error('No resume found'); return }

      const { data } = await generatePDF({ resume_id: rid, template: "modern" })
      window.open(data.pdf_url + "?fl_attachment=true", "_blank")
      toast.success("✅ PDF opened successfully!")
    } catch (err) {
      toast.error(formatApiError(err) || "PDF generation failed")
    } finally {
      setGeneratingPDF(false)
    }
  }

const TABS = ['AI Keyword Match', 'AI Skill Match', 'Strict ATS Check', 'Roadmap & Learning']
  const containerStyle = { maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32, padding: '40px 20px', minHeight: '100vh' }
  const cardStyle = { background: 'white', borderRadius: 24, border: '1px solid #E2E8F0', padding: '28px', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.04)' }
  const labelStyle = { fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }
  const inputStyle = { width: '100%', padding: '14px 18px', borderRadius: 16, border: '1.5px solid #E2E8F0', fontFamily: "'Inter',sans-serif", fontSize: 14, color: '#0F172A', outline: 'none', boxSizing: 'border-box', background: '#F8FAFC', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }

  return (
    <div style={containerStyle}>
      {/* ── Page Header ── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 10px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: '#EFF6FF', borderRadius: 20, color: '#2563EB', fontWeight: 600, fontSize: 13, marginBottom: 16 }}>
          <span style={{ fontSize: 16 }}>✨</span> Dual-Engine ATS Optimizer
        </div>
        <h1 style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 800, fontSize: 36, color: '#0F172A', marginBottom: 12, lineHeight: 1.2 }}>
          Maximize Your Resume's Impact
        </h1>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 16, color: '#64748B', lineHeight: 1.6 }}>
          Upload your resume, paste the target job description, and get BOTH a strict corporate-bot reality check and an AI-driven potential score.
        </p>
      </motion.div>

      {/* ── Setup Section ── */}
      <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>

        {/* LEFT COLUMN: Resume */}
        <div style={{ flex: '1 1 350px', ...cardStyle, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EFF6FF', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📄</div>
            <div>
              <h3 style={{ fontFamily: "'Poppins',sans-serif", fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>Candidate Profile</h3>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#64748B', margin: 0 }}>Upload your current resume</p>
            </div>
          </div>

          <label style={labelStyle}>Step 1: Upload PDF or DOCX</label>
          <div {...getResumeRootProps()} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '40px 20px', borderRadius: 20, border: `2px dashed ${resumeDrag ? '#3B82F6' : uploadDone ? '#10B981' : '#CBD5E1'}`,
            background: resumeDrag ? '#EFF6FF' : uploadDone ? '#F0FDF4' : '#F8FAFC',
            textAlign: 'center', cursor: uploading ? 'wait' : 'pointer', transition: 'all 0.2s', minHeight: 220
          }}>
            <input {...getResumeInputProps()} />
            {uploading ? (
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                <div style={{ width: 60, height: 60, margin: '0 auto 16px', position: 'relative' }}>
                  <svg width="60" height="60" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="30" cy="30" r="26" fill="none" stroke="#E2E8F0" strokeWidth="6" />
                    <circle cx="30" cy="30" r="26" fill="none" stroke="#3B82F6" strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={163} strokeDashoffset={163 - (uploadProgress / 100) * 163}
                      style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
                  </svg>
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Poppins',sans-serif", fontWeight: 800, fontSize: 14, color: '#3B82F6'
                  }}>{uploadProgress}%</div>
                </div>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 600, color: '#334155' }}>Processing Document...</p>
              </motion.div>
            ) : uploadDone ? (
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 15, color: '#065F46' }}>
                  {resumeFile?.name || 'Resume Ready'}
                </p>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#64748B', marginTop: 6 }}>Click or drag to replace</p>
              </motion.div>
            ) : (
              <div>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📥</div>
                <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 600, fontSize: 16, color: '#334155' }}>
                  Drag & Drop Resume
                </p>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#64748B', marginTop: 8 }}>Supported formats: PDF, DOCX (Max 10MB)</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Target Role & JD */}
        <div style={{ flex: '1 1 450px', ...cardStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎯</div>
            <div>
              <h3 style={{ fontFamily: "'Poppins',sans-serif", fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>Target Role Setup</h3>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#64748B', margin: 0 }}>Define the job you want to match</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Step 2: Job Title *</label>
              <input value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Step 3: Core Skills (Optional)</label>
              <input value={requiredSkills} onChange={e => setRequiredSkills(e.target.value)}
                placeholder="React, TypeScript, AWS..." style={inputStyle} />
            </div>
          </div>

          <label style={labelStyle}>Step 4: Job Description</label>
          <textarea value={jdText} onChange={e => setJdText(e.target.value)}
            placeholder="Paste the full job description here..."
            style={{ ...inputStyle, height: 180, resize: 'none' }} />
        </div>
      </motion.div>

      {/* ── Main Action Button ── */}
      <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={{ display: 'flex', justifyContent: 'center' }}>
        <motion.button onClick={handleAnalyze} disabled={analyzing}
          style={{
            padding: '18px 48px', borderRadius: 20, border: 'none', cursor: analyzing ? 'wait' : 'pointer',
            fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 18, color: 'white',
            background: analyzing ? '#94A3B8' : 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)'
          }}>
          {analyzing ? 'Analyzing ATS Match...' : '🚀 Run Dual-Engine ATS Analysis'}
        </motion.button>
      </motion.div>

      {/* ── Invalid / Non-Resume Document Guard ── */}
      <AnimatePresence>
        {invalidDocument && !analyzing && (
          <div ref={resultRef} style={{ marginTop: 20 }}>
            <InvalidDocumentError
              confidence={invalidDocData?.parsing_confidence}
              warnings={invalidDocData?.parsing_warnings || []}
              onReset={handleResetInvalidDocument}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Results Dashboard ── */}
      <AnimatePresence>
        {result && !analyzing && !invalidDocument && (
          <motion.div ref={resultRef} layout initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 20 }}>

            <ParsingHealthBanner result={result} />

            {/* Dual score dashboard */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
              <ScoreHero result={result} />
              <StrictScoreCard result={result} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ display: 'inline-flex', gap: 8, background: '#F1F5F9', padding: 6, borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'auto', maxWidth: '100%' }}>
                {TABS.map((tab, i) => (
                  <button key={tab} onClick={() => setActiveTab(i)}
                    style={{
                      padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                      fontFamily: "'Poppins',sans-serif", fontSize: 14, fontWeight: activeTab === i ? 700 : 500,
                      transition: 'all 0.2s', ...(activeTab === i
                        ? { background: 'white', color: '#0F172A', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }
                        : { background: 'transparent', color: '#64748B' }
                      )
                    }}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ ...cardStyle, padding: '32px' }}>
              <AnimatePresence mode="wait">
                <motion.div key={activeTab}>
                  {activeTab === 0 && <KeywordsTab result={result} />}
                  {activeTab === 1 && <SkillsTab result={result} />}
                  {activeTab === 2 && <StrictTab result={result} />}
                  {activeTab === 3 && <RoadmapTab result={result} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Enhancer Section */}
            <div style={{ ...cardStyle }}>
              <button onClick={() => setShowWizard(true)} disabled={enhancing}
                style={{ width: '100%', padding: '16px', background: '#D97706', color: 'white', borderRadius: 14, border: 'none', fontWeight: 700, cursor: enhancing ? 'wait' : 'pointer' }}>
                {enhancing ? 'Optimizing Profile...' : '✨ Auto-Enhance Resume & Download PDF'}
              </button>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
                A few quick questions first — takes under a minute, and every answer becomes real, verified content.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Knockout Alert Modal ── */}
      <AnimatePresence>
        {showKnockoutAlert && result?.is_knockout && (
          <KnockoutAlert
            result={result}
            onDismiss={() => setShowKnockoutAlert(false)}
            onEnhance={handleEnhanceFromAlert}
          />
        )}
      </AnimatePresence>

      {/* ── HITL Enhancement Wizard ── */}
      <AnimatePresence>
        {showWizard && result && (
          <EnhancementWizard
            result={result}
            onClose={() => setShowWizard(false)}
            onSubmit={handleWizardSubmit}
            onSkip={handleWizardSkip}
          />
        )}
      </AnimatePresence>

      {/* ── Set as Primary Resume Popup ── */}
      <AnimatePresence>
        {showPrimaryPopup && primaryResumeData && (
          <SetAsPrimaryPopup
            resumeUrl={primaryResumeData.resume_url}
            resumeName={primaryResumeData.resume_name}
            onNotNow={handlePrimaryNotNow}
            onYesUpdate={handlePrimaryYes}
          />
        )}
      </AnimatePresence>

      {/* ── Enhancement Wizard Modal ── */}
      <AnimatePresence>
        {missingFields.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '30px', borderRadius: 20, maxWidth: 400, width: '90%' }}>
              <h3 style={{ fontFamily: "'Poppins',sans-serif" }}>Essential Info Missing!</h3>
              <p style={{ fontSize: 14, color: '#64748B' }}>To make your resume top-tier, please provide: {missingFields.join(", ")}</p>
              <input value={manualInput} onChange={(e) => setManualInput(e.target.value)} placeholder="Enter missing details..." style={{ ...inputStyle, marginBottom: '15px' }} />
              <button onClick={submitManualInput} style={{ width: '100%', padding: '12px', background: '#2563EB', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>
                Enhance Anyway
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const formatApiError = (err) => {
  const data = err?.response?.data;
  if (!data) return err?.message || 'Request failed';

  if (Array.isArray(data.detail)) {
    return data.detail.map(e => `${e.loc?.join('.') || 'Field'}: ${e.msg}`).join(' | ');
  }
  if (typeof data.detail === 'object' && data.detail !== null) {
    return data.detail.msg || JSON.stringify(data.detail);
  }
  if (typeof data.detail === 'string') return data.detail;

  return JSON.stringify(data);
};