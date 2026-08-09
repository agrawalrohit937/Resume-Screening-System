import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  FileText,
  Video,
  Globe,
  Users,
  Check,
  Zap,
  Sparkles,
  Flame,
  ShieldCheck,
  Code,
  Terminal,
} from 'lucide-react'

export default function LandingCockpitSection({
  activeCockpitTab,
  setActiveCockpitTab,
  fadeInUp,
  scaleUp,
}) {
  return (
    <section id="cockpit" className="py-16 sm:py-24 bg-white/70 backdrop-blur-md relative border-y border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-[#2E9BDA] text-xs font-bold uppercase tracking-wider mb-4">
            <BarChart3 size={14} />
            <span>Telemetry Command Center</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            One Unified Platform for Your Career Acceleration
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-medium">
            Explore live interactive previews of our core AI modules built for developers and engineering recruiters.
          </p>
        </div>

        {/* Cockpit Container Card */}
        <div className="bg-slate-900/95 rounded-3xl p-4 sm:p-8 border border-slate-800 shadow-2xl overflow-hidden relative text-white">
          {/* Subtle Grid Background inside cockpit preview */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Cockpit Tabs Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-6 sm:mb-8 relative z-10">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none w-full sm:w-auto">
              <button
                onClick={() => setActiveCockpitTab('ats')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 ${
                  activeCockpitTab === 'ats'
                    ? 'bg-[#2E9BDA] text-white shadow-lg shadow-[#2E9BDA]/30'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileText size={16} />
                <span>ATS Resume Scanner</span>
              </button>

              <button
                onClick={() => setActiveCockpitTab('interview')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 ${
                  activeCockpitTab === 'interview'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Video size={16} />
                <span>AI Live Mock Coach</span>
              </button>

              <button
                onClick={() => setActiveCockpitTab('portfolio')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 ${
                  activeCockpitTab === 'portfolio'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Globe size={16} />
                <span>GitHub Portfolio Builder</span>
              </button>

              <button
                onClick={() => setActiveCockpitTab('recruiter')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 ${
                  activeCockpitTab === 'recruiter'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Users size={16} />
                <span>Recruiter Talent Portal</span>
              </button>
            </div>

            {/* Live Indicator Badge */}
            <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-emerald-400 text-xs font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE TELEMETRY</span>
            </div>
          </div>

          {/* Tab Content Display */}
          <div className="relative z-10 min-h-[380px]">
            <AnimatePresence mode="wait">
              {activeCockpitTab === 'ats' && (
                <motion.div
                  key="ats"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
                >
                  <div className="lg:col-span-7 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-mono font-bold">
                      <Zap size={14} />
                      <span>PARSER ENGINE v3.4 ACTIVE</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                      Deep Keyword & Metric Analysis for Top-Tier ATS Systems
                    </h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                      CareerShala parses your resume against specific target Job Descriptions, highlighting missing technical keywords, quantifying impact bullets, and formatting for Workday, Greenhouse, and Lever.
                    </p>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                        <p className="text-xs text-slate-400 font-medium">Average Match Lift</p>
                        <p className="text-xl sm:text-2xl font-extrabold text-sky-400 mt-1">+42%</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                        <p className="text-xs text-slate-400 font-medium">Scan Time</p>
                        <p className="text-xl sm:text-2xl font-extrabold text-emerald-400 mt-1">&lt; 1.2s</p>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-5 bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 space-y-4 shadow-inner">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                      <span className="text-xs font-mono text-slate-400 uppercase">Match Score Target</span>
                      <span className="text-sm font-extrabold text-emerald-400 font-mono">94 / 100</span>
                    </div>

                    <div className="space-y-3">
                      {[
                        { label: 'System Design Keywords', val: 95, color: 'bg-emerald-500' },
                        { label: 'Quantitative Metrics', val: 88, color: 'bg-sky-500' },
                        { label: 'Cloud Architecture & DevOps', val: 92, color: 'bg-indigo-500' },
                        { label: 'Formatting & Parseability', val: 100, color: 'bg-emerald-400' },
                      ].map((stat, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-slate-300">
                            <span>{stat.label}</span>
                            <span className="font-mono">{stat.val}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${stat.val}%` }}
                              transition={{ duration: 1, delay: 0.1 * idx }}
                              className={`h-full ${stat.color}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeCockpitTab === 'interview' && (
                <motion.div
                  key="interview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
                >
                  <div className="lg:col-span-7 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-bold">
                      <ShieldCheck size={14} />
                      <span>VISION & SPEECH AI ACTIVE</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                      Real-Time AI Mock Interviews with Vision Proctoring
                    </h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                      Practice tech interviews under realistic conditions. Our vision engine checks gaze stability while our speech model measures pace, filler words, and technical depth.
                    </p>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700">
                        ⚡ MediaPipe Gaze Tracking
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700">
                        🎤 Speech Pace Coach
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700">
                        🏆 100% Club Certification
                      </span>
                    </div>
                  </div>

                  <div className="lg:col-span-5 bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                      <span className="text-xs font-mono text-slate-400 uppercase">Live Evaluation telemetry</span>
                      <span className="text-xs font-extrabold text-indigo-400 font-mono">● SESSION ACTIVE</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700">
                        <p className="text-xs text-slate-400">Confidence Score</p>
                        <p className="text-2xl font-black text-indigo-400 mt-1">96%</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700">
                        <p className="text-xs text-slate-400">Pace (WPM)</p>
                        <p className="text-2xl font-black text-emerald-400 mt-1">142</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeCockpitTab === 'portfolio' && (
                <motion.div
                  key="portfolio"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
                >
                  <div className="lg:col-span-7 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                      <Globe size={14} />
                      <span>FREE GITHUB PORTFOLIO BUILDER</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                      Instant Developer Portfolios Synced with GitHub
                    </h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                      Connect your GitHub account in 1-click to auto-generate a sleek developer website showcase complete with live projects, tech stacks, and your verified ATS resume.
                    </p>
                  </div>

                  <div className="lg:col-span-5 bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                        <Code size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">portfolio.careershala.com/username</p>
                        <p className="text-xs text-slate-400">100% Free Forever · Fast CDN Hosted</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeCockpitTab === 'recruiter' && (
                <motion.div
                  key="recruiter"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
                >
                  <div className="lg:col-span-7 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-mono font-bold">
                      <Users size={14} />
                      <span>RECRUITER DISPATCH SUITE</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                      Direct Candidate Search & Verified Match Ranking
                    </h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                      Recruiters query top verified candidates by exact skill stacks, candidate scores, and verified QR badges for instant outreach dispatch.
                    </p>
                  </div>

                  <div className="lg:col-span-5 bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 space-y-3">
                    <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-700">
                      <p className="text-xs font-mono text-purple-400 font-bold">RECRUITER API ACTIVE</p>
                      <p className="text-sm text-slate-200 mt-1 font-medium">
                        Instant Job Description matching across 10,000+ verified tech candidate profiles.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
