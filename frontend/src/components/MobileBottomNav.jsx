import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Briefcase,
  ScanSearch,
  UserCircle,
  Menu,
  Building2,
  Shield,
  Sparkles,
  X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCopilot } from '../features/copilot/CopilotProvider'

export default function MobileBottomNav({ onMenuToggle }) {
  const { user } = useAuth()
  const location = useLocation()
  const { isOpen, setIsOpen } = useCopilot()
  const role = user?.role?.toLowerCase() || 'candidate'

  // Define Left and Right tabs based on user role (Total 5 items with center CareerMitra Hero)
  let leftItems = []
  let rightItems = []

  if (role === 'admin') {
    leftItems = [
      { to: '/admin', label: 'Admin', icon: Shield },
      { to: '/recruiter', label: 'Jobs', icon: Briefcase },
    ]
    rightItems = [
      { to: '/profile', label: 'Profile', icon: UserCircle },
    ]
  } else if (role === 'recruiter' || role === 'hiring_manager' || role === 'executive') {
    leftItems = [
      { to: '/recruiter/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/recruiter/jobs', label: 'Jobs', icon: Briefcase },
    ]
    rightItems = [
      { to: '/recruiter/company', label: 'Company', icon: Building2 },
    ]
  } else {
    // Default Candidate Navigation
    leftItems = [
      { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
      { to: '/jobs', label: 'Jobs', icon: Briefcase },
    ]
    rightItems = [
      { to: '/results', label: 'ATS Scan', icon: ScanSearch },
    ]
  }

  // Active check for secondary pages (opens via Menu drawer)
  const isPrimaryActive = [...leftItems, ...rightItems].some(
    (item) => location.pathname === item.to || (item.to !== '/dashboard' && item.to !== '/recruiter/dashboard' && location.pathname.startsWith(item.to))
  )
  const isMenuRelatedActive = !isPrimaryActive

  const renderNavLink = (item) => {
    const Icon = item.icon
    const isActive = location.pathname === item.to || (item.to !== '/dashboard' && item.to !== '/recruiter/dashboard' && location.pathname.startsWith(item.to))

    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={`flex flex-col items-center justify-end w-full min-w-0 select-none touch-manipulation relative group ${isActive
          ? 'text-[#2E9BDA]'
          : 'text-slate-500 hover:text-slate-800'
          }`}
      >
        <div className="h-8 flex items-center justify-center">
          <div className={`p-1 rounded-xl transition-all duration-200 flex items-center justify-center ${isActive ? 'bg-[#2E9BDA]/12 text-[#2E9BDA] scale-105 shadow-xs shadow-[#2E9BDA]/20' : 'text-slate-500 group-hover:text-slate-700'
            }`}>
            <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.2 : 1.9} />
          </div>
        </div>
        <span className={`text-xs mt-1 tracking-tight leading-tight truncate w-full text-center px-0.5 transition-colors ${isActive ? 'font-bold text-[#2E9BDA]' : 'font-medium text-slate-600'
          }`}>
          {item.label}
        </span>

        {/* Active Underline Indicator Bar */}
        <span
          className={`w-4 h-[2px] rounded-full mt-1 transition-all duration-300 ${isActive
            ? 'bg-[#2E9BDA] shadow-[0_1px_4px_rgba(46,155,218,0.7)] scale-100 opacity-100'
            : 'bg-transparent scale-0 opacity-0'
            }`}
        />
      </NavLink>
    )
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 shadow-[0_-3px_18px_rgba(0,0,0,0.06)] px-2 pt-1.5 pb-[max(0.55rem,env(safe-area-inset-bottom))]"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5 items-end w-full max-w-[360px] mx-auto">
        {/* Left Tabs (Home, Jobs) */}
        {leftItems.map(renderNavLink)}

        {/* Center Hero: CareerMitra AI Copilot (Elevated Floating Orb) */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex flex-col items-center justify-end w-full min-w-0 select-none touch-manipulation group cursor-pointer focus:outline-none"
          aria-label={isOpen ? "Close CareerMitra AI" : "Open CareerMitra AI"}
        >
          <div className="h-8 flex items-center justify-center relative">
            <div className="relative -translate-y-4">
              {/* 1. Pulsating Ambient Holographic Aura */}
              <span className={`absolute -inset-2 rounded-full bg-gradient-to-tr from-sky-400 via-indigo-500 to-pink-500 opacity-40 blur-md transition-all duration-300 ${isOpen ? 'scale-125 opacity-75' : 'group-hover:opacity-70 group-hover:scale-110'
                }`} />

              {/* 2. Special Dynamic Spinning Conic Gradient Spectrum Ring */}
              <div className="absolute -inset-[3.5px] rounded-full bg-[conic-gradient(from_0deg,#38bdf8,#6366f1,#a855f7,#ec4899,#f59e0b,#38bdf8)] animate-[spin_5s_linear_infinite] opacity-95 blur-[0.3px]" />

              {/* 3. Floating Hero Orb with High-Gloss White Bevel */}
              <div className={`relative w-[52px] h-[52px] rounded-full p-[2.5px] transition-all duration-300 ring-[3px] ring-white shadow-[0_10px_25px_rgba(99,102,241,0.4),0_3px_10px_rgba(56,189,248,0.25)] ${isOpen
                ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-600 shadow-indigo-500/60 scale-105'
                : 'bg-gradient-to-tr from-[#38bdf8] via-[#6366f1] to-[#ec4899] group-hover:scale-105 group-active:scale-95'
                }`}>
                <div className="w-full h-full rounded-full bg-gradient-to-b from-[#0B0F19] via-[#151932] to-[#0B0F19] flex items-center justify-center relative overflow-hidden border border-white/25">
                  {/* Glassmorphic Top Dome Shine */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.35),transparent_65%)] pointer-events-none" />

                  {isOpen ? (
                    <X className="w-5.5 h-5.5 text-white drop-shadow-sm transition-transform duration-200" strokeWidth={2.5} />
                  ) : (
                    <svg viewBox="0 0 40 40" fill="none" className="w-[32px] h-[32px] drop-shadow-[0_2px_8px_rgba(56,189,248,0.6)] transition-transform duration-300 group-hover:scale-110">
                      <defs>
                        <linearGradient id="botChromaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#FFFFFF" />
                          <stop offset="45%" stopColor="#E0F2FE" />
                          <stop offset="100%" stopColor="#BAE6FD" />
                        </linearGradient>

                        <linearGradient id="botVisorGloss" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#030712" />
                          <stop offset="100%" stopColor="#1E1B4B" />
                        </linearGradient>

                        <linearGradient id="aiGoldStar" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#FDE047" />
                          <stop offset="50%" stopColor="#F59E0B" />
                          <stop offset="100%" stopColor="#EC4899" />
                        </linearGradient>

                        <filter id="eyeGlow" x="-50%" y="-50%" width="200%" height="200%">
                          <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#38BDF8" floodOpacity="0.8" />
                        </filter>
                      </defs>

                      {/* Antenna with glowing pulse orb */}
                      <path d="M20 11V6.5" stroke="url(#botChromaGrad)" strokeWidth="2.2" strokeLinecap="round" />
                      <circle cx="20" cy="5" r="2.5" fill="#38BDF8" filter="url(#eyeGlow)" />
                      <circle cx="20" cy="5" r="1.2" fill="#FFFFFF" />

                      {/* Ear Audio nodes */}
                      <rect x="6" y="16.5" width="2.2" height="7" rx="1.1" fill="#38BDF8" opacity="0.85" />
                      <rect x="31.8" y="16.5" width="2.2" height="7" rx="1.1" fill="#818CF8" opacity="0.85" />

                      {/* Robot Head with subtle 3D bevel */}
                      <rect x="8" y="11" width="24" height="19" rx="9" fill="url(#botChromaGrad)" />
                      {/* Gloss highlight on forehead */}
                      <path d="M12 13.5C14.5 12.5 25.5 12.5 28 13.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />

                      {/* High-Tech Visor Screen */}
                      <rect x="10.5" y="14.5" width="19" height="12" rx="6" fill="url(#botVisorGloss)" />

                      {/* Glowing Intelligent Eyes (^ ^ friendly expression) */}
                      <path d="M13.5 20.5C14.5 18.5 16.5 18.5 17.5 20.5" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" fill="none" filter="url(#eyeGlow)" />
                      <path d="M22.5 20.5C23.5 18.5 25.5 18.5 26.5 20.5" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" fill="none" filter="url(#eyeGlow)" />

                      {/* Cute smart smile */}
                      <path d="M18.2 23.2C19.2 24.2 20.8 24.2 21.8 23.2" stroke="#38BDF8" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.9" />

                      {/* Radiant AI Magic Starburst (Top Right) */}
                      <path d="M32 6.5C32 9.5 29 9.5 29 9.5C29 9.5 32 9.5 32 12.5C32 9.5 35 9.5 35 9.5C35 9.5 32 9.5 32 6.5Z" fill="url(#aiGoldStar)" />
                      {/* Mini Satellite Spark */}
                      <circle cx="27" cy="4" r="1" fill="#FDE047" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </div>
          <span className={`text-[11px] font-bold mt-1 tracking-tight leading-tight whitespace-nowrap text-center transition-colors ${isOpen ? 'text-[#2E9BDA]' : 'text-slate-800 group-hover:text-[#2E9BDA]'
            }`}>
            CareerMitra
          </span>
          <span className="w-4 h-[2px] rounded-full mt-1 bg-transparent" />
        </button>

        {/* Right Tab (ATS Scan / Company) */}
        {rightItems.map(renderNavLink)}

        {/* 5th Tab: Menu Drawer Trigger */}
        <button
          type="button"
          onClick={onMenuToggle}
          className={`flex flex-col items-center justify-end w-full min-w-0 select-none touch-manipulation cursor-pointer ${isMenuRelatedActive
            ? 'text-[#2E9BDA]'
            : 'text-slate-500 hover:text-slate-800'
            }`}
          aria-label="Open full menu"
        >
          <div className="h-8 flex items-center justify-center">
            <div className={`p-1 rounded-xl transition-all duration-200 flex items-center justify-center ${isMenuRelatedActive ? 'bg-[#2E9BDA]/12 text-[#2E9BDA] scale-105 shadow-xs shadow-[#2E9BDA]/20' : 'text-slate-500'
              }`}>
              <Menu className="w-[22px] h-[22px]" strokeWidth={isMenuRelatedActive ? 2.2 : 1.9} />
            </div>
          </div>
          <span className={`text-xs mt-1 tracking-tight leading-tight truncate w-full text-center px-0.5 transition-colors ${isMenuRelatedActive ? 'font-bold text-[#2E9BDA]' : 'font-medium text-slate-600'
            }`}>
            Menu
          </span>
          <span
            className={`w-4 h-[2px] rounded-full mt-1 transition-all duration-300 ${isMenuRelatedActive
              ? 'bg-[#2E9BDA] shadow-[0_1px_4px_rgba(46,155,218,0.7)] scale-100 opacity-100'
              : 'bg-transparent scale-0 opacity-0'
              }`}
          />
        </button>
      </div>
    </nav>
  )
}
