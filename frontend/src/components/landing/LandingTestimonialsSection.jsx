import React from 'react'
import { motion } from 'framer-motion'
import { Star, Flame } from 'lucide-react'

export default function LandingTestimonialsSection({ testimonials }) {
  return (
    <section className="py-16 sm:py-24 bg-slate-50 relative border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold uppercase tracking-wider mb-4">
            <Flame size={14} />
            <span>Developer Proof of Success</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Trusted by 10,000+ Software Engineers
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-medium">
            Read how developers use CareerShala to pass ATS screens and land high-paying software roles.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="bg-white rounded-3xl p-7 border border-slate-200 shadow-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-1 text-amber-400 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                </div>
                <p className="text-slate-700 text-sm sm:text-base font-medium leading-relaxed italic mb-6">
                  "{t.quote}"
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <div className="w-10 h-10 rounded-full bg-[#2E9BDA] text-white font-black text-sm flex items-center justify-center shadow-md">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900">{t.name}</p>
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
