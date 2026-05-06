/**
 * UPDATED AppLayout — Replace your existing src/components/AppLayout.jsx
 * Adds Live Interview + Gamification + Analytics to sidebar
 */
import { useState } from 'react'
import { Outlet, useLocation, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import Sidebar from './Sidebar'

const PAGE_TITLES = {
  '/dashboard': { title: 'Dashboard', sub: 'Career intelligence overview' },
  '/upload': { title: 'Resume Library', sub: 'Upload and manage your resumes' },
  '/results': { title: 'ATS Matcher', sub: 'Hybrid BERT + TF-IDF scoring' },
  '/analytics': { title: 'Analytics', sub: 'Performance trends & insights' },
  '/interview': { title: 'Quick Practice', sub: 'Fast mock interview sessions' },
  '/live-interview': { title: 'Live AI Interview', sub: 'Full session with camera & AI feedback' },
  '/interview-analytics': { title: 'Interview Analytics', sub: 'Performance breakdown & weak areas' },
  '/enhance': { title: 'AI Resume Enhancer', sub: 'LLM-powered improvements' },
  '/github': { title: 'GitHub Analysis', sub: 'Profile & contribution insights' },
  '/fake-detect': { title: 'Authenticity Check', sub: '7-factor experience verification' },
  '/gamification': { title: 'Rewards Hub', sub: 'Points, badges & leaderboard' },
  '/recruiter': { title: 'Shortlist Candidates', sub: 'JD → Top matching resumes' },
}

function Topbar({ collapsed, onMenuToggle }) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const meta = PAGE_TITLES[pathname] || { title: 'CareerAI', sub: '' }

  const handleLogout = async () => {
    await logout()
    setShowUserMenu(false)
  }

  return (
    <header className="h-14 bg-white/90 backdrop-blur-lg border-b border-slate-200 flex items-center justify-between px-5 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Show menu toggle only for candidates */}
        {user?.role !== 'recruiter' && (
          <button onClick={onMenuToggle}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        )}
        <motion.div key={pathname} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 14, color: '#0F172A', lineHeight: 1.2 }}>{meta.title}</p>
          {meta.sub && <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: '#94A3B8', letterSpacing: '0.05em', fontWeight: 500 }}>{meta.sub}</p>}
        </motion.div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Online pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: '#059669', letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>Online</span>
        </div>

        {/* User badge with dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition-colors"
          >
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}>
              {user?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="hidden md:block">
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, color: '#1E293B', lineHeight: 1.2 }}>{user?.full_name?.split(' ')[0]}</p>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: '#94A3B8', textTransform: 'capitalize', fontWeight: 500 }}>{user?.role}</p>
            </div>
          </button>

          {/* Dropdown menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">{user?.full_name}</p>
                <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2 font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuth()
  const location = useLocation()

  // Redirect recruiter to shortlist page if not already there
  if (user?.role === 'recruiter' && location.pathname !== '/recruiter') {
    return <Navigate to="/recruiter" replace />
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Hide sidebar for recruiters */}
      {user?.role !== 'recruiter' && (
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(p => !p)}/>
      )}
      <motion.div
        animate={{ marginLeft: user?.role === 'recruiter' ? 0 : (collapsed ? 68 : 252) }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex-1 flex flex-col min-w-0"
      >
        <Topbar collapsed={collapsed} onMenuToggle={() => setCollapsed(p => !p)}/>
        <main className="flex-1 p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={window.location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-7xl mx-auto"
            >
              <Outlet/>
            </motion.div>
          </AnimatePresence>
        </main>
      </motion.div>
    </div>
  )
}
