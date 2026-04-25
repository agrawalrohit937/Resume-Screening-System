/**
 * UPDATED AppLayout — Replace your existing src/components/AppLayout.jsx
 * Adds Live Interview + Gamification + Analytics to sidebar
 */
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
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
  const { user } = useAuth()
  const meta = PAGE_TITLES[pathname] || { title: 'CareerAI', sub: '' }

  return (
    <header className="h-14 bg-white/90 backdrop-blur-lg border-b border-slate-200 flex items-center justify-between px-5 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <motion.div key={pathname} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14, color: '#0F172A', lineHeight: 1.2 }}>{meta.title}</p>
          {meta.sub && <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#94A3B8', letterSpacing: '0.05em' }}>{meta.sub}</p>}
        </motion.div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Online pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#059669', letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase' }}>Online</span>
        </div>

        {/* User badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}>
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="hidden md:block">
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, color: '#1E293B', lineHeight: 1.2 }}>{user?.full_name?.split(' ')[0]}</p>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#94A3B8', textTransform: 'capitalize' }}>{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  )
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(p => !p)}/>
      <motion.div
        animate={{ marginLeft: collapsed ? 68 : 252 }}
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
