import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, CheckCircle2, ShieldCheck, Zap } from 'lucide-react'

export default function LandingFinalCtaSection({ user }) {
  const navigate = useNavigate()

  return (
    <section className="py-14 sm:py-20 bg-gradient-to-b from-slate-50/80 via-slate-100/60 to-slate-100 relative overflow-hidden border-t border-slate-200/80">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-[#2E9BDA]/15 via-indigo-500/10 to-amber-300/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Luxury Framed Hero Card */}
        <div className="relative rounded-[2.5rem] p-8 sm:p-14 lg:p-16 bg-gradient-to-br from-slate-900 via-[#0B132B] to-slate-950 border border-slate-700/80 shadow-2xl shadow-slate-950/20 overflow-hidden text-center">
          
          {/* Inner Card Aurora Glows */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#2E9BDA]/25 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />

          {/* Dot mesh pattern inside card */}
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.5) 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
            
            {/* Top Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-sky-300 text-[11px] font-extrabold uppercase tracking-wider mb-6 backdrop-blur-md shadow-sm">
              <Sparkles size={13} className="text-amber-400 animate-pulse" />
              <span>Launch Your Tech Career</span>
            </div>

            {/* Main Headline */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15] mb-5">
              Your Career Deserves{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-300 via-[#2E9BDA] to-indigo-400">
                More Than a Resume.
              </span>
            </h2>

            {/* Subtitle */}
            <p className="text-slate-300 text-sm sm:text-base md:text-lg font-medium leading-relaxed max-w-2xl mb-8 sm:mb-10">
              Build your profile. Prove your skills. Prepare for opportunities. Join thousands of developers landing high-growth software roles.
            </p>

            {/* CTA Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto mb-8 sm:mb-10">
              {user ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl font-extrabold text-sm sm:text-base text-white bg-gradient-to-r from-[#2E9BDA] via-[#248bc7] to-indigo-600 hover:from-[#2380b8] hover:to-indigo-700 shadow-xl shadow-[#2E9BDA]/30 hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <span>Go to Your Dashboard</span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className="w-full sm:w-auto px-8 py-4 rounded-2xl font-extrabold text-sm sm:text-base text-white bg-gradient-to-r from-[#2E9BDA] via-[#248bc7] to-indigo-600 hover:from-[#2380b8] hover:to-indigo-700 shadow-xl shadow-[#2E9BDA]/30 hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2.5 group cursor-pointer"
                  >
                    <span>Start Your Career Journey</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    to="/login"
                    className="w-full sm:w-auto px-7 py-4 rounded-2xl font-bold text-sm sm:text-base text-slate-200 bg-white/10 border border-white/20 hover:bg-white/20 hover:text-white transition-all backdrop-blur-md flex items-center justify-center cursor-pointer"
                  >
                    <span>Sign In to Existing Account</span>
                  </Link>
                </>
              )}
            </div>

            {/* Micro Feature Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-xs font-semibold text-slate-300">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <CheckCircle2 size={14} className="text-emerald-400" /> Free Forever Tier
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <CheckCircle2 size={14} className="text-emerald-400" /> Instant ATS Feedback
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <CheckCircle2 size={14} className="text-emerald-400" /> 1-Click LinkedIn Integration
              </span>
            </div>

          </div>

        </div>

      </div>
    </section>
  )
}
