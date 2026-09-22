/**
 * LandingCockpitSection (Merged Interactive Demo Suite)
 * ----------------------------------------------------
 * Unified interactive suite combining the former Telemetry Cockpit & ATS Playground.
 * Provides live tabs for:
 *  1. ATS Matcher HUD (Keyword alignment, matched tokens, bullet optimizer)
 *  2. AI Mock Interview Coach (Vision proctoring HUD, speech pace gauge)
 *  3. 1-Click GitHub Portfolio Sync
 *  4. Tamper-Proof QR Certificate Preview
 *
 * Primary Anchor: #demo (also supports legacy #cockpit)
 */

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  FileText,
  Video,
  Globe,
  Users,
  Zap,
  Sparkles,
  ShieldCheck,
  Code,
  ArrowRight,
  CheckCircle2,
  Eye,
  Activity,
  Mic,
  ExternalLink,
  Star,
  Search,
  Check,
  TrendingUp,
  Cpu,
  Layers,
  Send,
  Award,
  CheckSquare,
  QrCode,
} from 'lucide-react'

const TABS = [
  { id: 'ats', label: 'ATS Matcher HUD', subtitle: 'Keyword & Metric Alignment', icon: FileText },
  { id: 'interview', label: 'AI Mock Interview Coach', subtitle: 'Vision & Speech Proctoring', icon: Video },
  { id: 'portfolio', label: 'GitHub Portfolio Builder', subtitle: 'Instant 1-Click Dev Site', icon: Globe },
  { id: 'certificate', label: 'Verified QR Certificate', subtitle: 'Tamper-Proof Skill Badge', icon: Award },
]

const ROTATION_INTERVAL = 3000

export default function LandingCockpitSection({
  activeCockpitTab,
  setActiveCockpitTab,
  user,
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (isHovered) return

    setProgress(0)
    const startTime = Date.now()

    const progressTimer = setInterval(() => {
      const elapsed = Date.now() - startTime
      const currentProgress = Math.min(100, (elapsed / ROTATION_INTERVAL) * 100)
      setProgress(currentProgress)
    }, 50)

    const switchTimer = setTimeout(() => {
      setActiveCockpitTab((prev) => {
        const currentIndex = TABS.findIndex((t) => t.id === prev)
        const nextIndex = (currentIndex + 1) % TABS.length
        return TABS[nextIndex].id
      })
    }, ROTATION_INTERVAL)

    return () => {
      clearInterval(progressTimer)
      clearTimeout(switchTimer)
    }
  }, [activeCockpitTab, isHovered, setActiveCockpitTab])

  return (
    <section id="demo" className="py-14 sm:py-20 bg-gradient-to-b from-[#F8FAFC] via-[#F1F5F9] to-white relative overflow-hidden text-slate-900 border-y border-slate-200/80">
      <span id="cockpit" className="sr-only" />
      
      {/* Background Lighting Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-[#2E9BDA]/15 via-indigo-500/10 to-transparent blur-[140px] rounded-full" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[500px] h-[500px] bg-sky-200/40 blur-[140px] rounded-full" />
      <div className="pointer-events-none absolute top-1/2 left-0 w-[400px] h-[400px] bg-indigo-200/30 blur-[130px] rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200/90 text-[#2E9BDA] text-xs font-black tracking-widest uppercase mb-3 shadow-sm backdrop-blur-md"
          >
            <Cpu size={14} className="text-[#2E9BDA]" />
            <span>UNIFIED CAREER SUITE</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.15] mb-4"
          >
            One Unified Platform for Your{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-indigo-600 to-[#1d6fa5]">
              Career Acceleration
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-sm sm:text-base text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed"
          >
            Explore live interactive previews of our core AI modules built for developers and engineering recruiters.
          </motion.p>
        </div>

        {/* Feature Showcase Container Card */}
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="rounded-3xl bg-white border border-slate-200/90 shadow-2xl shadow-slate-300/60 overflow-hidden relative"
        >
          {/* Top Progress Line */}
          <div className="w-full h-1 bg-slate-100 relative overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#2E9BDA] via-indigo-500 to-sky-400"
              style={{ width: `${isHovered ? 100 : progress}%` }}
              transition={{ ease: 'linear' }}
            />
          </div>

          {/* Tab Selector Bar */}
          <div className="p-3 sm:p-5 border-b border-slate-200/80 bg-slate-50/70">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {TABS.map((tab) => {
                const Icon = tab.icon
                const isActive = activeCockpitTab === tab.id

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveCockpitTab(tab.id)
                      setProgress(0)
                    }}
                    className={`relative flex items-center gap-3 px-4 py-3.5 rounded-2xl font-extrabold text-xs sm:text-sm transition-all duration-200 text-left border ${
                      isActive
                        ? 'bg-white text-slate-900 border-[#2E9BDA] shadow-md shadow-[#2E9BDA]/10 ring-2 ring-[#2E9BDA]/20'
                        : 'bg-slate-100/50 text-slate-500 border-transparent hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    
                    <div
                      className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                        isActive ? 'bg-[#2E9BDA] text-white shadow-md shadow-[#2E9BDA]/30' : 'bg-slate-200/70 text-slate-600'
                      }`}
                    >
                      <Icon size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-black truncate text-xs sm:text-sm leading-tight text-slate-900">{tab.label}</p>
                      <p className="text-[10.5px] font-semibold text-[#2E9BDA] mt-0.5 truncate">
                        {tab.subtitle}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Module Canvas Surface */}
          <div className="p-6 sm:p-10 min-h-[440px] flex items-center justify-center bg-white relative">
            <AnimatePresence mode="wait">
              
              {/* TAB 1: ATS RESUME OPTIMIZER */}
              {activeCockpitTab === 'ats' && (
                <motion.div
                  key="ats"
                  initial={{ opacity: 0, y: 15, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -15, scale: 0.99 }}
                  transition={{ duration: 0.3 }}
                  className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
                >
                  <div className="lg:col-span-6 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-[#2E9BDA] text-xs font-bold uppercase tracking-wider">
                      <Zap size={14} className="text-[#2E9BDA]" />
                      <span>Smart ATS Engine v4.2</span>
                    </div>

                    <h3 className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight tracking-tight">
                      Deep Keyword & Metric Alignment for Top ATS Systems
                    </h3>

                    <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
                      CareerShala parses your resume against specific target Job Descriptions, highlighting missing technical keywords, quantifying impact bullets, and formatting for Workday, Greenhouse, and Lever.
                    </p>

                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-center">
                        <p className="text-xs text-slate-500 font-bold">Match Lift</p>
                        <p className="text-2xl sm:text-3xl font-black text-[#2E9BDA] mt-1">+48%</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-center">
                        <p className="text-xs text-slate-500 font-bold">Parse Time</p>
                        <p className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">0.8s</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-center">
                        <p className="text-xs text-slate-500 font-bold">Pass Rate</p>
                        <p className="text-2xl sm:text-3xl font-black text-indigo-600 mt-1">99.4%</p>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-6 bg-slate-50 rounded-3xl p-6 border border-slate-200 space-y-5 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#2E9BDA] text-white flex items-center justify-center font-black shadow-md shadow-[#2E9BDA]/20">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">Senior_React_Resume.pdf</p>
                          <p className="text-xs text-slate-500 font-medium">Target: Senior Full-Stack Architect</p>
                        </div>
                      </div>
                      <span className="px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black border border-emerald-200">
                        96% MATCH
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      {[
                        { label: 'System Design & React Architecture', val: 98, color: 'bg-[#2E9BDA]' },
                        { label: 'Quantitative Metric Bullets', val: 92, color: 'bg-emerald-500' },
                        { label: 'Cloud Infrastructure & Microservices', val: 95, color: 'bg-indigo-600' },
                      ].map((item, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span>{item.label}</span>
                            <span className="font-mono text-[#2E9BDA]">{item.val}%</span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${item.val}%` }}
                              transition={{ duration: 1, delay: 0.1 * idx }}
                              className={`h-full ${item.color}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs space-y-2 shadow-sm">
                      <div className="flex items-center justify-between text-slate-500 font-bold">
                        <span className="text-[#2E9BDA] flex items-center gap-1.5 font-black">
                          <Sparkles size={14} /> AI Impact Bullet Optimizer
                        </span>
                        <span className="text-[10px] text-emerald-600 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">OPTIMIZED</span>
                      </div>
                      <p className="text-slate-400 line-through text-[11px]">"Worked on improving frontend performance and loading speed."</p>
                      <p className="text-slate-900 font-bold bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80 text-[11.5px] leading-relaxed">
                        ✓ "Refactored React asset delivery via code-splitting & WebP compression, reducing initial payload by 1.6 MB and lifting Lighthouse score from 70 to 94+."
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 2: AI LIVE MOCK COACH */}
              {activeCockpitTab === 'interview' && (
                <motion.div
                  key="interview"
                  initial={{ opacity: 0, y: 15, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -15, scale: 0.99 }}
                  transition={{ duration: 0.3 }}
                  className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
                >
                  <div className="lg:col-span-6 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-wider">
                      <ShieldCheck size={14} className="text-indigo-600" />
                      <span>Vision Proctoring & Speech AI</span>
                    </div>

                    <h3 className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight tracking-tight">
                      Real-Time AI Mock Interviews with Vision Proctoring
                    </h3>

                    <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
                      Practice tech interviews under realistic conditions. Our vision engine checks gaze stability while our speech model measures pace, filler words, and technical depth.
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2">
                        <Eye size={15} className="text-indigo-600" /> MediaPipe Gaze Tracking
                      </span>
                      <span className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2">
                        <Mic size={15} className="text-emerald-600" /> Speech Pace Coach (WPM)
                      </span>
                      <span className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-purple-600" /> Verified Skill Badges
                      </span>
                    </div>
                  </div>

                  <div className="lg:col-span-6 bg-slate-50 rounded-3xl p-5 border border-slate-200 space-y-4 shadow-xl">
                    <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center border border-slate-800 shadow-inner">
                      <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        src="/interviewer-avatar.mp4"
                        className="w-full h-full object-cover"
                      />

                      <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>GAZE: STABLE (99%)</span>
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 bg-slate-900/85 backdrop-blur-md p-3 rounded-xl border border-white/10 text-xs text-white flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <Activity size={16} className="text-indigo-400 animate-pulse shrink-0" />
                          <span className="font-bold truncate">"How do you handle distributed locking?"</span>
                        </div>
                        <span className="text-emerald-400 font-mono font-bold shrink-0">138 WPM</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center text-xs">
                      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <p className="text-slate-500 font-bold">Confidence Index</p>
                        <p className="text-2xl font-black text-indigo-600 mt-0.5">96%</p>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <p className="text-slate-500 font-bold">Technical Rank</p>
                        <p className="text-2xl font-black text-emerald-600 mt-0.5">Top 2%</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: GITHUB PORTFOLIO BUILDER */}
              {activeCockpitTab === 'portfolio' && (
                <motion.div
                  key="portfolio"
                  initial={{ opacity: 0, y: 15, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -15, scale: 0.99 }}
                  transition={{ duration: 0.3 }}
                  className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
                >
                  <div className="lg:col-span-6 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                      <Globe size={14} className="text-emerald-600" />
                      <span>Free 1-Click Website Builder</span>
                    </div>

                    <h3 className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight tracking-tight">
                      Instant Developer Portfolios Synced with GitHub
                    </h3>

                    <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
                      Connect your GitHub account in 1-click to auto-generate a sleek developer website showcase complete with live projects, tech stacks, and your verified ATS resume.
                    </p>

                    <div className="pt-2">
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-500 font-mono uppercase font-bold">YOUR CUSTOM DOMAIN</p>
                          <p className="text-sm font-black text-slate-900 mt-0.5">careershala.tech/dev/username</p>
                        </div>
                        <span className="px-3.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-black border border-emerald-200">
                          FREE FOREVER
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-6 bg-slate-50 rounded-3xl p-5 border border-slate-200 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-600 shadow-sm">
                      <Globe size={14} className="text-emerald-600 shrink-0" />
                      <span className="text-slate-900 font-bold truncate">https://careershala.tech/dev/alex-coder</span>
                      <ExternalLink size={14} className="ml-auto text-slate-400 shrink-0" />
                    </div>

                    <div className="p-4.5 rounded-2xl bg-white border border-slate-200 space-y-3.5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-[#2E9BDA] text-white flex items-center justify-center font-black p-0.5 shadow-md">
                          <img src="/logo_t.webp" alt="Avatar" className="w-full h-full object-cover rounded-full bg-white p-1" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">Alex Chen</p>
                          <p className="text-xs text-slate-500 font-medium">Senior Full-Stack Engineer @ FinTech</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <div className="flex items-center justify-between font-black text-slate-900">
                            <span className="truncate">resume-screening-ai</span>
                            <span className="text-amber-500 font-bold flex items-center gap-0.5 shrink-0"><Star size={11} fill="currentColor" /> 342</span>
                          </div>
                          <p className="text-[10.5px] text-slate-500 font-mono mt-1">Python · React · FastAPI</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <div className="flex items-center justify-between font-black text-slate-900">
                            <span className="truncate">distributed-cache</span>
                            <span className="text-amber-500 font-bold flex items-center gap-0.5 shrink-0"><Star size={11} fill="currentColor" /> 128</span>
                          </div>
                          <p className="text-[10.5px] text-slate-500 font-mono mt-1">Go · Redis · Raft</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 4: VERIFIED QR CERTIFICATE */}
              {activeCockpitTab === 'certificate' && (
                <motion.div
                  key="certificate"
                  initial={{ opacity: 0, y: 15, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -15, scale: 0.99 }}
                  transition={{ duration: 0.3 }}
                  className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
                >
                  <div className="lg:col-span-6 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider">
                      <Award size={14} className="text-amber-600" />
                      <span>Tamper-Proof Credential System</span>
                    </div>

                    <h3 className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight tracking-tight">
                      Instant Recruiter-Verifiable QR Certificates
                    </h3>

                    <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
                      Score 90%+ on any proctored AI assessment to unlock a cryptographically signed verifiable digital certificate. Hiring managers scan the QR to inspect your full video interview telemetry.
                    </p>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold">Verification Speed</p>
                        <p className="text-2xl font-black text-emerald-600 mt-1">&lt; 1 Second</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold">Recruiter Callback</p>
                        <p className="text-2xl font-black text-[#2E9BDA] mt-1">4.2x Faster</p>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-6 bg-slate-50 rounded-3xl p-5 border border-slate-200 space-y-3.5 shadow-xl">
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white border border-slate-700 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#2E9BDA]/20 rounded-full blur-2xl pointer-events-none" />
                      
                      <div className="flex items-center justify-between pb-4 border-b border-slate-700">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#2E9BDA] flex items-center justify-center font-black text-white text-xs">
                            CS
                          </div>
                          <div>
                            <p className="text-xs font-black tracking-wider uppercase text-slate-200">CareerShala Verified</p>
                            <p className="text-[10px] text-slate-400 font-mono">ID: CS-2026-9821</p>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-black border border-emerald-500/30">
                          100% CLUB VERIFIED
                        </span>
                      </div>

                      <div className="py-4 space-y-1">
                        <p className="text-[11px] text-slate-400 uppercase tracking-widest font-mono">CANDIDATE CREDENTIAL</p>
                        <h4 className="text-lg font-black text-white">Full-Stack AI &amp; React Architect</h4>
                        <p className="text-xs text-slate-300">Awarded to <span className="text-white font-bold">Rohit Agrawal</span> with 98% Proctor Score</p>
                      </div>

                      <div className="pt-3 border-t border-slate-700 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <QrCode size={32} className="text-[#2E9BDA] bg-white/10 p-1 rounded-lg" />
                          <div>
                            <p className="text-[10px] text-slate-400 font-mono">Scan to Verify</p>
                            <p className="text-[11px] font-bold text-sky-300">careershala.tech/verify/CS-2026</p>
                          </div>
                        </div>
                        <span className="text-[11px] text-emerald-400 font-mono font-bold">
                          ✓ Signed &amp; Authentic
                        </span>
                      </div>
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
