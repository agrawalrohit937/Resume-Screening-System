import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useDropzone } from 'react-dropzone'
import { 
  Building2, Sparkles, FileText, UploadCloud, CheckCircle2, AlertTriangle, 
  Search, SlidersHorizontal, ArrowRight, Download, Github, Linkedin, ExternalLink, 
  UserCheck, Briefcase, Target, Award, Zap, RefreshCw, X, Check, Code, Layers, 
  BrainCircuit, Users, Filter, Sliders
} from 'lucide-react'
import api, { generatePDF } from '../services/api'
import GithubHoverCard from '../components/recruiter/GithubHoverCard'

// ─── Score Utilities ──────────────────────────────────────────────────────────
const pct = (v) => Math.round(v || 0)

const getScoreTheme = (p) => {
  if (p >= 80) return {
    text: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200/80',
    badgeText: 'text-emerald-700',
    barFill: 'bg-emerald-500',
    stroke: '#10B981'
  }
  if (p >= 60) return {
    text: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200/80',
    badgeText: 'text-indigo-700',
    barFill: 'bg-indigo-500',
    stroke: '#6366F1'
  }
  if (p >= 40) return {
    text: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200/80',
    badgeText: 'text-amber-700',
    barFill: 'bg-amber-500',
    stroke: '#F59E0B'
  }
  return {
    text: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200/80',
    badgeText: 'text-rose-700',
    barFill: 'bg-rose-500',
    stroke: '#F43F5E'
  }
}

const SAMPLE_JD = `Senior Python Developer — AI platform backend

Required Skills: Python, FastAPI, MongoDB, Docker, AWS, PostgreSQL, Redis

Requirements:
• 5+ years Python production experience
• Strong async + system design skills
• Cloud infrastructure (AWS preferred)
• Docker and container orchestration`

// ─── Mini Progress Bar ────────────────────────────────────────────────────────
function ScoreBar({ label, val, colorClass }) {
  const p = pct(val)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className="text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="text-slate-700 font-mono">{p}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${p}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full rounded-full ${colorClass}`}
        />
      </div>
    </div>
  )
}

// ─── Candidate Card ───────────────────────────────────────────────────────────
function CandidateCard({ c, idx }) {
  const s = pct(c.final_score)
  const theme = getScoreTheme(s)

  const REC_CONFIG = {
    strong_match: { label: 'Strong Match', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/70' },
    good_match: { label: 'Good Match', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/70' },
    partial_match: { label: 'Partial Match', bg: 'bg-amber-50 text-amber-700 border-amber-200/70' },
    poor_match: { label: 'Weak Match', bg: 'bg-rose-50 text-rose-700 border-rose-200/70' },
  }[c.recommendation] || { label: 'Evaluated', bg: 'bg-slate-100 text-slate-700 border-slate-200' }

  const handleDownloadPdf = async () => {
    try {
      if (c.file_url) {
        window.open(c.file_url, '_blank')
        return
      }

      toast('Generating PDF…', { icon: '⏳' })
      const { data } = await generatePDF({
        resume_id: c.resume_id,
        template: 'modern'
      })

      if (data?.pdf_url) {
        window.open(data.pdf_url, '_blank')
      } else {
        toast.error('PDF generation not available')
      }
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.detail || 'Download failed')
    }
  }

  // Rank Badge Styles
  const getRankBadgeStyle = (rank) => {
    if (rank === 1) return 'bg-gradient-to-br from-amber-400 to-amber-600 text-white border-amber-300 shadow-md'
    if (rank === 2) return 'bg-gradient-to-br from-slate-400 to-slate-600 text-white border-slate-300 shadow-sm'
    if (rank === 3) return 'bg-gradient-to-br from-amber-700 to-amber-900 text-white border-amber-600 shadow-sm'
    return 'bg-slate-100 text-slate-600 border-slate-200'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      className={`bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden relative group`}
    >
      {/* Top Accent Line */}
      <div className={`h-1.5 w-full ${theme.barFill}`} />

      <div className="p-5 space-y-4">
        {/* Header: Rank + Name + Score Gauge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-extrabold text-xs shrink-0 border ${getRankBadgeStyle(c.rank)}`}>
              #{c.rank}
            </div>
            <div className="min-w-0">
              <h4 className="font-extrabold text-base text-slate-900 truncate leading-tight">
                {c.name || 'Candidate'}
              </h4>
              {c.email ? (
                <a
                  href={`mailto:${c.email}`}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline truncate block mt-0.5"
                >
                  {c.email}
                </a>
              ) : (
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">ATS Evaluated</p>
              )}
            </div>
          </div>

          {/* Radial percentage gauge */}
          <div className={`w-12 h-12 rounded-2xl ${theme.bg} border ${theme.border} flex flex-col items-center justify-center shrink-0 shadow-xs`}>
            <span className={`font-black text-base ${theme.text} leading-none`}>{s}</span>
            <span className={`text-[8px] font-bold ${theme.text} uppercase mt-0.5`}>% ATS</span>
          </div>
        </div>

        {/* Recommendation Badge */}
        <div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${REC_CONFIG.bg}`}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            {REC_CONFIG.label}
          </span>
        </div>

        {/* Score Breakdown Bars */}
        <div className="space-y-2.5 bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
          <ScoreBar label="Semantic Match" val={c.bert_score} colorClass="bg-indigo-500" />
          <ScoreBar label="Keyword Match" val={c.tfidf_score} colorClass="bg-emerald-500" />
          <ScoreBar label="Overall Score" val={c.final_score} colorClass={theme.barFill} />
        </div>

        {/* Matched Skills Pills */}
        {c.matched_skills?.length > 0 && (
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">
              Matched Skills ({c.matched_skills.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {c.matched_skills.slice(0, 6).map((sk) => (
                <span
                  key={sk}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-mono text-[10.5px] font-bold"
                >
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                  {sk}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Missing Skills Pills */}
        {c.missing_skills?.length > 0 && (
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">
              Missing Skills ({c.missing_skills.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {c.missing_skills.slice(0, 4).map((sk) => (
                <span
                  key={sk}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200/60 font-mono text-[10.5px] font-bold"
                >
                  <X className="w-3 h-3 text-rose-600 stroke-[3]" />
                  {sk}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Experience Indicator */}
        {c.experience_years > 0 && (
          <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5 pt-1">
            <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
            {c.experience_years} years verified experience
          </p>
        )}
      </div>

      {/* Action Footer */}
      <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2 flex-wrap">
        <button
          onClick={handleDownloadPdf}
          className="flex-1 min-w-[100px] h-9 px-3 rounded-xl bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 active:scale-95 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Download className="w-3.5 h-3.5" />
          Resume
        </button>

        <GithubHoverCard username={c.github_username || ''} />

        {c.linkedin_url && (
          <a
            href={c.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-3 rounded-xl bg-[#0A66C2]/10 border border-[#0A66C2]/20 text-[#0A66C2] hover:bg-[#0A66C2]/20 active:scale-95 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Linkedin className="w-3.5 h-3.5" />
            LinkedIn
          </a>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main Recruiter Dashboard Component ───────────────────────────────────────
export default function RecruiterDashboard() {
  const [jdMode, setJdMode] = useState('paste')
  const [jdText, setJdText] = useState('')
  const [jdFile, setJdFile] = useState(null)
  const [jobTitle, setJobTitle] = useState('')
  const [skills, setSkills] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [topN, setTopN] = useState(20)
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [summary, setSummary] = useState(null)
  const [filterRec, setFilterRec] = useState('all')
  const [sortBy, setSortBy] = useState('score')
  const resultsRef = useRef(null)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    onDrop: async ([f]) => {
      if (!f) return
      setJdFile(f)
      if (f.type === 'text/plain') {
        setJdText(await f.text())
      } else {
        toast('File uploaded — text will be parsed during candidate matching', { icon: '📄' })
      }
    }
  })

  const runMatch = async () => {
    const jd = jdText.trim()
    if (jd.length < 30 && !jdFile) {
      toast.error('Please paste or upload a Job Description (min 30 characters)')
      return
    }
    setLoading(true)
    setCandidates([])
    setSummary(null)

    try {
      const { data } = await api.post('/recruiter/v2/match-jd', {
        job_title: jobTitle || 'Target Role',
        job_description: jd || `File: ${jdFile?.name}`,
        required_skills: skills.split(',').map(s => s.trim()).filter(Boolean),
        min_score: minScore / 100,
        max_results: topN,
      })
      setCandidates(data.candidates || [])
      setSummary(data.summary || {})
      toast.success(`Matched & ranked ${data.total_candidates} candidates 🎯`)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
      if (!data.candidates || data.candidates.length === 0) {
        toast('No matching candidates found. Try adjusting min score or skills.')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Candidate matching failed.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = candidates
    .filter(c => filterRec === 'all' || (c.recommendation || '').toLowerCase() === filterRec)
    .sort((a, b) => sortBy === 'score' ? b.final_score - a.final_score : (a.name || '').localeCompare(b.name || ''))

  const jdLen = jdText.trim().length

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 font-sans pb-24">

      {/* ── 1. Header Banner ────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-100/50 to-blue-50/30 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-800 text-white flex items-center justify-center shadow-md border border-indigo-400/30 shrink-0">
              <Building2 className="w-6 h-6 text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10.5px] font-black uppercase tracking-wider border border-indigo-100 mb-2">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                Shortlist & Rank Candidates
              </div>
              <h1 className="font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">
                Recruiter Intelligence Dashboard
              </h1>
              <p className="text-sm font-medium text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Paste or upload a Job Description to rank all platform candidates instantly using multi-factor ATS scoring, skill verification, and GitHub insights.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── 2. JD Input & Criteria Form Card ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden"
      >
        {/* Form Card Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Job Description & Criteria</h3>
              <p className="text-xs font-medium text-slate-400">Provide job requirements to run instant ATS candidate matching</p>
            </div>
          </div>

          {/* JD Mode Switcher Pills */}
          <div className="flex items-center bg-slate-200/60 p-1 rounded-xl gap-1">
            <button
              onClick={() => setJdMode('paste')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                jdMode === 'paste' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ✏️ Paste Text
            </button>
            <button
              onClick={() => setJdMode('file')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                jdMode === 'file' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📎 Upload File
            </button>
          </div>
        </div>

        {/* Form Input Content */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Job Description Input Container */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                Job Description <span className="text-rose-500">*</span>
              </label>
              {jdMode === 'paste' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setJdText(SAMPLE_JD)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    Load Sample
                  </button>
                  {jdText && (
                    <button
                      onClick={() => setJdText('')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <X className="w-3 h-3 text-slate-400" />
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {jdMode === 'paste' ? (
              <div>
                <textarea
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  placeholder="Paste the full job description here... Include required technical skills, responsibilities, and experience requirements."
                  className="w-full h-44 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all resize-none leading-relaxed font-sans"
                />
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className={`font-mono font-bold ${jdLen >= 30 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {jdLen} characters {jdLen >= 30 ? '✓ Ready' : '(minimum 30 required)'}
                  </span>
                </div>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`h-40 rounded-2xl border-2 border-dashed transition-all p-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer ${
                  isDragActive
                    ? 'border-indigo-500 bg-indigo-50/60'
                    : jdFile
                    ? 'border-emerald-400 bg-emerald-50/40'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/60 hover:border-slate-300'
                }`}
              >
                <input {...getInputProps()} />
                {jdFile ? (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                      <Check className="w-5 h-5 stroke-[3]" />
                    </div>
                    <p className="font-extrabold text-sm text-slate-800">{jdFile.name}</p>
                    <p className="text-xs text-slate-400">Click or drag a new file to replace</p>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-xs">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <p className="font-bold text-sm text-slate-700">
                      {isDragActive ? 'Drop job description file here' : 'Drag & drop JD file or click to upload'}
                    </p>
                    <p className="text-xs text-slate-400">Supports PDF, DOCX, or TXT format</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Grid 1: Job Title & Required Skills */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 block mb-2">
                Target Job Title
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Senior Full Stack Engineer"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 block mb-2">
                Required Skills <span className="text-slate-400 font-normal lowercase">(comma separated)</span>
              </label>
              <div className="relative">
                <Target className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="e.g. python, fastapi, docker, aws"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Grid 2: Min Score & Show Top N */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/60">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  Minimum ATS Match Score
                </label>
                <span className="font-black text-sm text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                  {minScore}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
                <span>0% (All)</span>
                <span>45% (Decent)</span>
                <span>90% (Elite)</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 block mb-2">
                Max Candidates to Display
              </label>
              <select
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 cursor-pointer shadow-xs"
              >
                {[1, 5, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>
                    Show Top {n} Candidates
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Run Match Button */}
          <motion.button
            onClick={runMatch}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.01 }}
            whileTap={{ scale: loading ? 1 : 0.99 }}
            className={`w-full py-4 rounded-2xl font-extrabold text-base text-white shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
              loading
                ? 'bg-slate-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-indigo-500/25'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Analyzing Platform Candidates...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Find & Rank Best Candidates
              </>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* ── 3. Loading Skeleton ────────────────────────────────────────── */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm"
          >
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 animate-bounce shadow-md">
              <BrainCircuit className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-extrabold text-xl text-slate-900">Semantic Matching in Progress</h3>
              <p className="text-sm font-medium text-slate-500 mt-1 max-w-md mx-auto">
                Running NLP semantic matching, skill verification, and experience scoring on candidate profiles...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 4. Candidate Match Results ───────────────────────────────────── */}
      <AnimatePresence>
        {candidates.length > 0 && !loading && (
          <motion.div
            ref={resultsRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            {/* Summary Statistics Ribbon + Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
              {summary && (
                <div className="flex flex-wrap gap-2.5 items-center">
                  <div className="px-3.5 py-2 rounded-2xl bg-indigo-50 border border-indigo-100 text-center min-w-[70px]">
                    <p className="font-black text-xl text-indigo-700 leading-none">{candidates.length}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Total</p>
                  </div>
                  <div className="px-3.5 py-2 rounded-2xl bg-emerald-50 border border-emerald-100 text-center min-w-[70px]">
                    <p className="font-black text-xl text-emerald-700 leading-none">{summary.strong_matches || 0}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Strong</p>
                  </div>
                  <div className="px-3.5 py-2 rounded-2xl bg-blue-50 border border-blue-100 text-center min-w-[70px]">
                    <p className="font-black text-xl text-blue-700 leading-none">{summary.good_matches || 0}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Good</p>
                  </div>
                  <div className="px-3.5 py-2 rounded-2xl bg-rose-50 border border-rose-100 text-center min-w-[70px]">
                    <p className="font-black text-xl text-rose-700 leading-none">{summary.poor_matches || 0}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Weak</p>
                  </div>
                  <div className="px-3.5 py-2 rounded-2xl bg-amber-50 border border-amber-100 text-center min-w-[70px]">
                    <p className="font-black text-xl text-amber-700 leading-none">
                      {Math.round(summary.average_score > 1.0 ? summary.average_score : (summary.average_score || 0) * 100)}%
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Average</p>
                  </div>
                </div>
              )}

              {/* Filter & Sort controls */}
              <div className="flex items-center gap-2.5 self-end md:self-auto">
                <div className="relative flex items-center">
                  <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                  <select
                    value={filterRec}
                    onChange={(e) => setFilterRec(e.target.value)}
                    className="h-10 pl-8 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-700 outline-none cursor-pointer focus:bg-white transition-all shadow-xs"
                  >
                    <option value="all">All Matches</option>
                    <option value="strong_match">Strong Matches Only</option>
                    <option value="good_match">Good Matches Only</option>
                    <option value="partial_match">Partial Matches Only</option>
                  </select>
                </div>

                <div className="relative flex items-center">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="h-10 pl-8 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-700 outline-none cursor-pointer focus:bg-white transition-all shadow-xs"
                  >
                    <option value="score">Sort by Score</option>
                    <option value="name">Sort by Name</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Candidates Grid */}
            {filtered.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="font-extrabold text-base text-slate-800">No candidates match the selected filter</p>
                <p className="text-xs text-slate-400 mt-1">Try switching to "All Matches" to see remaining candidates.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((c, i) => (
                  <CandidateCard key={`${c.user_id}-${c.resume_id}`} c={c} idx={i} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 5. Default Initial State Card ─────────────────────────────── */}
      {!loading && candidates.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm"
        >
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-md">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-extrabold text-xl text-slate-900">Shortlist Top Candidates Instantly</h3>
            <p className="text-sm font-medium text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
              Paste or upload your target Job Description above to rank platform candidates based on semantic ATS matching, technical skill coverage, and GitHub insights.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {['Semantic NLP Match', 'Keyword Coverage', 'Skill Gap Breakdown', 'GitHub Insights'].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200/60 font-mono text-[11px] font-bold text-slate-500"
              >
                ✓ {tag}
              </span>
            ))}
          </div>
        </motion.div>
      )}

    </div>
  )
}
