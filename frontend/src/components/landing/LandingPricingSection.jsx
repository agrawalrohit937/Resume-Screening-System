import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Sparkles, Zap, ShieldCheck } from 'lucide-react'

export default function LandingPricingSection({ isAnnual, setIsAnnual }) {
  return (
    <section id="pricing" className="py-16 sm:py-24 bg-white relative border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-4 shadow-sm">
            <Zap size={14} />
            <span>Transparent Pricing in INR (₹)</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4">
            Start Free. Upgrade as You Grow.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-medium mb-8">
            Free forever developer portfolio & starter ATS scans. Upgrade for unlimited vision mock interviews.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 p-1.5 rounded-2xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                !isAnnual ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setIsAnnual(true)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                isAnnual ? 'bg-[#2E9BDA] text-white shadow-md' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>Annual Billing</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-900 text-[10px] font-black uppercase">
                Save 25%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          
          {/* Card 1: Free Starter */}
          <div className="bg-slate-50/80 rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Free Starter</span>
              <div className="flex items-baseline gap-1 my-4">
                <span className="text-4xl font-black text-slate-900">₹0</span>
                <span className="text-xs text-slate-500 font-bold">/ forever</span>
              </div>
              <p className="text-slate-600 text-xs sm:text-sm mb-6 font-medium leading-relaxed">
                Perfect for software engineers building their initial resume and GitHub portfolio.
              </p>

              <div className="space-y-3 border-t border-slate-200 pt-6">
                {[
                  '3 Free ATS Resume Scans / mo',
                  '1-Click GitHub Portfolio Site',
                  'Basic AI Mock Interview Practice',
                  'Community Support',
                ].map((feat, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Check size={14} className="text-emerald-600 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              to="/login"
              className="mt-8 w-full py-3.5 rounded-xl font-extrabold text-sm text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 text-center transition-all shadow-sm"
            >
              Get Started Free
            </Link>
          </div>

          {/* Card 2: Pro Developer (Featured) */}
          <div className="bg-white rounded-3xl p-8 border-2 border-[#2E9BDA] shadow-2xl relative flex flex-col justify-between ring-4 ring-[#2E9BDA]/10">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white text-xs font-black uppercase tracking-wider shadow-md">
              Most Popular
            </div>

            <div>
              <span className="text-xs font-extrabold text-[#2E9BDA] uppercase tracking-wider">Pro Developer</span>
              <div className="flex items-baseline gap-1 my-4">
                <span className="text-4xl font-black text-slate-900">
                  {isAnnual ? '₹399' : '₹499'}
                </span>
                <span className="text-xs text-slate-500 font-bold">/ month</span>
              </div>
              <p className="text-slate-600 text-xs sm:text-sm mb-6 font-medium leading-relaxed">
                For active job seekers who want unlimited ATS scoring & live AI mock interviews.
              </p>

              <div className="space-y-3 border-t border-slate-100 pt-6">
                {[
                  'Unlimited ATS Resume Scans & JD Matching',
                  'Unlimited AI Live Mock Interviews',
                  'MediaPipe Vision & Speech Telemetry',
                  '100% Club QR Verified Certificates',
                  'Priority AI Copilot Assistant',
                ].map((feat, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Check size={14} className="text-[#2E9BDA] shrink-0 font-extrabold" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              to="/login"
              className="mt-8 w-full py-3.5 rounded-xl font-extrabold text-sm text-white bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] hover:from-[#2380b8] hover:to-[#175b87] text-center shadow-lg shadow-[#2E9BDA]/25 transition-all flex items-center justify-center gap-2"
            >
              <span>Start Pro Trial</span>
              <Sparkles size={15} />
            </Link>
          </div>

          {/* Card 3: Recruiter Enterprise */}
          <div className="bg-slate-50/80 rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <span className="text-xs font-extrabold text-purple-600 uppercase tracking-wider">Recruiter Suite</span>
              <div className="flex items-baseline gap-1 my-4">
                <span className="text-4xl font-black text-slate-900">
                  {isAnnual ? '₹1,499' : '₹1,999'}
                </span>
                <span className="text-xs text-slate-500 font-bold">/ month</span>
              </div>
              <p className="text-slate-600 text-xs sm:text-sm mb-6 font-medium leading-relaxed">
                For engineering recruiters & hiring teams sourcing pre-verified candidates.
              </p>

              <div className="space-y-3 border-t border-slate-200 pt-6">
                {[
                  'Access to 10,000+ Verified Candidate Profiles',
                  'JD-to-Candidate Batch Matching Engine',
                  'QR Certificate Authenticator API',
                  'Direct Outreach Candidate Dispatch',
                ].map((feat, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Check size={14} className="text-purple-600 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              to="/login"
              className="mt-8 w-full py-3.5 rounded-xl font-extrabold text-sm text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 text-center transition-all shadow-sm"
            >
              Access Recruiter Portal
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
