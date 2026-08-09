import React from 'react'
import { motion } from 'framer-motion'
import { Check, X, ShieldCheck } from 'lucide-react'

export default function LandingComparisonSection({ data }) {
  return (
    <section id="comparison" className="py-16 sm:py-24 bg-white relative border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider mb-4">
            <ShieldCheck size={14} className="text-[#2E9BDA]" />
            <span>Why Engineers Choose Us</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            CareerShala vs Traditional Tools
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-medium">
            See how specialized engineering AI beats general chatbots and generic resume builders.
          </p>
        </div>

        {/* Matrix Table Card */}
        <div className="bg-slate-50/80 rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80">
                  <th className="p-4 sm:p-6 text-sm font-extrabold text-slate-900">Feature</th>
                  <th className="p-4 sm:p-6 text-sm font-extrabold text-[#2E9BDA] bg-[#2E9BDA]/10 text-center">
                    CareerShala AI
                  </th>
                  <th className="p-4 sm:p-6 text-sm font-extrabold text-slate-500 text-center">
                    Traditional Resumes
                  </th>
                  <th className="p-4 sm:p-6 text-sm font-extrabold text-slate-500 text-center">
                    Generic ChatGPT
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-xs sm:text-sm font-semibold">
                {data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white transition-colors">
                    <td className="p-4 sm:p-5 font-bold text-slate-900">{row.feature}</td>

                    {/* CareerShala Column */}
                    <td className="p-4 sm:p-5 text-center bg-[#2E9BDA]/[0.03]">
                      {row.us === true ? (
                        <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto font-black">
                          <Check size={16} />
                        </div>
                      ) : (
                        <span className="text-slate-700 font-bold">{row.us}</span>
                      )}
                    </td>

                    {/* Traditional Resumes */}
                    <td className="p-4 sm:p-5 text-center">
                      {row.traditional === false ? (
                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                          <X size={16} />
                        </div>
                      ) : (
                        <span className="text-slate-500">{row.traditional}</span>
                      )}
                    </td>

                    {/* ChatGPT */}
                    <td className="p-4 sm:p-5 text-center">
                      {row.ChatGPT === false ? (
                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                          <X size={16} />
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
