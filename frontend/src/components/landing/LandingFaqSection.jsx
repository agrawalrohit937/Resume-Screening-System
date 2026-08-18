import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, ChevronDown, Sparkles } from 'lucide-react'

export default function LandingFaqSection({ items, openFaq, setOpenFaq }) {
  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx)
  }

  return (
    <section id="faq" className="py-14 sm:py-20 bg-slate-50/70 relative border-t border-slate-200/80 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-sky-200/15 rounded-full blur-[130px] pointer-events-none -z-10" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider mb-3 shadow-xs">
            <HelpCircle size={14} className="text-[#2E9BDA]" />
            <span>Got Questions?</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-3.5 leading-tight">
            Frequently Asked{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-indigo-600 to-[#1d6fa5]">
              Questions
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
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
