import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, CheckCircle2, ShieldCheck, Trophy, Flame, Star, Zap, Play, Target, Bot, Code2 } from 'lucide-react'

export default function LandingHeroSection({ user, fadeInUp, staggerContainer }) {
  const navigate = useNavigate()

  return (
    <section className="relative pt-6 sm:pt-14 pb-14 sm:pb-24 overflow-hidden bg-gradient-to-b from-sky-50/40 via-white to-slate-50/50">
      {/* Dynamic Background Ambient Glowing Orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[700px] pointer-events-none -z-10 overflow-hidden transform-gpu">
        <div className="absolute -top-12 left-1/4 w-[380px] sm:w-[580px] h-[380px] sm:h-[580px] bg-gradient-to-tr from-[#2E9BDA]/20 via-sky-300/25 to-blue-500/15 rounded-full blur-3xl md:blur-[130px] animate-pulse" />
        <div className="absolute top-10 right-1/4 w-[320px] sm:w-[500px] h-[320px] sm:h-[500px] bg-gradient-to-br from-indigo-400/20 via-purple-300/20 to-pink-300/15 rounded-full blur-3xl md:blur-[130px]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[700px] h-[240px] sm:h-[380px] bg-sky-200/30 rounded-full blur-3xl md:blur-[140px]" />
        
        {/* Subtle dot mesh background */}
        <div
          className="absolute inset-0 opacity-[0.25]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(46, 155, 218, 0.25) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
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
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 border border-sky-200/80 shadow-md shadow-sky-500/5 backdrop-blur-md mb-6 sm:mb-8 hover:shadow-lg hover:border-sky-300 transition-all cursor-pointer group"
            onClick={() => {
              const el = document.getElementById('playground')
              el?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#2E9BDA] animate-ping" />
            <span className="text-xs sm:text-sm font-extrabold text-slate-800 tracking-wide">
              🚀 AI CAREER ACCELERATOR 3.0 — <span className="text-[#2E9BDA]">15,000+ Resumes &amp; Interviews Optimized</span>
            </span>
            <ArrowRight size={14} className="text-[#2E9BDA] group-hover:translate-x-1 transition-transform" />
          </motion.div>

          {/* User-Friendly Headline */}
          <motion.h1
            variants={fadeInUp}
            className="text-3xl sm:text-6xl md:text-7xl font-black text-slate-900 tracking-tight leading-[1.12] max-w-5xl mb-6 sm:mb-8"
          >
            Land Your Dream Tech Job Faster With{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-indigo-600 to-[#1d6fa5]">
              Intelligent AI
            </span>
          </motion.h1>

          {/* Friendly Subtitle */}
          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-xl text-slate-600 font-medium max-w-3xl leading-relaxed mb-8 sm:mb-10 px-2 sm:px-0"
          >
            Stop sending job applications into a black hole. CareerShala aligns your resume for ATS filters, hosts real-time AI mock interviews with computer vision proctoring, and builds your free live developer portfolio website.
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
                  <span>Scan &amp; Optimize My Resume Free</span>
                  <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
                </Link>
                <a
                  href="#playground"
                  className="w-full sm:w-auto px-7 py-4 rounded-2xl font-bold text-base text-slate-700 bg-white/95 border border-slate-200 hover:bg-slate-50 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Play size={16} className="text-[#2E9BDA] fill-[#2E9BDA]" />
                  <span>Test ATS Matcher Live</span>
                </a>
              </>
            )}
          </motion.div>

          {/* Quick Value Proof Pills */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm font-bold text-slate-600 mb-14"
          >
            <div className="flex items-center gap-1.5 bg-white/90 px-4 py-2 rounded-full border border-slate-200/80 shadow-sm">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>No Credit Card Required</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/90 px-4 py-2 rounded-full border border-slate-200/80 shadow-sm">
              <ShieldCheck size={16} className="text-[#2E9BDA]" />
              <span>Real-Time AI Vision Proctoring</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/90 px-4 py-2 rounded-full border border-slate-200/80 shadow-sm">
              <Code2 size={16} className="text-purple-600" />
              <span>Free Developer Portfolio</span>
            </div>
          </motion.div>

          {/* Social Proof Badges Ticker */}
          <motion.div
            variants={fadeInUp}
            className="w-full max-w-4xl pt-8 border-t border-slate-200/70 flex flex-col items-center gap-4"
          >
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
              Trusted by candidates practicing for top engineering teams
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-slate-400 font-extrabold text-sm sm:text-base opacity-75">
              <span className="hover:text-slate-700 transition-colors">Google</span>
              <span className="hover:text-slate-700 transition-colors">Microsoft</span>
              <span className="hover:text-slate-700 transition-colors">Amazon</span>
              <span className="hover:text-slate-700 transition-colors">Meta</span>
              <span className="hover:text-slate-700 transition-colors">Flipkart</span>
              <span className="hover:text-slate-700 transition-colors">TCS Digital</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
