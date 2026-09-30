/**
 * InterviewReport — Ultra-Modern, Vibrant, Rich-Color & Silky Smooth Stacking Assessment Report.
 */
import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  ThumbsUp,
  HelpCircle,
  XCircle,
  ClipboardList,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Rocket,
  RotateCcw,
  BarChart3,
  Mic,
  Sparkles,
  Lightbulb,
  Check,
  X,
  Copy,
  Printer,
  ArrowRight,
  Search,
  Layers,
  Zap,
  Award,
  Activity,
  CheckCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { SkillBreakdownBars, QuestionScoreStrip } from '../Charts'

const getScoreColor = (v) =>
  v >= 80 ? '#059669' : v >= 60 ? '#2563EB' : v >= 40 ? '#D97706' : '#DC2626'

const getScoreGradient = (v) =>
  v >= 80
    ? 'from-emerald-500 to-teal-600 text-white shadow-emerald-500/25'
    : v >= 60
    ? 'from-indigo-600 to-blue-600 text-white shadow-indigo-500/25'
    : v >= 40
    ? 'from-amber-500 to-orange-500 text-white shadow-amber-500/25'
    : 'from-rose-500 to-red-600 text-white shadow-rose-500/25'

const getScoreHeaderBg = (v) =>
  v >= 80
    ? 'from-emerald-50/90 via-teal-50/40 to-white border-b border-emerald-100/80'
    : v >= 60
    ? 'from-indigo-50/90 via-blue-50/40 to-white border-b border-indigo-100/80'
    : v >= 40
    ? 'from-amber-50/90 via-orange-50/40 to-white border-b border-amber-100/80'
    : 'from-rose-50/90 via-red-50/40 to-white border-b border-rose-100/80'

const getVerdict = (v) =>
  v >= 80
    ? 'Outstanding Performance'
    : v >= 60
    ? 'Solid Competence'
    : v >= 40
    ? 'Needs Targeted Practice'
    : 'Significant Skill Gaps'

// ── Hiring recommendation badge ─────────────────────────────────────────────
function HiringBadge({ rec }) {
  const CFG = {
    'Strong Yes': {
      bg: 'bg-emerald-500 text-white shadow-emerald-500/20',
      text: 'text-white',
      Icon: CheckCircle2,
    },
    Yes: {
      bg: 'bg-indigo-600 text-white shadow-indigo-500/20',
      text: 'text-white',
      Icon: ThumbsUp,
    },
    Maybe: {
      bg: 'bg-amber-500 text-white shadow-amber-500/20',
      text: 'text-white',
      Icon: HelpCircle,
    },
    No: {
      bg: 'bg-rose-500 text-white shadow-rose-500/20',
      text: 'text-white',
      Icon: XCircle,
    },
  }
  const cfg =
    CFG[rec] || {
      bg: 'bg-slate-700 text-white',
      text: 'text-white',
      Icon: ClipboardList,
    }
  const { Icon } = cfg
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-md ${cfg.bg}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>Verdict: {rec}</span>
    </div>
  )
}

// ── Vibrant Glowing Radial Score Meter ─────────────────────────────────────
function VibrantHeroScore({ score, size = 96 }) {
  const c = getScoreColor(score)
  const r = size / 2 - 8
  const circ = 2 * Math.PI * r
  const off = circ - (score / 100) * circ

  return (
    <div
      className="relative shrink-0 flex items-center justify-center filter drop-shadow-[0_4px_12px_rgba(99,102,241,0.2)]"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={8}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black tabular-nums leading-none text-slate-900 text-2xl sm:text-3xl tracking-tight">
          {Math.round(score)}
        </span>
        <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mt-1">
          Overall
        </span>
      </div>
    </div>
  )
}

// ── Silky Smooth Stacking Question Card ────────────────────────────────────
function SmoothStackingQuestionCard({ item, index, total }) {
  const score = Math.round(item.evaluation?.overall_score || 0)
  const c = getScoreColor(score)
  const gradClass = getScoreGradient(score)
  const headerBg = getScoreHeaderBg(score)

  const copyAnswer = () => {
    if (!item.answer) return
    navigator.clipboard?.writeText(item.answer)
    toast.success(`Question ${index + 1} answer copied! 📋`, { id: 'copy-answer' })
  }

  // Smooth Stacking Top Offset: Stacks cards cleanly with subtle 8px cascade
  const stickyTop = 80 + Math.min(index, 5) * 8

  return (
    <div
      id={`q-card-${index}`}
      style={{ top: `${stickyTop}px` }}
      className="sticky z-10 transition-all duration-300 mb-6 report-question-card"
    >
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        className="rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-md shadow-[0_12px_36px_-10px_rgba(15,23,42,0.10)] hover:shadow-[0_20px_48px_-12px_rgba(15,23,42,0.16)] transition-all overflow-hidden"
      >
        {/* Colorful Gradient Header */}
        <div className={`p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r ${headerBg}`}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-xs sm:text-sm font-black shrink-0 bg-gradient-to-br ${gradClass} shadow-md`}
            >
              #{String(index + 1).padStart(2, '0')}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-black bg-white text-indigo-700 border border-indigo-200/80 uppercase tracking-wider shadow-2xs">
                {item.category || 'Technical'}
              </span>
              {item.reattempted && (
                <span className="text-[10px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-md shadow-2xs">
                  Reattempted
                </span>
              )}
              {item.answer_source === 'voice' && (
                <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-2xs">
                  <Mic className="h-3 w-3" /> Voice
                </span>
              )}
            </div>

            <h3 className="text-xs sm:text-sm font-black text-slate-800 truncate flex-1">
              {item.question_text}
            </h3>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r ${gradClass} shadow-md flex items-center gap-1.5`}
            >
              <span>{score}/100</span>
              {item.evaluation?.grade && (
                <span className="opacity-90 text-[11px] font-bold">({item.evaluation.grade})</span>
              )}
            </div>
          </div>
        </div>

        {/* Card Content Body */}
        <div className="p-4 sm:p-6 space-y-4 text-xs">
          {/* Question Prompt */}
          <div className="p-3.5 bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-2xl border border-indigo-100/70 text-slate-900 font-semibold text-xs sm:text-sm leading-relaxed">
            <span className="text-indigo-700 font-black block text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
              <Zap size={13} className="text-indigo-600" /> Question Prompt
            </span>
            {item.question_text}
          </div>

          {/* Candidate Answer */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Candidate's Response
              </span>
              <button
                type="button"
                onClick={copyAnswer}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 cursor-pointer print:hidden transition-colors"
              >
                <Copy size={12} /> Copy Answer
              </button>
            </div>
            <div className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200/80 text-slate-800 leading-relaxed font-medium text-xs sm:text-[13px]">
              {item.answer || '— (No response recorded)'}
            </div>
          </div>

          {/* 4 Score Gauges with Vibrant Colors */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              ['Relevance', item.evaluation?.relevance_score, '#2563EB', 'bg-blue-50/70 border-blue-200/60'],
              ['Clarity', item.evaluation?.clarity_score, '#059669', 'bg-emerald-50/70 border-emerald-200/60'],
              ['Confidence', item.evaluation?.confidence_score, '#7C3AED', 'bg-purple-50/70 border-purple-200/60'],
              ['Technical Depth', item.evaluation?.technical_score, '#D97706', 'bg-amber-50/70 border-amber-200/60'],
            ].map(([label, val, color, bg]) => {
              const v = Math.round(val || 0)
              return (
                <div
                  key={label}
                  className={`px-3.5 py-2.5 rounded-2xl border flex items-center justify-between ${bg}`}
                >
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">{label}</span>
                  <span className="text-xs sm:text-sm font-black tabular-nums" style={{ color }}>
                    {v}%
                  </span>
                </div>
              )
            })}
          </div>

          {/* AI Feedback & Benchmark Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {item.evaluation?.feedback && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-white border border-indigo-100 text-indigo-950 space-y-1 shadow-2xs">
                <p className="text-xs font-black text-indigo-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 shrink-0 text-indigo-600" /> AI Evaluation Feedback
                </p>
                <p className="leading-relaxed font-medium text-indigo-900/90">
                  {item.evaluation.feedback}
                </p>
              </div>
            )}

            {item.evaluation?.ideal_answer_summary && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-white border border-emerald-100 text-emerald-950 space-y-1 shadow-2xs">
                <p className="text-xs font-black text-emerald-700 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 shrink-0 text-emerald-600" /> Benchmark Ideal Response
                </p>
                <p className="leading-relaxed font-medium text-emerald-900/90">
                  {item.evaluation.ideal_answer_summary}
                </p>
              </div>
            )}
          </div>

          {/* Tips & Keywords */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
            {item.evaluation?.improvement_tips?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Tips:
                </span>
                {item.evaluation.improvement_tips.slice(0, 2).map((tip, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-medium"
                  >
                    💡 {tip}
                  </span>
                ))}
              </div>
            )}

            {(item.evaluation?.keywords_found?.length > 0 ||
              item.evaluation?.keywords_missing?.length > 0) && (
              <div className="flex flex-wrap gap-1 items-center">
                {item.evaluation.keywords_found?.slice(0, 3).map((k) => (
                  <span
                    key={k}
                    className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-0.5 font-black"
                  >
                    <Check className="w-2.5 h-2.5" /> {k}
                  </span>
                ))}
                {item.evaluation.keywords_missing?.slice(0, 2).map((k) => (
                  <span
                    key={k}
                    className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-0.5 font-black"
                  >
                    <X className="w-2.5 h-2.5" /> {k}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main Vibrant & Silky Smooth Interview Report ────────────────────────────
export default function InterviewReport({
  reportData,
  cheatingData,
  answers = [],
  onRestart,
}) {
  if (!reportData) return null
  const { session, summary } = reportData
  const overall = session?.overall_score || 0
  const cheatPct = Math.round(
    (cheatingData?.score || session?.cheating_score || 0) * 100
  )
  const warnings = cheatingData?.warning_count || session?.warning_count || 0
  const cheatColor =
    cheatPct > 50 ? '#DC2626' : cheatPct > 20 ? '#D97706' : '#059669'

  // Question Filters, Search & Active Tab
  const [selectedFilter, setSelectedFilter] = useState('ALL') // 'ALL' | 'TECHNICAL' | 'BEHAVIORAL' | 'HIGH' | 'LOW'
  const [searchQuery, setSearchQuery] = useState('')
  const [activeInsightTab, setActiveInsightTab] = useState('strengths') // 'strengths' | 'gaps' | 'next_steps'

  // Filtered Questions List
  const filteredAnswers = useMemo(() => {
    return answers.filter((item) => {
      const score = Math.round(item.evaluation?.overall_score || 0)
      const cat = (item.category || '').toLowerCase()
      const text = (item.question_text || '').toLowerCase()
      const ans = (item.answer || '').toLowerCase()

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (!text.includes(q) && !ans.includes(q) && !cat.includes(q)) {
          return false
        }
      }

      if (selectedFilter === 'TECHNICAL') return cat.includes('tech')
      if (selectedFilter === 'BEHAVIORAL') return cat.includes('behav') || cat.includes('hr')
      if (selectedFilter === 'HIGH') return score >= 80
      if (selectedFilter === 'LOW') return score < 60
      return true
    })
  }, [answers, selectedFilter, searchQuery])

  // Scroll to question
  const scrollToQuestion = (idx) => {
    const el = document.getElementById(`q-card-${idx}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Full-Page Export & Print Handler
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="w-full max-w-[1550px] mx-auto px-2 sm:px-6 space-y-5 sm:space-y-7 font-sans text-slate-900 pb-20 report-root">
      
      {/* ── Embedded Print CSS for Full PDF Export ── */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm 12mm;
          }
          body, html, #root {
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 11pt !important;
          }
          .report-root {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print\\:hidden, button, input {
            display: none !important;
          }
          .report-question-card {
            position: static !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 16px !important;
            box-shadow: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* ── 1. Top Bento Grid (3 Vibrant High-Impact Cards) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        
        {/* Bento Card A: Executive Summary & Performance Meter (5 Cols) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-5 bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/40 rounded-3xl border border-indigo-100/90 p-4 sm:p-6 shadow-sm flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-900/60">
                  Assessment Complete
                </span>
              </div>
              {summary?.hiring_recommendation && (
                <HiringBadge rec={summary.hiring_recommendation} />
              )}
            </div>

            <div>
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 leading-tight">
                {session?.job_title || 'Technical Interview'} Evaluation
              </h1>
              <p
                className="text-xs sm:text-sm font-black mt-0.5"
                style={{ color: getScoreColor(overall) }}
              >
                {getVerdict(overall)}
              </p>
            </div>

            {/* Score Ring + Metrics Cluster */}
            <div className="flex items-center gap-4 pt-1">
              <VibrantHeroScore score={overall} />

              <div className="grid grid-cols-3 gap-2 flex-1">
                <div className="flex flex-col items-center justify-center bg-white/90 border border-blue-200/80 rounded-2xl p-2.5 text-center shadow-2xs">
                  <span className="text-base sm:text-lg font-black tabular-nums text-blue-600">
                    {Math.round(session?.avg_confidence || 0)}%
                  </span>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mt-0.5">
                    Confidence
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center bg-white/90 border border-emerald-200/80 rounded-2xl p-2.5 text-center shadow-2xs">
                  <span className="text-base sm:text-lg font-black tabular-nums text-emerald-600">
                    {Math.round(session?.avg_clarity || 0)}%
                  </span>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mt-0.5">
                    Clarity
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center bg-white/90 border border-purple-200/80 rounded-2xl p-2.5 text-center shadow-2xs">
                  <span className="text-base sm:text-lg font-black tabular-nums inline-flex items-center gap-0.5" style={{ color: cheatColor }}>
                    <ShieldCheck size={14} /> {cheatPct}%
                  </span>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mt-0.5">
                    Integrity{warnings > 0 ? ` (${warnings}⚠)` : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Executive Summary Snippet */}
          {summary?.executive_summary && (
            <div className="p-3.5 rounded-2xl bg-indigo-600/10 border border-indigo-200/80 text-xs text-indigo-950 font-medium leading-relaxed">
              <span className="font-black text-indigo-700">Executive Summary: </span>
              "{summary.executive_summary}"
            </div>
          )}
        </motion.div>

        {/* Bento Card B: Skill Breakdown (4 Cols) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="lg:col-span-4 bg-gradient-to-br from-emerald-50/60 via-white to-teal-50/30 rounded-3xl border border-emerald-100/90 p-4 sm:p-6 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Competency Matrix
              </h2>
              <span className="text-[10px] text-emerald-700 font-black bg-emerald-100/80 px-2 py-0.5 rounded-md">5 Dimensions</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Performance breakdown across key technical &amp; behavioral pillars
            </p>
            {summary?.skill_radar ? (
              <SkillBreakdownBars skillRadar={summary.skill_radar} />
            ) : (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                Skills mapped across interview responses.
              </p>
            )}
          </div>

          {answers?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-emerald-100/80">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1"><BarChart3 size={13} className="text-emerald-600" /> Progression Curve</span>
                <span className="text-slate-400">{answers.length} Questions</span>
              </div>
              <QuestionScoreStrip answers={answers} />
            </div>
          )}
        </motion.div>

        {/* Bento Card C: Dynamic AI Strategic Insights (3 Cols) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-3 bg-gradient-to-br from-purple-50/60 via-white to-indigo-50/40 rounded-3xl border border-purple-100/90 p-4 sm:p-5 shadow-sm flex flex-col justify-between space-y-3"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                AI Strategic Insights
              </h2>
            </div>

            {/* 3 Vibrant Selector Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100/90 p-1 rounded-2xl text-[10px] font-black print:hidden">
              <button
                type="button"
                onClick={() => setActiveInsightTab('strengths')}
                className={`py-1.5 rounded-xl transition-all cursor-pointer text-center ${
                  activeInsightTab === 'strengths'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Strengths
              </button>
              <button
                type="button"
                onClick={() => setActiveInsightTab('gaps')}
                className={`py-1.5 rounded-xl transition-all cursor-pointer text-center ${
                  activeInsightTab === 'gaps'
                    ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/20'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Gaps
              </button>
              <button
                type="button"
                onClick={() => setActiveInsightTab('next_steps')}
                className={`py-1.5 rounded-xl transition-all cursor-pointer text-center ${
                  activeInsightTab === 'next_steps'
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Action Plan
              </button>
            </div>

            {/* Interactive Tab Content */}
            <div className="mt-3 print:hidden">
              <AnimatePresence mode="wait">
                {activeInsightTab === 'strengths' && (
                  <motion.div
                    key="strengths"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="space-y-2"
                  >
                    {(summary?.top_strengths || session?.strength_areas || []).slice(0, 3).map((s, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-xs font-bold text-emerald-950 shadow-2xs">
                        <TrendingUp size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span>{s}</span>
                      </div>
                    ))}
                    {!(summary?.top_strengths || session?.strength_areas)?.length && (
                      <p className="text-xs text-slate-400 italic py-4 text-center">Consistent performance across areas.</p>
                    )}
                  </motion.div>
                )}

                {activeInsightTab === 'gaps' && (
                  <motion.div
                    key="gaps"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="space-y-2"
                  >
                    {(summary?.critical_gaps || session?.weakness_areas || []).slice(0, 3).map((g, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-2xl bg-rose-50/80 border border-rose-200/80 text-xs font-bold text-rose-950 shadow-2xs">
                        <TrendingDown size={14} className="text-rose-600 shrink-0 mt-0.5" />
                        <span>{g}</span>
                      </div>
                    ))}
                    {!(summary?.critical_gaps || session?.weakness_areas)?.length && (
                      <p className="text-xs text-slate-400 italic py-4 text-center">No critical gaps detected.</p>
                    )}
                  </motion.div>
                )}

                {activeInsightTab === 'next_steps' && (
                  <motion.div
                    key="next_steps"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="space-y-2"
                  >
                    {(summary?.next_steps || []).slice(0, 3).map((n, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 text-xs font-bold text-indigo-950 shadow-2xs">
                        <Rocket size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                        <span>{n}</span>
                      </div>
                    ))}
                    {!summary?.next_steps?.length && (
                      <p className="text-xs text-slate-400 italic py-4 text-center">Review the question cards below for targeted practice.</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Print View: Full text */}
            <div className="hidden print:block space-y-2 mt-2">
              <div className="p-2 rounded-lg bg-emerald-50 text-[10px] text-emerald-900 font-semibold">
                <strong>Strengths:</strong> {(summary?.top_strengths || session?.strength_areas || []).join(', ') || 'Solid competence'}
              </div>
              <div className="p-2 rounded-lg bg-rose-50 text-[10px] text-rose-900 font-semibold">
                <strong>Gaps:</strong> {(summary?.critical_gaps || session?.weakness_areas || []).join(', ') || 'None'}
              </div>
              <div className="p-2 rounded-lg bg-indigo-50 text-[10px] text-indigo-900 font-semibold">
                <strong>Plan:</strong> {(summary?.next_steps || []).join(', ') || 'Practice technical questions'}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-purple-100 flex items-center justify-between text-[11px] print:hidden">
            <span className="text-slate-400 font-medium">Evaluation Standard</span>
            <span className="text-purple-600 font-black">100% Calibrated</span>
          </div>
        </motion.div>

      </div>

      {/* ── 2. Sticky Stacking Cards Section with Top Quick Jump Bar ── */}
      <div className="space-y-4">
        
        {/* Sticky Control Header with Question Quick-Jump Pills & Filter */}
        <div className="sticky top-2 z-20 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          
          {/* Left: Title & Quick Jump Pills */}
          <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar py-0.5 max-w-full">
            <div className="flex items-center gap-1.5 shrink-0">
              <Layers size={16} className="text-indigo-600" />
              <span className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                Questions ({answers.length})
              </span>
            </div>

            {/* Question Quick Jump Pills */}
            <div className="flex items-center gap-1.5 shrink-0 print:hidden">
              {answers.map((item, i) => {
                const s = Math.round(item.evaluation?.overall_score || 0)
                const dotColor = getScoreColor(s)
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => scrollToQuestion(i)}
                    title={`Jump to Question ${i + 1} (Score: ${s}%)`}
                    className="px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-[11px] font-black text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
                    <span>Q{i + 1}</span>
                    <span className="text-[10px] text-slate-400">({s}%)</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right: Search & Filters */}
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Search question..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-3 py-1 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-medium w-36 sm:w-48 transition-all"
              />
            </div>

            <div className="inline-flex p-1 bg-slate-100 rounded-xl text-[10px] sm:text-[11px] font-bold">
              {[
                ['ALL', 'All'],
                ['TECHNICAL', 'Technical'],
                ['BEHAVIORAL', 'Behavioral'],
                ['HIGH', '≥80%'],
                ['LOW', '<60%'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedFilter(key)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    selectedFilter === key
                      ? 'bg-white text-indigo-700 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stacking Cards Deck Container */}
        <div className="relative pt-2 pb-8">
          {filteredAnswers.map((item, i) => {
            const originalIndex = answers.indexOf(item)
            const resolvedIdx = originalIndex >= 0 ? originalIndex : i
            return (
              <SmoothStackingQuestionCard
                key={resolvedIdx}
                item={item}
                index={resolvedIdx}
                total={answers.length}
              />
            )
          })}

          {filteredAnswers.length === 0 && (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-200/80 text-slate-400 text-xs font-semibold shadow-xs">
              No questions found for the selected filter or search keyword.
            </div>
          )}
        </div>

      </div>

      {/* ── 3. Bottom Action Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 print:hidden">
        <button
          type="button"
          onClick={handlePrint}
          className="py-2.5 px-4 rounded-xl font-extrabold text-xs text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 transition-all cursor-pointer inline-flex items-center gap-2 shadow-2xs active:scale-95"
        >
          <Printer size={14} className="text-indigo-600" />
          <span>Export Full PDF Report</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRestart}
            className="py-2.5 px-4 rounded-xl font-bold text-xs text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 transition-all cursor-pointer inline-flex items-center gap-2 shadow-2xs active:scale-95"
          >
            <RotateCcw size={14} /> Start New Practice Session
          </button>
          <Link
            to="/interview"
            className="py-2.5 px-5 rounded-xl font-extrabold text-xs text-white transition-all bg-gradient-to-r from-indigo-600 via-indigo-700 to-[#2E9BDA] hover:from-indigo-700 hover:to-[#2380b8] flex items-center gap-2 shadow-md shadow-indigo-500/20 active:scale-95"
          >
            <span>Interview Hub</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

    </div>
  )
}