import React from 'react'
import { Link } from 'react-router-dom'
import { Send, Linkedin, Github, Twitter, Heart, Flame, Layers, Briefcase, ChevronRight, Cpu, ShieldCheck, CheckCircle2, Sparkles } from 'lucide-react'

export default function LandingFooter({
  newsletterEmail,
  setNewsletterEmail,
  subscribing,
  handleNewsletterSubmit,
}) {
  return (
    <footer className="bg-[#0A0F1D] text-slate-300 pt-16 pb-12 border-t border-slate-800/90 relative overflow-hidden">
      
      {/* Background Subtle Ambient Glow */}
      <div className="absolute top-0 left-1/3 w-[600px] h-[300px] bg-gradient-to-b from-[#2E9BDA]/15 to-transparent blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
        
        {/* Main 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          
          {/* Column 1: Brand & Status */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-white shadow-md p-1.5 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                <img
                  src="/logo.png"
                  alt="CareerShala Logo"
                  width={36}
                  height={36}
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-xl font-black tracking-tight text-white">
                Career<span className="text-[#2E9BDA]">Shala</span>
              </span>
            </Link>
            
            <p className="text-slate-300 text-xs sm:text-[13.5px] leading-relaxed max-w-sm font-medium">
              The AI Career Accelerator engineered for software developers. Strict ATS resume optimization, vision-proctored mock interviews, and verified skill credentials.
            </p>

            <div className="pt-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>All Systems Operational</span>
              </div>
            </div>
          </div>

          {/* Column 2: Product Tools */}
          <div className="space-y-4">
            <h4 className="font-black text-white uppercase tracking-wider text-xs sm:text-[13px]">
              Product Tools
            </h4>
            <ul className="space-y-2.5 text-sm font-medium text-slate-300">
              <li>
                <a href="#features" className="hover:text-white hover:text-sky-300 transition-colors block">
                  ATS Resume Optimizer
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-white hover:text-sky-300 transition-colors block">
                  AI Mock Interview Coach
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-white hover:text-sky-300 transition-colors block">
                  Free GitHub Portfolio Builder
                </a>
              </li>
              <li>
                <a href="#certificates" className="hover:text-white hover:text-sky-300 transition-colors block">
                  Verified QR Credentials
                </a>
              </li>
              <li>
                <a href="#workflow" className="hover:text-white hover:text-sky-300 transition-colors block">
                  6-Stage Career Workflow
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Platform & Enterprise */}
          <div className="space-y-4">
            <h4 className="font-black text-white uppercase tracking-wider text-xs sm:text-[13px]">
              Solutions &amp; Company
            </h4>
            <ul className="space-y-2.5 text-sm font-medium text-slate-300">
              <li>
                <Link to="/recruiter" className="hover:text-white hover:text-sky-300 transition-colors block">
                  Talent Shortlist Portal
                </Link>
              </li>
              <li>
                <a href="#enterprise" className="hover:text-white hover:text-sky-300 transition-colors block">
                  Enterprise Hiring Suite
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white hover:text-sky-300 transition-colors block">
                  Transparent Pricing
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white hover:text-sky-300 transition-colors block">
                  FAQ &amp; Knowledge Base
                </a>
              </li>
              <li>
                <Link to="/careers" className="inline-flex items-center gap-1.5 text-amber-300 font-bold hover:text-amber-200 transition-colors">
                  <Flame size={13} className="text-amber-400 fill-amber-400 animate-pulse" />
                  <span>Careers</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-extrabold">Hiring</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Newsletter */}
          <div className="space-y-4">
            <h4 className="font-black text-white uppercase tracking-wider text-xs sm:text-[13px]">
              Stay Connected
            </h4>
            <p className="text-xs sm:text-[13px] text-slate-300 font-medium leading-relaxed">
              Get weekly career telemetry, top interview questions, and tech hiring trends.
            </p>
            <form onSubmit={handleNewsletterSubmit} className="space-y-2.5">
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#2E9BDA] focus:ring-2 focus:ring-[#2E9BDA]/30 transition-all shadow-xs"
              />
              <button
                type="submit"
                disabled={subscribing}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#2E9BDA] via-[#248bc7] to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#2E9BDA]/25 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <span>{subscribing ? 'Subscribing...' : 'Subscribe Free'}</span>
                <Send size={13} />
              </button>
            </form>
            <p className="text-xs text-slate-400 font-medium pt-1">
              Need help? Contact{' '}
              <a href="mailto:support@careershala.tech" className="text-sky-300 hover:text-white transition-colors underline underline-offset-2">
                support@careershala.tech
              </a>
            </p>
          </div>
        </div>

        {/* Bottom Legal & Copyright Bar */}
        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs sm:text-[13px] font-medium gap-4 text-slate-400">
          <p className="text-slate-400">© {new Date().getFullYear()} CareerShala Technologies Pvt. Ltd. All rights reserved.</p>

          <div className="flex flex-wrap items-center gap-5 sm:gap-7">
            <a href="#privacy" className="text-slate-300 hover:text-white transition-colors">Privacy Policy</a>
            <a href="#terms" className="text-slate-300 hover:text-white transition-colors">Terms of Service</a>
            <a href="#security" className="text-slate-300 hover:text-white transition-colors">Security</a>
            <Link to="/support" className="text-[#2E9BDA] font-bold hover:text-sky-300 transition-colors">Help &amp; Support</Link>
          </div>
        </div>

      </div>
    </footer>
  )
}
