import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { dedupeCaseInsensitive } from './jobHelpers'

export default function JobMatchModal({
  isOpen,
  job,
  loading,
  result,
  isApplied,
  isApplying,
  onClose,
  onApply,
}) {
  if (!isOpen) return null

  const matchedSkills = result ? dedupeCaseInsensitive(result.matched_skills) : []
  const matchedLower = new Set(matchedSkills.map((s) => s.toLowerCase()))
  const missingSkills = result
    ? dedupeCaseInsensitive(result.missing_skills).filter((s) => !matchedLower.has(s.toLowerCase()))
    : []
  const totalSkillsCount = matchedSkills.length + missingSkills.length

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 relative overflow-hidden"
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">
                <Sparkles size={12} /> ATS Engine Evaluation
              </span>
              <h3 className="text-lg font-extrabold text-slate-900">{job?.title}</h3>
              <p className="text-xs text-slate-500 font-medium">
                {job?.company_name} • {job?.location}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
            >
              <X size={18} />
            </button>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl border-4 border-[#2E9BDA] border-t-transparent animate-spin mb-4" />
              <p className="text-sm font-bold text-slate-800">Evaluating Match Percentage...</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Comparing technical skills, internship/experience, and role relevance.
              </p>
            </div>
          ) : result ? (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-blue-50/50 border border-indigo-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Profile Compatibility Fit</p>
                  <h4 className="text-3xl font-black text-slate-900 mt-0.5">{Math.round(result.final_score)}%</h4>
                  <p className="text-xs font-bold text-indigo-700 mt-0.5">{result.recommendation}</p>
                </div>

                <div className="text-right text-xs space-y-1">
                  <p className="text-slate-600 font-medium">
                    Skills Match: <strong className="text-slate-900">{matchedSkills.length}</strong> / {totalSkillsCount}
                  </p>
                  <p className="text-slate-600 font-medium">
                    Weight: <strong className="text-indigo-600 font-bold">Skills 70% • Exp 15% • Edu 15%</strong>
                  </p>
                </div>
              </div>

              {(result.is_knockout || result.knockout_reasons?.length > 0) && (
                <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 flex items-start gap-3 text-amber-900 shadow-2xs">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <div className="font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Requirement Warning</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-200/80 text-amber-900 font-bold">
                        Deficit Detected
                      </span>
                    </div>
                    {result.knockout_reasons?.length > 0 ? (
                      result.knockout_reasons.map((reason, idx) => (
                        <p key={idx} className="font-semibold text-amber-800">
                          • {reason}
                        </p>
                      ))
                    ) : (
                      <p className="font-semibold text-amber-800">• Role requirements (experience or education) not fully met.</p>
                    )}
                    <p className="text-[11px] text-amber-700/90 font-medium pt-0.5">
                      Warning: You may still apply, but recruiters will see this deficit during candidate screening.
                    </p>
                  </div>
                </div>
              )}

              {matchedSkills.length > 0 && (
                <div>
                  <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Matching Competencies ({matchedSkills.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {matchedSkills.map((s, idx) => (
                      <span key={idx} className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        ✓ {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {missingSkills.length > 0 && (
                <div>
                  <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Potential Gaps to Highlight ({missingSkills.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {missingSkills.slice(0, 6).map((s, idx) => (
                      <span key={idx} className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        + {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={isApplied || isApplying}
                  onClick={onApply}
                  className={`px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition ${
                    isApplied
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed opacity-90'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                  }`}
                >
                  {isApplied ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      Already Applied
                    </span>
                  ) : (
                    'Apply Now with Resume'
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

