/**
 * ATSModals.jsx — Modal overlays and diagnostics dialogs for ATS Matcher:
 * - ScanningDiagnosticsModal: Animated Cyber Document Scanner with live multi-step diagnostics.
 * - EnhancementWizard: 3-step HITL wizard to verify contact links, skills, and impact metrics.
 * - InvalidDocumentError: Safeguard card when uploaded document is unreadable/non-resume.
 * - SetAsPrimaryPopup: Confirmation popup to set enhanced resume as profile primary.
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  XCircle, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  Zap, 
  Sparkles,
  Link2,
  Cpu,
  ArrowRight,
  HelpCircle,
  TrendingUp,
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
      className="max-w-2xl mx-auto my-8 p-8 sm:p-10 bg-white/95 backdrop-blur-2xl border border-rose-200/90 rounded-3xl shadow-2xl text-center flex flex-col items-center gap-4"
    >
      <div className="w-20 h-20 rounded-3xl bg-rose-50 border-2 border-rose-200 flex items-center justify-center text-rose-600 shadow-sm animate-pulse">
        <XCircle size={44} />
      </div>

      <h2 className="text-2xl font-black text-slate-900 font-poppins">
        Document Not Recognized as a Resume
      </h2>

      <p className="text-slate-600 text-sm max-w-md leading-relaxed font-medium">
        We couldn't detect standard resume sections (Work Experience, Technical Skills, Education). 
        The file may be a scan, certificate, invoice, or formatted with non-standard multi-column tables.
      </p>

      {(warnings.length > 0 || typeof confidence === 'number') && (
        <div className="w-full max-w-md mt-2 p-4 bg-slate-50 border border-rose-100 rounded-2xl text-left text-xs text-slate-700 font-medium">
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
        className="mt-4 px-8 py-3.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-extrabold rounded-2xl transition shadow-lg hover:shadow-xl transform active:scale-98 cursor-pointer"
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
    { label: 'Parsing AST Document Structure & Sections', detail: 'Validating single-column layout & section hierarchy' },
    { label: 'Extracting Technical Stack & 768-dim Vectors', detail: 'Cosine similarity & domain ontology mapping' },
    { label: 'Applying Fresher Calibration (70% Skills / 15% Exp / 15% Edu)', detail: 'Mitigating tenure penalties for early career talent' },
    { label: 'Evaluating Corporate Knockout Gates & Formulation', detail: 'Generating comprehensive score roadmap' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl border border-indigo-100/90 overflow-hidden relative"
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        
        {/* Hologram Cyber Scanner Visualizer */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-28 h-32 bg-gradient-to-b from-indigo-50/80 via-blue-50/60 to-purple-50/80 border-2 border-indigo-200/90 rounded-2xl shadow-inner flex flex-col items-center justify-center p-3 overflow-hidden">
            <FileText size={40} className="text-indigo-600 mb-1 opacity-80" />
            
            {/* Animated Laser Scanning Line */}
            <motion.div
              animate={{ y: [-45, 45, -45] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="absolute w-full h-1.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_14px_#06b6d4]"
            />

            {/* Concentric radar rings */}
            <motion.div
              animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0.1, 0.6] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
              className="absolute inset-2 rounded-xl border border-indigo-400/80 pointer-events-none"
            />
          </div>

          <h3 className="text-xl font-black text-slate-900 mt-4 font-poppins text-center">
            Evaluating ATS Readiness
          </h3>
          <p className="text-xs text-indigo-600 font-extrabold tracking-wider uppercase mt-0.5">
            Targeting: {jobTitle || 'Target Requisition'}
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
                    ? 'bg-indigo-50/90 border-indigo-300 shadow-xs' 
                    : isDone 
                      ? 'bg-emerald-50/50 border-emerald-200' 
                      : 'bg-slate-50/50 border-slate-100 opacity-60'
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {isDone ? (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  ) : isCurrent ? (
                    <Loader2 size={16} className="animate-spin text-indigo-600" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-extrabold leading-snug ${isCurrent ? 'text-indigo-950' : isDone ? 'text-slate-800' : 'text-slate-500'}`}>
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

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>Engine: Hybrid-RAG Multi-Factor ATS</span>
          <span className="flex items-center gap-1 font-mono text-indigo-600 font-bold">
            <Zap size={12} /> Real-time neural inference
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── HITL Enhancement Wizard Modal ───────────────────────────────────────────
const METRIC_QUESTIONS = [
  "Did you improve efficiency, speed, or performance? By roughly what percentage or number?",
  "Did you grow a user base, team, dataset, or revenue? By roughly what amount?",
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
    .slice(0, 14)

  const groups = []
  if (missingLinks.length > 0) groups.push('identity')
  if (skillOptions.length > 0) groups.push('skills')
  groups.push('metrics')

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
      >
        <div className="px-6 py-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white flex justify-between items-center">
          <div>
            <h3 className="text-base sm:text-lg font-black font-poppins flex items-center gap-2">
              <Sparkles size={18} className="text-amber-300" />
              Resume Enhancer Assistant
            </h3>
            <p className="text-xs text-blue-100 font-medium">Step {step + 1} of {groups.length} — Human-In-The-Loop Verification</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-xl text-white/80 hover:text-white hover:bg-white/10 text-xs font-bold">✕</button>
        </div>

        <div className="p-6">
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                  />
                </div>
              ))}
            </div>
          )}

          {currentGroup === 'skills' && (
            <div>
              <p className="text-xs text-slate-600 font-medium mb-3">Select skills you have hands-on experience with to auto-tailor into your bullets:</p>
              <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1 custom-scrollbar">
                {skillOptions.map(skill => {
                  const isChecked = selectedSkills.includes(skill)
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                        isChecked
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
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
              <p className="text-xs text-slate-600 font-medium">Quantify your achievements to pass modern impact-driven screening parsers:</p>
              {METRIC_QUESTIONS.map((q, i) => (
                <div key={i}>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{q}</label>
                  <input
                    type="text"
                    placeholder="e.g. Reduced API latency by 40% with Redis caching"
                    value={metrics[`m${i}`]}
                    onChange={e => setMetrics(prev => ({ ...prev, [`m${i}`]: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
            {step > 0 ? (
              <button onClick={goBack} className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer">
                ← Back
              </button>
            ) : (
              <button onClick={onSkip} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer">
                Skip Wizard
              </button>
            )}

            {isLastStep ? (
              <button 
                onClick={handleFinish} 
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
              >
                ✨ Enhance & Download PDF
              </button>
            ) : (
              <button 
                onClick={goNext} 
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
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
        <h3 className="text-lg font-black text-slate-900 mb-1 font-poppins">Set as Primary Profile Resume?</h3>
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
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
          >
            {updating ? <Loader2 size={14} className="animate-spin" /> : '✓ Yes, Update'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
