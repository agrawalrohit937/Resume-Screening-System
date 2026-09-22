import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileText,
  Video,
  CheckCircle2,
  Zap,
  Globe,
  Award,
  Star,
  Check,
  Cpu,
  Layers,
  ChevronRight,
  QrCode,
} from 'lucide-react'

export default function LandingHeroSection({ user }) {
  const navigate = useNavigate()

  return (
    <section className="relative pt-8 sm:pt-12 pb-16 sm:pb-24 overflow-hidden bg-gradient-to-b from-sky-50/60 via-white to-slate-50/70 text-center">
      
      {/* Dynamic Multi-Color Aurora Mesh Ambient Background */}
      <div className="absolute top-0 left-1/4 w-[650px] h-[450px] bg-gradient-to-tr from-[#2E9BDA]/20 via-indigo-400/15 to-amber-300/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-20 right-1/4 w-[550px] h-[400px] bg-gradient-to-br from-sky-200/25 via-purple-200/20 to-emerald-200/15 rounded-full blur-[130px] pointer-events-none -z-10" />

      {/* Subtle geometric dot grid pattern with radial fade */}
      <div
        className="absolute inset-0 opacity-[0.16] pointer-events-none -z-10 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(46, 155, 218, 0.4) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center">
        
        {/* Category Pill with Ambient Shine */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 border border-sky-200/80 text-[#2E9BDA] text-[11px] font-extrabold uppercase tracking-wider mb-5 shadow-sm shadow-sky-500/5 backdrop-blur-md">
          <Cpu size={14} className="text-[#2E9BDA]" />
          <Sparkles size={12} className="text-amber-500 animate-pulse" />
          <span>ENTERPRISE AI ATS &amp; PROCTORED CAREER ACCELERATOR</span>
        </div>

        {/* Main Headline */}
        <h1 className="hero-title-lcp text-4xl sm:text-6xl md:text-7xl font-black text-slate-900 tracking-tight leading-[1.14] max-w-5xl mb-4">
          Score 90%+ on ATS Filters.{' '}
          <span className="inline-block pb-1 bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-sky-600 to-indigo-600">
            Ace Proctored AI Mock Interviews.
          </span>
        </h1>

        {/* Sub-headline */}
        <p className="text-base sm:text-lg text-slate-600 font-medium max-w-3xl mx-auto leading-relaxed mb-7 px-2">
          CareerShala is the complete career intelligence platform: deep semantic ATS resume optimization, 60 FPS computer-vision mock interview coaching, instant GitHub developer portfolios, and recruiter-verified QR credentials.
        </p>

        {/* Feature Highlights Exactly 3 Mini Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 w-full max-w-2xl">
          {[
            { icon: <ShieldCheck size={13} className="text-[#2E9BDA]" />, text: '99.4% ATS Compatibility' },
            { icon: <Video size={13} className="text-indigo-600" />, text: '60 FPS Vision Proctor' },
            { icon: <Globe size={13} className="text-emerald-600" />, text: 'Free Developer Portfolio' },
          ].map((pill, i) => (
            <div
              key={i}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white/90 border border-slate-200/80 text-slate-700 text-xs font-bold shadow-xs backdrop-blur-sm"
            >
              {pill.icon}
              <span>{pill.text}</span>
            </div>
          ))}
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto mb-12">
          {user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl font-extrabold text-sm sm:text-base text-white bg-gradient-to-r from-[#2E9BDA] via-[#248bc7] to-indigo-600 hover:from-[#2380b8] hover:to-indigo-700 shadow-lg shadow-[#2E9BDA]/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Go to Your Dashboard</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <>
              <Link
                to="/signup"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl font-extrabold text-sm sm:text-base text-white bg-gradient-to-r from-[#2E9BDA] via-[#248bc7] to-indigo-600 hover:from-[#2380b8] hover:to-indigo-700 shadow-lg shadow-[#2E9BDA]/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Start Your Free Career Journey</span>
                <Sparkles size={16} className="group-hover:rotate-12 transition-transform" />
              </Link>
              <a
                href="#features"
                className="w-full sm:w-auto px-7 py-4 rounded-2xl font-bold text-sm sm:text-base text-slate-700 bg-white/90 border border-slate-200/90 hover:bg-white hover:border-slate-300 shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer backdrop-blur-sm"
              >
                <span>Explore Full Capabilities</span>
                <ChevronRight size={15} className="text-slate-400" />
              </a>
            </>
          )}
        </div>

        {/* ── STATIC PRESTIGE DASHBOARD SHOWCASE (UNIFIED LIGHT THEME) ── */}
        <div className="w-full max-w-5xl bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border-2 border-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.14),0_12px_28px_-8px_rgba(46,155,218,0.2)] text-left relative overflow-hidden mb-12">
          {/* Top highlight sheen line */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400/80 to-transparent pointer-events-none" />

          {/* Top Browser Bar Mockup */}
          <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-400/80" />
              <span className="w-3 h-3 rounded-full bg-amber-400/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-400/80" />
              <span className="ml-2 text-xs font-mono font-bold text-slate-400 hidden sm:inline">
                https://careershala.tech/dashboard/overview
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono font-extrabold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>AI COGNITIVE ENGINE ACTIVE</span>
            </div>
          </div>

          {/* 3-Column Unified Light Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            
            {/* 1. ATS Score Optimizer Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-50/90 to-white border border-slate-200/80 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-[#2E9BDA] flex items-center justify-center font-black shadow-xs">
                    <FileText size={18} />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10.5px] font-mono font-black border border-emerald-200">
                    PASSED 96%
                  </span>
                </div>
                <h4 className="text-sm font-black text-slate-900">Semantic ATS Matcher</h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5 mb-3.5">
                  Target: Full-Stack Architect
                </p>

                <div className="space-y-1.5">
                  {[
                    { name: 'React 18 & Next.js', score: '98%' },
                    { name: 'FastAPI & Python', score: '96%' },
                    { name: 'Docker & Kubernetes', score: '94%' },
                  ].map((s, i) => (
                    <div key={i} className="flex justify-between items-center text-xs bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70 font-bold text-slate-700">
                      <span>{s.name}</span>
                      <span className="text-[#2E9BDA] font-mono">{s.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 text-[11px] text-emerald-700 font-bold flex items-center gap-1.5 mt-3">
                <Check size={13} strokeWidth={3} className="text-emerald-600" />
                <span>Parsed for Workday &amp; Greenhouse</span>
              </div>
            </div>

            {/* 2. Live Vision Mock Interview Card (Differentiated by Accent Border/Glow, Same Light Base) */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-indigo-50/40 via-white to-white border-2 border-indigo-500/30 ring-4 ring-indigo-500/5 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-black shadow-xs">
                    <Video size={18} />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10.5px] font-mono font-black border border-indigo-200">
                    60 FPS PROCTOR
                  </span>
                </div>
                <h4 className="text-sm font-black text-slate-900">AI Mock Interview Coach</h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5 mb-3.5 truncate">
                  Prompt: "Explain optimistic UI updates in React."
                </p>

                <div className="space-y-1.5 bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/70 text-xs">
                  <div className="flex justify-between items-center text-slate-700 font-medium">
                    <span>Iris Gaze Tracking:</span>
                    <span className="text-emerald-600 font-bold font-mono">98% Focused</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700 font-medium">
                    <span>Speech Cadence:</span>
                    <span className="text-indigo-600 font-bold font-mono">142 WPM</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700 font-medium">
                    <span>Anti-Cheat Status:</span>
                    <span className="text-emerald-600 font-bold font-mono">0 Flags</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 text-[11px] text-indigo-700 font-bold flex items-center gap-1.5 mt-3">
                <Sparkles size={13} className="text-indigo-600" />
                <span>Instant rubric &amp; answer evaluation</span>
              </div>
            </div>

            {/* 3. GitHub Portfolio & QR Certificate Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-50/90 to-white border border-slate-200/80 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-black shadow-xs">
                    <Award size={18} />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10.5px] font-mono font-black border border-amber-200">
                    100% CLUB
                  </span>
                </div>
                <h4 className="text-sm font-black text-slate-900">Verified QR Certificate</h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5 mb-3.5">
                  ID: CS-2026-9821 (Public Scan)
                </p>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-800 font-bold">
                    <Globe size={13} className="text-[#2E9BDA]" />
                    <span className="truncate">careershala.tech/dev/rohit</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <QrCode size={13} className="text-purple-600" />
                    <span>Recruiter Instant Verification</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 text-[11px] text-amber-800 font-bold flex items-center gap-1.5 mt-3">
                <Star size={13} className="text-amber-500 fill-amber-500" />
                <span>GitHub Repos + Verified ATS Badge</span>
              </div>
            </div>

          </div>
        </div>

        {/* ── Social Proof Trust Metrics Strip (Cohesive Component with Dividers & Icons) ── */}
        <div className="w-full max-w-4xl rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-xs p-5 sm:p-6 grid grid-cols-2 md:grid-cols-4 gap-y-4 md:gap-y-0 divide-y md:divide-y-0 md:divide-x divide-slate-200/80 text-center">
          <div className="px-4 py-2 sm:py-0 flex flex-col items-center">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-[#2E9BDA] flex items-center justify-center mb-2">
              <FileText size={16} />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">10,000+</p>
            <p className="text-xs text-slate-500 font-bold mt-0.5">Resumes Scored</p>
          </div>
          <div className="px-4 py-2 sm:py-0 flex flex-col items-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
              <ShieldCheck size={16} />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-[#2E9BDA] font-mono">99.4%</p>
            <p className="text-xs text-slate-500 font-bold mt-0.5">ATS Pass Rate</p>
          </div>
          <div className="px-4 py-2 sm:py-0 flex flex-col items-center">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
              <Zap size={16} />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-indigo-600 font-mono">4.2x</p>
            <p className="text-xs text-slate-500 font-bold mt-0.5">Faster Callbacks</p>
          </div>
          <div className="px-4 py-2 sm:py-0 flex flex-col items-center">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
              <Globe size={16} />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">100% Free</p>
            <p className="text-xs text-slate-500 font-bold mt-0.5">GitHub Portfolio Site</p>
          </div>
        </div>

      </div>
    </section>
  )
}
