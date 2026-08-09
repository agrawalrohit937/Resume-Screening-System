import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, CheckCircle2, ShieldCheck, Trophy, Flame, Star, Zap } from 'lucide-react'

export default function LandingHeroSection({ user, fadeInUp, staggerContainer }) {
  const navigate = useNavigate()

  return (
    <section className="relative pt-6 sm:pt-14 pb-14 sm:pb-24 overflow-hidden bg-gradient-to-b from-sky-50/50 via-white to-slate-50/40">
      {/* Dynamic Background Ambient Glowing Orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[650px] pointer-events-none -z-10 overflow-hidden transform-gpu">
        <div className="absolute -top-10 left-1/4 w-[350px] sm:w-[550px] h-[350px] sm:h-[550px] bg-gradient-to-tr from-[#2E9BDA]/20 via-sky-300/25 to-blue-500/15 rounded-full blur-3xl md:blur-[120px] animate-pulse" />
        <div className="absolute top-12 right-1/4 w-[300px] sm:w-[480px] h-[300px] sm:h-[480px] bg-gradient-to-br from-indigo-400/20 via-purple-300/20 to-pink-300/15 rounded-full blur-3xl md:blur-[120px]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[650px] h-[220px] sm:h-[350px] bg-sky-200/40 rounded-full blur-3xl md:blur-[140px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center"
        >
          {/* Top Announcement Pill */}
          <motion.div
            variants={fadeInUp}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 border border-sky-200/90 shadow-sm backdrop-blur-md mb-6 sm:mb-8 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => {
              const el = document.getElementById('playground')
              el?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#2E9BDA] animate-ping" />
            <span className="text-xs sm:text-sm font-extrabold text-slate-800 tracking-wide">
              🚀 AI CAREER ACCELERATOR 3.0 — <span className="text-[#2E9BDA]">12,500+ Resumes Optimized This Week</span>
            </span>
            <ArrowRight size={14} className="text-[#2E9BDA] group-hover:translate-x-1 transition-transform" />
          </motion.div>

          {/* User-Friendly Headline */}
          <motion.h1
            variants={fadeInUp}
            className="text-3xl sm:text-6xl md:text-7xl font-black text-slate-900 tracking-tight leading-[1.14] max-w-5xl mb-6 sm:mb-8"
          >
            Get Your Resume Noticed & Pass AI Screening in{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-indigo-600 to-[#1d6fa5] underline decoration-sky-300/60 decoration-wavy decoration-2">
              Seconds
            </span>
          </motion.h1>

          {/* Friendly Subtitle */}
          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-xl text-slate-600 font-medium max-w-3xl leading-relaxed mb-8 sm:mb-10 px-2 sm:px-0"
          >
            Stop sending job applications into a black hole. CareerShala automatically aligns your resume for ATS algorithms, helps you practice friendly AI mock interviews, and builds you a beautiful free developer portfolio.
          </motion.p>

          {/* Primary Action Buttons */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto justify-center mb-10 sm:mb-14 px-4 sm:px-0"
          >
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl font-extrabold text-base text-white bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] hover:from-[#2380b8] hover:to-[#175b87] shadow-xl shadow-[#2E9BDA]/25 hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-3 group"
              >
                <span>Go to Your Dashboard</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl font-extrabold text-base text-white bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] hover:from-[#2380b8] hover:to-[#175b87] shadow-xl shadow-[#2E9BDA]/25 hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-3 group"
                >
                  <span>Scan & Optimize My Resume Free</span>
                  <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
                </Link>
                <a
                  href="#playground"
                  className="w-full sm:w-auto px-7 py-4 rounded-2xl font-bold text-base text-slate-700 bg-white/95 border border-slate-200 hover:bg-slate-50 shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
                >
                  <span>Test Skill Matcher Live</span>
                  <ArrowRight size={16} />
                </a>
              </>
            )}
          </motion.div>

          {/* Quick Value Proof Pills */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm font-bold text-slate-600 mb-12"
          >
            <div className="flex items-center gap-1.5 bg-white/90 px-3.5 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>No Credit Card Required</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/90 px-3.5 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>100% Free Developer Portfolio</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/90 px-3.5 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>Instant ATS Score Calculation</span>
            </div>
          </motion.div>

          {/* Key Metric Feature Cards */}
          <motion.div
            variants={fadeInUp}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full max-w-4xl"
          >
            <div className="flex items-center gap-3.5 p-4 sm:p-5 rounded-2xl bg-white/90 border border-slate-200/90 shadow-md backdrop-blur-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="w-11 h-11 rounded-xl bg-sky-50 text-[#2E9BDA] flex items-center justify-center shrink-0 font-bold border border-sky-100">
                <CheckCircle2 size={22} />
              </div>
              <div className="text-left">
                <p className="text-sm font-extrabold text-slate-900">98.4% ATS Accuracy</p>
                <p className="text-xs text-slate-500 font-semibold">Strict keyword match algorithms</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-4 sm:p-5 rounded-2xl bg-white/90 border border-slate-200/90 shadow-md backdrop-blur-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-bold border border-indigo-100">
                <ShieldCheck size={22} />
              </div>
              <div className="text-left">
                <p className="text-sm font-extrabold text-slate-900">AI Video Proctoring</p>
                <p className="text-xs text-slate-500 font-semibold">Tamper-proof 100% Club badges</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-4 sm:p-5 rounded-2xl bg-white/90 border border-slate-200/90 shadow-md backdrop-blur-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold border border-emerald-100">
                <Trophy size={22} />
              </div>
              <div className="text-left">
                <p className="text-sm font-extrabold text-slate-900">1-Click GitHub Portfolios</p>
                <p className="text-xs text-slate-500 font-semibold">Instant free website deployment</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
