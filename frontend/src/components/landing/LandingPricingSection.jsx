import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Sparkles, Zap, ShieldCheck, ArrowRight, Crown, Star, Lock, Flame } from 'lucide-react'

// 3D Tilt Card Container Component
function TiltCard({ children, className = '', isPopular = false }) {
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotX = ((y - centerY) / centerY) * -5
    const rotY = ((x - centerX) / centerX) * 5
    setRotateX(rotX)
    setRotateY(rotY)
  }

  const handleMouseLeave = () => {
    setRotateX(0)
    setRotateY(0)
  }

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{
        rotateX,
        rotateY,
        y: isPopular ? -8 : 0,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
      className={`relative rounded-[2rem] p-7 sm:p-8 flex flex-col justify-between transition-all duration-300 ${className}`}
    >
      {children}
    </motion.div>
  )
}

export default function LandingPricingSection() {
  const plans = [
    {
      id: 'free',
      name: 'Free Tier',
      badge: 'STARTER',
      price: '₹0',
      period: 'lifetime free',
      desc: 'Essential AI tools for students and developers building their initial profile and resume.',
      buttonText: 'Get Started Free',
      buttonLink: '/signup',
      isPopular: false,
      buttonClass: 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm',
      features: [
        { text: '3 Free ATS Resume Scans / mo', tag: null },
        { text: '1-Click GitHub Portfolio Website', tag: 'FREE' },
        { text: 'Basic AI Mock Interview Practice', tag: null },
        { text: 'Full Access to Community Hub', tag: null },
      ],
    },
    {
      id: 'pro',
      name: 'Pro Developer',
      badge: 'MOST POPULAR',
      price: '₹499',
      period: 'per month',
      desc: 'For active job seekers who want unlimited ATS scoring, live AI mock coaching, and QR certificates.',
      buttonText: 'Upgrade to Pro',
      buttonLink: '/signup',
      isPopular: true,
      buttonClass: 'bg-gradient-to-r from-[#2E9BDA] via-[#2563EB] to-indigo-600 hover:from-[#248bc7] hover:to-indigo-700 text-white shadow-lg shadow-[#2563EB]/25 hover:shadow-xl',
      features: [
        { text: 'Unlimited ATS Resume Scans & JD Match', tag: 'UNLIMITED' },
        { text: 'Unlimited AI Live Mock Interviews', tag: '60 FPS' },
        { text: 'MediaPipe Eye & Speech Proctoring', tag: 'VISION' },
        { text: '100% Club QR Verified Certificates', tag: 'BADGE' },
        { text: 'Priority AI Copilot Assistant', tag: '24/7' },
      ],
    },
    {
      id: 'recruiter',
      name: 'Recruiter Suite',
      badge: 'ENTERPRISE',
      price: '₹1,999',
      period: 'per month',
      desc: 'For hiring managers and tech recruiters sourcing pre-assessed candidates with verified scores.',
      buttonText: 'Access Recruiter Portal',
      buttonLink: '/signup',
      isPopular: false,
      buttonClass: 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm',
      features: [
        { text: 'Access 10,000+ Verified Developer Profiles', tag: 'DATABASE' },
        { text: 'JD-to-Candidate Batch Match Engine', tag: 'FAST' },
        { text: 'QR Certificate Authenticator API', tag: null },
        { text: 'Direct Candidate Outreach Dispatch', tag: null },
      ],
    },
  ]

  return (
    <section id="pricing" className="py-16 sm:py-24 bg-gradient-to-b from-white via-blue-50/25 to-slate-50 relative border-t border-slate-200/80 overflow-hidden">
      
      {/* Background ambient lighting glows matching tailwind blue palette */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-gradient-to-tr from-blue-200/20 via-sky-200/20 to-indigo-200/15 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-black uppercase tracking-widest mb-3.5 shadow-xs">
            <Zap size={13} className="text-blue-600" />
            <span>TRANSPARENT INR (₹) PRICING</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-3.5 leading-tight">
            Start Free.{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-[#2563EB] to-indigo-600">
              Upgrade as You Grow.
            </span>
          </h2>

          <p className="text-sm sm:text-base text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
            Free forever developer portfolio &amp; starter ATS scans. Upgrade for unlimited vision mock interviews and verified distinction badges.
          </p>
        </div>

        {/* 3D Tilt Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 max-w-6xl mx-auto items-stretch">
          {plans.map((plan, idx) => (
            <TiltCard
              key={plan.id}
              isPopular={plan.isPopular}
              className={
                plan.isPopular
                  ? 'bg-gradient-to-b from-white via-blue-50/40 to-white border-2 border-blue-500 shadow-[0_20px_50px_-6px_rgba(37,99,235,0.22)] ring-4 ring-blue-500/10'
                  : 'bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-blue-300'
              }
            >
              {/* Top Glossy Highlight Sheen Line */}
              <div
                className={`absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent ${
                  plan.isPopular ? 'via-blue-500/60' : 'via-slate-300'
                } to-transparent pointer-events-none`}
              />

              {/* Floating Featured Badge */}
              {plan.isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#2E9BDA] via-[#2563EB] to-indigo-600 text-white text-[10.5px] font-black uppercase tracking-wider shadow-md shadow-blue-500/30 flex items-center gap-1.5 z-10">
                  <Crown size={12} className="text-amber-300" />
                  <span>Most Popular</span>
                </div>
              )}

              <div>
                {/* Header Row */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-black text-slate-800 tracking-wider uppercase font-mono">
                    {plan.name}
                  </span>
                  {!plan.isPopular && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border bg-slate-100 text-slate-600 border-slate-200">
                      {plan.badge}
                    </span>
                  )}
                </div>

                {/* Price Display */}
                <div className="flex items-baseline gap-1.5 my-3">
                  <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">/ {plan.period}</span>
                </div>

                <p className="text-slate-600 text-xs sm:text-sm mb-6 font-medium leading-relaxed min-h-[38px]">
                  {plan.desc}
                </p>

                {/* Feature Checklist */}
                <div className="space-y-3 border-t border-slate-100 pt-6">
                  {plan.features.map((feat, i) => (
                    <div key={i} className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                            plan.isPopular ? 'bg-blue-600 text-white' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          <Check size={11} strokeWidth={3} />
                        </div>
                        <span className={plan.isPopular ? 'text-slate-900 font-extrabold' : 'text-slate-700'}>
                          {feat.text}
                        </span>
                      </div>
                      {feat.tag && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black font-mono tracking-wider uppercase ${
                            plan.isPopular
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {feat.tag}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Action Button */}
              <div className="pt-8">
                <Link
                  to={plan.buttonLink}
                  className={`w-full py-3.5 rounded-2xl font-extrabold text-xs sm:text-sm text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${plan.buttonClass}`}
                >
                  <span>{plan.buttonText}</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </TiltCard>
          ))}
        </div>

        {/* Value Guarantees Strip */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 pt-12 text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1.5 text-slate-700">
            <ShieldCheck size={16} className="text-emerald-500" /> 7-Day Money Back Guarantee
          </span>
          <span className="flex items-center gap-1.5 text-slate-700">
            <Zap size={16} className="text-blue-600" /> Instant Account Activation
          </span>
          <span className="flex items-center gap-1.5 text-slate-700">
            <Lock size={16} className="text-indigo-600" /> Cancel Anytime with 1-Click
          </span>
        </div>

      </div>
    </section>
  )
}
