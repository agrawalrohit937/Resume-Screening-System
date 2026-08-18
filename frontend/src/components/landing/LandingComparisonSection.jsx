import React from 'react'
import { motion } from 'framer-motion'
import { Check, X, ShieldCheck, Sparkles } from 'lucide-react'

export default function LandingComparisonSection({ data }) {
  return (
    <section id="comparison" className="py-14 sm:py-20 bg-white relative border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider mb-3 shadow-xs">
            <ShieldCheck size={14} className="text-[#2E9BDA]" />
            <span>Competitive Matrix</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-3.5 leading-tight">
            CareerShala vs{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-indigo-600 to-[#1d6fa5]">
              Traditional Alternatives
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
            See how specialized engineering AI beats generic chatbots and static resume builders.
          </p>
        </div>

        {/* Matrix Table Card */}
        <div className="bg-slate-50/70 rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-900/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/90">
                  <th className="p-4 sm:p-5 text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">Feature</th>
                  <th className="p-4 sm:p-5 text-xs sm:text-sm font-black text-[#2E9BDA] bg-[#2E9BDA]/10 text-center uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-1.5">
                      <Sparkles size={14} className="text-[#2E9BDA]" />
                      <span>CareerShala AI</span>
                    </div>
                  </th>
                  <th className="p-4 sm:p-5 text-xs sm:text-sm font-black text-slate-500 text-center uppercase tracking-wider">
                    Traditional Resumes
                  </th>
                  <th className="p-4 sm:p-5 text-xs sm:text-sm font-black text-slate-500 text-center uppercase tracking-wider">
                    Generic ChatGPT
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-xs sm:text-sm font-semibold">
                {data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/80 transition-colors">
                    <td className="p-4 sm:p-4.5 font-bold text-slate-900">{row.feature}</td>

                    {/* CareerShala Column */}
                    <td className="p-4 sm:p-4.5 text-center bg-[#2E9BDA]/[0.04]">
                      {row.us === true ? (
                        <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto font-black shadow-xs">
                          <Check size={16} />
                        </div>
                      ) : (
                        <span className="text-slate-700 font-bold">{row.us}</span>
                      )}
                    </td>

                    {/* Traditional Resumes */}
                    <td className="p-4 sm:p-4.5 text-center">
                      {row.traditional === false ? (
                        <div className="w-7 h-7 rounded-full bg-slate-200/80 text-slate-400 flex items-center justify-center mx-auto">
                          <X size={15} />
                        </div>
                      ) : (
                        <span className="text-slate-500">{row.traditional}</span>
                      )}
                    </td>

                    {/* ChatGPT */}
                    <td className="p-4 sm:p-4.5 text-center">
                      {row.ChatGPT === false ? (
                        <div className="w-7 h-7 rounded-full bg-slate-200/80 text-slate-400 flex items-center justify-center mx-auto">
                          <X size={15} />
                        </div>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 text-xs font-bold">
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
