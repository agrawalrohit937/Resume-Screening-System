import React from 'react'
import { motion } from 'framer-motion'
import { Check, X, ShieldCheck, Sparkles, Zap } from 'lucide-react'

export default function LandingComparisonSection({ data }) {
  return (
    <section id="comparison" className="py-16 sm:py-24 bg-gradient-to-b from-white via-slate-50/70 to-white relative border-t border-slate-200/80 overflow-hidden">
      {/* Dynamic Multi-Color Aurora Mesh Ambient Background */}
      <div className="absolute top-1/3 left-1/4 w-[600px] h-[450px] bg-gradient-to-tr from-[#2E9BDA]/15 via-indigo-500/10 to-amber-300/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/4 w-[500px] h-[350px] bg-gradient-to-br from-sky-200/20 to-purple-200/15 rounded-full blur-[130px] pointer-events-none -z-10" />

      {/* Subtle geometric dot grid pattern with radial fade */}
      <div
        className="absolute inset-0 opacity-[0.16] pointer-events-none -z-10 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(46, 155, 218, 0.4) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-sky-200/80 text-[#2E9BDA] text-[11px] font-extrabold uppercase tracking-wider mb-4 shadow-sm shadow-sky-500/5 backdrop-blur-md">
            <ShieldCheck size={14} className="text-[#2E9BDA]" />
            <Sparkles size={12} className="text-amber-500 animate-pulse" />
            <span>COMPETITIVE BENCHMARK</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.16] mb-3.5">
            Specialized Engineering AI vs{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-sky-600 to-indigo-600">
              Generic Alternatives.
            </span>
          </h2>

          <p className="text-slate-600 text-sm sm:text-base font-medium leading-relaxed max-w-2xl mx-auto">
            See how CareerShala's domain-specific proctoring models and verified credentials outperform generic LLMs and legacy job boards.
          </p>
        </div>

        {/* Matrix Table Luxury Glass Card */}
        <div className="bg-white/90 backdrop-blur-2xl rounded-[2rem] border-2 border-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.12),0_12px_28px_-8px_rgba(46,155,218,0.18)] overflow-hidden relative">
          {/* Top Glossy Highlight Sheen Line */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400/80 to-transparent pointer-events-none" />

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80">
                  <th className="p-4 sm:p-5 text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                    Core Platform Capability
                  </th>
                  <th className="p-4 sm:p-5 text-xs sm:text-sm font-black text-[#2E9BDA] bg-[#2E9BDA]/10 text-center uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-1.5">
                      <Sparkles size={14} className="text-[#2E9BDA]" />
                      <span>CareerShala</span>
                    </div>
                  </th>
                  <th className="p-4 sm:p-5 text-xs sm:text-sm font-black text-slate-500 text-center uppercase tracking-wider">
                    Traditional Portals
                  </th>
                  <th className="p-4 sm:p-5 text-xs sm:text-sm font-black text-slate-500 text-center uppercase tracking-wider">
                    Generic ChatGPT
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm font-semibold">
                {data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-sky-50/30 transition-colors">
                    <td className="p-4 sm:p-4.5 font-bold text-slate-900">{row.feature}</td>

                    {/* CareerShala Column */}
                    <td className="p-4 sm:p-4.5 text-center bg-[#2E9BDA]/[0.03]">
                      {row.us === true ? (
                        <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-300/80 flex items-center justify-center mx-auto font-black shadow-xs">
                          <Check size={16} strokeWidth={3} />
                        </div>
                      ) : (
                        <span className="text-slate-700 font-extrabold">{row.us}</span>
                      )}
                    </td>

                    {/* Traditional Resumes */}
                    <td className="p-4 sm:p-4.5 text-center">
                      {row.traditional === false ? (
                        <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center mx-auto">
                          <X size={15} strokeWidth={2.5} />
                        </div>
                      ) : (
                        <span className="text-slate-500">{row.traditional}</span>
                      )}
                    </td>

                    {/* ChatGPT */}
                    <td className="p-4 sm:p-4.5 text-center">
                      {row.ChatGPT === false ? (
                        <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center mx-auto">
                          <X size={15} strokeWidth={2.5} />
                        </div>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
                          {row.ChatGPT}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
