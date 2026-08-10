import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Sparkles, CheckCircle2, Zap, Target, ArrowRight, ShieldCheck, FileText, TrendingUp, CheckSquare, Layers } from 'lucide-react'

export default function LandingAtsPlayground({ user }) {
  const MATCHED_KEYWORDS = [
    { name: 'React 18 & Next.js', score: '98%', match: true },
    { name: 'Python & FastAPI', score: '96%', match: true },
    { name: 'Docker & Kubernetes', score: '94%', match: true },
    { name: 'PostgreSQL & Redis', score: '95%', match: true },
    { name: 'System Architecture', score: '98%', match: true },
    { name: 'Microservices & CI/CD', score: '92%', match: true },
  ]

  const ATS_PLATFORMS = [
    { name: 'Workday ATS', pass: '99.2%' },
    { name: 'Greenhouse', pass: '98.8%' },
    { name: 'Lever', pass: '100%' },
    { name: 'Taleo', pass: '97.5%' },
  ]

  return (
    <section id="playground" className="py-24 sm:py-32 bg-gradient-to-b from-white via-sky-50/40 to-[#F8FAFC] relative overflow-hidden text-slate-900 border-b border-slate-200/80">
      
      {/* Background Lighting Glows */}
      <div className="pointer-events-none absolute -top-40 right-1/4 w-[750px] h-[450px] bg-gradient-to-br from-sky-200/40 via-blue-100/30 to-transparent blur-[140px] rounded-full" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 w-[650px] h-[400px] bg-indigo-100/30 blur-[130px] rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black tracking-widest uppercase mb-5 shadow-sm backdrop-blur-md"
          >
            <Target size={14} className="text-emerald-600" />
            <span>REAL-TIME ATS PARSER INSIGHTS</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.14] mb-5"
          >
            Engineered to Pass ATS Screening{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-indigo-600 to-[#1d6fa5]">
              in 5 Seconds
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-lg text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed"
          >
            See how CareerShala automatically optimizes candidate resumes to score top-tier compatibility ratings across enterprise recruiting systems.
          </motion.p>
        </div>

        {/* Static Showcase Grid Card */}
        <div className="max-w-5xl mx-auto bg-white rounded-3xl p-6 sm:p-12 border border-slate-200/90 shadow-2xl shadow-slate-300/60 relative overflow-hidden">
          
          {/* Top Banner Row */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-200/90">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#2E9BDA] text-white flex items-center justify-center font-black shadow-lg shadow-[#2E9BDA]/25 shrink-0">
                <FileText size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">Senior Full-Stack Developer Resume</h3>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black font-mono">PASSED</span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Target JD: Senior Full-Stack Engineer @ FAANG / Tech Scaleup</p>
              </div>
            </div>

            {/* Score Ring / Gauge Badge */}
            <div className="flex items-center gap-4 bg-gradient-to-r from-sky-50 via-indigo-50 to-emerald-50 px-6 py-3.5 rounded-2xl border border-sky-200/80 shadow-sm shrink-0">
              <div className="text-center">
                <p className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider font-mono">ATS COMPATIBILITY SCORE</p>
                <p className="text-3xl sm:text-4xl font-black text-slate-900 leading-none mt-1">96<span className="text-lg font-bold text-[#2E9BDA]">%</span></p>
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-[#2E9BDA] border-t-emerald-500 flex items-center justify-center font-black text-xs text-[#2E9BDA] bg-white shadow-sm">
                96%
              </div>
            </div>
          </div>

          {/* Core Telemetry Breakdown Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8">
            
            {/* Left: Matched Technical Keywords */}
            <div className="lg:col-span-7 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckSquare size={16} className="text-emerald-600" /> Matched Technical Skill Graph
                </p>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">6 / 6 KEYWORDS MATCHED</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {MATCHED_KEYWORDS.map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between shadow-sm">
                    <span className="text-xs font-extrabold text-slate-900">{item.name}</span>
                    <span className="text-xs font-black text-[#2E9BDA] font-mono bg-sky-50 px-2 py-0.5 rounded border border-sky-200">{item.score}</span>
                  </div>
                ))}
              </div>

              {/* Enterprise ATS Platform Readiness */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                <p className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-[#2E9BDA]" /> Enterprise ATS Parser Verification
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {ATS_PLATFORMS.map((plat, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-sm">
                      <p className="text-[11px] font-extrabold text-slate-800">{plat.name}</p>
                      <p className="text-xs font-black text-emerald-600 font-mono mt-0.5">{plat.pass}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: AI Transformation Card */}
            <div className="lg:col-span-5 space-y-4">
              <p className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={16} className="text-[#2E9BDA]" /> Live Impact Bullet Transformation
              </p>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3.5 shadow-sm">
                <div>
                  <span className="text-[10.5px] font-extrabold text-rose-500 uppercase tracking-wider font-mono bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    BEFORE (WEAK IMPACT)
                  </span>
                  <p className="text-xs text-slate-500 line-through mt-1.5 leading-relaxed">
                    "Worked on improving frontend performance and loading speed for our web application."
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/80">
                  <span className="text-[10.5px] font-extrabold text-emerald-700 uppercase tracking-wider font-mono bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                    AFTER (AI ATS ENHANCED)
                  </span>
                  <p className="text-xs font-extrabold text-slate-900 mt-1.5 leading-relaxed bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                    ✓ "Refactored React asset delivery via code-splitting & WebP compression, reducing initial payload by 1.6 MB and lifting Lighthouse score from 70 to 94+."
                  </p>
                </div>
              </div>

              {/* Action CTA */}
              <div className="pt-2">
                <Link
                  to={user ? '/dashboard' : '/login'}
                  className="w-full py-4 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-[#2E9BDA] via-indigo-600 to-[#1d6fa5] hover:opacity-95 shadow-xl shadow-[#2E9BDA]/25 hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2.5"
                >
                  <span>Scan & Enhance Your Resume Free</span>
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  )
}
