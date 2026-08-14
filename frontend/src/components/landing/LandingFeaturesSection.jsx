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
  Gamepad2,
  Bot,
  Flame,
  Activity,
  Cpu,
} from 'lucide-react'

export default function LandingFeaturesSection({ fadeInUp }) {
  return (
    <section id="features" className="py-20 sm:py-28 bg-slate-50/50 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-sky-200/20 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-sky-200 text-[#2E9BDA] text-xs font-bold uppercase tracking-wider mb-4 shadow-sm">
            <Sparkles size={14} />
            <span>Modern 8-in-1 AI Career Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
            Built to Give You an <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] to-indigo-600">Unfair Advantage</span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
            Everything you need to bypass ATS filters, ace proctored technical interviews, automate recruiter outreach, and land top software offers.
          </p>
        </div>

        {/* ── BENTO GRID ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1: Large Spotlight (Span 2 cols on LG) - AI Live Interview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-2 bg-gradient-to-br from-white via-white to-sky-50/60 rounded-3xl p-7 sm:p-9 border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#2E9BDA]/10 to-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div>
              <div className="flex items-center justify-between gap-3 mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Video size={13} />
                  <span>AI VIDEO INTERVIEW &amp; PROCTORING</span>
                </span>
                <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  ● 60 FPS WASM PROCTORING
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">
                Practice Live Technical Interviews with Computer Vision Proctoring
              </h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6 max-w-2xl">
                Experience realistic technical assessments with our friendly AI Alex. Includes real-time eye gaze tracking, looking down detection, and instant speech pacing feedback.
              </p>

              {/* Simulated Interactive HUD */}
              <div className="bg-slate-950 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-inner grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Gaze Tracking</p>
                  <p className="text-xs font-extrabold text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Focused (Center)
                  </p>
                </div>
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Looking Down</p>
                  <p className="text-xs font-extrabold text-slate-200">3s Anti-Cheat Guard</p>
                </div>
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Device Scanner</p>
                  <p className="text-xs font-extrabold text-sky-400">Mobile &amp; Tab Safe</p>
                </div>
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Warning Counter</p>
                  <p className="text-xs font-extrabold text-amber-400">0 / 5 (Max Safety)</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 pt-2">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-emerald-500" /> Speech-to-text transcription</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-emerald-500" /> MediaPipe FaceMesh &amp; Iris</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-emerald-500" /> Question-by-question scoring</span>
            </div>
          </motion.div>

          {/* Card 2: 90%+ ATS Scanner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-white rounded-3xl p-7 border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-200 text-[#2E9BDA] flex items-center justify-center mb-5">
                <FileText className="w-6 h-6" />
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-sky-50 text-[#2E9BDA] border border-sky-200 mb-3">
                SMART ATS MATCHER
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2.5">
                Pass Corporate ATS Algorithms
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-5">
                Upload your resume alongside any target Job Description. Get instant missing keyword suggestions and formatting fixes.
              </p>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 mb-4">
                <div className="flex justify-between text-xs font-extrabold text-slate-800">
                  <span>ATS Match Score</span>
                  <span className="text-emerald-600 font-mono">94% (Exceptional)</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-[#2E9BDA] to-emerald-500 h-full w-[94%]" />
                </div>
              </div>
            </div>

            <div className="text-xs font-bold text-slate-500 space-y-1.5">
              <p className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Workday &amp; Greenhouse parsed</p>
              <p className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Actionable bullet suggestions</p>
            </div>
          </motion.div>

          {/* Card 3: Free Instant Developer Portfolio */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="bg-white rounded-3xl p-7 border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-5">
                <Globe className="w-6 h-6" />
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-3">
                100% FREE FOREVER
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2.5">
                Instant Developer Portfolio
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-5">
                Connect your GitHub profile in 1-click. Generate a live developer website highlighting your repos, skills, and verified badges.
              </p>

              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 font-mono text-[11px] font-bold text-emerald-800 truncate">
                🔗 portfolio.careershala.com/username
              </div>
            </div>

            <div className="text-xs font-bold text-slate-500 space-y-1.5 pt-4">
              <p className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> 1-Click GitHub repository sync</p>
              <p className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Fast CDN global hosting</p>
            </div>
          </motion.div>

          {/* Card 4: Verified 100% Club Certificates */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-white rounded-3xl p-7 border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-5">
                <Award className="w-6 h-6" />
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-900 border border-amber-200 mb-3">
                VERIFIED BADGES
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2.5">
                100% Club QR Certificate
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-5">
                Score high in proctored mock interviews to unlock verifiable credentials with a scannable QR code for hiring managers.
              </p>

              <div className="flex items-center gap-2 p-3 bg-amber-50/70 rounded-xl border border-amber-200/70 text-xs font-bold text-amber-900">
                <ShieldCheck size={16} className="text-amber-600 shrink-0" />
                <span>Tamper-proof recruiter validation</span>
              </div>
            </div>

            <div className="text-xs font-bold text-slate-500 space-y-1.5 pt-4">
              <p className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Add badge directly to LinkedIn</p>
              <p className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Shareable verification link</p>
            </div>
          </motion.div>

          {/* Card 5: Auto Outreach & Recruiter Copilot (Span 1 col) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="bg-white rounded-3xl p-7 border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-cyan-50 border border-cyan-200 text-cyan-600 flex items-center justify-center mb-5">
                <Send className="w-6 h-6" />
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-cyan-50 text-cyan-800 border border-cyan-200 mb-3">
                OUTREACH AGENT
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2.5">
                Auto Job Applications
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-5">
                Generate high-converting recruiter cold emails, track interview responses, and automate targeted outreach.
              </p>
            </div>

            <div className="text-xs font-bold text-slate-500 space-y-1.5">
              <p className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Personalized email generator</p>
              <p className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Application pipeline tracker</p>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
