import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, ChevronDown, Sparkles } from 'lucide-react'

export default function LandingFaqSection({ items, openFaq, setOpenFaq }) {
  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx)
  }

  return (
    <section id="faq" className="py-16 sm:py-24 bg-gradient-to-b from-white via-slate-50/70 to-white relative border-t border-slate-200/80 overflow-hidden">
      {/* Dynamic Multi-Color Aurora Mesh Ambient Background */}
      <div className="absolute top-1/3 right-1/4 w-[650px] h-[450px] bg-gradient-to-tr from-[#2E9BDA]/15 via-indigo-500/10 to-amber-300/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-1/4 w-[500px] h-[350px] bg-gradient-to-br from-sky-200/20 to-purple-200/15 rounded-full blur-[130px] pointer-events-none -z-10" />

      {/* Subtle geometric dot grid pattern with radial fade */}
      <div
        className="absolute inset-0 opacity-[0.16] pointer-events-none -z-10 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(46, 155, 218, 0.4) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-sky-200/80 text-[#2E9BDA] text-[11px] font-extrabold uppercase tracking-wider mb-4 shadow-sm shadow-sky-500/5 backdrop-blur-md">
            <HelpCircle size={14} className="text-[#2E9BDA]" />
            <Sparkles size={12} className="text-amber-500 animate-pulse" />
            <span>GOT QUESTIONS?</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.16] mb-3.5">
            Frequently Asked{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-sky-600 to-indigo-600">
              Questions
            </span>
          </h2>
          <p className="text-slate-600 text-sm sm:text-base font-medium leading-relaxed max-w-2xl mx-auto">
            Everything you need to know about our ATS algorithms, mock interviews, and verification systems.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3.5">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                openFaq === idx
                  ? 'bg-white border-[#2E9BDA]/40 shadow-lg ring-2 ring-[#2E9BDA]/10'
                  : 'bg-white/90 backdrop-blur-sm border-slate-200/90 hover:border-slate-300 shadow-xs'
              }`}
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-4.5 sm:p-5 text-left flex items-center justify-between gap-4 focus:outline-none cursor-pointer"
              >
                <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                  {item.q}
                </span>
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 ${
                    openFaq === idx
                      ? 'rotate-180 bg-sky-50 text-[#2E9BDA]'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <ChevronDown size={16} />
                </div>
              </button>

              <AnimatePresence>
                {openFaq === idx && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-4.5 sm:px-5 pb-5 pt-1 text-slate-600 text-xs sm:text-sm font-medium leading-relaxed border-t border-slate-100">
                      {item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
