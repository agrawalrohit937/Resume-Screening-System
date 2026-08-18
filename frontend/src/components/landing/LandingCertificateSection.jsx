import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck,
  ArrowRight,
  Eye,
  Trophy,
  X,
  Brain,
  Award,
  Sparkles,
  Share2,
  CheckCircle2,
} from 'lucide-react'

export default function LandingCertificateSection({ user }) {
  const navigate = useNavigate()
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false)
    }
    if (isModalOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isModalOpen])

  const handleTakeAssessment = () => {
    if (user) {
      navigate('/live-interview')
    } else {
      navigate('/login')
    }
  }

  const benefits = [
    {
      icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
      bg: 'bg-emerald-50/90',
      border: 'border-emerald-200/80',
      title: 'Verified Credentials',
      desc: 'Tamper-proof digital certificates with unique ID & scannable QR verification.',
    },
    {
      icon: <Brain className="w-4 h-4 text-[#2E9BDA]" />,
      bg: 'bg-sky-50/90',
      border: 'border-sky-200/80',
      title: 'Skill-Based Assessments',
      desc: 'AI-proctored technical evaluations to validate your real-world domain knowledge.',
    },
    {
      icon: <Share2 className="w-4 h-4 text-indigo-600" />,
      bg: 'bg-indigo-50/90',
      border: 'border-indigo-200/80',
      title: 'LinkedIn & Resume Ready',
      desc: 'Add verified certificates directly to your LinkedIn profile in 1-click and boost your resume.',
    },
  ]

  const featurePills = [
    '1-Click LinkedIn Add',
    'Unique Certificate ID',
    'QR Verification',
    'Shareable Credential',
  ]

  return (
    <section id="certificates" className="py-16 sm:py-24 relative overflow-hidden bg-gradient-to-b from-white via-slate-50/70 to-white">
      {/* Dynamic Multi-Color Aurora Mesh Ambient Background */}
      <div className="absolute top-1/3 right-1/4 w-[650px] h-[450px] bg-gradient-to-tr from-[#2E9BDA]/15 via-indigo-500/10 to-amber-300/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-1/2 left-1/12 w-[500px] h-[350px] bg-gradient-to-br from-sky-200/20 to-purple-200/15 rounded-full blur-[130px] pointer-events-none -z-10" />

      {/* Subtle geometric dot grid pattern with radial fade */}
      <div
        className="absolute inset-0 opacity-[0.16] pointer-events-none -z-10 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(46, 155, 218, 0.4) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Balanced 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Left Column: Heading, 3 Sleek Glass Benefits, CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-6 flex flex-col justify-center space-y-6"
          >
            <div>
              {/* Category Pill with Ambient Shine */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-sky-200/80 text-[#2E9BDA] text-[11px] font-extrabold uppercase tracking-wider mb-4 shadow-sm shadow-sky-500/5 backdrop-blur-md">
                <Award size={14} className="text-[#2E9BDA]" />
                <Sparkles size={12} className="text-amber-500 animate-pulse" />
                <span>Verified Skill Credentials</span>
              </div>

              {/* Main Heading */}
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.16] mb-3.5">
                Prove Your Skills.{' '}
                <span className="block sm:inline bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] via-sky-600 to-indigo-600">
                  Get Certified.
                </span>
              </h2>

              {/* Subheading */}
              <p className="text-slate-600 text-sm sm:text-base font-medium leading-relaxed max-w-xl">
                Take skill assessments, prove your expertise, and earn verified certificates you can showcase on LinkedIn and your resume.
              </p>
            </div>

            {/* 3 Core Sleek Glass Benefit Rows */}
            <div className="space-y-3 max-w-xl">
              {benefits.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 sm:p-4 rounded-2xl bg-white/85 backdrop-blur-sm border border-slate-200/80 shadow-sm hover:shadow-md hover:border-sky-300 hover:bg-gradient-to-r hover:from-white hover:to-sky-50/30 transition-all duration-200 flex items-start gap-3.5 group"
                >
                  <div className={`w-9 h-9 rounded-xl ${item.bg} ${item.border} border flex items-center justify-center shrink-0 mt-0.5 shadow-inner group-hover:scale-105 transition-transform`}>
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="text-[13.5px] font-extrabold text-slate-900 group-hover:text-[#2E9BDA] transition-colors">{item.title}</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={handleTakeAssessment}
                className="px-7 py-3.5 rounded-2xl font-extrabold text-xs sm:text-sm text-white bg-gradient-to-r from-[#2E9BDA] via-[#248bc7] to-indigo-600 hover:from-[#2380b8] hover:to-indigo-700 shadow-lg shadow-[#2E9BDA]/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Take an Assessment</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-3.5 rounded-2xl font-bold text-xs sm:text-sm text-slate-700 bg-white/90 border border-slate-200/90 hover:bg-white hover:border-slate-300 shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer backdrop-blur-sm"
              >
                <Eye size={15} className="text-[#2E9BDA]" />
                <span>View Certificate</span>
              </button>
            </div>

            {/* Feature-based Trust Pill Strip */}
            <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-2.5 text-xs font-semibold text-slate-500">
              {featurePills.map((pill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 border border-slate-200/70 text-slate-600 text-[11px] font-bold shadow-2xs backdrop-blur-xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E9BDA]" />
                  <span>{pill}</span>
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right Column: Aesthetic 3D Certificate Pedestal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-6 flex justify-center items-center relative py-4"
          >
            {/* Ambient Multi-Layer Radial Glow */}
            <div className="absolute inset-0 max-w-lg mx-auto bg-gradient-to-tr from-sky-400/20 via-indigo-400/15 to-amber-300/20 rounded-[2.5rem] blur-2xl -z-10" />

            {/* Floating Container */}
            <motion.div
              animate={{
                y: [0, -7, 0],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="relative w-full max-w-md sm:max-w-lg group cursor-pointer"
              onClick={() => setIsModalOpen(true)}
            >
              {/* Layer 2: Deepest Stacked Sheet */}
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-tr from-slate-300/40 to-sky-100/30 border border-slate-200/60 shadow-sm transform rotate-[-4deg] translate-y-3 translate-x-2 scale-[0.97] pointer-events-none transition-transform duration-300 group-hover:rotate-[-2.5deg]" />

              {/* Layer 1: Middle Stacked Sheet */}
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/90 to-amber-50/50 border border-amber-200/50 shadow-md transform rotate-[-2deg] translate-y-1.5 translate-x-1 scale-[0.985] pointer-events-none transition-transform duration-300 group-hover:rotate-[-1deg]" />

              {/* Main Luxury Glassmorphic Certificate Card Frame */}
              <div className="relative rounded-[2rem] p-3 sm:p-3.5 bg-gradient-to-br from-white/95 via-white/90 to-sky-50/80 backdrop-blur-2xl border-2 border-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.14),0_12px_28px_-8px_rgba(46,155,218,0.2)] transition-all duration-400 transform sm:rotate-[-1deg] group-hover:rotate-0 group-hover:scale-[1.02] group-hover:shadow-[0_30px_70px_-15px_rgba(46,155,218,0.28),0_16px_36px_-8px_rgba(245,158,11,0.22)]">
                
                {/* Glossy Top Border Accent */}
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent rounded-t-[2rem] pointer-events-none" />

                {/* Inner Certificate Paper */}
                <div className="relative rounded-[1.5rem] overflow-hidden border border-slate-200/90 bg-white shadow-inner">
                  <picture>
                    <source srcSet="/certificate_sample.webp" type="image/webp" />
                    <img
                      src="/certificate_sample.png"
                      alt="CareerShala Python Assessment Certificate of Achievement awarded to Aadhya Agarwal"
                      width={1024}
                      height={1024}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-auto object-contain block transition-transform duration-500 group-hover:scale-[1.01]"
                    />
                  </picture>
                </div>

                {/* 2 Clean Floating Badges */}
                
                {/* 1. Top-Right: Verified Certificate Badge */}
                <div className="absolute -top-3.5 -right-2 sm:-right-3 bg-white/95 backdrop-blur-md border border-emerald-200 text-emerald-800 px-3.5 py-1.5 rounded-xl shadow-lg shadow-emerald-500/10 flex items-center gap-2 text-xs font-extrabold pointer-events-none">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                  <span>Verified Certificate</span>
                </div>

                {/* 2. Bottom-Right: Highest Distinction & 100/100 Badge */}
                <div className="absolute -bottom-3.5 -right-2 sm:-right-3 bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white px-3.5 py-1.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-mono font-bold pointer-events-none">
                  <Trophy size={14} className="text-amber-400 shrink-0 fill-amber-400" />
                  <span>Highest Distinction • 100/100</span>
                </div>

              </div>
            </motion.div>
          </motion.div>

        </div>
      </div>

      {/* ── Full-Certificate Lightbox Modal ── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            {/* Dark Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />

            {/* Modal Certificate Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 max-w-4xl w-full flex flex-col items-center my-auto"
            >
              {/* Floating Close Button at Top-Right */}
              <div className="w-full flex justify-end mb-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/25 text-white backdrop-blur-md border border-white/20 transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Full Certificate Display */}
              <div className="w-full rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-slate-900">
                <picture>
                  <source srcSet="/certificate_sample.webp" type="image/webp" />
                  <img
                    src="/certificate_sample.png"
                    alt="CareerShala Python Assessment Certificate of Achievement"
                    className="w-full h-auto max-h-[80vh] object-contain block mx-auto"
                  />
                </picture>
              </div>

              {/* Minimalist Floating Action Bar Below Certificate */}
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 w-full px-2">
                <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 text-center sm:text-left">
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                  <span>Verified credentials can be added to your LinkedIn profile in 1-click.</span>
                </p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md border border-white/20 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setIsModalOpen(false)
                      handleTakeAssessment()
                    }}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] hover:from-[#2380b8] hover:to-[#175b87] text-white text-xs font-extrabold shadow-lg shadow-[#2E9BDA]/30 flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    <span>Take an Assessment</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  )
}
