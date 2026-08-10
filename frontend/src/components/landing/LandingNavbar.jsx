import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Sparkles, Menu, X, Flame } from 'lucide-react'

export default function LandingNavbar({ user, isMobileMenuOpen, setIsMobileMenuOpen }) {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 border-b border-slate-200/80 shadow-sm transition-all duration-300">
      <div className="max-w-[1536px] mx-auto px-4 sm:px-8 lg:px-12 h-16 sm:h-20 flex items-center justify-between gap-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center group-hover:shadow-md group-hover:scale-105 transition-all duration-300 p-1 sm:p-1.5">
            <img
              src="/logo_t.webp"
              alt="CareerShala Logo"
              width={40}
              height={40}
              decoding="async"
              loading="eager"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 group-hover:opacity-80 transition-opacity">
            Career<span className="text-[#2E9BDA]">Shala</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-600">
          <a href="#cockpit" className="hover:text-[#2E9BDA] transition-colors">
            Cockpit
          </a>
          <a href="#playground" className="hover:text-[#2E9BDA] transition-colors">
            ATS Matcher
          </a>
          <a href="#features" className="hover:text-[#2E9BDA] transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-[#2E9BDA] transition-colors">
            How It Works
          </a>
          <a href="#comparison" className="hover:text-[#2E9BDA] transition-colors">
            Comparison
          </a>
          <a href="#pricing" className="hover:text-[#2E9BDA] transition-colors">
            Pricing
          </a>
          <a href="#faq" className="hover:text-[#2E9BDA] transition-colors">
            FAQ
          </a>
          <Link
            to="/careers"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-extrabold text-xs hover:bg-amber-100 hover:text-amber-800 transition-all shadow-sm"
          >
            <Flame size={13} className="text-amber-500 fill-amber-500 animate-pulse" />
            <span>Careers (We're Hiring!)</span>
          </Link>
        </nav>

        {/* Desktop CTA Action */}
        <div className="hidden lg:flex items-center gap-3">
          {user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] hover:from-[#2380b8] hover:to-[#175b87] shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center gap-2"
            >
              <span>Dashboard</span>
              <ArrowRight size={14} className="hidden sm:inline" />
            </button>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 transition-all"
              >
                Sign In
              </Link>
              <Link
                to="/login"
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] hover:from-[#2380b8] hover:to-[#175b87] shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center gap-2"
              >
                <span>Try Free ATS Scan</span>
                <Sparkles size={14} />
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer Navigation Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden bg-white/95 border-b border-slate-200 px-6 py-5 flex flex-col gap-4 shadow-xl"
          >
            <nav className="flex flex-col gap-3 font-semibold text-slate-700 text-base">
              <Link
                to="/careers"
                onClick={() => setIsMobileMenuOpen(false)}
                className="inline-flex items-center gap-2 py-1.5 text-amber-700 font-extrabold"
              >
                <Flame size={15} className="text-amber-500 fill-amber-500 animate-pulse" />
                <span>Careers (We're Hiring!)</span>
              </Link>
              <a
                href="#cockpit"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1.5 hover:text-[#2E9BDA] transition-colors"
              >
                Interactive Cockpit
              </a>
              <a
                href="#playground"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1.5 hover:text-[#2E9BDA] transition-colors"
              >
                ATS Matcher
              </a>
              <a
                href="#features"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1.5 hover:text-[#2E9BDA] transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1.5 hover:text-[#2E9BDA] transition-colors"
              >
                How It Works
              </a>
              <a
                href="#comparison"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1.5 hover:text-[#2E9BDA] transition-colors"
              >
                Comparison
              </a>
              <a
                href="#pricing"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1.5 hover:text-[#2E9BDA] transition-colors"
              >
                Pricing
              </a>
              <a
                href="#faq"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1.5 hover:text-[#2E9BDA] transition-colors"
              >
                FAQ
              </a>
            </nav>

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
              {user ? (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    navigate('/dashboard')
                  }}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] shadow-md flex items-center justify-center gap-2"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full text-center py-2.5 rounded-xl font-bold text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full text-center py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] shadow-md flex items-center justify-center gap-2"
                  >
                    <span>Try Free ATS Scan</span>
                    <Sparkles size={15} />
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
