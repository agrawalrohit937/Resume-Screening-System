import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Sparkles, CheckCircle2, Zap, Target, ArrowRight, ShieldCheck, FileText, CheckSquare, Layers, Check } from 'lucide-react'

export default function LandingAtsPlayground({ user }) {
  const MATCHED_KEYWORDS = [
    { name: 'React 18 & Next.js', score: '98%' },
    { name: 'Python & FastAPI', score: '96%' },
    { name: 'Docker & Kubernetes', score: '94%' },
    { name: 'PostgreSQL & Redis', score: '95%' },
    { name: 'System Architecture', score: '98%' },
    { name: 'Microservices & CI/CD', score: '92%' },
  ]

  const ATS_PLATFORMS = [
    { name: 'Workday ATS', pass: '99.2%' },
    { name: 'Greenhouse', pass: '98.8%' },
    { name: 'Lever', pass: '100%' },
    { name: 'Taleo', pass: '97.5%' },
  ]

  const stepsFlow = [
    { num: '1', title: 'Upload Resume', desc: 'PDF or DOCX parsed with semantic token extraction' },
    { num: '2', title: 'AI JD Comparison', desc: 'Real-time keyword density & formula scoring' },
    { num: '3', title: 'ATS Score & Fixes', desc: 'Instant 90%+ optimization suggestions' },
  ]

  return (
    <section id="playground" className="py-14 sm:py-20 bg-gradient-to-b from-white via-sky-50/50 to-slate-50 relative overflow-hidden text-slate-900 border-y border-slate-200/80">
      
      {/* Background Lighting Glows */}
      <div className="pointer-events-none absolute -top-40 right-1/4 w-[700px] h-[450px] bg-gradient-to-br from-sky-200/30 via-indigo-100/20 to-transparent blur-[140px] rounded-full -z-10" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 w-[600px] h-[400px] bg-sky-100/30 blur-[130px] rounded-full -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Split-Screen Composition: Left Explainer & Flow | Right Rich Resume Analysis UI */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Left Column: ATS Explanation & Visual Flow */}
          <div className="lg:col-span-5 flex flex-col space-y-6">
            
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-black tracking-widest uppercase mb-3.5 shadow-xs">
                <Target size={13} className="text-emerald-600" />
                <span>REAL-TIME ATS ENGINE</span>
              </div>

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.16] mb-3.5">
                Engineered to Pass ATS Screening{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-indigo-600 to-[#1d6fa5]">
                  in 5 Seconds.
                </span>
              </h2>

              <p className="text-slate-600 text-sm sm:text-base font-medium leading-relaxed">
                Most resumes get discarded before a human recruiter ever sees them. CareerShala benchmarks your resume against target Job Descriptions with quantified impact metrics.
              </p>
            </div>

            {/* Visual Flow Indicator */}
            <div className="space-y-3 pt-1">
              {stepsFlow.map((st, idx) => (
                <div key={idx} className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs">
                  <div className="w-7 h-7 rounded-xl bg-sky-50 text-[#2E9BDA] font-mono font-black text-xs flex items-center justify-center border border-sky-200 shrink-0 mt-0.5">
                    {st.num}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">{st.title}</h4>
                    <p className="text-[11.5px] text-slate-500 font-medium leading-tight mt-0.5">{st.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Enterprise Platform Badges */}
            <div className="pt-2">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                Benchmarked Against Enterprise Parsers:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ATS_PLATFORMS.map((plat, idx) => (
                  <div key={idx} className="p-2 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                    <p className="text-[10.5px] font-extrabold text-slate-800">{plat.name}</p>
                    <p className="text-xs font-black text-emerald-600 font-mono">{plat.pass}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Large Resume Analysis UI Mockup */}
          <div className="lg:col-span-7">
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-2xl shadow-slate-900/10 space-y-6">
              
              {/* Header Row with 96% Score Gauge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#2E9BDA] text-white flex items-center justify-center font-black shadow-md shadow-[#2E9BDA]/25 shrink-0">
                    <FileText size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black text-slate-900">Senior_FullStack_Resume.pdf</h3>
                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black font-mono border border-emerald-200">
                        PASSED
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Target JD: Senior Full-Stack Engineer @ Tech Scaleup</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200 shrink-0">
                  <div className="text-right">
                    <p className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider font-mono">MATCH SCORE</p>
                    <p className="text-2xl font-black text-slate-900 leading-none">96<span className="text-sm font-bold text-[#2E9BDA]">%</span></p>
                  </div>
                  <div className="w-10 h-10 rounded-full border-3 border-[#2E9BDA] border-t-emerald-500 flex items-center justify-center font-black text-xs text-[#2E9BDA] bg-white shadow-xs">
                    96%
                  </div>
                </div>
              </div>

              {/* Matched Keywords Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-black text-slate-700">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                    <CheckSquare size={14} className="text-emerald-600" /> Matched Skill Tokens
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    6 / 6 KEYWORDS MATCHED
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MATCHED_KEYWORDS.map((item, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between shadow-2xs">
                      <span className="text-[11.5px] font-extrabold text-slate-800">{item.name}</span>
                      <span className="text-[11px] font-black text-[#2E9BDA] font-mono">{item.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Before & After Transformation */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[#2E9BDA]" /> AI Bullet Transformation
                </p>

                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wider font-mono bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                      BEFORE (WEAK IMPACT)
                    </span>
                    <p className="text-xs text-slate-500 line-through mt-1">
                      "Worked on improving frontend performance and loading speed for our web application."
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider font-mono bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                      AFTER (QUANTIFIED &amp; ENHANCED)
                    </span>
                    <p className="text-xs font-extrabold text-slate-900 mt-1 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200 leading-relaxed">
                      ✓ "Refactored React delivery via code-splitting &amp; WebP compression, reducing initial payload by 1.6 MB and lifting Lighthouse score to 94+."
                    </p>
                  </div>
                </div>
              </div>

              {/* Scan CTA Button */}
              <Link
                to={user ? '/dashboard' : '/signup'}
                className="w-full py-3.5 rounded-2xl font-extrabold text-xs sm:text-sm text-white bg-gradient-to-r from-[#2E9BDA] via-[#248bc7] to-indigo-600 hover:from-[#2380b8] hover:to-indigo-700 shadow-md shadow-[#2E9BDA]/25 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
              >
                <span>Scan &amp; Optimize Your Resume Free</span>
                <ArrowRight size={15} />
              </Link>

            </div>
          </div>

        </div>

      </div>
    </section>
  )
}
