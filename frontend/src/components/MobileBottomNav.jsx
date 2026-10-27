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
  Sparkles
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
        className={`flex flex-col items-center justify-center w-full min-w-0 py-1 rounded-xl transition-all duration-200 select-none touch-manipulation relative group ${isActive
          ? 'text-[#2E9BDA] font-bold'
          : 'text-slate-500 hover:text-slate-700 font-medium'
          }`}
      >
        <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-[#2E9BDA]/12 text-[#2E9BDA] scale-105 shadow-xs shadow-[#2E9BDA]/20' : 'text-slate-500'
          }`}>
          <Icon className="w-5 h-5" strokeWidth={isActive ? 2.3 : 1.8} />
        </div>
        <span className="text-[10px] mt-0.5 tracking-tight leading-none truncate max-w-[56px] text-center">
          {item.label}
        </span>

        {/* Active Underline Indicator Bar */}
        <span
          className={`w-6 h-[2.5px] rounded-full mt-1 transition-all duration-300 ${isActive
            ? 'bg-[#2E9BDA] shadow-[0_1px_6px_rgba(46,155,218,0.7)] scale-100 opacity-100'
            : 'bg-transparent scale-0 opacity-0'
            }`}
        />
      </NavLink>
    )
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-1 py-1 safe-area-pb"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5 items-end w-full max-w-md mx-auto">
        {/* Left Tabs (Home, Jobs) */}
        {leftItems.map(renderNavLink)}

        {/* Center Hero: CareerMitra AI Copilot (Elevated Glowing Orb) */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex flex-col items-center justify-center w-full min-w-0 -mt-3.5 py-0 select-none touch-manipulation group cursor-pointer focus:outline-none"
          aria-label={isOpen ? "Close CareerMitra AI" : "Open CareerMitra AI"}
        >
          <div className="relative">
            {/* Ambient Glow */}
            <span className={`absolute -inset-1 rounded-full bg-gradient-to-r from-[#2E9BDA] via-indigo-500 to-purple-600 transition-all duration-300 ${isOpen ? 'opacity-90 blur-md scale-110' : 'opacity-40 blur-xs group-hover:opacity-90 group-hover:blur-sm'
              }`} />

            {/* Floating Hero Orb */}
            <div className={`relative w-10 h-10 rounded-full p-[2px] transition-all duration-200 ${isOpen
              ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-600 shadow-lg shadow-indigo-500/40 scale-105'
              : 'bg-gradient-to-tr from-[#2E9BDA] via-indigo-600 to-purple-600 shadow-md shadow-indigo-500/25 group-active:scale-95'
              }`}>
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5 text-white drop-shadow-sm transition-transform group-hover:rotate-12" strokeWidth={2.2} />
              </div>
            </div>

            {/* Green Active Dot */}
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full shadow-xs" />
          </div>
          <span className={`text-[10px] font-bold mt-1 tracking-tight leading-none truncate max-w-[62px] text-center transition-colors ${isOpen ? 'text-[#2E9BDA]' : 'text-slate-700 group-hover:text-[#2E9BDA]'
            }`}>
            CareerMitra
          </span>
          <span className="w-6 h-[2.5px] rounded-full mt-1 bg-transparent" />
        </button>

        {/* Right Tab (ATS Scan / Company) */}
        {rightItems.map(renderNavLink)}

        {/* 5th Tab: Menu Drawer Trigger */}
        <button
          type="button"
          onClick={onMenuToggle}
          className={`flex flex-col items-center justify-center w-full min-w-0 py-1 rounded-xl transition-all duration-200 select-none touch-manipulation cursor-pointer ${isMenuRelatedActive
            ? 'text-[#2E9BDA] font-bold'
            : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          aria-label="Open full menu"
        >
          <div className={`p-1.5 rounded-xl transition-all duration-200 ${isMenuRelatedActive ? 'bg-[#2E9BDA]/12 text-[#2E9BDA] scale-105 shadow-xs shadow-[#2E9BDA]/20' : 'text-slate-500'
            }`}>
            <Menu className="w-5 h-5" strokeWidth={isMenuRelatedActive ? 2.3 : 1.8} />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight leading-none truncate max-w-[56px] text-center">
            Menu
          </span>
          <span
            className={`w-6 h-[2.5px] rounded-full mt-1 transition-all duration-300 ${isMenuRelatedActive
              ? 'bg-[#2E9BDA] shadow-[0_1px_6px_rgba(46,155,218,0.7)] scale-100 opacity-100'
              : 'bg-transparent scale-0 opacity-0'
              }`}
          />
        </button>
      </div>
    </nav>
  )
}
