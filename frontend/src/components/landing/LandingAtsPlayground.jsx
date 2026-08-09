import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Sparkles, Check, CheckSquare, XSquare, ArrowRight, Zap, Target } from 'lucide-react'

export default function LandingAtsPlayground({
  playgroundRole,
  setPlaygroundRole,
  playgroundSkills,
  setPlaygroundSkills,
  analyzingPlayground,
  playgroundResult,
  handlePlaygroundSubmit,
  fadeInUp,
}) {
  const PRESET_SKILLS = [
    { label: 'Full-Stack Stack', skills: 'React, Python, Docker, Node.js, PostgreSQL' },
    { label: 'Cloud & DevOps', skills: 'AWS, Kubernetes, Docker, Terraform, CI/CD' },
    { label: 'Backend Architecture', skills: 'Java, Spring Boot, Microservices, Redis, Kafka' },
  ]

  return (
    <section id="playground" className="py-16 sm:py-24 bg-gradient-to-b from-white via-sky-50/30 to-slate-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-4 shadow-sm">
            <Target size={14} />
            <span>Try It Live Right Now</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4">
            Test Your Resume ATS Score in 5 Seconds
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
            Select your target role and type your skills (or click a quick preset below) to see how an ATS algorithm parses your profile.
          </p>
        </div>

        {/* Playground Card Container */}
        <div className="max-w-4xl mx-auto bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-2xl relative overflow-hidden">
          
          {/* Quick Presets Bar */}
          <div className="mb-6 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="text-slate-700 font-extrabold flex items-center gap-1">
              <Zap size={13} className="text-[#2E9BDA]" /> Quick Try Examples:
            </span>
            {PRESET_SKILLS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPlaygroundSkills(preset.skills)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-50 hover:text-[#2E9BDA] border border-slate-200/80 transition-all font-bold text-xs"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <form onSubmit={handlePlaygroundSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Target Role Dropdown */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Target Job Position
                </label>
                <select
                  value={playgroundRole}
                  onChange={(e) => setPlaygroundRole(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E9BDA]/20 focus:border-[#2E9BDA] transition-all"
                >
                  <option value="Full-Stack Engineer">Full-Stack Engineer</option>
                  <option value="Frontend Specialist">Frontend Specialist (React / Next.js)</option>
                  <option value="Backend Architect">Backend Architect (Python / Node.js)</option>
                  <option value="DevOps & Cloud Engineer">DevOps & Cloud Engineer</option>
                  <option value="AI / ML Engineer">AI / ML Engineer</option>
                </select>
              </div>

              {/* Skills Input */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Your Tech Stack & Keywords
                </label>
                <input
                  type="text"
                  value={playgroundSkills}
                  onChange={(e) => setPlaygroundSkills(e.target.value)}
                  placeholder="e.g. React, Python, Docker, Node.js"
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2E9BDA]/20 focus:border-[#2E9BDA] transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={analyzingPlayground || !playgroundSkills.trim()}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-extrabold text-sm text-white bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] hover:from-[#2380b8] hover:to-[#175b87] shadow-lg shadow-[#2E9BDA]/25 hover:shadow-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {analyzingPlayground ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Calculating ATS Score...
                  </span>
                ) : (
                  <>
                    <span>Calculate Live Match Score</span>
                    <Sparkles size={16} />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Results Display */}
          <AnimatePresence>
            {playgroundResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-8 pt-8 border-t border-slate-200 space-y-6"
              >
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-2xl bg-gradient-to-r from-sky-50 to-emerald-50 border border-sky-200/80 shadow-sm">
                  <div className="text-center sm:text-left">
                    <span className="text-xs font-mono font-bold text-slate-500 uppercase">Estimated ATS Compatibility Score</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-5xl font-black text-slate-900">{playgroundResult.score}%</span>
                      <span className="text-xs font-extrabold text-emerald-700 font-mono bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                        GREAT ATS MATCH
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 w-full sm:w-auto">
                    <div className="w-full h-3.5 rounded-full bg-slate-200/90 overflow-hidden shadow-inner">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#2E9BDA] to-emerald-500 transition-all duration-700"
                        style={{ width: `${playgroundResult.score}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Matched Keywords */}
                  <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200/90">
                    <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm mb-3">
                      <CheckSquare size={16} />
                      <span>Matched Technical Keywords ({playgroundResult.matched.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {playgroundResult.matched.map((sk, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold border border-emerald-200">
                          ✓ {sk}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Additions */}
                  <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200/90">
                    <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm mb-3">
                      <XSquare size={16} />
                      <span>Recommended Key Additions</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {playgroundResult.missing.map((sk, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200">
                          + {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-sky-50/90 border border-sky-200 text-sky-950 text-xs sm:text-sm font-semibold flex items-center justify-between gap-4">
                  <span>💡 <strong>Pro Tip:</strong> {playgroundResult.recommendation}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
