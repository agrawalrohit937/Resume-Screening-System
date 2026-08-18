import React from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  Video,
  Globe,
  Award,
  Users,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Trophy,
  ArrowRight,
  Sparkles,
  Send,
  Cpu,
} from 'lucide-react'

export default function LandingFeaturesSection({ fadeInUp }) {
  return (
    <section id="features" className="py-16 sm:py-24 bg-gradient-to-b from-white via-slate-50/60 to-white relative overflow-hidden">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[500px] bg-gradient-to-tr from-sky-200/15 via-indigo-200/10 to-amber-200/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-sky-200 text-[#2E9BDA] text-[11px] font-black tracking-widest uppercase mb-3.5 shadow-xs backdrop-blur-md">
            <Sparkles size={13} className="text-amber-500" />
            <span>MODERN AI CAREER ARCHITECTURE</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-3.5 leading-tight">
            Built to Give You an{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-indigo-600 to-[#1d6fa5]">
              Unfair Advantage
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
            Everything you need to bypass ATS filters, ace proctored technical interviews, automate outreach, and land top software offers.
          </p>
        </div>

        {/* ── LUXURY BENTO GRID ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1: Large Spotlight (Span 2 cols on LG) - AI Live Interview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-2 bg-gradient-to-br from-white via-white to-sky-50/40 rounded-[2rem] p-7 sm:p-8 border border-slate-200/90 shadow-[0_4px_25px_-4px_rgba(46,155,218,0.08)] hover:shadow-[0_16px_45px_-6px_rgba(46,155,218,0.18)] hover:border-sky-300 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
          >
            {/* Top Glossy Highlight Line */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-sky-400/50 to-transparent pointer-events-none" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[#2E9BDA]/10 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
            
            <div>
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                    <Video size={20} />
                  </div>
                  <div>
                    <span className="inline-block text-[11px] font-black uppercase tracking-wider text-indigo-700 font-mono">
                      AI VISION &amp; PROCTORING
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                      Live Mock Interview with Computer Vision Coach
                    </h3>
                  </div>
                </div>

                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> 60 FPS WASM
                </span>
              </div>

              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6 max-w-2xl font-medium">
                Experience realistic technical assessments with our friendly AI Alex. Includes real-time eye gaze tracking, looking down detection, and instant speech pacing feedback.
              </p>

              {/* Simulated Interactive HUD */}
              <div className="bg-slate-950 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-inner grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Gaze Tracking</p>
                  <p className="text-xs font-extrabold text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Focused (Center)
                  </p>
                </div>
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Looking Down</p>
                  <p className="text-xs font-extrabold text-slate-200">3s Anti-Cheat Guard</p>
                </div>
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Speech Clarity</p>
                  <p className="text-xs font-extrabold text-sky-400">142 WPM • Clear</p>
                </div>
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Warning Counter</p>
                  <p className="text-xs font-extrabold text-amber-400">0 / 5 (Max Safety)</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 pt-2 border-t border-slate-100">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Speech-to-text transcription</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> MediaPipe FaceMesh &amp; Iris</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Instant AI question scoring</span>
            </div>
          </motion.div>

          {/* Card 2: 90%+ ATS Scanner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-gradient-to-br from-white via-white to-sky-50/40 rounded-[2rem] p-7 border border-slate-200/90 shadow-[0_4px_25px_-4px_rgba(46,155,218,0.08)] hover:shadow-[0_16px_45px_-6px_rgba(46,155,218,0.18)] hover:border-sky-300 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
          >
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-sky-400/50 to-transparent pointer-events-none" />

            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-[#2E9BDA] text-white flex items-center justify-center mb-5 shadow-md shadow-[#2E9BDA]/20 group-hover:scale-105 transition-transform">
                <FileText size={22} />
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-sky-50 text-[#2E9BDA] border border-sky-200 mb-3">
                SMART ATS MATCHER
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2">
                Pass Corporate ATS Filters
              </h3>
              <p className="text-slate-600 text-xs leading-relaxed mb-5 font-medium">
                Upload your resume alongside any target Job Description. Get instant missing keyword suggestions and formatting fixes.
              </p>

              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2 mb-4">
                <div className="flex justify-between text-xs font-black text-slate-800">
                  <span>ATS Match Score</span>
                  <span className="text-emerald-600 font-mono">94% (Exceptional)</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-[#2E9BDA] to-emerald-500 h-full w-[94%]" />
                </div>
              </div>
            </div>

            <div className="text-xs font-bold text-slate-500 space-y-1.5 pt-3 border-t border-slate-100">
              <p className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> Workday &amp; Greenhouse parsed</p>
              <p className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> Actionable bullet suggestions</p>
            </div>
          </motion.div>

          {/* Card 3: Free Instant Developer Portfolio */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="bg-gradient-to-br from-white via-white to-emerald-50/30 rounded-[2rem] p-7 border border-slate-200/90 shadow-[0_4px_25px_-4px_rgba(16,185,129,0.08)] hover:shadow-[0_16px_45px_-6px_rgba(16,185,129,0.18)] hover:border-emerald-300 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
          >
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent pointer-events-none" />

            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center mb-5 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Globe size={22} />
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 mb-3">
                100% FREE FOREVER
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2">
                Instant Developer Portfolio
              </h3>
              <p className="text-slate-600 text-xs leading-relaxed mb-5 font-medium">
                Connect your GitHub profile in 1-click. Generate a live developer website highlighting your repos, skills, and verified badges.
              </p>

              <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 font-mono text-[11px] font-bold text-emerald-800 truncate">
                🔗 portfolio.careershala.com/username
              </div>
            </div>

            <div className="text-xs font-bold text-slate-500 space-y-1.5 pt-4 border-t border-slate-100">
              <p className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> 1-Click GitHub repository sync</p>
              <p className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> Fast CDN global hosting</p>
            </div>
          </motion.div>

          {/* Card 4: Verified 100% Club Certificates */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-gradient-to-br from-white via-white to-amber-50/30 rounded-[2rem] p-7 border border-slate-200/90 shadow-[0_4px_25px_-4px_rgba(245,158,11,0.08)] hover:shadow-[0_16px_45px_-6px_rgba(245,158,11,0.18)] hover:border-amber-300 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
          >
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent pointer-events-none" />

            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center mb-5 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <Award size={22} />
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-200 mb-3">
                VERIFIED BADGES
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2">
                100% Club QR Certificate
              </h3>
              <p className="text-slate-600 text-xs leading-relaxed mb-5 font-medium">
                Score high in proctored mock interviews to unlock verifiable credentials with a scannable QR code for hiring managers.
              </p>

              <div className="flex items-center gap-2 p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs font-bold text-amber-900">
                <ShieldCheck size={16} className="text-amber-600 shrink-0" />
                <span>Tamper-proof recruiter validation</span>
              </div>
            </div>

            <div className="text-xs font-bold text-slate-500 space-y-1.5 pt-4 border-t border-slate-100">
              <p className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> Add badge directly to LinkedIn</p>
              <p className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> Shareable verification link</p>
            </div>
          </motion.div>

          {/* Card 5: Auto Outreach & Recruiter Copilot */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="bg-gradient-to-br from-white via-white to-cyan-50/30 rounded-[2rem] p-7 border border-slate-200/90 shadow-[0_4px_25px_-4px_rgba(6,182,212,0.08)] hover:shadow-[0_16px_45px_-6px_rgba(6,182,212,0.18)] hover:border-cyan-300 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
          >
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent pointer-events-none" />

            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center mb-5 shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                <Send size={20} />
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-cyan-50 text-cyan-800 border border-cyan-200 mb-3">
                OUTREACH AGENT
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2">
                Automated HR Outreach
              </h3>
              <p className="text-slate-600 text-xs leading-relaxed mb-5 font-medium">
                Generate high-converting recruiter cold emails, track interview responses, and automate targeted outreach.
              </p>
            </div>

            <div className="text-xs font-bold text-slate-500 space-y-1.5 pt-4 border-t border-slate-100">
              <p className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> Personalized email generator</p>
              <p className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> Application pipeline tracker</p>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
