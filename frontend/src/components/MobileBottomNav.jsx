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
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-200 select-none touch-manipulation ${
                isActive
                  ? 'text-[#2E9BDA] font-bold'
                  : 'text-slate-500 hover:text-slate-700 font-medium'
              }`}
            >
              <div className={`relative p-1 rounded-xl transition-all duration-200 ${
                isActive ? 'bg-[#2E9BDA]/10 text-[#2E9BDA] scale-105' : 'text-slate-500'
              }`}>
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.3 : 1.8} />
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#2E9BDA] rounded-full" />
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight leading-none truncate max-w-[62px]">
                {item.label}
              </span>
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
          <div className="p-1 rounded-xl text-slate-500">
            <Menu className="w-5 h-5" strokeWidth={1.8} />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight leading-none text-slate-500">
            More
          </span>
        </button>
      </div>
    </nav>
  )
}
