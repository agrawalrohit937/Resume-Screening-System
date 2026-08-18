import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Play,
  Code2,
  Zap,
  Award,
  FileText,
  Video,
  Globe,
  Activity,
  Check,
} from 'lucide-react'

export default function LandingHeroSection({ user }) {
  const navigate = useNavigate()

  return (
    <section className="relative pt-6 sm:pt-10 pb-12 sm:pb-16 overflow-hidden bg-gradient-to-b from-sky-50/40 via-white to-slate-50/50 text-center">
      
      {/* Background ambient glowing orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[700px] pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-12 left-1/4 w-[550px] sm:w-[700px] h-[500px] sm:h-[650px] bg-gradient-to-tr from-[#2E9BDA]/20 via-sky-200/25 to-indigo-400/15 rounded-full blur-[140px]" />
        <div className="absolute top-10 right-1/4 w-[450px] sm:w-[600px] h-[400px] sm:h-[550px] bg-gradient-to-br from-indigo-300/20 via-purple-200/20 to-amber-200/15 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[800px] h-[300px] sm:h-[450px] bg-sky-200/30 rounded-full blur-[150px]" />
        
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.22] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,#000_70%,transparent_100%)]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(46, 155, 218, 0.4) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center">
        
        {/* Top Announcement Pill */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/95 border border-sky-200/90 shadow-xs backdrop-blur-md mb-5 sm:mb-6 hover:shadow-md hover:border-sky-300 transition-all cursor-pointer group"
          onClick={() => {
            const el = document.getElementById('playground')
            el?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
          <span className="flex h-2 w-2 rounded-full bg-[#2E9BDA] animate-pulse" />
          <span className="text-xs sm:text-sm font-extrabold text-slate-800 tracking-tight">
            ✦ AI-Powered Career Intelligence — <span className="text-[#2E9BDA]">Built for Your Next Opportunity</span>
          </span>
          <ArrowRight size={13} className="text-[#2E9BDA] group-hover:translate-x-0.5 transition-transform" />
        </div>

        {/* Main Wide Headline */}
        <h1 className="hero-title-lcp text-4xl sm:text-6xl md:text-7xl lg:text-[72px] font-black text-slate-900 tracking-tight leading-[1.2] max-w-5xl mb-4 sm:mb-5">
          Your AI-Powered{' '}
          <span className="inline-block pb-2.5 px-1 bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-indigo-600 to-[#1d6fa5]">
            Career Journey
          </span>{' '}
          Starts Here.
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg md:text-xl text-slate-600 font-medium max-w-3xl mx-auto leading-relaxed mb-8 sm:mb-9 px-2 sm:px-0">
          Stop sending job applications into a black hole. CareerShala aligns your resume for ATS filters, hosts real-time AI mock interviews with computer vision proctoring, and builds your free live developer portfolio website.
        </p>

        {/* Action Buttons Row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto mb-9 sm:mb-10">
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
                <span>Start Your Career Journey</span>
                <Sparkles size={16} className="group-hover:rotate-12 transition-transform" />
              </Link>
              <a
                href="#playground"
                className="w-full sm:w-auto px-7 py-4 rounded-2xl font-bold text-sm sm:text-base text-slate-700 bg-white border border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play size={14} className="text-[#2E9BDA] fill-[#2E9BDA]" />
                <span>Test ATS Matcher Live</span>
              </a>
            </>
          )}
        </div>

        {/* 4 Value Proof Capsule Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 text-xs sm:text-[13px] font-bold text-slate-700 mb-9 sm:mb-11">
          <div className="flex items-center gap-1.5 bg-white/95 px-4 py-2 rounded-full border border-slate-200/90 shadow-2xs">
            <CheckCircle2 size={15} className="text-emerald-500" />
            <span>No Credit Card Required</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/95 px-4 py-2 rounded-full border border-slate-200/90 shadow-2xs">
            <ShieldCheck size={15} className="text-[#2E9BDA]" />
            <span>60 FPS Vision Proctoring</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/95 px-4 py-2 rounded-full border border-slate-200/90 shadow-2xs">
            <Code2 size={15} className="text-purple-600" />
            <span>Free Developer Portfolio</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/95 px-4 py-2 rounded-full border border-slate-200/90 shadow-2xs">
            <Zap size={15} className="text-amber-500" />
            <span>99.4% ATS Compatibility</span>
          </div>
        </div>

        {/* Horizontal Telemetry Ribbon Card - Fills screen width gracefully */}
        <div className="w-full max-w-5xl mx-auto mb-10 sm:mb-12 bg-white/95 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-lg shadow-slate-900/5 grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-[#2E9BDA] flex items-center justify-center font-black shrink-0 border border-sky-100">
              <FileText size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900 leading-tight">ATS Resume Engine</p>
              <p className="text-[11px] font-bold text-emerald-600">96% Average Match</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black shrink-0 border border-indigo-100">
              <Video size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900 leading-tight">AI Mock Coach</p>
              <p className="text-[11px] font-bold text-indigo-600">60 FPS Vision Proctor</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black shrink-0 border border-emerald-100">
              <Globe size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900 leading-tight">GitHub Portfolio</p>
              <p className="text-[11px] font-bold text-emerald-600">Instant 1-Click Sync</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black shrink-0 border border-amber-100">
              <Award size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900 leading-tight">100% Club Badges</p>
              <p className="text-[11px] font-bold text-amber-600">Verifiable QR Credentials</p>
            </div>
          </div>
        </div>

        {/* Monochrome Trust Strip */}
        <div className="w-full max-w-5xl pt-7 border-t border-slate-200/80 flex flex-col items-center gap-3.5">
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            TRUSTED BY CANDIDATES PRACTICING FOR TOP ENGINEERING TEAMS
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 text-slate-400 font-extrabold text-sm sm:text-base tracking-wide opacity-80">
            <span className="hover:text-slate-800 transition-colors">Google</span>
            <span className="hover:text-slate-800 transition-colors">Microsoft</span>
            <span className="hover:text-slate-800 transition-colors">Amazon</span>
            <span className="hover:text-slate-800 transition-colors">Meta</span>
            <span className="hover:text-slate-800 transition-colors">Flipkart</span>
            <span className="hover:text-slate-800 transition-colors">TCS Digital</span>
          </div>
        </div>

      </div>
    </section>
  )
}
