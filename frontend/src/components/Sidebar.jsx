import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

// ── Icons ────────────────────────────────────────────────────────────────────
const Icons = {
  dashboard: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  upload: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  ats: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M8 11h6M11 8v6"/></svg>,
  analytics: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
  liveInterview: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>,
  interview: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>,
  enhance: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>,

  gamification: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>,
  interviewAnalytics: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
}

// ── Navigation sections (routes matching App.jsx) ───────────────────────────
const NAV_SECTIONS = [
  {
    title: 'OVERVIEW',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: Icons.dashboard },
    ],
  },
  {
    title: 'RESUME TOOLS',
    items: [
      { to: '/results', label: 'ATS Matcher', icon: Icons.ats },
    ],
  },
  {
    title: 'AI INTERVIEW',
    items: [
      { to: '/live-interview-v2', label: 'Live Interview', badge: 'NEW', icon: Icons.liveInterview },
      { to: '/interview', label: 'Quick Practice', icon: Icons.interview },
      { to: '/interview-analytics', label: 'Interview Stats', icon: Icons.interviewAnalytics },
    ],
  },
  {
    title: 'INSIGHTS',
    items: [
      { to: '/analytics', label: 'Analytics', icon: Icons.analytics },
    ],
  },
  {
    title: 'REWARDS',
    items: [
      { to: '/gamification', label: 'Badges & Points', badgeIcon: '🏆', icon: Icons.gamification },
    ],
  },
  {
    title: 'RECRUITER',
    items: [
      { to: '/recruiter', label: 'Shortlist', icon: Icons.ats },
    ],
  },
]

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth()
  const location = useLocation()

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 260 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed left-0 top-0 h-full bg-white border-r border-slate-100 flex flex-col z-40 shadow-sm overflow-hidden"
    >
      {/* ── Logo Header ── */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100 min-h-[60px] shrink-0">
        <div className="w-8 h-8 rounded-[10px] bg-[#2563EB] flex items-center justify-center text-white font-bold text-lg shrink-0">
          c
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <p className="font-bold text-slate-900 text-xl tracking-tight">
                Career<span className="text-[#2563EB]">AI</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Navigation List ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3 scrollbar-thin">
        {NAV_SECTIONS.map((section, idx) => (
          <div key={idx}>
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]"
                >
                  {section.title}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location.pathname === item.to || (item.to === '/dashboard' && location.pathname === '/')
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-2.5 py-2.5 rounded-[12px] text-[13px] font-semibold transition-all duration-150 relative
                      ${collapsed ? 'justify-center' : ''}
                      ${isActive
                        ? 'bg-[#EEF2FF] text-[#2563EB]'
                        : 'text-[#64748B] hover:bg-slate-50 hover:text-slate-900'
                      }`}
                  >
                    <span className={`shrink-0 transition-colors ${isActive ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`}>
                      {item.icon}
                    </span>
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="truncate flex-1"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* Badge */}
                    {!collapsed && item.badge && (
                      <span className="bg-[#DBEAFE] text-[#2563EB] text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest shrink-0">
                        {item.badge}
                      </span>
                    )}
                    {!collapsed && item.badgeIcon && (
                      <span className="text-sm shrink-0">{item.badgeIcon}</span>
                    )}

                    {/* Active indicator bar */}
                    {isActive && !collapsed && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#2563EB] rounded-l-full"
                      />
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}

        {/* ── Premium Upgrade Card ── */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-6 px-2 pb-4"
            >
              <div className="bg-[#F8FAFC] rounded-2xl p-5 text-center relative overflow-hidden flex flex-col items-center">
                <div className="w-full h-24 mb-2 flex items-center justify-center relative z-10">
                  <img src="/illustration.png" alt="Upgrade" className="object-contain h-full" />
                </div>
                <h4 className="font-bold text-slate-800 text-[13px] mb-1.5 relative z-10">Unlock Full Potential</h4>
                <p className="text-[11px] text-slate-500 mb-4 leading-relaxed relative z-10 px-1">
                  Go Premium for AI insights, unlimited checks, and more.
                </p>
                <button className="w-full bg-[#2563EB] text-white rounded-[10px] py-2.5 text-[12px] font-bold shadow-md shadow-blue-200 hover:bg-blue-700 transition-colors flex justify-center items-center gap-2 relative z-10">
                  <span className="text-sm">👑</span> Upgrade Now
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── User + Logout ── */}
      <div className="border-t border-slate-100 p-3 shrink-0">
        <div className={`flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer group transition-colors ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-900 truncate">{user?.full_name}</p>
                <p className="text-[9px] text-slate-400 capitalize">{user?.role}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && (
            <button onClick={logout}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-rose-50 hover:text-rose-500 text-slate-300">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Toggle handle ── */}
      <button onClick={onToggle}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-[#2563EB] hover:border-blue-200 transition-all z-10">
        <svg className={`w-3 h-3 transition-transform duration-200 ${collapsed ? 'rotate-0' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
    </motion.aside>
  )
}

