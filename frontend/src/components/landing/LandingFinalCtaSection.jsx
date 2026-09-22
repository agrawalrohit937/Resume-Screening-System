import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, CheckCircle2, ShieldCheck, Zap } from 'lucide-react'

export default function LandingFinalCtaSection({ user }) {
  const navigate = useNavigate()

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-white via-slate-50/70 to-slate-100 border-t border-slate-200/80 relative overflow-hidden">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[450px] bg-gradient-to-tr from-[#2E9BDA]/15 via-indigo-500/10 to-amber-300/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* High-Contrast Luxury Sapphire Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative rounded-[2.5rem] p-8 sm:p-14 lg:p-16 bg-gradient-to-br from-[#0B1528] via-[#0F1E38] to-[#070D18] border border-sky-500/30 shadow-2xl shadow-slate-900/15 overflow-hidden text-center group"
        >
          
          {/* Inner Card Aurora Glows */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#2E9BDA]/20 rounded-full blur-[90px] pointer-events-none group-hover:scale-110 transition-transform duration-700" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-[90px] pointer-events-none group-hover:scale-110 transition-transform duration-700" />

          {/* Glossy Top Border Accent Line */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400 to-transparent pointer-events-none" />

          {/* Dot mesh pattern inside card */}
          <div
            className="absolute inset-0 opacity-[0.12] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.4) 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
            
            {/* Top Pill Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sky-300 text-[11.5px] font-extrabold uppercase tracking-wider mb-6 backdrop-blur-md shadow-xs">
              <Sparkles size={13} className="text-amber-400 animate-pulse" />
              <span>Launch Your Tech Career</span>
            </div>

            {/* Main Headline */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15] mb-5">
              Your Career Deserves{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-sky-300 to-indigo-300">
                More Than a Resume.
              </span>
            </h2>

            {/* Subtitle */}
            <p className="text-slate-300 text-sm sm:text-base md:text-lg font-medium leading-relaxed max-w-2xl mb-8 sm:mb-10">
              Build your verified portfolio, bypass ATS filters with real-time semantic benchmarking, and practice with 60 FPS vision proctors.
            </p>

            {/* CTA Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mb-9">
              {user ? (
                <motion.button
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/dashboard')}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-sm sm:text-base text-white bg-gradient-to-r from-[#2E9BDA] via-[#248bc7] to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-xl shadow-[#2E9BDA]/30 hover:shadow-2xl transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <span>Go to Your Dashboard</span>
                  <ArrowRight size={16} />
                </motion.button>
              ) : (
                <>
                  <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
                    <Link
                      to="/signup"
                      className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-sm sm:text-base text-white bg-gradient-to-r from-[#2E9BDA] via-[#248bc7] to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-xl shadow-[#2E9BDA]/30 hover:shadow-2xl transition-all flex items-center justify-center gap-2.5 group cursor-pointer"
                    >
                      <span>Start Your Career Journey</span>
                      <ArrowRight size={16} className="group-hover:translate-x-1.5 transition-transform" />
                    </Link>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
                    <Link
                      to="/login"
                      className="w-full sm:w-auto px-7 py-4 rounded-2xl font-bold text-sm sm:text-base text-white bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/40 shadow-sm backdrop-blur-md flex items-center justify-center transition-all cursor-pointer"
                    >
                      <span>Sign In to Existing Account</span>
                    </Link>
                  </motion.div>
                </>
              )}
            </div>

            {/* Micro Feature Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-xs sm:text-[13px] font-bold text-slate-200">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15 backdrop-blur-md shadow-2xs">
                <CheckCircle2 size={15} className="text-emerald-400" /> Free Forever Tier
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15 backdrop-blur-md shadow-2xs">
                <CheckCircle2 size={15} className="text-emerald-400" /> Instant ATS Feedback
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15 backdrop-blur-md shadow-2xs">
                <CheckCircle2 size={15} className="text-emerald-400" /> 1-Click LinkedIn Integration
              </span>
            </div>

          </div>

        </motion.div>

      </div>
    </section>
  )
}
