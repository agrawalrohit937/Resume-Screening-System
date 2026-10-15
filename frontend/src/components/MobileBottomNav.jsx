import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Briefcase,
  ScanSearch,
  UserCircle,
  Menu,
  MessagesSquare,
  Building2,
  Shield,
  FolderKanban
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function MobileBottomNav({ onMenuToggle }) {
  const { user } = useAuth()
  const location = useLocation()
  const role = user?.role?.toLowerCase() || 'candidate'

  // Define tabs based on role
  let navItems = []

  if (role === 'admin') {
    navItems = [
      { to: '/admin', label: 'Admin', icon: Shield },
      { to: '/recruiter', label: 'Jobs', icon: Briefcase },
      { to: '/profile', label: 'Profile', icon: UserCircle },
    ]
  } else if (role === 'recruiter' || role === 'hiring_manager' || role === 'executive') {
    navItems = [
      { to: '/recruiter/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/recruiter/jobs', label: 'Jobs', icon: Briefcase },
      { to: '/recruiter/company', label: 'Company', icon: Building2 },
      { to: '/profile', label: 'Profile', icon: UserCircle },
    ]
  } else {
    // Default Candidate navigation (using /interview for full mobile compatibility)
    navItems = [
      { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
      { to: '/jobs', label: 'Jobs', icon: Briefcase },
      { to: '/results', label: 'ATS Scan', icon: ScanSearch },
      { to: '/interview', label: 'Mock', icon: MessagesSquare },
      { to: '/profile', label: 'Profile', icon: UserCircle },
    ]
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 safe-area-pb"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.to || (item.to !== '/dashboard' && location.pathname.startsWith(item.to))

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-200 select-none touch-manipulation relative group ${
                isActive
                  ? 'text-[#2E9BDA] font-bold'
                  : 'text-slate-500 hover:text-slate-700 font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${
                isActive ? 'bg-[#2E9BDA]/12 text-[#2E9BDA] scale-105 shadow-xs shadow-[#2E9BDA]/20' : 'text-slate-500'
              }`}>
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.3 : 1.8} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight leading-none truncate max-w-[62px]">
                {item.label}
              </span>
              
              {/* Active Underline Indicator Bar */}
              <span
                className={`w-8 h-[3px] rounded-full mt-1.5 transition-all duration-300 ${
                  isActive
                    ? 'bg-[#2E9BDA] shadow-[0_1px_8px_rgba(46,155,218,0.85)] scale-100 opacity-100'
                    : 'bg-transparent scale-0 opacity-0'
                }`}
              />
            </NavLink>
          )
        })}

        {/* More Menu Drawer Trigger */}
        <button
          type="button"
          onClick={onMenuToggle}
          className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-slate-500 hover:text-slate-800 transition-all duration-200 select-none touch-manipulation cursor-pointer"
          aria-label="Open full menu"
        >
          <div className="p-1.5 rounded-xl text-slate-500">
            <Menu className="w-5 h-5" strokeWidth={1.8} />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight leading-none text-slate-500">
            More
          </span>
          <span className="w-8 h-[3px] rounded-full mt-1.5 bg-transparent" />
        </button>
      </div>
    </nav>
  )
}
