/**
 * ATSModals.jsx — Modal overlays and diagnostics dialogs for ATS Matcher:
 * - ScanningDiagnosticsModal: Animated Document Scanner with live multi-step diagnostics.
 * - ResumeSuperchargeScanningModal: HUD Scanner prior to Wizard.
 * - EnhancementWizard: 3-step HITL wizard to verify contact links, skills, and impact metrics.
 * - InvalidDocumentError: Safeguard card when uploaded document is unreadable/non-resume.
 * - SetAsPrimaryPopup: Confirmation popup to set enhanced resume as profile primary.
 */

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  XCircle, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  Sparkles,
  Check
} from 'lucide-react'
import { dedupeCaseInsensitive } from './ATSHelpers'

// ── Invalid Document Fallback ────────────────────────────────────────────────
export function InvalidDocumentError({ confidence, warnings = [], onReset }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className="max-w-2xl mx-auto my-4 sm:my-8 p-5 sm:p-10 bg-white border border-rose-200/90 rounded-2xl sm:rounded-3xl shadow-xl text-center flex flex-col items-center gap-3 sm:gap-4 mx-3 sm:mx-auto"
    >
      <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-rose-50 border-2 border-rose-200 flex items-center justify-center text-rose-600 shadow-2xs animate-pulse">
        <XCircle size={32} className="sm:w-11 sm:h-11" />
      </div>

      <h2 className="text-lg sm:text-2xl font-black text-slate-900">
        Document Not Recognized as a Resume
      </h2>

      <p className="text-slate-600 text-xs sm:text-sm max-w-md leading-relaxed font-medium">
        We couldn't detect standard resume sections (Work Experience, Technical Skills, Education). 
        The file may be a scan, certificate, invoice, or formatted with non-standard multi-column tables.
      </p>

      {(warnings.length > 0 || typeof confidence === 'number') && (
        <div className="w-full max-w-md mt-2 p-3 sm:p-4 bg-slate-50 border border-rose-100 rounded-xl sm:rounded-2xl text-left text-xs text-slate-700 font-medium">
          {typeof confidence === 'number' && (
            <p className="font-mono font-bold text-rose-700 mb-1">
              Detection Confidence: {Math.round(confidence * 100)}%
            </p>
          )}
          {warnings.slice(0, 3).map((w, i) => (
            <p key={i} className="text-slate-600 my-0.5 leading-snug">• {w}</p>
          ))}
        </div>
      )}

      <button
        onClick={onReset}
        className="mt-2 sm:mt-4 px-6 py-2.5 sm:px-8 sm:py-3.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl transition shadow-md hover:shadow-lg transform active:scale-98 cursor-pointer"
      >
        Upload Valid ATS Resume
      </button>
    </motion.div>
  )
}

// ── Interactive Scanning Modal Visualizer ────────────────────────────────────
export function ScanningDiagnosticsModal({ jobTitle }) {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setActiveStep(1), 600)
    const t2 = setTimeout(() => setActiveStep(2), 1400)
    const t3 = setTimeout(() => setActiveStep(3), 2200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])

  const steps = [
    { label: 'Analyzing Document Formatting & Structure', detail: 'Verifying section headings and single-column readability' },
    { label: 'Matching Required Skills & Technologies', detail: 'Evaluating technical stack against job qualifications' },
    { label: 'Evaluating Work Experience & Achievements', detail: 'Assessing role relevance and demonstrated accomplishments' },
    { label: 'Finalizing ATS Compatibility Score', detail: 'Preparing your detailed match breakdown' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl border border-sky-100 overflow-hidden relative"
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#2E9BDA] via-indigo-500 to-[#2E9BDA]" />
        
        {/* Scanner Visualizer */}
        <div className="flex flex-col items-center mb-4 sm:mb-6">
          <div className="relative w-22 h-26 sm:w-28 sm:h-32 bg-gradient-to-b from-sky-50/80 via-white to-sky-50/50 border-2 border-sky-200 rounded-2xl shadow-inner flex flex-col items-center justify-center p-2.5 sm:p-3 overflow-hidden">
            <FileText size={32} className="sm:w-10 sm:h-10 text-[#2E9BDA] mb-1 opacity-80" />
            
            {/* Animated Laser Scanning Line */}
            <motion.div
              animate={{ y: [-38, 38, -38] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="absolute w-full h-1.5 bg-gradient-to-r from-transparent via-[#2E9BDA] to-transparent shadow-[0_0_14px_#2E9BDA]"
            />

            {/* Concentric radar rings */}
            <motion.div
              animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0.1, 0.6] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
              className="absolute inset-2 rounded-xl border border-sky-400/80 pointer-events-none"
            />
          </div>

          <h3 className="text-base sm:text-xl font-bold text-slate-900 mt-3 sm:mt-4 text-center">
            Evaluating ATS Readiness
          </h3>
          <p className="text-[11px] sm:text-xs text-[#2E9BDA] font-bold tracking-wide uppercase mt-0.5">
            Role: {jobTitle || 'Target Position'}
          </p>
        </div>

        {/* Step Ticker */}
        <div className="space-y-3">
          {steps.map((s, idx) => {
            const isDone = activeStep > idx
            const isCurrent = activeStep === idx

            return (
              <div 
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-2xl border transition-all duration-300 ${
                  isCurrent 
                    ? 'bg-sky-50 border-sky-200 shadow-xs' 
                    : isDone 
                      ? 'bg-emerald-50/60 border-emerald-200' 
                      : 'bg-slate-50/50 border-slate-100 opacity-60'
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {isDone ? (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  ) : isCurrent ? (
                    <Loader2 size={16} className="animate-spin text-[#2E9BDA]" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold leading-snug ${isCurrent ? 'text-sky-950' : isDone ? 'text-slate-800' : 'text-slate-500'}`}>
                    {s.label}
                  </p>
                  <p className="text-[10.5px] text-slate-400 truncate mt-0.5 font-medium">
                    {s.detail}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span>CareerShala ATS Engine</span>
          <span className="flex items-center gap-1 text-[#2E9BDA] font-semibold">
            <CheckCircle2 size={13} /> Live Verification
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Interactive Supercharge Scanning HUD Modal ──────────────────────────────
export function ResumeSuperchargeScanningModal({ onComplete, onClose }) {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setActiveStep(1), 450)
    const t2 = setTimeout(() => setActiveStep(2), 950)
    const t3 = setTimeout(() => setActiveStep(3), 1400)
    const t4 = setTimeout(() => {
      if (onComplete) onComplete()
    }, 1850)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [onComplete])

  const steps = [
    { label: 'Scanning Experience & Project Bullets', detail: 'Finding opportunities for stronger action verbs & metrics' },
    { label: 'Identifying Missing Keywords', detail: 'Cross-referencing core requirements from the job description' },
    { label: 'Preparing Quantified Impact Bullets', detail: 'Transforming basic duties into measurable results' },
    { label: 'Ready for Quick Verification', detail: 'Opening step-by-step assistant' },
  ]

  if (typeof document === 'undefined') return null

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.92, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 15 }}
        className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 overflow-hidden relative"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#2E9BDA] to-[#2587bf]" />

        {/* Scanning Visualizer */}
        <div className="flex flex-col items-center mb-5">
          <div className="relative w-24 h-28 bg-gradient-to-b from-sky-50 via-white to-sky-50 border-2 border-sky-200 rounded-2xl shadow-inner flex flex-col items-center justify-center p-3 overflow-hidden">
            <FileText size={34} className="text-[#2E9BDA] opacity-80" />
            
            {/* Animated Laser Scanning Line */}
            <motion.div
              animate={{ y: [-36, 36, -36] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
              className="absolute w-full h-1.5 bg-gradient-to-r from-transparent via-[#2E9BDA] to-transparent shadow-[0_0_12px_#2E9BDA]"
            />

            {/* Concentric radar rings */}
            <motion.div
              animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0.1, 0.7] }}
              transition={{ repeat: Infinity, duration: 2.2 }}
              className="absolute inset-2 rounded-xl border border-sky-400/80 pointer-events-none"
            />
          </div>

          <span className="text-[10px] font-bold uppercase tracking-wider text-[#2E9BDA] mt-3 px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200">
            RESUME SCANNER
          </span>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1.5 text-center">
            Analyzing Resume for Impact Enhancements
          </h3>
          <p className="text-xs text-slate-500 font-medium text-center max-w-xs mt-0.5">
            Evaluating bullet strength & identifying missing keywords
          </p>
        </div>

        {/* Step Ticker */}
        <div className="space-y-2.5">
          {steps.map((s, idx) => {
            const isDone = activeStep > idx
            const isCurrent = activeStep === idx

            return (
              <div 
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-2xl border transition-all duration-300 ${
                  isCurrent 
                    ? 'bg-sky-50 border-sky-200 shadow-xs' 
                    : isDone 
                      ? 'bg-emerald-50/60 border-emerald-200' 
                      : 'bg-slate-50/50 border-slate-100 opacity-60'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  ) : isCurrent ? (
                    <Loader2 size={16} className="animate-spin text-[#2E9BDA]" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold leading-snug ${isCurrent ? 'text-sky-950' : isDone ? 'text-slate-800' : 'text-slate-500'}`}>
                    {s.label}
                  </p>
                  <p className="text-[10.5px] text-slate-400 truncate mt-0.5 font-medium">
                    {s.detail}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>AI Engine: Impact & Metrics Optimization</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ── HITL Enhancement Wizard Modal (CareerShala Clean Standard) ──────────────
const METRIC_QUESTIONS = [
  "Did you improve any efficiency, speed, or performance?",
  "Did you help scale users, handle data, or mentor team members?",
]

const METRIC_PRESETS = [
  [
    "⚡ Reduced API latency by 40% with Redis caching",
    "📉 Cut frontend load time by 35% with code-splitting"
  ],
  [
    "👥 Scaled system to handle 10k+ monthly active users",
    "🚀 Delivered 15+ features with 99.9% uptime"
  ]
]

export function EnhancementWizard({ result, onClose, onSubmit, onSkip }) {
  const contact = result?.contact_snapshot || {}
  const missingLinks = ['linkedin', 'github', 'portfolio'].filter(k => !contact[k])

  const rawMissing = [
    ...(result?.strict_missing_keywords || []),
    ...(result?.missing_skills || [])
  ]
  const matchedLower = new Set((result?.matched_skills || []).map(s => s.toLowerCase().trim()))
  const skillOptions = dedupeCaseInsensitive(rawMissing)
    .filter(skill => !matchedLower.has(skill.toLowerCase().trim()))
    .slice(0, 12)

  const groups = []
  if (missingLinks.length > 0) groups.push('identity')
  if (skillOptions.length > 0) groups.push('skills')
  groups.push('metrics')

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  const [step, setStep] = useState(0)
  const [links, setLinks] = useState({ linkedin: '', github: '', portfolio: '' })
  const [selectedSkills, setSelectedSkills] = useState([])
  const [metrics, setMetrics] = useState({ m0: '', m1: '' })

  const goNext = () => setStep(s => Math.min(s + 1, groups.length - 1))
  const goBack = () => setStep(s => Math.max(s - 1, 0))

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

  const groupLabels = {
    identity: '1. Links',
    skills: '2. Missing Skills',
    metrics: '3. Measurable Impact'
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md overflow-hidden">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="w-full max-w-xl max-h-[88vh] sm:max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 my-auto flex flex-col"
      >
        {/* Clean Header */}
        <div className="p-4 sm:p-6 bg-white border-b border-slate-100 flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-50 text-[#2E9BDA] border border-sky-200 font-mono">
                AI RESUME ASSISTANT
              </span>
              <span className="text-xs font-semibold text-slate-400">
                Step {step + 1} of {groups.length}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles size={18} className="text-[#2E9BDA]" />
              Supercharge Resume Assistant
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Confirm key details so AI can tailor your bullets accurately.
            </p>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center cursor-pointer text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator Progress Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2 shrink-0">
          {groups.map((grp, idx) => {
            const isDone = step > idx
            const isCurrent = step === idx

            return (
              <div 
                key={grp}
                className={`flex-1 py-1 px-2 rounded-xl text-center text-[10px] sm:text-[10.5px] font-bold transition flex items-center justify-center gap-1.5 ${
                  isCurrent 
                    ? 'bg-white text-[#2E9BDA] border border-sky-200 shadow-2xs font-bold' 
                    : isDone 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-transparent text-slate-400'
                }`}
              >
                {isDone ? <Check size={11} className="text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-[#2E9BDA] shrink-0" />}
                <span className="truncate">{groupLabels[grp]}</span>
              </div>
            )
          })}
        </div>

        {/* Form Body with Smooth Transition & Zero Viewport Cutoff */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentGroup}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              {currentGroup === 'identity' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-600 font-medium">Add verified professional links to pass strict ATS contact filters:</p>
                  {missingLinks.map(key => (
                    <div key={key}>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">{key} Profile URL</label>
                      <input
                        type="url"
                        placeholder={`https://${key}.com/your-profile`}
                        value={links[key]}
                        onChange={e => setLinks(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#2E9BDA]/50 focus:border-[#2E9BDA] focus:outline-none font-medium"
                      />
                    </div>
                  ))}
                </div>
              )}

              {currentGroup === 'skills' && (
                <div>
                  <p className="text-xs text-slate-600 font-medium mb-3">
                    Select target skills you have hands-on familiarity with to blend into your resume bullets:
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1 custom-scrollbar">
                    {skillOptions.map(skill => {
                      const isChecked = selectedSkills.includes(skill)
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleSkill(skill)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                            isChecked
                              ? 'bg-[#2E9BDA] text-white border-[#2E9BDA] shadow-xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {isChecked ? <Check size={12} /> : '+'}
                          <span>{skill}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {currentGroup === 'metrics' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-600 font-medium">
                    Quantify your achievements to stand out (pick a preset below or enter your own):
                  </p>
                  {METRIC_QUESTIONS.map((q, i) => (
                    <div key={i} className="space-y-2 p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl">
                      <label className="block text-xs font-bold text-slate-800 leading-snug">{q}</label>
                      <input
                        type="text"
                        placeholder="Type custom impact or select a preset below..."
                        value={metrics[`m${i}`]}
                        onChange={e => setMetrics(prev => ({ ...prev, [`m${i}`]: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-[#2E9BDA]/50 focus:border-[#2E9BDA] focus:outline-none font-medium"
                      />
                      {/* Responsive Smart Metric Chips with Selection & Full Wrap */}
                      <div className="flex flex-col sm:flex-row gap-1.5 pt-1">
                        {METRIC_PRESETS[i]?.map((preset, pIdx) => {
                          const isSelected = metrics[`m${i}`] === preset
                          return (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => setMetrics(prev => ({ ...prev, [`m${i}`]: preset }))}
                              className={`text-[11px] font-medium px-3 py-2 rounded-xl transition cursor-pointer text-left shadow-2xs active:scale-98 flex-1 break-words leading-relaxed border ${
                                isSelected
                                  ? 'bg-sky-50 text-[#2E9BDA] border-[#2E9BDA] ring-1 ring-[#2E9BDA]/40 font-semibold'
                                  : 'bg-white hover:bg-sky-50/60 text-slate-700 border-slate-200'
                              }`}
                            >
                              {preset}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation with Mobile Safe Area */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex justify-between items-center shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {step > 0 ? (
            <button 
              type="button"
              onClick={goBack} 
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              ← Back
            </button>
          ) : (
            <button 
              type="button"
              onClick={onSkip} 
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Skip Wizard
            </button>
          )}

          {isLastStep ? (
            <button 
              type="button"
              onClick={handleFinish} 
              className="px-5 py-2.5 bg-gradient-to-r from-[#2E9BDA] to-[#2587bf] hover:from-[#2587bf] hover:to-[#1e74a8] text-white rounded-xl text-xs font-bold shadow-md shadow-sky-500/25 transition cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles size={13} />
              <span>Supercharge Resume Now 🚀</span>
            </button>
          ) : (
            <button 
              type="button"
              onClick={goNext} 
              className="px-5 py-2.5 bg-[#2E9BDA] hover:bg-[#2587bf] text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Next →
            </button>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  )
}

// ── Primary Resume Confirmation Modal ────────────────────────────────────────
export function SetAsPrimaryPopup({ resumeName, onNotNow, onYesUpdate }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 text-center"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mb-4 shadow-sm">
          <Sparkles size={26} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Set as Primary Profile Resume?</h3>
        <p className="text-xs text-slate-600 mb-4 leading-relaxed font-medium">
          Would you like to make <strong className="text-slate-800">{resumeName}</strong> your active default resume across all job searches and mock interviews?
        </p>

        <div className="flex gap-3">
          <button 
            onClick={onNotNow}
            disabled={updating}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
          >
            Not Now
          </button>
          <button 
            onClick={handleYes}
            disabled={updating}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#2587bf] hover:from-[#2587bf] hover:to-[#1e74a8] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
          >
            {updating ? <Loader2 size={14} className="animate-spin" /> : '✓ Yes, Update'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
