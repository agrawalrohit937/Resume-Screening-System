import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Sparkles, Menu, X, Flame } from 'lucide-react'

export default function LandingNavbar({ user, isMobileMenuOpen, setIsMobileMenuOpen }) {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pt-3 sm:pt-4 px-4 sm:px-6 pointer-events-none transition-all duration-300">
      <div
        className={`max-w-6xl mx-auto pointer-events-auto rounded-full transition-all duration-300 flex items-center justify-between px-5 sm:px-6 h-14 sm:h-16 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-xl shadow-slate-900/5'
            : 'bg-white/85 backdrop-blur-xl border border-slate-200/70 shadow-md shadow-slate-900/5'
        }`}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center group-hover:shadow-sm group-hover:scale-105 transition-all duration-300 p-1">
            <img
              src="/logo_t.webp"
              alt="CareerShala Logo"
              width={32}
              height={32}
              decoding="async"
              loading="eager"
              fetchPriority="high"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-base sm:text-lg font-black tracking-tight text-slate-900">
            Career<span className="text-[#2E9BDA]">Shala</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-6 text-[13px] font-bold text-slate-600">
          <a href="#cockpit" className="hover:text-[#2E9BDA] transition-colors">
            Cockpit
          </a>
          <a href="#playground" className="hover:text-[#2E9BDA] transition-colors">
            ATS Scanner
          </a>
          <a href="#features" className="hover:text-[#2E9BDA] transition-colors">
            Features
          </a>
          <a href="#certificates" className="hover:text-[#2E9BDA] transition-colors">
            Certificates
          </a>
          <a href="#how-it-works" className="hover:text-[#2E9BDA] transition-colors">
            Workflow
          </a>
          <a href="#pricing" className="hover:text-[#2E9BDA] transition-colors">
            Pricing
          </a>
          <a href="#faq" className="hover:text-[#2E9BDA] transition-colors">
            FAQ
          </a>
          <Link
            to="/careers"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/90 text-amber-700 font-extrabold text-[11px] hover:bg-amber-100 transition-all shadow-2xs"
          >
            <Flame size={12} className="text-amber-500 fill-amber-500 animate-pulse" />
            <span>Careers</span>
          </Link>
        </nav>

        {/* Desktop CTA Action */}
        <div className="hidden lg:flex items-center gap-3">
          {user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2 rounded-full font-extrabold text-[13px] text-white bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] hover:from-[#248bc7] hover:to-[#175d8d] shadow-md shadow-[#2E9BDA]/20 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Dashboard</span>
              <ArrowRight size={13} />
            </button>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3.5 py-1.5 rounded-full text-[13px] font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 transition-all"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="px-5 py-2.5 rounded-full font-extrabold text-[13px] text-white bg-gradient-to-r from-[#2E9BDA] via-[#248bc7] to-indigo-600 hover:from-[#2380b8] hover:to-indigo-700 shadow-md shadow-[#2E9BDA]/25 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5 group cursor-pointer"
              >
                <span>Get Started Free</span>
                <Sparkles size={13} className="group-hover:rotate-12 transition-transform" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className="lg:hidden p-2 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Toggle Navigation Menu"
        >
          {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile Drawer Navigation Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden pointer-events-auto max-w-6xl mx-auto mt-2 bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-3xl p-5 shadow-2xl flex flex-col gap-3"
          >
            <nav className="flex flex-col gap-1.5 font-bold text-slate-700 text-sm">
              <Link
                to="/careers"
                onClick={() => setIsMobileMenuOpen(false)}
                className="inline-flex items-center gap-2 py-2 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-extrabold"
              >
                <Flame size={14} className="text-amber-500 fill-amber-500 animate-pulse" />
                <span>Careers (We're Hiring!)</span>
              </Link>
              <a
                href="#cockpit"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 px-3 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cockpit
              </a>
              <a
                href="#playground"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 px-3 rounded-xl hover:bg-slate-100 transition-colors"
              >
                ATS Scanner
              </a>
              <a
                href="#features"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 px-3 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Features
              </a>
              <a
                href="#certificates"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 px-3 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Certificates
              </a>
              <a
                href="#how-it-works"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 px-3 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Workflow
              </a>
              <a
                href="#pricing"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 px-3 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Pricing
              </a>
              <a
                href="#faq"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 px-3 rounded-xl hover:bg-slate-100 transition-colors"
              >
                FAQ
              </a>
            </nav>

            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              {user ? (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    navigate('/dashboard')
                  }}
                  className="w-full py-3 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] shadow-md flex items-center justify-center gap-2"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full py-2.5 rounded-2xl text-sm font-bold text-slate-700 bg-slate-100 text-center hover:bg-slate-200 transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full py-3 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-[#2E9BDA] via-[#248bc7] to-indigo-600 shadow-md flex items-center justify-center gap-2 text-center"
                  >
                    <span>Get Started Free</span>
                    <Sparkles size={14} />
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
