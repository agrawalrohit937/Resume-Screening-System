import React from 'react'
import { motion } from 'framer-motion'
import { FileText, Video, Globe, Award, ArrowRight, Layers, Check } from 'lucide-react'

export default function LandingWorkflowSection({ activeStep, setActiveStep }) {
  const steps = [
    {
      num: '01',
      icon: <FileText className="w-5 h-5 text-[#2E9BDA]" />,
      title: 'Scan & Match Your Resume',
      desc: 'Upload your resume alongside any job link. See your instant ATS match score and get simple tips to fill missing keyword gaps.',
    },
    {
      num: '02',
      icon: <Video className="w-5 h-5 text-indigo-600" />,
      title: 'Practice Mock Interviews',
      desc: 'Answer realistic coding & system design questions. Receive friendly live feedback on your speech pace, clarity, and technical answers.',
    },
    {
      num: '03',
      icon: <Globe className="w-5 h-5 text-emerald-600" />,
      title: 'Publish Free Portfolio',
      desc: 'Sync GitHub in 1-click to publish your free developer website showcasing your projects, skills, and optimized resume.',
    },
    {
      num: '04',
      icon: <Award className="w-5 h-5 text-amber-600" />,
      title: 'Get Found by Recruiters',
      desc: 'Recruiters search candidates by verified 100% Club certificates and skill stacks for direct job dispatches.',
    },
  ]

  return (
    <section id="how-it-works" className="py-16 sm:py-24 bg-gradient-to-b from-slate-50 via-white to-slate-50 border-t border-slate-200/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-[#2E9BDA] text-xs font-bold uppercase tracking-wider mb-4 shadow-sm">
            <Layers size={14} />
            <span>Simple 4-Step Journey</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4">
            How CareerShala Helps You Get Hired
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-medium">
            From resume optimization to live mock coaching and portfolio deployment.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {steps.map((st, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              onClick={() => setActiveStep(idx)}
              className={`p-6 rounded-3xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                activeStep === idx
                  ? 'bg-white border-[#2E9BDA] shadow-xl ring-4 ring-[#2E9BDA]/10 -translate-y-1'
                  : 'bg-white/90 border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-2xl font-black text-[#2E9BDA] bg-sky-50 px-3 py-1 rounded-xl border border-sky-200">
                    {st.num}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                    {st.icon}
                  </div>
                </div>

                <h3 className="text-lg font-extrabold text-slate-900 mb-2">{st.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed mb-4">{st.desc}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400">
                <span>Step {idx + 1} of 4</span>
                {activeStep === idx && <Check size={14} className="text-[#2E9BDA]" />}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
