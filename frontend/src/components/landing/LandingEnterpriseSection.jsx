import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  Users,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Search,
  Filter,
  TrendingUp,
  Cpu,
  Layers,
  Star,
  Check,
  BarChart3,
  Sliders,
  Send,
} from 'lucide-react'

export default function LandingEnterpriseSection({ user }) {
  const benefits = [
    {
      icon: <Cpu className="w-4 h-4 text-indigo-600" />,
      bg: 'bg-indigo-50/90',
      border: 'border-indigo-200/80',
      title: 'Batch JD-to-Resume Semantic Matching',
      desc: 'Upload target Job Descriptions and parse hundreds of candidate resumes in seconds using vector cosine similarity and knockout criteria.',
    },
    {
      icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
      bg: 'bg-emerald-50/90',
      border: 'border-emerald-200/80',
      title: 'Pre-Vetted 100% Club Talent Pipeline',
      desc: 'Filter verified software engineers by cryptographically validated proctor scores, iris gaze stability, and real-world domain rubrics.',
    },
    {
      icon: <Users className="w-4 h-4 text-[#2E9BDA]" />,
      bg: 'bg-sky-50/90',
      border: 'border-sky-200/80',
      title: 'Multi-Role Team Collaboration & RBAC',
      desc: 'Granular permissions for Admins, Hiring Managers, Interviewers, and Executives with shared candidate evaluation notes & interview dispatch.',
    },
  ]

  const enterprisePills = [
    'SOC2 & GDPR Compliant',
    'Custom Scoring Rubrics',
    'Enterprise Hiring SLA',
    'Role-Based Access (RBAC)',
    '1-Click Candidate Dispatch',
  ]

  return (
    <section id="enterprise" className="py-16 sm:py-24 relative overflow-hidden bg-gradient-to-b from-white via-slate-50/70 to-white border-t border-slate-200/80">
      {/* Dynamic Multi-Color Aurora Mesh Ambient Background */}
      <div className="absolute top-1/3 left-1/4 w-[650px] h-[450px] bg-gradient-to-tr from-indigo-500/15 via-[#2E9BDA]/10 to-purple-300/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/12 w-[500px] h-[350px] bg-gradient-to-br from-emerald-200/20 to-sky-200/15 rounded-full blur-[130px] pointer-events-none -z-10" />

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
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-indigo-200/80 text-indigo-700 text-[11px] font-extrabold uppercase tracking-wider mb-4 shadow-sm shadow-indigo-500/5 backdrop-blur-md">
                <Briefcase size={14} className="text-indigo-600" />
                <Sparkles size={12} className="text-amber-500 animate-pulse" />
                <span>ENTERPRISE RECRUITER SUITE</span>
              </div>

              {/* Main Heading */}
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.16] mb-3.5">
                Scale Engineering Hiring with{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-[#2E9BDA] to-emerald-600">
                  Verified Competency Signals.
                </span>
              </h2>

              {/* Subheading */}
              <p className="text-slate-600 text-sm sm:text-base font-medium leading-relaxed max-w-xl">
                Ditch resume guesswork. Source pre-screened developers ranked by AI proctored interview telemetry, validated GitHub contributions, and automated JD fit scores.
              </p>
            </div>

            {/* 3 Core Sleek Glass Benefit Rows */}
            <div className="space-y-3 max-w-xl">
              {benefits.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 sm:p-4 rounded-2xl bg-white/85 backdrop-blur-sm border border-slate-200/80 shadow-sm hover:shadow-md hover:border-indigo-300 hover:bg-gradient-to-r hover:from-white hover:to-indigo-50/30 transition-all duration-200 flex items-start gap-3.5 group"
                >
                  <div className={`w-9 h-9 rounded-xl ${item.bg} ${item.border} border flex items-center justify-center shrink-0 mt-0.5 shadow-inner group-hover:scale-105 transition-transform`}>
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="text-[13.5px] font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">{item.title}</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                to={user ? '/recruiter' : '/signup'}
                className="px-7 py-3.5 rounded-2xl font-extrabold text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-600 via-[#2E9BDA] to-[#1d6fa5] hover:from-indigo-700 hover:to-[#175d8d] shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Access Recruiter Dashboard</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </Link>

              <a
                href="#pricing"
                className="px-6 py-3.5 rounded-2xl font-bold text-xs sm:text-sm text-slate-700 bg-white/90 border border-slate-200/90 hover:bg-white hover:border-slate-300 shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer backdrop-blur-sm"
              >
                <span>View Recruiter Plans</span>
              </a>
            </div>

            {/* Feature-based Trust Pill Strip */}
            <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
              {enterprisePills.map((pill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 border border-slate-200/70 text-slate-600 text-[11px] font-bold shadow-2xs backdrop-blur-xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>{pill}</span>
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right Column: 3D Stacked Recruiter Dashboard Pedestal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-6 flex justify-center items-center relative py-4"
          >
            {/* Ambient Multi-Layer Radial Glow */}
            <div className="absolute inset-0 max-w-lg mx-auto bg-gradient-to-tr from-indigo-400/20 via-sky-400/15 to-emerald-300/20 rounded-[2.5rem] blur-2xl -z-10" />

            {/* Floating Container */}
            <div className="relative w-full max-w-md sm:max-w-lg group">
              {/* Layer 2: Deepest Stacked Sheet */}
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-tr from-slate-300/40 to-indigo-100/30 border border-slate-200/60 shadow-sm transform rotate-[-3deg] translate-y-3 translate-x-2 scale-[0.97] pointer-events-none transition-transform duration-300 group-hover:rotate-[-1.5deg]" />

              {/* Layer 1: Middle Stacked Sheet */}
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/90 to-sky-50/50 border border-sky-200/50 shadow-md transform rotate-[-1.5deg] translate-y-1.5 translate-x-1 scale-[0.985] pointer-events-none transition-transform duration-300 group-hover:rotate-[-0.5deg]" />

              {/* Main Luxury Glassmorphic Recruiter Card Frame */}
              <div className="relative rounded-[2rem] p-5 sm:p-6 bg-gradient-to-br from-white/95 via-white/90 to-indigo-50/80 backdrop-blur-2xl border-2 border-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.14),0_12px_28px_-8px_rgba(99,102,241,0.2)] transition-all duration-400 transform sm:rotate-[-0.5deg] group-hover:rotate-0 group-hover:scale-[1.01] hover:shadow-[0_30px_70px_-15px_rgba(99,102,241,0.28)]">
                
                {/* Glossy Top Border Accent Line */}
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent pointer-events-none" />

                {/* Dashboard Top Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-xs text-xs">
                      RP
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">Enterprise Talent Shortlist</h4>
                      <p className="text-[10px] text-slate-400 font-mono">Requisition: Lead Backend Engineer</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-mono text-[10px] font-black border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 18 Matched
                  </span>
                </div>

                {/* Candidate Rows */}
                <div className="space-y-2.5 mb-4">
                  {[
                    {
                      name: 'Rohit Agrawal',
                      role: 'Senior React & Full-Stack AI',
                      match: '98%',
                      badge: '100% Club Pro',
                      proctor: 'Verified 98/100',
                      skills: 'React, Python, Redis',
                    },
                    {
                      name: 'Aadhya Agarwal',
                      role: 'Python & Distributed Systems',
                      match: '96%',
                      badge: 'Top 1% Architect',
                      proctor: 'Verified 96/100',
                      skills: 'FastAPI, Docker, Go',
                    },
                    {
                      name: 'Vikram Sethi',
                      role: 'Cloud Infrastructure & K8s',
                      match: '94%',
                      badge: 'Verified Developer',
                      proctor: 'Verified 94/100',
                      skills: 'Kubernetes, AWS, Terraform',
                    },
                  ].map((cand, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:border-indigo-300 hover:shadow-sm transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#2E9BDA] to-indigo-600 text-white text-xs font-black flex items-center justify-center">
                          {cand.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-black text-slate-900">{cand.name}</p>
                            <span className="text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-mono">
                              {cand.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{cand.skills}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-600 font-mono">{cand.match} Match</span>
                        <p className="text-[9.5px] text-indigo-600 font-bold mt-0.5">{cand.proctor}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Quick Dispatch Banner */}
                <div className="p-3 rounded-xl bg-slate-900 text-white flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Send size={13} className="text-[#2E9BDA]" />
                    <span className="text-[11px] font-bold text-slate-200">1-Click Direct Interview Invite</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">✓ Automated Dispatch</span>
                </div>

              </div>
            </div>
          </motion.div>

        </div>

      </div>
    </section>
  )
}
