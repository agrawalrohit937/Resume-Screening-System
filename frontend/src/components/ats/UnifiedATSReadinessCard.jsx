import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Sparkles,
  Download,
  Target,
  Briefcase,
  GraduationCap,
  RotateCcw,
  ArrowLeft,
  Copy,
  Check,
  Loader2
} from 'lucide-react'
import ScoreRing from '../ScoreRing'
import { dedupeCaseInsensitive } from './ATSHelpers'

export default function UnifiedATSReadinessCard({
  result,
  onEnhance,
  onDownloadPDF,
  onReset,
  enhancing,
  generatingPDF
}) {
  const [activeTab, setActiveTab] = useState('fixes')
  const [copiedText, setCopiedText] = useState('')

  // ── Core Calculations ─────────────────────────────────────────────────────
  const finalScore = Math.round(result?.final_score ?? result?.match_score ?? 0)
  const isKnockout = !!result?.is_knockout
  const knockoutReasons = result?.knockout_reasons || []

  const strictAtsScore = Math.round(result?.strict_ats_score ?? result?.keyword_score ?? Math.round(finalScore * 0.9))
  const vectorScore = Math.round(result?.vector_score ?? (finalScore >= 80 ? Math.min(finalScore + 5, 98) : Math.min(finalScore + 10, 92)))

  // ── UNIFIED SKILLS & KEYWORDS ───────────
  const matchedSkillsRaw = dedupeCaseInsensitive(result?.matched_skills || [])
  const missingSkillsRaw = dedupeCaseInsensitive(result?.missing_skills || [])
  const strictMatchedKeywords = dedupeCaseInsensitive(result?.strict_matched_keywords || [])
  const strictMissingKeywords = dedupeCaseInsensitive(result?.strict_missing_keywords || [])

  const unifiedMatched = useMemo(() => {
    const combined = [...matchedSkillsRaw, ...strictMatchedKeywords]
    return dedupeCaseInsensitive(combined)
  }, [matchedSkillsRaw, strictMatchedKeywords])

  const unifiedMissing = useMemo(() => {
    const combined = [...missingSkillsRaw, ...strictMissingKeywords]
    const matchedLower = new Set(unifiedMatched.map(s => s.toLowerCase().trim()))
    return dedupeCaseInsensitive(combined).filter(s => !matchedLower.has(s.toLowerCase().trim()))
  }, [missingSkillsRaw, strictMissingKeywords, unifiedMatched])

  const totalUnifiedCount = unifiedMatched.length + unifiedMissing.length
  const skillCoveragePct = totalUnifiedCount > 0 ? Math.round((unifiedMatched.length / totalUnifiedCount) * 100) : Math.round(result?.skills_score ?? 0)

  // ── Diagnostics ───────────────────────────────────────────────────────────
  const parsingIsHealthy = result?.parsing_is_healthy ?? true
  const parsingConfidence = typeof result?.parsing_confidence === 'number' ? result.parsing_confidence : 0.94

  const expScore = Math.round((result?.experience_score ?? 75) <= 1.0 ? (result?.experience_score ?? 75) * 100 : (result?.experience_score ?? 75))
  const eduScore = Math.round((result?.education_score ?? 85) <= 1.0 ? (result?.education_score ?? 85) * 100 : (result?.education_score ?? 85))

  const expIsLow = expScore < 70
  const eduIsInProgress = Boolean(
    result?.is_in_progress ||
    result?.education_status === 'in_progress' ||
    result?.features?.is_in_progress ||
    result?.education_label === 'Degree in Progress' ||
    result?.eligibility?.checks?.some(c => c.rule_id === 'degree_level' && (c.observed || c.status_label || '').toLowerCase().includes('in progress')) ||
    (result?.extracted_data?.education || []).some(e => /pursuing|expected|in[\s-]progress|202[6-9]|203\d/i.test(JSON.stringify(e)))
  )

  const eduIsLow = eduScore < 70 && !eduIsInProgress
  const eduSubtext = eduIsInProgress ? 'Degree in Progress' : (eduIsLow ? 'Degree Mismatch' : 'Degree Aligned')

  const actionableSuggestions = [...(result?.feedback_suggestions || [])]
  if (expIsLow && !actionableSuggestions.some(s => (s || '').toLowerCase().includes('experience'))) {
    actionableSuggestions.push('Experience duration is below target: Add verified internship achievements or project bullet points to compensate.')
  }
  if (eduIsLow && !actionableSuggestions.some(s => (s || '').toLowerCase().includes('education'))) {
    actionableSuggestions.push('Education differs from target requirements: Highlight specialized coursework, capstones, or certifications.')
  }

  const formatActionableFix = (text) => {
    if (!text) return { category: 'ATS SUGGESTION', type: 'general', text: '', accent: 'bg-slate-100 text-slate-700 border-slate-200' }
    const lower = text.toLowerCase()

    // 1. Positive Reinforcement / Strengths / Skill Match
    const isPositive =
      lower.includes('strong technical alignment') ||
      lower.includes('high skill relevance') ||
      lower.includes('strong alignment') ||
      lower.includes('skill match') ||
      lower.includes('strength') ||
      lower.includes('exceptional fit') ||
      lower.includes('target met') ||
      lower.includes('well aligned') ||
      lower.includes('well-aligned') ||
      (lower.includes('strong') && !lower.includes('missing') && !lower.includes('below') && !lower.includes('gap'))

    if (isPositive) {
      const category = (lower.includes('skill') || lower.includes('technical') || unifiedMissing.length === 0)
        ? 'SKILL MATCH'
        : 'STRENGTH'
      return { category, text, accent: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
    }

    // 2. Degree in Progress / Education
    if (lower.includes('degree in progress') || lower.includes('in progress') || lower.includes('pursuing')) {
      return { category: 'DEGREE IN PROGRESS', text, accent: 'bg-indigo-100 text-indigo-800 border-indigo-200' }
    }
    if (lower.includes('education') || lower.includes('degree')) {
      return { category: 'EDUCATION', text, accent: 'bg-indigo-100 text-indigo-800 border-indigo-200' }
    }

    // 3. Experience & Tenure
    if (lower.includes('experience') || lower.includes('tenure') || lower.includes('internship')) {
      return { category: 'EXPERIENCE', text, accent: 'bg-amber-100 text-amber-800 border-amber-200' }
    }

    // 4. Actual Skill Gap / Missing Critical Skills
    const isSkillGap =
      lower.includes('missing mandatory skills') ||
      lower.includes('missing skill') ||
      lower.includes('missing requirement') ||
      lower.includes('skill gap') ||
      (lower.includes('missing') && lower.includes('skill')) ||
      (lower.includes('add') && lower.includes('skill'))

    if (isSkillGap || lower.includes('missing')) {
      return { category: 'SKILL GAP', text, accent: 'bg-rose-100 text-rose-800 border-rose-200' }
    }

    // 5. General ATS Optimization / Suggestions
    return { category: 'ATS SUGGESTION', text, accent: 'bg-sky-100 text-[#2E9BDA] border-sky-200' }
  }

  const formattedSuggestions = actionableSuggestions.map(formatActionableFix)

  const handleCopy = (text) => {
    if (!text) return
    navigator.clipboard?.writeText(text)
    setCopiedText(text)
    toast.success('Copied to clipboard!', { icon: '📋', duration: 1800 })
    setTimeout(() => setCopiedText(''), 1800)
  }

  const getRatingTier = (score) => {
    if (score >= 85) return { label: 'Exceptional Fit', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
    if (score >= 70) return { label: 'Strong Match', color: 'text-sky-700 bg-sky-50 border-sky-200' }
    if (score >= 50) return { label: 'Moderate Fit', color: 'text-amber-700 bg-amber-50 border-amber-200' }
    return { label: 'Needs Action', color: 'text-rose-700 bg-rose-50 border-rose-200' }
  }
  const ratingTier = getRatingTier(finalScore)

  const TABS = [
    { id: 'fixes', icon: Sparkles, label: `Action Plan (${formattedSuggestions.length})` },
    { id: 'skills', icon: Target, label: `Skills & Match Analysis` }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl shadow-slate-900/5 overflow-hidden font-sans"
    >
      {/* ── 1. Status Banner ── */}
      <div className={`px-6 sm:px-8 py-4.5 flex items-center justify-between border-b transition-all duration-300 ${isKnockout && knockoutReasons.length > 0 ? '' : 'mb-6 sm:mb-8'} ${isKnockout ? 'bg-rose-50/90 border-rose-100 hover:bg-rose-50' : 'bg-slate-50/90 border-slate-100 hover:bg-slate-50'}`}>
        <div className="flex items-center gap-3.5 group cursor-default">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-transform duration-300 group-hover:scale-105 ${isKnockout ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {isKnockout ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />}
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              {isKnockout ? 'Knockout Disqualifier Detected' : 'Enterprise Gate Cleared'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              {isKnockout ? 'Hard requirement unmet. Check details below.' : 'High probability of clearing automated resume screening filters.'}
            </p>
          </div>
        </div>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-xs sm:text-sm font-bold bg-white hover:bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer shrink-0 group"
          >
            <RotateCcw size={14} className="transition-transform duration-300 group-hover:-rotate-45" /> <span>New Scan</span>
          </button>
        )}
      </div>

      {isKnockout && knockoutReasons.length > 0 && (
        <div className="px-6 sm:px-8 py-3.5 mb-6 sm:mb-8 bg-rose-50 border-b border-rose-100 text-sm font-medium">
          <p className="font-bold text-rose-800 mb-1 flex items-center gap-1.5">
            <AlertTriangle size={16} className="text-rose-600" /> Disqualifiers:
          </p>
          <ul className="list-disc list-inside text-rose-700 space-y-1 ml-1">
            {knockoutReasons.map((reason, idx) => <li key={idx}>{reason}</li>)}
          </ul>
        </div>
      )}

      {/* ── 2. Premium Bento Grid ── */}
      <div className="p-6 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-5 bg-white border-b border-slate-100 items-stretch">
        
        {/* Left: Composite Score Card */}
        <div className="lg:col-span-4 flex flex-col items-center justify-between p-6 sm:p-7 bg-gradient-to-b from-slate-50/80 via-white to-slate-50/40 rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xl hover:border-slate-300 transition-all duration-300 ease-out hover:-translate-y-1 relative overflow-hidden group h-full cursor-default">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute -top-12 -left-12 w-36 h-36 bg-emerald-400/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-500 pointer-events-none" />

          <span className="text-xs font-black text-slate-400 uppercase tracking-widest px-3.5 py-1 bg-white border border-slate-200/80 rounded-full shadow-2xs group-hover:border-slate-300 transition-colors z-10">
            MATCH SCORE
          </span>

          <div className="py-2 transform group-hover:scale-105 transition-transform duration-300 z-10">
            <ScoreRing score={finalScore} size={155} strokeWidth={12} label="" />
          </div>

          <div className="text-center w-full z-10">
            <span className={`inline-block px-5 py-1.5 rounded-full text-xs sm:text-sm font-black tracking-widest uppercase border shadow-2xs transform group-hover:scale-105 transition-transform duration-300 ${ratingTier.color}`}>
              {ratingTier.label}
            </span>
            <p className="text-xs text-slate-400 font-semibold mt-2">
              Based on skills, experience &amp; degree fit
            </p>
          </div>
        </div>

        {/* Right: Modern Metric Cards */}
        <div className="lg:col-span-8 flex flex-col justify-between gap-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-xl hover:border-slate-300 hover:-translate-y-1.5 transition-all duration-300 ease-out flex items-center justify-between group relative overflow-hidden cursor-default">
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-slate-400/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div className="relative z-10">
                <h4 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">Strict ATS Match</h4>
                <p className="text-xs text-slate-400 font-medium mt-1">Workday / Taleo filters</p>
              </div>
              <span className="text-3xl sm:text-4xl font-black text-slate-900 font-display tracking-tight group-hover:text-slate-950 group-hover:scale-105 transition-all duration-300 relative z-10">{strictAtsScore}%</span>
            </div>

            <div className="p-5 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/70 via-white to-sky-50/30 shadow-2xs hover:shadow-xl hover:border-sky-300 hover:-translate-y-1.5 transition-all duration-300 ease-out flex items-center justify-between group relative overflow-hidden cursor-default">
              <div className="absolute -right-6 -top-6 w-28 h-28 bg-[#2E9BDA]/15 rounded-full blur-2xl group-hover:bg-[#2E9BDA]/25 transition-all duration-300 pointer-events-none" />
              <div className="relative z-10">
                <h4 className="text-xs sm:text-sm font-black text-[#2E9BDA] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={15} className="group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300" /> Semantic AI Match
                </h4>
                <p className="text-xs text-sky-600/80 font-medium mt-1">Contextual vector similarity</p>
              </div>
              <span className="text-3xl sm:text-4xl font-black text-[#2E9BDA] font-display tracking-tight group-hover:scale-105 transition-transform duration-300 relative z-10">{vectorScore}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 flex-1">
            {[
              {
                icon: Target,
                label: 'Skills',
                val: skillCoveragePct,
                isHealthy: true,
                subtext: `${unifiedMatched.length}/${totalUnifiedCount} matched`,
                colors: 'bg-sky-50 text-[#2E9BDA] border border-sky-100',
                borderHover: 'hover:border-sky-300',
                glow: 'bg-sky-400/15',
                gradient: 'from-sky-50/50 via-transparent to-transparent',
                bar: 'bg-[#2E9BDA]'
              },
              {
                icon: FileText,
                label: 'Format',
                val: Math.round(parsingConfidence * 100),
                isHealthy: parsingIsHealthy,
                subtext: parsingIsHealthy ? 'Clean layout' : 'Layout alert',
                colors: parsingIsHealthy ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100',
                borderHover: parsingIsHealthy ? 'hover:border-emerald-300' : 'hover:border-amber-300',
                glow: parsingIsHealthy ? 'bg-emerald-400/15' : 'bg-amber-400/15',
                gradient: parsingIsHealthy ? 'from-emerald-50/50 via-transparent to-transparent' : 'from-amber-50/50 via-transparent to-transparent',
                bar: parsingIsHealthy ? 'bg-emerald-500' : 'bg-amber-500'
              },
              {
                icon: Briefcase,
                label: 'Exp',
                val: expScore,
                isHealthy: !expIsLow,
                subtext: expIsLow ? 'Tenure deficit' : 'Target met',
                colors: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
                borderHover: 'hover:border-indigo-300',
                glow: 'bg-indigo-400/15',
                gradient: 'from-indigo-50/50 via-transparent to-transparent',
                bar: expIsLow ? 'bg-amber-500' : 'bg-indigo-600'
              },
              {
                icon: GraduationCap,
                label: 'Edu',
                val: eduScore,
                isHealthy: !eduIsLow,
                subtext: eduSubtext,
                colors: 'bg-purple-50 text-purple-600 border border-purple-100',
                borderHover: 'hover:border-purple-300',
                glow: 'bg-purple-400/15',
                gradient: 'from-purple-50/50 via-transparent to-transparent',
                bar: eduIsLow ? 'bg-amber-500' : 'bg-purple-600'
              }
            ].map((stat, idx) => (
              <div
                key={idx}
                className={`p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-white hover:bg-white shadow-2xs hover:shadow-xl flex flex-col justify-between h-full group relative overflow-hidden transition-all duration-300 ease-out hover:-translate-y-1.5 cursor-default ${stat.borderHover}`}
              >
                {/* Background Glow / Gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
                <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${stat.glow}`} />

                {/* Top: Icon at top-left with subtle hover scale */}
                <div className="flex items-start justify-between w-full relative z-10">
                  <div className={`w-9 h-9 rounded-xl ${stat.colors} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-2xs`}>
                    <stat.icon size={17} />
                  </div>
                </div>

                {/* Middle: Balanced center percentage */}
                <div className="flex items-center justify-center flex-1 my-3 sm:my-3.5 relative z-10">
                  <span className={`text-3xl sm:text-4xl font-extrabold font-display tracking-tight transition-colors duration-300 ${!stat.isHealthy ? 'text-amber-600' : 'text-slate-800'}`}>
                    {stat.val}%
                  </span>
                </div>

                {/* Bottom: Labels and progress bar */}
                <div className="w-full mt-auto relative z-10">
                  <div className="flex items-center justify-between mb-1.5 text-xs">
                    <span className="font-bold text-slate-800">{stat.label}</span>
                    <span className="text-slate-400 font-semibold text-[11px] truncate max-w-[90px]">{stat.subtext}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${stat.bar}`} style={{ width: `${stat.val}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── 3. Unified Two-Tab Navigation ── */}
      <div className="px-6 sm:px-8 py-3.5 border-b border-slate-100 bg-white flex items-center justify-between">
        <div className="flex gap-2 p-1.5 bg-slate-100/70 rounded-2xl">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative px-5 py-2.5 text-sm font-bold transition-colors rounded-xl outline-none cursor-pointer"
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="active-tab-glow"
                  className="absolute inset-0 bg-white shadow-xs rounded-xl border border-slate-200/60"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className={`relative z-10 flex items-center gap-2 ${activeTab === tab.id ? 'text-[#2E9BDA]' : 'text-slate-500 hover:text-slate-800'}`}>
                <tab.icon size={16} />
                {tab.label}
              </span>
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 font-medium hidden md:inline-block">Click any keyword to copy</span>
      </div>

      {/* ── 4. Dynamic Tab Content (No Artificial Empty Space) ── */}
      <div className="p-5 sm:p-6 bg-slate-50/40">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: Action Roadmap */}
          {activeTab === 'fixes' && (
            <motion.div key="fixes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4 w-full">
              
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-lg hover:border-slate-300 transition-all duration-300 group relative overflow-hidden space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                  <Sparkles size={15} className="text-[#2E9BDA] group-hover:rotate-12 transition-transform duration-300" />
                  <span>AI Enhancement Transformation Demo</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="p-4 bg-slate-50/80 hover:bg-rose-50/30 border border-slate-200/80 hover:border-rose-200 rounded-xl relative mt-1 transition-all duration-300 group/orig hover:shadow-xs">
                    <span className="absolute -top-2.5 left-3 px-2.5 py-0.5 bg-white border border-slate-200 text-rose-500 text-[10px] font-bold uppercase tracking-wider rounded-md shadow-2xs">Original</span>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 line-through leading-relaxed">
                      "Worked on improving frontend performance and reducing load times."
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/30 hover:from-emerald-50 hover:to-emerald-50/50 border border-emerald-200/80 hover:border-emerald-300 rounded-xl relative mt-1 transition-all duration-300 group/opt hover:shadow-xs">
                    <span className="absolute -top-2.5 left-3 px-2.5 py-0.5 bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-bold uppercase tracking-wider rounded-md shadow-2xs">Optimized</span>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 mt-1 leading-relaxed">
                      ✓ "Refactored React bundle delivery via code-splitting, reducing initial payload by 1.6MB and lifting Lighthouse score to 94."
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 w-full">
                {formattedSuggestions.map((item, idx) => (
                  <motion.div
                    whileHover={{ y: -2 }}
                    key={idx}
                    className="p-4 sm:p-4.5 bg-white hover:bg-slate-50/50 border border-slate-200/80 hover:border-slate-300 rounded-2xl flex items-start justify-between gap-4 shadow-2xs hover:shadow-md transition-all duration-300 group relative overflow-hidden cursor-default"
                  >
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-xl bg-slate-100 group-hover:bg-[#2E9BDA] text-slate-700 group-hover:text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5 transition-colors duration-300 shadow-2xs">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border mb-1.5 shadow-2xs ${item.accent}`}>
                          {item.category}
                        </span>
                        <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                          {item.text}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(item.text)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-[#2E9BDA] text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0 cursor-pointer shadow-2xs"
                      title="Copy recommendation"
                    >
                      <Copy size={13} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 2: UNIFIED Skills & Match Analysis */}
          {activeTab === 'skills' && (
            <motion.div key="skills" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 w-full">
              
              {/* Section: Successfully Matched */}
              <div>
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600"/> 
                  Successfully Matched Requirements ({unifiedMatched.length})
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 w-full">
                  {unifiedMatched.map((kw, i) => (
                    <motion.div
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      key={i}
                      onClick={() => handleCopy(kw)}
                      className="p-3.5 rounded-xl border bg-white border-slate-200/80 hover:border-emerald-400 hover:bg-emerald-50/20 transition-all duration-200 cursor-pointer flex items-center justify-between shadow-2xs hover:shadow-md group"
                    >
                      <span className="text-xs sm:text-sm font-bold text-slate-800 truncate mr-2 group-hover:text-slate-900">{kw}</span>
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0 group-hover:scale-110 transition-transform duration-200" />
                    </motion.div>
                  ))}
                </div>
                {unifiedMatched.length === 0 && <p className="text-xs text-slate-500 italic">No exact matches found.</p>}
              </div>

              {/* Section: Missing Requirements */}
              {unifiedMissing.length > 0 && (
                <div>
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-rose-600"/> 
                    Missing Requirements ({unifiedMissing.length})
                  </h5>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 w-full">
                    {unifiedMissing.map((kw, i) => (
                      <motion.div
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        key={i}
                        onClick={() => handleCopy(kw)}
                        className="p-3.5 rounded-xl border bg-rose-50/40 border-rose-200/70 hover:bg-rose-50 hover:border-rose-400 transition-all duration-200 cursor-pointer flex items-center justify-between shadow-2xs hover:shadow-md group"
                      >
                        <span className="text-xs sm:text-sm font-bold text-slate-800 truncate mr-2">{kw}</span>
                        <span className="text-[10px] font-black px-2 py-0.5 bg-white text-rose-600 border border-rose-200 group-hover:bg-rose-600 group-hover:text-white group-hover:border-rose-600 rounded-md font-mono shrink-0 shadow-2xs transition-colors duration-200">
                          + ADD
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── 5. Action Footer ── */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-50 via-white to-sky-50/40 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h5 className="text-sm sm:text-base font-black text-slate-900">Maximize Interview Callbacks</h5>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">Auto-infuse missing keywords into tailored bullet points instantly.</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border border-slate-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            >
              <RotateCcw size={15} />
              <span>Start New Scan</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDownloadPDF}
            disabled={generatingPDF}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border border-slate-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            {generatingPDF ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={onEnhance}
            disabled={enhancing}
            className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-[#2E9BDA] via-[#248ac3] to-[#1a6ea6] hover:from-[#2891cf] hover:to-[#176294] text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md shadow-[#2E9BDA]/25 hover:shadow-lg hover:shadow-[#2E9BDA]/35 transition-all duration-200 transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            {enhancing ? (
              <><Loader2 size={15} className="animate-spin" /> Enhancing...</>
            ) : (
              <><Sparkles size={15} className="animate-pulse" /> <span>Auto-Enhance Resume</span></>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}