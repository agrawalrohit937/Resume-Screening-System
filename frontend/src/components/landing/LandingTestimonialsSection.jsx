import React from 'react'
import { motion } from 'framer-motion'
import { Star, Flame, CheckCircle2, Quote, Sparkles, Award } from 'lucide-react'

export default function LandingTestimonialsSection({ testimonials }) {
  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-white via-slate-50/70 to-white relative border-t border-slate-200/80 overflow-hidden">
      {/* Dynamic Multi-Color Aurora Mesh Ambient Background */}
      <div className="absolute top-1/3 left-1/4 w-[600px] h-[450px] bg-gradient-to-tr from-amber-300/15 via-[#2E9BDA]/10 to-indigo-400/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/4 w-[500px] h-[350px] bg-gradient-to-br from-purple-200/15 to-sky-200/20 rounded-full blur-[130px] pointer-events-none -z-10" />

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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-amber-200/80 text-amber-800 text-[11px] font-extrabold uppercase tracking-wider mb-4 shadow-sm shadow-amber-500/5 backdrop-blur-md">
            <Award size={14} className="text-amber-600" />
            <Sparkles size={12} className="text-amber-500 animate-pulse" />
            <span>AUTHENTIC CANDIDATE SUCCESS</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.16] mb-3.5">
            Trusted by 10,000+{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-sky-600 to-indigo-600">
              Software Engineers.
            </span>
          </h2>

          <p className="text-slate-600 text-sm sm:text-base font-medium leading-relaxed max-w-2xl mx-auto">
            Read how developers use CareerShala to pass ATS screens, prove their competencies with proctored assessments, and land top roles.
          </p>
        </div>

        {/* Testimonials Grid with Refined Avatars & Generous Spacing */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-7 items-stretch">
          {testimonials.map((t, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="bg-white/90 backdrop-blur-md rounded-[2rem] p-7 sm:p-9 border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-sky-300 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
            >
              {/* Top Glossy Highlight Sheen Line */}
              <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent pointer-events-none" />

              <div>
                {/* 5-Star Rating Row */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={15} fill="currentColor" />
                    ))}
                  </div>
                  <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 shadow-2xs">
                    <CheckCircle2 size={12} className="text-emerald-600" /> Verified
                  </span>
                </div>

                <p className="text-slate-700 text-sm font-medium leading-relaxed italic mb-8">
                  "{t.quote}"
                </p>
              </div>

              <div className="flex items-center gap-3.5 pt-5 border-t border-slate-100">
                {/* Refined Avatar Ring */}
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#2E9BDA] to-indigo-600 p-[2px] shadow-sm shrink-0">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-black text-xs text-[#2E9BDA]">
                    {t.initials}
                  </div>
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
