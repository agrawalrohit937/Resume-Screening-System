import React from 'react'
import { Link } from 'react-router-dom'
import { Send, Linkedin, Github, Twitter, Heart, Flame, Layers, Briefcase, ChevronRight, Cpu, ShieldCheck } from 'lucide-react'

export default function LandingFooter({
  newsletterEmail,
  setNewsletterEmail,
  subscribing,
  handleNewsletterSubmit,
}) {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 sm:pt-20 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Top 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          
          {/* Column 1: Brand Info & Status */}
          <div className="space-y-5">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center p-1.5 shadow-md">
                <img
                  src="/logo_t.webp"
                  alt="CareerShala Logo"
                  width={40}
                  height={40}
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-xl font-extrabold text-white tracking-tight">
                Career<span className="text-[#2E9BDA]">Shala</span>
              </span>
            </Link>
            
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              The AI Career Accelerator engineered for developers. Strict ATS resume optimization, vision-proctored mock interviews, and free GitHub portfolios.
            </p>

            <div className="pt-2 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs tracking-wider bg-emerald-500/10 px-3.5 py-1.5 rounded-full border border-emerald-500/20 w-fit">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Systems 100% Operational
              </div>
              <div className="flex items-center gap-2 text-sky-400 font-extrabold text-xs tracking-wider bg-sky-500/10 px-3.5 py-1.5 rounded-full border border-sky-500/20 w-fit">
                <ShieldCheck size={14} />
                SOC2 & GDPR Compliant
              </div>
            </div>
          </div>

          {/* Column 2: Candidate Tools */}
          <div className="space-y-4">
            <h4 className="font-black text-white uppercase tracking-widest text-xs flex items-center gap-2">
              <Layers size={14} className="text-[#2E9BDA]" /> Candidate Tools
            </h4>
            <ul className="space-y-2.5 font-medium text-xs text-slate-400">
              <li>
                <a href="#playground" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ChevronRight size={12} className="text-[#2E9BDA]" /> ATS Resume Scanner
                </a>
              </li>
              <li>
                <a href="#cockpit" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ChevronRight size={12} className="text-[#2E9BDA]" /> AI Video Speech Coach
                </a>
              </li>
              <li>
                <a href="#cockpit" className="text-[#2E9BDA] hover:text-sky-300 transition-colors flex items-center gap-1.5">
                  <ChevronRight size={12} className="text-[#2E9BDA]" /> Free Developer Portfolio
                </a>
              </li>
              <li>
                <a href="#certificates" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ChevronRight size={12} className="text-[#2E9BDA]" /> Verified Skill Certificates
                </a>
              </li>
              <li>
                <a href="#playground" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ChevronRight size={12} className="text-[#2E9BDA]" /> Interactive Playground
                </a>
              </li>
              <li>
                <Link to="/apply-assistant" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ChevronRight size={12} className="text-[#2E9BDA]" /> Auto Outreach Agent
                </Link>
              </li>
              <li>
                <Link to="/results" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ChevronRight size={12} className="text-[#2E9BDA]" /> ATS Analysis Reports
                </Link>
              </li>
              <li>
                <Link to="/careers" className="text-amber-400 font-extrabold hover:text-amber-300 transition-colors flex items-center gap-1.5">
                  <Flame size={13} className="text-amber-400 animate-pulse fill-amber-400" /> Careers (We're Hiring!)
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Recruiter Suite */}
          <div className="space-y-4">
            <h4 className="font-black text-white uppercase tracking-widest text-xs flex items-center gap-2">
              <Briefcase size={14} className="text-indigo-400" /> Recruiter Suite
            </h4>
            <ul className="space-y-2.5 font-medium text-xs text-slate-400">
              <li>
                <Link to="/recruiter" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ChevronRight size={12} className="text-indigo-400" /> Talent Shortlist Dashboard
                </Link>
              </li>
              <li>
                <a href="#comparison" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ChevronRight size={12} className="text-indigo-400" /> Feature Matrix
                </a>
              </li>
              <li>
                <Link to="/support" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ChevronRight size={12} className="text-indigo-400" /> Enterprise Hiring SLA
                </Link>
              </li>
              <li>
                <Link to="/billing" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ChevronRight size={12} className="text-indigo-400" /> Recruiter Billing Plans
                </Link>
              </li>
              <li>
                <a href="#cockpit" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ChevronRight size={12} className="text-indigo-400" /> JD Candidate Ranker
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Stay Informed Newsletter */}
          <div className="space-y-4">
            <h4 className="font-black text-white uppercase tracking-widest text-xs flex items-center gap-2">
              <Send size={14} className="text-emerald-400" /> Stay Informed
            </h4>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Get weekly career telemetry reports, top interview prompts, and recruiter hiring trends directly to your inbox.
            </p>
            <form onSubmit={handleNewsletterSubmit} className="space-y-2.5">
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#2E9BDA] transition-all"
              />
              <button
                type="submit"
                disabled={subscribing}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#3B82F6] hover:from-[#3B82F6] hover:to-indigo-600 text-white font-extrabold text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {subscribing ? 'Subscribing...' : 'Subscribe Free'} <Send size={13} />
              </button>
            </form>
            <p className="text-[11px] text-slate-500 font-medium pt-1">
              For press & partnerships: admin@careershala.tech
            </p>
          </div>
        </div>

        {/* Platform Capabilities Banner Row */}
        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-400">
          <span className="text-white font-extrabold flex items-center gap-2">
            <Cpu size={16} className="text-[#2E9BDA]" /> Platform Capabilities:
          </span>
          <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px]">
            <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">AI Resume Matcher</span>
            <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">Live Video Coach</span>
            <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">Developer Portfolios</span>
            <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">Verified Skill Badges</span>
            <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">Enterprise Security</span>
            <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">Instant Recruiter Search</span>
          </div>
        </div>

        {/* Bottom Legal & Copyright Bar */}
        <div className="border-t border-slate-800/80 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs font-medium gap-4 text-slate-500">
          <div className="flex items-center gap-3">
            <p>© {new Date().getFullYear()} CareerShala Technologies Pvt. Ltd. All rights reserved.</p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <a href="#privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#terms" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#security" className="hover:text-white transition-colors">Security & Trust</a>
            <a href="#cookies" className="hover:text-white transition-colors">Cookie Preferences</a>
            <Link to="/support" className="hover:text-white transition-colors text-[#2E9BDA] font-bold">Help & Support</Link>
          </div>
        </div>

      </div>
    </footer>
  )
}
