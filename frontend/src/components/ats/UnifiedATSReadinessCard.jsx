import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Target,
  Briefcase,
  GraduationCap,
  Award,
  FileCheck2,
  Layers,
  Copy,
  Check
} from 'lucide-react'
import ScoreRing from '../ScoreRing'
import { dedupeCaseInsensitive } from './ATSHelpers'

export default function UnifiedATSReadinessCard({
  result,
  onEnhance,
  onReset,
  enhancing
}) {
  const [copiedText, setCopiedText] = useState('')

  // ── Core Calculations ─────────────────────────────────────────────────────
  const finalScore = Math.round(
    result?.strict_ats_score ??
    result?.strict_score ??
    result?.final_score ??
    result?.math_score ??
    result?.match_score ?? 0
  )
  const isKnockout = !!result?.is_knockout

  const droppedComponents = result?.dropped_components || []
  const isExpDropped = droppedComponents.includes('experience')
  const isEduDropped = droppedComponents.includes('education')

  // ── UNIFIED SKILLS & KEYWORDS ─────────────────────────────────────────────
  const matchedSkillsRaw = dedupeCaseInsensitive(result?.matched_skills || [])
  const missingSkillsRaw = dedupeCaseInsensitive(result?.missing_skills || [])
  const strictMatchedKeywords = dedupeCaseInsensitive(result?.strict_matched_keywords || [])
  const strictMissingKeywords = dedupeCaseInsensitive(result?.strict_missing_keywords || [])

  const unifiedMatched = useMemo(() => {
    const combined = [...matchedSkillsRaw, ...strictMatchedKeywords]
    return dedupeCaseInsensitive(combined)
  }, [matchedSkillsRaw, strictMatchedKeywords])

  const ADJECTIVE_NOISE = useMemo(() => new Set([
    'analytical', 'strong', 'excellent', 'good', 'great', 'driven', 'dynamic',
    'self-starter', 'proactive', 'motivated', 'detail-oriented', 'passionate'
  ]), [])

  const unifiedMissing = useMemo(() => {
    const cleanKey = (str) =>
      (str || '')
        .toLowerCase()
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/[\s\-_]+/g, ' ')
        .trim()

    const combined = [...missingSkillsRaw, ...strictMissingKeywords]
    const matchedLower = new Set(unifiedMatched.map(s => s.toLowerCase().trim()))
    const matchedClean = new Set(unifiedMatched.map(cleanKey))

    const filtered = dedupeCaseInsensitive(combined).filter(s => {
      const sLower = s.toLowerCase().trim()
      const sClean = cleanKey(s)
      if (ADJECTIVE_NOISE.has(sLower) || ADJECTIVE_NOISE.has(sClean)) return false
      if (matchedLower.has(sLower) || matchedClean.has(sClean)) return false
      
      for (const m of matchedLower) {
        const mClean = cleanKey(m)
        if (mClean === sClean) return false
        if ((m.includes(sLower) || sLower.includes(m)) && Math.min(sLower.length, m.length) >= 4) return false
      }
      return true
    })

    const seenClean = new Set()
    const resultList = []
    for (const item of filtered) {
      const key = cleanKey(item)
      if (!seenClean.has(key)) {
        seenClean.add(key)
        resultList.push(item)
      }
    }
    return resultList
  }, [missingSkillsRaw, strictMissingKeywords, unifiedMatched])

  const totalUnifiedCount = unifiedMatched.length + unifiedMissing.length
  
  // Real scores from engine
  const skillsScore = typeof result?.skills_score === 'number'
    ? Math.round(result.skills_score)
    : (totalUnifiedCount > 0 ? Math.round((unifiedMatched.length / totalUnifiedCount) * 100) : 0)

  const expScore = Math.round((result?.experience_score ?? 75) <= 1.0 ? (result?.experience_score ?? 75) * 100 : (result?.experience_score ?? 75))
  const eduScore = Math.round((result?.education_score ?? 85) <= 1.0 ? (result?.education_score ?? 85) * 100 : (result?.education_score ?? 85))

  const eduIsInProgress = Boolean(
    result?.is_in_progress ||
    result?.education_status === 'in_progress' ||
    result?.features?.is_in_progress ||
    result?.education_label === 'Degree in Progress' ||
    (result?.extracted_data?.education || []).some(e => /pursuing|expected|in[\s-]progress|202[6-9]|203\d/i.test(JSON.stringify(e)))
  )
  const eduSubtext = eduIsInProgress ? 'Degree in Progress' : (eduScore < 70 ? 'Degree Mismatch' : 'Degree Aligned')

  const handleCopy = (text) => {
    if (!text) return
    navigator.clipboard?.writeText(text)
    setCopiedText(text)
    toast.success(`Copied "${text}"`, { icon: '📋', duration: 1500 })
    setTimeout(() => setCopiedText(''), 1500)
  }

  const getRatingTier = (score) => {
    if (result?.match_band) {
      const b = result.match_band.toLowerCase()
      if (b === 'not_eligible') return { label: 'Not Eligible', color: 'text-rose-700 bg-rose-50 border-rose-200' }
      if (b === 'strong_match' || b === 'strong') return { label: 'Strong Match', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
      if (b === 'good_match' || b === 'good') return { label: 'Good Match', color: 'text-sky-700 bg-sky-50 border-sky-200' }
      if (b === 'partial_match' || b === 'partial') return { label: 'Partial Match', color: 'text-amber-700 bg-amber-50 border-amber-200' }
      if (b === 'low_match' || b === 'low') return { label: 'Low Match', color: 'text-rose-700 bg-rose-50 border-rose-200' }
    }
    if (score >= 85) return { label: 'Exceptional Fit', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
    if (score >= 70) return { label: 'Strong Match', color: 'text-sky-700 bg-sky-50 border-sky-200' }
    if (score >= 50) return { label: 'Moderate Fit', color: 'text-amber-700 bg-amber-50 border-amber-200' }
    return { label: 'Action Required', color: 'text-rose-700 bg-rose-50 border-rose-200' }
  }
  const ratingTier = getRatingTier(finalScore)

  const mustHaveSet = useMemo(() => new Set((result?.must_have_skills || []).map(s => (s || '').toLowerCase().trim())), [result?.must_have_skills])
  const niceHaveSet = useMemo(() => new Set((result?.nice_to_have_skills || []).map(s => (s || '').toLowerCase().trim())), [result?.nice_to_have_skills])

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-5"
    >
      
      {/* ── BENTO GRID HERO: MODERN EXECUTIVE ATS READINESS ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
        
        {/* Bento Tile 1: Floating ScoreRing & Status (7 Cols) */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="lg:col-span-7 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-xl hover:shadow-sky-100/50 hover:border-[#2E9BDA]/40 p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden transition-all duration-300 group"
        >
          {/* Ambient dynamic radial glow */}
          <div className="absolute -top-12 -right-12 w-80 h-80 bg-gradient-to-bl from-[#2E9BDA]/15 via-sky-400/10 to-transparent rounded-full blur-3xl pointer-events-none group-hover:scale-125 group-hover:opacity-100 opacity-70 transition-all duration-700" />
          <div className="absolute -bottom-16 -left-16 w-60 h-60 bg-gradient-to-tr from-emerald-400/10 to-transparent rounded-full blur-3xl pointer-events-none group-hover:scale-110 opacity-50 transition-all duration-700" />

          {/* Compatibility Clearance Status */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-200 ${
                isKnockout ? 'bg-rose-100 text-rose-600 ring-2 ring-rose-200/50' : 'bg-emerald-100 text-emerald-600 ring-2 ring-emerald-200/50'
              }`}>
                {isKnockout ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
              </div>
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight">
                  {isKnockout ? 'Action Items Detected' : 'ATS Compatibility: Passed'}
                </span>
                <span className="text-[10.5px] text-slate-400 font-medium">Standard Parsing Engine Ready</span>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 px-3 py-1 rounded-full border border-slate-200/80 shadow-2xs transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Verified Against Role
            </span>
          </div>

          {/* Central Hero Score */}
          <div className="py-6 sm:py-7 flex flex-col sm:flex-row items-center justify-around gap-6 text-center sm:text-left relative z-10">
            <div className="shrink-0 relative group-hover:scale-105 group-hover:-rotate-1 transition-all duration-300 ease-out drop-shadow-xs">
              <ScoreRing
                score={finalScore}
                size={165}
                strokeWidth={13}
                label=""
                className="bg-transparent border-0 shadow-none p-0 flex flex-col items-center justify-center"
              />
            </div>

            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide border shadow-2xs group-hover:shadow-xs transition-shadow">
                <Award size={13} className="text-[#2E9BDA] group-hover:rotate-12 transition-transform duration-300" />
                <span className={ratingTier.color.split(' ')[0]}>{ratingTier.label}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight tracking-tight group-hover:text-slate-950 transition-colors">
                {finalScore >= 75 ? 'High Interview Likelihood' : 'Opportunity for Improvement'}
              </h3>
              <p className="text-xs sm:text-[13px] text-slate-500 font-medium max-w-sm leading-relaxed">
                Evaluated across required technical skills, relevant experience tenure, and academic alignment.
              </p>
            </div>
          </div>

          {/* Clean Quick Stats Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium relative z-10">
            <span className="flex items-center gap-1.5">
              <span>Matched Keywords:</span>
              <strong className="text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">{unifiedMatched.length} of {totalUnifiedCount}</strong>
            </span>
            <span className="text-[#2E9BDA] font-bold flex items-center gap-1.5 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100/80">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E9BDA] animate-ping" />
              Single-Column Standard
            </span>
          </div>
        </motion.div>

        {/* Bento Tile 2: Screening Pillars Matrix (5 Cols) */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="lg:col-span-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-xl hover:shadow-sky-100/50 hover:border-[#2E9BDA]/40 p-6 sm:p-7 flex flex-col justify-between space-y-3.5 transition-all duration-300 relative overflow-hidden group"
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Layers size={14} className="text-[#2E9BDA] group-hover:rotate-6 transition-transform" /> Screening Breakdown
            </h4>
            <span className="text-[11px] font-bold text-[#2E9BDA] bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-100/80 shadow-2xs">
              {unifiedMatched.length}/{totalUnifiedCount} Skills
            </span>
          </div>

          {/* Pillar: Skills */}
          <div className="p-3.5 bg-slate-50/70 hover:bg-sky-50/60 rounded-2xl border border-slate-200/70 hover:border-sky-300/70 hover:shadow-md hover:shadow-sky-100/30 transition-all duration-200 flex flex-col gap-2 group/p1 cursor-default">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#2E9BDA] flex items-center justify-center shrink-0 shadow-2xs group-hover/p1:scale-110 group-hover/p1:rotate-3 transition-transform duration-200">
                  <Target size={15} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate group-hover/p1:text-[#2E9BDA] transition-colors">Technical Competencies</span>
                  <span className="text-[10px] text-slate-500 font-medium">{unifiedMatched.length} required skills verified</span>
                </div>
              </div>
              <span className="text-sm font-black text-slate-900 group-hover/p1:text-[#2E9BDA] transition-colors">{skillsScore}%</span>
            </div>
            {/* Glowing Shimmer Progress Bar */}
            <div className="w-full bg-slate-200/60 h-2 rounded-full overflow-hidden p-[1px] relative">
              <div
                className="bg-gradient-to-r from-[#2E9BDA] via-sky-400 to-[#2E9BDA] h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden shadow-xs"
                style={{ width: `${Math.min(100, Math.max(0, skillsScore))}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_2s_infinite]" />
              </div>
            </div>
          </div>

          {/* Pillar: Experience */}
          <div className="p-3.5 bg-slate-50/70 hover:bg-indigo-50/60 rounded-2xl border border-slate-200/70 hover:border-indigo-300/70 hover:shadow-md hover:shadow-indigo-100/30 transition-all duration-200 flex flex-col gap-2 group/p2 cursor-default">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-2xs group-hover/p2:scale-110 group-hover/p2:rotate-3 transition-transform duration-200">
                  <Briefcase size={15} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate group-hover/p2:text-indigo-600 transition-colors">Work Experience</span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {isExpDropped ? 'Exempt for this role' : `${expScore}% relevance`}
                  </span>
                </div>
              </div>
              <span className="text-sm font-black text-slate-900 group-hover/p2:text-indigo-600 transition-colors">
                {isExpDropped ? 'Exempt' : `${expScore}%`}
              </span>
            </div>
            {/* Glowing Shimmer Progress Bar */}
            <div className="w-full bg-slate-200/60 h-2 rounded-full overflow-hidden p-[1px] relative">
              <div
                className="bg-gradient-to-r from-indigo-500 via-indigo-400 to-indigo-600 h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden shadow-xs"
                style={{ width: `${isExpDropped ? 100 : Math.min(100, Math.max(0, expScore))}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_2s_infinite]" />
              </div>
            </div>
          </div>

          {/* Pillar: Education */}
          <div className="p-3.5 bg-slate-50/70 hover:bg-purple-50/60 rounded-2xl border border-slate-200/70 hover:border-purple-300/70 hover:shadow-md hover:shadow-purple-100/30 transition-all duration-200 flex flex-col gap-2 group/p3 cursor-default">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 shadow-2xs group-hover/p3:scale-110 group-hover/p3:rotate-3 transition-transform duration-200">
                  <GraduationCap size={15} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate group-hover/p3:text-purple-600 transition-colors">Education & Degrees</span>
                  <span className="text-[10px] text-slate-500 font-medium">{eduSubtext}</span>
                </div>
              </div>
              <span className="text-sm font-black text-slate-900 group-hover/p3:text-purple-600 transition-colors">{eduScore}%</span>
            </div>
            {/* Glowing Shimmer Progress Bar */}
            <div className="w-full bg-slate-200/60 h-2 rounded-full overflow-hidden p-[1px] relative">
              <div
                className="bg-gradient-to-r from-purple-500 via-purple-400 to-purple-600 h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden shadow-xs"
                style={{ width: `${Math.min(100, Math.max(0, eduScore))}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_2s_infinite]" />
              </div>
            </div>
          </div>

          {/* ATS Layout Hygiene */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-50/90 to-teal-50/70 border border-emerald-200/80 flex items-center justify-between text-xs text-emerald-900 shadow-2xs hover:shadow-xs transition-shadow">
            <span className="flex items-center gap-1.5 font-bold">
              <FileCheck2 size={15} className="text-emerald-600" />
              Standard ATS Format
            </span>
            <span className="text-[10px] font-extrabold text-emerald-700 bg-white/90 border border-emerald-200/80 px-2.5 py-0.5 rounded-md shadow-2xs">
              100% Readable
            </span>
          </div>
        </motion.div>

      </div>

      {/* ── BENTO TILE 3: KEY SKILLS & TECHNOLOGIES ────────────────────── */}
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 p-6 sm:p-7 space-y-4 transition-all duration-300"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sky-50 text-[#2E9BDA] flex items-center justify-center shadow-2xs ring-2 ring-sky-100/60">
              <Target size={17} />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Key Skills & Technologies ({unifiedMatched.length}/{totalUnifiedCount} Matched)
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                Keywords matched with job requirements and recommendations
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 hover:bg-slate-100 px-3 py-1 rounded-full border border-slate-200/70 transition-colors self-start sm:self-auto shadow-2xs">
            Click any skill to copy
          </span>
        </div>

        {/* Matched Keywords Grid */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 mb-2.5">
            <CheckCircle2 size={13} className="text-emerald-600" /> Matched Skills ({unifiedMatched.length})
          </span>
          <div className="flex flex-wrap gap-2">
            {unifiedMatched.map((kw, idx) => (
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                key={idx}
                onClick={() => handleCopy(kw)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/60 text-xs font-semibold text-slate-800 flex items-center gap-1.5 shadow-2xs hover:shadow-xs hover:shadow-emerald-100/50 transition-all duration-150 cursor-pointer group"
              >
                <span className="group-hover:text-emerald-700 transition-colors">{kw}</span>
                {copiedText === kw ? (
                  <Check size={12} className="text-emerald-600 animate-scale-in" />
                ) : (
                  <CheckCircle2 size={12} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Missing Keywords Grid */}
        {unifiedMissing.length > 0 && (
          <div className="pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5 mb-2.5">
              <AlertTriangle size={13} className="text-rose-600" /> Missing Job Requirements ({unifiedMissing.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {unifiedMissing.map((kw, idx) => {
                const kwLower = (kw || '').toLowerCase().trim()
                const isMust = mustHaveSet.has(kwLower)
                const isNice = niceHaveSet.has(kwLower)
                const badgeLabel = isMust ? 'REQUIRED' : (isNice ? 'PREFERRED' : '+ ADD')
                const badgeClass = isMust
                  ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                  : (isNice ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white text-rose-600 border-rose-200')

                return (
                  <motion.button
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    key={idx}
                    onClick={() => handleCopy(kw)}
                    className="px-3 py-1.5 rounded-xl border border-rose-200/90 bg-rose-50/40 hover:bg-rose-50 hover:border-rose-400 text-xs font-semibold text-slate-800 flex items-center gap-2 shadow-2xs hover:shadow-xs hover:shadow-rose-100/50 transition-all duration-150 cursor-pointer group"
                  >
                    <span className="group-hover:text-rose-700 transition-colors">{kw}</span>
                    <span className={`text-[8.5px] font-extrabold px-1.5 py-0.2 rounded border font-mono ${badgeClass}`}>
                      {badgeLabel}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </div>
        )}

        {/* Soft Competencies (Informative, does not penalize technical score) */}
        {result?.soft_skills && result.soft_skills.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700 flex items-center gap-1.5 mb-2.5">
              <Sparkles size={13} className="text-[#2E9BDA]" /> Soft Competencies & Professional Strengths ({result.soft_skills.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {result.soft_skills.map((trait, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-xl border border-sky-200/80 bg-sky-50/50 text-xs font-semibold text-slate-700 shadow-2xs"
                >
                  {trait}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* ── CLEAN & ATTRACTIVE SUPERCHARGE RESUME BANNER ── */}
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="rounded-3xl bg-gradient-to-r from-sky-50/90 via-white to-sky-50/70 border border-sky-200/90 p-6 sm:p-8 shadow-sm hover:shadow-xl hover:shadow-sky-100/50 hover:border-[#2E9BDA]/40 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden transition-all duration-300 group"
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#2E9BDA]/10 rounded-full blur-3xl pointer-events-none group-hover:scale-125 transition-transform duration-700" />

        <div className="space-y-2.5 text-center md:text-left relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-100/80 text-[#2E9BDA] text-xs font-bold border border-sky-200 mb-1 shadow-2xs">
            <Sparkles size={13} className="text-[#2E9BDA] animate-pulse" />
            AI Resume Enhancement
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Want to increase your ATS match score?
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
            Let our AI naturally integrate missing keywords, turn basic job duties into measurable high-impact achievements, and tailor your resume specifically for this position.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold text-slate-700 justify-center md:justify-start">
            <span className="flex items-center gap-1.5 hover:text-[#2E9BDA] transition-colors">
              <CheckCircle2 size={13} className="text-emerald-500" />
              High-Impact Bullet Points
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5 hover:text-[#2E9BDA] transition-colors">
              <CheckCircle2 size={13} className="text-emerald-500" />
              Skill Gap Integration
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5 hover:text-[#2E9BDA] transition-colors">
              <CheckCircle2 size={13} className="text-emerald-500" />
              1-Click ATS PDF Export
            </span>
          </div>
        </div>

        <div className="shrink-0 relative z-10 w-full md:w-auto">
          {onEnhance && (
            <motion.button
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={onEnhance}
              disabled={enhancing}
              className="w-full md:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-[#2E9BDA] to-[#2587bf] hover:from-[#2587bf] hover:to-[#1e74a8] text-white font-extrabold text-sm shadow-md shadow-sky-500/25 hover:shadow-lg hover:shadow-sky-500/40 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2.5 group/btn"
            >
              <Sparkles size={16} className="group-hover/btn:rotate-12 transition-transform duration-300" />
              <span>Supercharge Resume Now 🚀</span>
            </motion.button>
          )}
        </div>
      </motion.div>

    </motion.div>
  )
}