import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, ChevronDown } from 'lucide-react'

export default function LandingFaqSection({ items, openFaq, setOpenFaq }) {
  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx)
  }

  return (
    <section id="faq" className="py-16 sm:py-24 bg-slate-50 relative border-t border-slate-200/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-200/70 border border-slate-300 text-slate-800 text-xs font-bold uppercase tracking-wider mb-4">
            <HelpCircle size={14} />
            <span>Got Questions?</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-medium">
            Everything you need to know about our ATS algorithms, mock interviews, and privacy.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-sm hover:shadow transition-all"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 focus:outline-none"
              >
                <span className="font-extrabold text-slate-900 text-base sm:text-lg">
                  {item.q}
                </span>
                <div className={`w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 transition-transform duration-300 ${openFaq === idx ? 'rotate-180 bg-sky-50 text-[#2E9BDA]' : 'text-slate-500'}`}>
                  <ChevronDown size={18} />
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
                    <div className="px-5 sm:px-6 pb-6 pt-1 text-slate-600 text-sm sm:text-base font-medium leading-relaxed border-t border-slate-100">
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
