import React from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  Video,
  Globe,
  Award,
  Sparkles,
  Layers,
  Check,
  ArrowRight,
  TrendingUp,
  Cpu,
  Send,
  Zap,
} from 'lucide-react'

export default function LandingWorkflowSection({ activeStep, setActiveStep }) {
  const steps = [
    {
      num: '01',
      stage: 'BUILD',
      color: 'sky',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
      borderHover: 'group-hover:border-sky-400 group-hover:shadow-[0_20px_50px_-15px_rgba(56,189,248,0.25)]',
      icon: <Globe className="w-5 h-5 text-sky-600" />,
      title: 'Developer Portfolio',
      desc: 'Sync your GitHub repositories in 1-click to auto-publish a live, branded developer website.',
    },
    {
      num: '02',
      stage: 'ANALYZE',
      color: 'indigo',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      borderHover: 'group-hover:border-indigo-400 group-hover:shadow-[0_20px_50px_-15px_rgba(99,102,241,0.25)]',
      icon: <FileText className="w-5 h-5 text-indigo-600" />,
      title: 'ATS Semantic Scan',
      desc: 'Compare your resume against target Job Descriptions to detect missing keywords & density gaps.',
    },
    {
      num: '03',
      stage: 'IMPROVE',
      color: 'emerald',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      borderHover: 'group-hover:border-emerald-400 group-hover:shadow-[0_20px_50px_-15px_rgba(16,185,129,0.25)]',
      icon: <Sparkles className="w-5 h-5 text-emerald-600" />,
      title: 'Impact Bullet Rewriter',
      desc: 'Transform weak bullet lines into quantified XYZ impact metrics formatted for Workday & Greenhouse.',
    },
    {
      num: '04',
      stage: 'PRACTICE',
      color: 'purple',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      borderHover: 'group-hover:border-purple-400 group-hover:shadow-[0_20px_50px_-15px_rgba(168,85,247,0.25)]',
      icon: <Video className="w-5 h-5 text-purple-600" />,
      title: 'AI Mock Coaching',
      desc: 'Practice technical & behavioral questions with 60 FPS computer vision gaze and speech pace feedback.',
    },
    {
      num: '05',
      stage: 'PROVE',
      color: 'amber',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      borderHover: 'group-hover:border-amber-400 group-hover:shadow-[0_20px_50px_-15px_rgba(245,158,11,0.25)]',
      icon: <Award className="w-5 h-5 text-amber-600" />,
      title: 'Verified QR Certificate',
      desc: 'Earn tamper-proof QR certificates and distinction badges shareable directly on LinkedIn and your resume.',
    },
    {
      num: '06',
      stage: 'DISPATCH',
      color: 'rose',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      borderHover: 'group-hover:border-rose-400 group-hover:shadow-[0_20px_50px_-15px_rgba(244,63,94,0.25)]',
      icon: <Send className="w-5 h-5 text-rose-600" />,
      title: 'Recruiter Outreach Agent',
      desc: 'Automatically generate tailored cold cover emails and get shortlisted by tech hiring managers.',
    },
  ]

  return (
    <section id="workflow" className="py-16 sm:py-24 bg-gradient-to-b from-white via-slate-50/70 to-white border-t border-slate-200/80 relative overflow-hidden">
      <span id="how-it-works" className="sr-only" />
      
      {/* Dynamic Multi-Color Aurora Mesh Ambient Background */}
      <div className="absolute top-1/3 right-1/4 w-[650px] h-[450px] bg-gradient-to-tr from-sky-400/15 via-indigo-500/10 to-purple-300/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-1/12 w-[500px] h-[350px] bg-gradient-to-br from-amber-200/20 to-sky-200/15 rounded-full blur-[130px] pointer-events-none -z-10" />

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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-sky-200/80 text-[#2E9BDA] text-[11px] font-extrabold uppercase tracking-wider mb-4 shadow-sm shadow-sky-500/5 backdrop-blur-md">
            <Layers size={14} className="text-[#2E9BDA]" />
            <Sparkles size={12} className="text-amber-500 animate-pulse" />
            <span>END-TO-END CAREER ROADMAP</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.16] mb-3.5">
            How CareerShala Works in{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-sky-600 to-indigo-600">
              6 Cohesive Steps.
            </span>
          </h2>

          <p className="text-slate-600 text-sm sm:text-base font-medium leading-relaxed max-w-2xl mx-auto">
            A seamless journey engineered to transform your raw developer profile into a verified credential with direct recruiter visibility.
          </p>
        </div>

        {/* 6-Step Connected Grid with Rich Interactive Hover */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 relative">
          {steps.map((st, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -7, scale: 1.015, transition: { duration: 0.25 } }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              onClick={() => setActiveStep(idx)}
              className={`p-7 sm:p-8 rounded-[2rem] border transition-all duration-300 cursor-pointer relative flex flex-col justify-between overflow-hidden group backdrop-blur-md ${
                activeStep === idx
                  ? 'bg-white border-[#2E9BDA] shadow-[0_30px_70px_-15px_rgba(46,155,218,0.25)] ring-4 ring-[#2E9BDA]/15 -translate-y-1'
                  : `bg-white/90 border-slate-200/80 ${st.borderHover} shadow-xs hover:shadow-lg`
              }`}
            >
              {/* Top Glossy Highlight Sheen Line */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              {/* Step Ambient Glow Orb */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-sky-400/10 to-transparent rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />

              <div className="relative z-10">
                {/* Top Row: Number Badge + Consistent Squircle Icon */}
                <div className="flex items-center justify-between mb-5">
                  <span className={`font-mono text-xs font-black px-3 py-1.5 rounded-xl border shadow-2xs ${st.badgeClass}`}>
                    STEP {st.num}
                  </span>
                  <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 flex items-center justify-center">
                    {st.icon}
                  </div>
                </div>

                <span className="text-[10.5px] font-black tracking-widest uppercase text-slate-400 font-mono block mb-1">
                  PHASE {idx + 1}: {st.stage}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mb-2 leading-snug group-hover:text-[#2E9BDA] transition-colors">{st.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed mb-6">{st.desc}</p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500 relative z-10">
                <span className="text-[11px] font-mono">Stage {idx + 1} of 6</span>
                {activeStep === idx ? (
                  <span className="flex items-center gap-1 text-[#2E9BDA] font-extrabold text-[11px]">
                    <Check size={14} /> Selected Phase
                  </span>
                ) : (
                  <ArrowRight size={14} className="text-slate-300 group-hover:text-[#2E9BDA] group-hover:translate-x-1.5 transition-all" />
                )}
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
