import React from 'react'
import { motion } from 'framer-motion'
import { Star, Flame, CheckCircle2, Quote } from 'lucide-react'

export default function LandingTestimonialsSection({ testimonials }) {
  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-slate-50 via-white to-slate-50 relative border-t border-slate-200/80 overflow-hidden">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/4 w-[500px] h-[350px] bg-amber-200/15 rounded-full blur-[130px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-black uppercase tracking-widest mb-3.5 shadow-xs">
            <Flame size={13} className="text-amber-500 fill-amber-500 animate-pulse" />
            <span>ENGINEERING CANDIDATE PROOF</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-3.5 leading-tight">
            Trusted by 10,000+{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-indigo-600 to-[#1d6fa5]">
              Software Engineers
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
            Read how developers use CareerShala to pass ATS screens and land high-paying software roles.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="bg-gradient-to-br from-white via-white to-slate-50/50 rounded-[2rem] p-7 sm:p-8 border border-slate-200/90 shadow-[0_4px_25px_-4px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_40px_-6px_rgba(46,155,218,0.15)] hover:border-sky-300 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
            >
              {/* Top Glossy Highlight Line */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent pointer-events-none" />

              <div>
                {/* 5-Star Rating Row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={15} fill="currentColor" />
                    ))}
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-600" /> Verified
                  </span>
                </div>

                <p className="text-slate-700 text-xs sm:text-sm font-medium leading-relaxed italic mb-6">
                  "{t.quote}"
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#2E9BDA] to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-md shadow-[#2E9BDA]/20 group-hover:scale-105 transition-transform">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 group-hover:text-[#2E9BDA] transition-colors">{t.name}</p>
                  <p className="text-xs text-slate-500 font-semibold">{t.role} · {t.company}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
