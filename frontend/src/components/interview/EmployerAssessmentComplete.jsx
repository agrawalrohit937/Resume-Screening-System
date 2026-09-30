import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, ShieldCheck, Clock, Building2, Briefcase, ArrowRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function EmployerAssessmentComplete({ sessionData = {} }) {
  const companyName = sessionData.company_name || 'the hiring team'
  const jobTitle = sessionData.job_title || 'Position'
  const completedAt = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-[#EFF6FF] flex items-center justify-center p-4 sm:p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full bg-white rounded-3xl border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)] p-8 sm:p-10 text-center relative overflow-hidden"
      >
        {/* Top Decorative Ring */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 via-[#2E9BDA] to-emerald-500" />

        {/* Success Icon Badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15, delay: 0.1 }}
          className="w-18 h-18 rounded-3xl bg-emerald-50 border-2 border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-sm shadow-emerald-500/10"
        >
          <CheckCircle2 className="w-10 h-10 text-emerald-600" strokeWidth={2.2} />
        </motion.div>

        {/* Heading */}
        <h1 className="text-2xl font-black text-slate-900 font-poppins tracking-tight">
          Assessment Submitted!
        </h1>
        <p className="text-sm font-semibold text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 rounded-full px-3.5 py-1 inline-flex items-center gap-1.5 mt-2">
          <ShieldCheck size={14} className="text-emerald-600" />
          <span>Secure Encrypted Submission</span>
        </p>

        {/* Core Message */}
        <p className="text-sm text-slate-600 mt-4 leading-relaxed font-medium">
          Thank you. Your Live AI Assessment has been securely submitted to the hiring team at{' '}
          <strong className="text-slate-900">{companyName}</strong> for the{' '}
          <strong className="text-slate-900">{jobTitle}</strong> role.
        </p>

        {/* Summary Details Card */}
        <div className="bg-slate-50/80 rounded-2xl border border-slate-100 p-4 mt-6 text-left space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Building2 size={12} /> Company
            </span>
            <span className="font-bold text-slate-800">{companyName}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Briefcase size={12} /> Role
            </span>
            <span className="font-bold text-slate-800">{jobTitle}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Clock size={12} /> Submitted At
            </span>
            <span className="font-bold text-slate-800">{completedAt}</span>
          </div>
        </div>

        {/* Next Steps Note */}
        <div className="mt-6 p-4 rounded-2xl bg-blue-50/60 border border-blue-100 text-left">
          <p className="text-xs font-bold text-blue-950 uppercase tracking-wider mb-1">
            What Happens Next?
          </p>
          <p className="text-xs text-blue-900/70 font-medium leading-relaxed">
            The recruiting team will review your audio & text responses alongside the comprehensive evaluation report. They will be in touch with you directly regarding next steps in the interview process.
          </p>
        </div>

        {/* Action Button */}
        <div className="mt-8 space-y-3">
          <Link
            to="/"
            className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-slate-900/10 transition-all"
          >
            <Home size={15} />
            <span>Return to CareerShala Home</span>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
