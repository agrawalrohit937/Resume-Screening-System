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
  Brain,
  Layers,
  ChevronRight,
} from 'lucide-react'

export default function LandingFeaturesSection({ fadeInUp }) {
  return (
    <section id="features" className="py-16 sm:py-24 relative overflow-hidden bg-gradient-to-b from-white via-slate-50/70 to-white">
      {/* Dynamic Multi-Color Aurora Mesh Ambient Backgrounds */}
      <div className="absolute top-1/4 right-1/4 w-[650px] h-[450px] bg-gradient-to-tr from-[#2E9BDA]/15 via-indigo-500/10 to-amber-300/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-1/2 left-1/12 w-[500px] h-[350px] bg-gradient-to-br from-sky-200/20 to-purple-200/15 rounded-full blur-[130px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/3 w-[450px] h-[300px] bg-gradient-to-tl from-emerald-200/15 to-indigo-200/15 rounded-full blur-[130px] pointer-events-none -z-10" />

      {/* Subtle geometric dot grid pattern with radial fade */}
      <div
        className="absolute inset-0 opacity-[0.16] pointer-events-none -z-10 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(46, 155, 218, 0.4) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-sky-200/80 text-[#2E9BDA] text-[11px] font-extrabold uppercase tracking-wider mb-4 shadow-sm shadow-sky-500/5 backdrop-blur-md">
            <Cpu size={14} className="text-[#2E9BDA]" />
            <Sparkles size={12} className="text-amber-500 animate-pulse" />
            <span>MODERN AI CAREER ARCHITECTURE</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.16] mb-3.5">
            Built to Give You an{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-sky-600 to-indigo-600">
              Unfair Advantage.
            </span>
          </h2>

          <p className="text-slate-600 text-sm sm:text-base font-medium leading-relaxed max-w-2xl mx-auto">
            Everything you need to bypass ATS filters, ace proctored technical interviews, automate outreach, and land top software engineering offers.
          </p>
        </div>

        {/* ── LUXURY BENTO GRID WITH VIBRANT COLOR ACCENTS & HOVER EFFECTS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 items-stretch">
          
          {/* Card 1: Large Featured Spotlight (Span 2 cols on LG) - AI Vision */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -6, transition: { duration: 0.25 } }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-2 relative group"
          >
            {/* Ambient Multi-Layer Radial Glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-sky-400/20 via-indigo-500/15 to-purple-400/15 rounded-[2.5rem] blur-2xl group-hover:blur-3xl group-hover:opacity-100 opacity-70 transition-all duration-500 -z-10" />

            {/* Main Luxury Glassmorphic Card Frame */}
            <div className="h-full rounded-[2rem] p-7 sm:p-9 bg-gradient-to-br from-white via-indigo-50/20 to-sky-50/30 backdrop-blur-2xl border border-indigo-100/90 shadow-sm group-hover:shadow-[0_20px_60px_-15px_rgba(99,102,241,0.25)] group-hover:border-indigo-400/80 transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
              
              {/* Glossy Top Border Accent Line */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/80 to-transparent pointer-events-none group-hover:via-sky-400 transition-all duration-500" />

              <div>
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-300/80 text-indigo-600 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                      <Video size={22} className="text-indigo-600" />
                    </div>
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 font-mono block">
                        AI VISION &amp; SPEECH PROCTOR
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight group-hover:text-indigo-950 transition-colors">
                        Live Mock Interview Coaching
                      </h3>
                    </div>
                  </div>

                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono font-extrabold text-emerald-800 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-300 shadow-2xs shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> 60 FPS WASM
                  </span>
                </div>

                <p className="text-slate-600 text-sm leading-relaxed mb-6 font-medium">
                  Experience realistic technical assessments with real-time eye gaze tracking, looking-down detection, speech pacing analytics, and instant rubric evaluations.
                </p>

                {/* Clean 3-Metric Feature Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-2">
                  <div className="p-3.5 rounded-xl bg-white/90 border border-indigo-100 shadow-2xs group-hover:border-indigo-200 transition-colors">
                    <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Iris Gaze Tracker</p>
                    <p className="text-xs font-extrabold text-slate-900 mt-1 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-500" /> 98% Eye Focus
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/90 border border-indigo-100 shadow-2xs group-hover:border-indigo-200 transition-colors">
                    <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Speech Cadence</p>
                    <p className="text-xs font-extrabold text-slate-900 mt-1 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-indigo-600" /> 142 WPM Pacing
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/90 border border-indigo-100 shadow-2xs group-hover:border-indigo-200 transition-colors">
                    <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Anti-Cheat Monitor</p>
                    <p className="text-xs font-extrabold text-slate-900 mt-1 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-500" /> 0 Flags Detected
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 text-xs font-bold text-slate-600 pt-5 border-t border-slate-200/80 mt-6">
                <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Real-time speech guidance</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Lightweight zero-lag WASM</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Instant answer score</span>
              </div>
            </div>
          </motion.div>

          {/* Card 2: 90%+ ATS Scanner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -6, transition: { duration: 0.25 } }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-[2rem] p-7 sm:p-8 bg-gradient-to-br from-white via-sky-50/30 to-white backdrop-blur-md border border-sky-200/80 shadow-xs hover:shadow-[0_20px_50px_-15px_rgba(46,155,218,0.22)] hover:border-sky-400 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
          >
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-300 text-[#2E9BDA] flex items-center justify-center mb-5 shadow-xs group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                <FileText size={22} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-[#2E9BDA] font-mono block mb-1">
                SMART ATS ENGINE
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2 group-hover:text-[#2E9BDA] transition-colors">
                Pass Corporate ATS Filters
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6 font-medium">
                Upload your resume against any target Job Description for instant missing keyword density and formatting fixes.
              </p>
            </div>

            <div className="text-xs font-bold text-slate-600 space-y-2 pt-4 border-t border-slate-200/80">
              <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> Workday &amp; Greenhouse parsed</p>
              <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> Actionable XYZ bullet rewrites</p>
            </div>
          </motion.div>

          {/* Card 3: Free Instant Developer Portfolio */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -6, transition: { duration: 0.25 } }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="rounded-[2rem] p-7 sm:p-8 bg-gradient-to-br from-white via-emerald-50/30 to-white backdrop-blur-md border border-emerald-200/80 shadow-xs hover:shadow-[0_20px_50px_-15px_rgba(16,185,129,0.22)] hover:border-emerald-400 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
          >
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-300 text-emerald-600 flex items-center justify-center mb-5 shadow-xs group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                <Globe size={22} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 font-mono block mb-1">
                100% FREE FOREVER
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2 group-hover:text-emerald-700 transition-colors">
                Instant Developer Portfolio
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6 font-medium">
                Connect your GitHub profile in 1-click to auto-publish a live developer website at careershala.tech/dev/yourname.
              </p>
            </div>

            <div className="text-xs font-bold text-slate-600 space-y-2 pt-4 border-t border-slate-200/80">
              <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> 1-Click GitHub repository sync</p>
              <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> Global ultra-fast CDN hosting</p>
            </div>
          </motion.div>

          {/* Card 4: Recruiter Shortlist & Candidate Ranker */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -6, transition: { duration: 0.25 } }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-[2rem] p-7 sm:p-8 bg-gradient-to-br from-white via-purple-50/30 to-white backdrop-blur-md border border-purple-200/80 shadow-xs hover:shadow-[0_20px_50px_-15px_rgba(168,85,247,0.22)] hover:border-purple-400 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
          >
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-300 text-purple-600 flex items-center justify-center mb-5 shadow-xs group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                <Users size={22} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-purple-700 font-mono block mb-1">
                ENTERPRISE PORTAL
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2 group-hover:text-purple-700 transition-colors">
                Talent Shortlist Pipeline
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6 font-medium">
                Hiring managers filter pre-screened developers ranked by validated proctor scores, gaze stability, and skill tags.
              </p>
            </div>

            <div className="text-xs font-bold text-slate-600 space-y-2 pt-4 border-t border-slate-200/80">
              <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> Batch JD-to-resume matching</p>
              <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> Direct interview invite dispatch</p>
            </div>
          </motion.div>

          {/* Card 5: Auto Outreach & Recruiter Copilot */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -6, transition: { duration: 0.25 } }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="rounded-[2rem] p-7 sm:p-8 bg-gradient-to-br from-white via-amber-50/30 to-white backdrop-blur-md border border-amber-200/80 shadow-xs hover:shadow-[0_20px_50px_-15px_rgba(245,158,11,0.22)] hover:border-amber-400 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
          >
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-300 text-amber-600 flex items-center justify-center mb-5 shadow-xs group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                <Send size={20} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 font-mono block mb-1">
                AI OUTREACH AGENT
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2 group-hover:text-amber-700 transition-colors">
                Automated HR Outreach
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6 font-medium">
                Generate high-converting personalized recruiter cold emails highlighting your top metrics with direct Gmail dispatch.
              </p>
            </div>

            <div className="text-xs font-bold text-slate-600 space-y-2 pt-4 border-t border-slate-200/80">
              <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> Tailored JD metric alignment</p>
              <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> 1-Click direct Gmail dispatch</p>
            </div>
          </motion.div>

          {/* Card 6: CareerQuest Gamification & XP Streaks */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -6, transition: { duration: 0.25 } }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="rounded-[2rem] p-7 sm:p-8 bg-gradient-to-br from-white via-rose-50/30 to-white backdrop-blur-md border border-rose-200/80 shadow-xs hover:shadow-[0_20px_50px_-15px_rgba(244,63,94,0.22)] hover:border-rose-400 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
          >
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-rose-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-300 text-rose-600 flex items-center justify-center mb-5 shadow-xs group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                <Trophy size={22} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-rose-700 font-mono block mb-1">
                GAMIFIED QUESTS &amp; XP
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2 group-hover:text-rose-700 transition-colors">
                CareerQuest Rewards Hub
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6 font-medium">
                Maintain interview practice streaks, complete daily coding challenges, earn XP points, and climb the developer leaderboard.
              </p>
            </div>

            <div className="text-xs font-bold text-slate-600 space-y-2 pt-4 border-t border-slate-200/80">
              <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> Daily practice streaks &amp; levels</p>
              <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> Public rank badge verification</p>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
