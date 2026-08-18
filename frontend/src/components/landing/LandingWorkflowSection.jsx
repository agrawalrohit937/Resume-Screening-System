import React from 'react'
import { motion } from 'framer-motion'
import { FileText, Video, Globe, Award, Sparkles, Layers, Check, ArrowRight, TrendingUp, Cpu } from 'lucide-react'

export default function LandingWorkflowSection({ activeStep, setActiveStep }) {
  const steps = [
    {
      num: '01',
      stage: 'BUILD',
      icon: <Globe className="w-5 h-5 text-sky-500" />,
      title: 'Developer Portfolio',
      desc: 'Sync your GitHub repos in 1-click to auto-publish a live developer portfolio website.',
      color: 'from-sky-500/20 via-sky-400/10 to-transparent',
      borderColor: 'group-hover:border-sky-300',
    },
    {
      num: '02',
      stage: 'ANALYZE',
      icon: <FileText className="w-5 h-5 text-indigo-500" />,
      title: 'ATS Semantic Scan',
      desc: 'Compare your resume against target Job Descriptions to surface keyword gaps.',
      color: 'from-indigo-500/20 via-indigo-400/10 to-transparent',
      borderColor: 'group-hover:border-indigo-300',
    },
    {
      num: '03',
      stage: 'IMPROVE',
      icon: <Sparkles className="w-5 h-5 text-emerald-500" />,
      title: 'Bullet Rewriter',
      desc: 'Transform passive lines into quantified Google XYZ-formula impact statements.',
      color: 'from-emerald-500/20 via-emerald-400/10 to-transparent',
      borderColor: 'group-hover:border-emerald-300',
    },
    {
      num: '04',
      stage: 'PRACTICE',
      icon: <Video className="w-5 h-5 text-purple-500" />,
      title: 'AI Mock Coaching',
      desc: 'Practice technical & behavioral questions with 60fps computer vision proctoring.',
      color: 'from-purple-500/20 via-purple-400/10 to-transparent',
      borderColor: 'group-hover:border-purple-300',
    },
    {
      num: '05',
      stage: 'PROVE',
      icon: <Award className="w-5 h-5 text-amber-500" />,
      title: 'Verified Certificate',
      desc: 'Earn tamper-proof QR certificates and distinction badges shareable on LinkedIn.',
      color: 'from-amber-500/20 via-amber-400/10 to-transparent',
      borderColor: 'group-hover:border-amber-300',
    },
    {
      num: '06',
      stage: 'GROW',
      icon: <TrendingUp className="w-5 h-5 text-rose-500" />,
      title: 'Recruiter Dispatch',
      desc: 'Get found by engineering recruiters sourcing top-ranked talent directly.',
      color: 'from-rose-500/20 via-rose-400/10 to-transparent',
      borderColor: 'group-hover:border-rose-300',
    },
  ]

  return (
    <section id="how-it-works" className="py-16 sm:py-24 bg-gradient-to-b from-slate-50 via-white to-slate-50 border-t border-slate-200/80 relative overflow-hidden">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 right-1/4 w-[600px] h-[450px] bg-gradient-to-br from-sky-200/20 to-indigo-200/20 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-sky-200 text-[#2E9BDA] text-[11px] font-black tracking-widest uppercase mb-3.5 shadow-xs">
            <Layers size={13} />
            <span>END-TO-END CAREER ECOSYSTEM</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-3.5 leading-tight">
            Build → Analyze → Improve →{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-indigo-600 to-[#1d6fa5]">
              Practice → Prove → Grow
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
            A cohesive 6-phase journey engineered to take you from candidate profile to verified achievement and top engineering offers.
          </p>
        </div>

        {/* 6-Step Connected Grid with Luxury Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
          {steps.map((st, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              onClick={() => setActiveStep(idx)}
              className={`p-6 sm:p-7 rounded-[2rem] border transition-all duration-300 cursor-pointer relative flex flex-col justify-between overflow-hidden group ${
                activeStep === idx
                  ? 'bg-white border-[#2E9BDA] shadow-[0_16px_45px_-6px_rgba(46,155,218,0.2)] ring-4 ring-[#2E9BDA]/10 -translate-y-1'
                  : `bg-gradient-to-br from-white via-white to-slate-50/50 border-slate-200/90 ${st.borderColor} shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_40px_-6px_rgba(46,155,218,0.14)] hover:-translate-y-1`
              }`}
            >
              {/* Top Glossy Highlight Line */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-sky-400/40 to-transparent pointer-events-none" />

              {/* Subtle top-right ambient background hue */}
              <div className={`absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl ${st.color} rounded-full blur-2xl pointer-events-none`} />

              <div className="relative z-10">
                {/* Top Row: Number Badge + 3D Squircle Icon */}
                <div className="flex items-center justify-between mb-5">
                  <span className="font-mono text-base font-black text-[#2E9BDA] bg-sky-50 px-3 py-1 rounded-xl border border-sky-200/80 shadow-2xs">
                    {st.num}
                  </span>
                  <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200/90 shadow-md shadow-slate-900/5 group-hover:scale-105 transition-transform flex items-center justify-center">
                    {st.icon}
                  </div>
                </div>

                <span className="text-[10.5px] font-black tracking-widest uppercase text-slate-400 font-mono block mb-1">
                  STAGE {idx + 1}: {st.stage}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mb-1.5 leading-snug">{st.title}</h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed mb-5">{st.desc}</p>
              </div>

              <div className="pt-3.5 border-t border-slate-100/90 flex items-center justify-between text-xs font-bold text-slate-400 relative z-10">
                <span>Phase {idx + 1} of 6</span>
                {activeStep === idx ? (
                  <span className="flex items-center gap-1 text-[#2E9BDA] font-extrabold text-[11px]">
                    <Check size={14} /> Active Phase
                  </span>
                ) : (
                  <ArrowRight size={13} className="text-slate-300 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                )}
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
